import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { FieldIssue, LlmExtractionService } from '../extraction/llm-extraction.service';
import { ExtractionValidationService } from '../validation/extraction-validation.service';
import { AI_PROVIDER, AiProvider } from '../gateway/ai-provider.interface';
import { AiDirection, AiDocumentStatus, AiSuggestionStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { DomainException } from '../../common/errors/domain.exception';
import type { Actor, OrgContext } from '../../common/types/request-context.types';
import { InvoicesService } from '../../invoices/invoices.service';
import type { CreateInvoiceDto } from '../../invoices/dto/invoice.dto';
import { BillsService } from '../../bills/bills.service';
import type { CreateBillDto } from '../../bills/dto/bill.dto';
import { BusinessContextService } from '../business-context/business-context.service';
import { HeuristicLlmProvider } from '../providers/heuristic-llm.provider';
import { RawExtractionResult } from '../providers/llm-provider.interface';
import { DocumentClassifierService } from './document-classifier.service';
import { EntityMatchResult, EntityResolutionService } from './entity-resolution.service';
import { DirectionFallbackService } from './direction-fallback.service';
import { CodingSuggestionService, LineCoding } from '../coding/coding-suggestion.service';
import { TransactionDirectionService } from './transaction-direction.service';
import { LineClassificationService, ClassifiedLineResult } from './line-classification.service';
import { AccountingClassificationService, ProposedAccountingIntent } from './accounting-classification.service';
import { ConfidenceService } from './confidence.service';
import { AccountingSafetyService } from '../guardrails/accounting-safety.service';
import { AiAuditService } from '../audit/ai-audit.service';
import { AiFeedbackService } from '../feedback/ai-feedback.service';

export interface ProcessDocumentOptions {
  buffer?: Buffer;
  text?: string;
}

/** A contact the reviewer may create for an unmatched counterparty. Never created automatically. */
export interface ProposedContact {
  type: 'SUPPLIER' | 'CUSTOMER';
  name: string;
  vatNumber?: string;
  companyNumber?: string;
  address?: string;
}

export interface SuggestionPayload {
  extraction: RawExtractionResult;
  direction: AiDirection;
  entity: { id: string; name: string } | null;
  lines: ClassifiedLineResult[];
  accountingIntent: ProposedAccountingIntent | null;
  /** Per-line account / tax code suggestion with its source and reason. */
  coding?: LineCoding[];
  counterpartyMatch?: Pick<EntityMatchResult, 'matchType' | 'confidence' | 'reason' | 'candidates'> | null;
  proposedContact?: ProposedContact | null;
}

const decimalOrNull = (v: string | null | undefined) => (v === null || v === undefined ? null : new Prisma.Decimal(v));

/**
 * Document analysis (run by the document.analyse job): extract fields -> identify direction and
 * parties -> classify -> propose. Status moves AI_EXTRACTED -> VALIDATED -> AWAITING_REVIEW.
 * It only ever produces a suggestion for human review. Nothing is drafted or approved
 * automatically, and nothing missing from the document is filled in.
 */
@Injectable()
export class DocumentIntelligenceService {
  constructor(
    private readonly db: PrismaService,
    private readonly businessContext: BusinessContextService,
    private readonly llmProvider: HeuristicLlmProvider,
    private readonly classifier: DocumentClassifierService,
    private readonly entityResolver: EntityResolutionService,
    private readonly directionResolver: TransactionDirectionService,
    private readonly lineClassifier: LineClassificationService,
    private readonly accountingClassifier: AccountingClassificationService,
    private readonly confidenceService: ConfidenceService,
    private readonly safety: AccountingSafetyService,
    private readonly audit: AiAuditService,
    private readonly feedback: AiFeedbackService,
    private readonly invoices: InvoicesService,
    private readonly llmExtraction: LlmExtractionService,
    private readonly validator: ExtractionValidationService,
    private readonly directionFallback: DirectionFallbackService,
    private readonly coding: CodingSuggestionService,
    private readonly bills: BillsService,
    @Optional() @Inject(AI_PROVIDER) private readonly aiProvider: AiProvider | null,
  ) {}

  async processDocument(organizationId: string, documentId: string, options?: ProcessDocumentOptions) {
    const doc = await this.db.aiDocument.findFirst({
      where: { organizationId, id: documentId },
      include: { organization: true },
    });
    if (!doc) {
      throw new NotFoundException(`Document ${documentId} not found for this organisation.`);
    }
    await this.assertAiEnabled(organizationId);

    // Re-runnable: discard anything a previous, interrupted attempt wrote for this document.
    await this.db.transaction(async (tx) => {
      await tx.aiSuggestion.deleteMany({ where: { organizationId, documentId } });
      await tx.aiLineClassification.deleteMany({ where: { organizationId, documentId } });
      await tx.aiClassification.deleteMany({ where: { organizationId, documentId } });
      await tx.aiExtraction.deleteMany({ where: { organizationId, documentId } });
    });

    await this.audit.logEvent(organizationId, documentId, 'REQUESTED', doc.createdById);

    // 1. Extraction: only what the document states. With an AI provider the model reads the text
    //    and code verifies every value against it; otherwise the rule-based extractor runs.
    const text = doc.extractedText ?? options?.text ?? '';
    const organisation = {
      name: doc.organization.name,
      legalName: doc.organization.legalName,
      taxNumber: doc.organization.taxNumber,
      registrationNumber: doc.organization.registrationNumber,
    };
    let extraction: RawExtractionResult;
    let modelVersion: string;
    let rawStructuredData: Record<string, unknown>;
    if (this.aiProvider) {
      const llm = await this.llmExtraction.extract({ organizationId, userId: doc.createdById, documentId, text, organisation });
      extraction = llm.result;
      modelVersion = `${llm.promptKey}@v${llm.promptVersion}`;
      rawStructuredData = { extractor: 'llm', result: llm.result, verificationIssues: llm.issues, modelOutput: llm.modelOutput };
    } else {
      extraction = await this.llmProvider.extractDocumentData({
        buffer: options?.buffer ?? Buffer.from(text, 'utf8'),
        fileName: doc.fileName,
        mimeType: doc.mimeType,
        text,
      });
      modelVersion = 'blynt-rules-v2';
      rawStructuredData = { extractor: 'rules', result: extraction, verificationIssues: [] };
    }

    const extractionRow = await this.db.aiExtraction.create({
      data: {
        organizationId,
        documentId,
        invoiceNumber: extraction.invoiceNumber ?? null,
        invoiceDate: extraction.invoiceDate ? new Date(extraction.invoiceDate) : null,
        dueDate: extraction.dueDate ? new Date(extraction.dueDate) : null,
        currency: extraction.currency ?? null,
        issuerName: extraction.issuer?.name ?? null,
        issuerTaxId: extraction.issuer?.vatNumber ?? null,
        issuerAddress: extraction.issuer?.address ?? null,
        recipientName: extraction.recipient?.name ?? null,
        recipientTaxId: extraction.recipient?.vatNumber ?? null,
        recipientAddress: extraction.recipient?.address ?? null,
        subtotal: decimalOrNull(extraction.subtotal),
        taxAmount: decimalOrNull(extraction.vatTotal),
        totalAmount: decimalOrNull(extraction.total),
        rawStructuredData: rawStructuredData as unknown as Prisma.InputJsonValue,
        modelVersion,
      },
    });
    await this.setStatus(documentId, AiDocumentStatus.AI_EXTRACTED);
    await this.audit.logEvent(organizationId, documentId, 'EXTRACTED', doc.createdById, {
      invoiceNumber: extraction.invoiceNumber ?? null,
      total: extraction.total ?? null,
    });

    // 2. Parties and direction (organisation identity first; UNKNOWN when inconclusive)
    const [issuerMatch, recipientMatch] = await Promise.all([
      this.entityResolver.resolveEntity(organizationId, extraction.issuer, 'SUPPLIER'),
      this.entityResolver.resolveEntity(organizationId, extraction.recipient, 'CUSTOMER'),
    ]);
    // Rules first; the model is asked only when the rules have nothing to go on.
    const directionResult = await this.directionFallback.decide({
      organizationId,
      userId: doc.createdById,
      documentId,
      text,
      organisation,
      rules: this.directionResolver.resolveDirection(extraction, organisation, issuerMatch, recipientMatch),
    });
    const direction = directionResult.direction;
    const counterparty =
      direction === AiDirection.PURCHASE ? issuerMatch : direction === AiDirection.SALE ? recipientMatch : null;
    const targetEntity = counterparty?.contact ?? null;

    const docClassification = this.classifier.classify(extraction, direction);
    await this.db.aiClassification.create({
      data: {
        organizationId,
        documentId,
        direction,
        entityType: direction === AiDirection.PURCHASE ? 'SUPPLIER' : direction === AiDirection.SALE ? 'CUSTOMER' : 'UNKNOWN',
        entityId: targetEntity?.id ?? null,
        entityMatchReason: counterparty?.reason ?? null,
        classification: docClassification.documentType,
        confidenceScore: new Prisma.Decimal(directionResult.confidence),
        reasoning: directionResult.reasoning,
      },
    });
    await this.audit.logEvent(organizationId, documentId, 'CLASSIFIED', doc.createdById, {
      direction,
      basis: directionResult.basis,
      documentType: docClassification.documentType,
      matchedEntity: targetEntity?.name ?? null,
    });

    // 3. Lines and accounting proposal (only once direction is known)
    const businessProfile = await this.businessContext.getProfile(organizationId);
    const lines = await this.lineClassifier.classifyLines(
      organizationId,
      extraction.lines,
      direction,
      businessProfile,
      targetEntity?.id,
      { subtotal: extraction.subtotal, vatTotal: extraction.vatTotal },
    );
    // Account and tax code per line: counterparty history, then rules, then the model (own lists only).
    const coding =
      direction === AiDirection.UNKNOWN
        ? []
        : await this.coding.suggest({
            organizationId,
            userId: doc.createdById,
            documentId,
            direction: direction === AiDirection.PURCHASE ? 'PURCHASE' : 'SALE',
            contactId: targetEntity?.id ?? null,
            contactName: targetEntity?.name ?? null,
            lines,
            postingDate: extraction.invoiceDate ? new Date(extraction.invoiceDate) : null,
            business: [businessProfile.industry && `industry ${businessProfile.industry}`].filter(Boolean).join(', ') || undefined,
          });
    for (const c of coding) {
      const line = lines.find((l) => l.lineNumber === c.lineNumber);
      if (line) line.taxClassification = c.taxCode;
    }
    const intent =
      direction === AiDirection.UNKNOWN
        ? null
        : await this.accountingClassifier.buildAccountingIntent(
            organizationId,
            direction === AiDirection.PURCHASE ? 'PURCHASE' : 'SALE',
            lines,
            targetEntity,
            new Map(coding.map((c) => [c.lineNumber, c.accountId])),
          );

    for (const line of lines) {
      const proposed = intent?.lines.find((l) => l.sourceLineNumber === line.lineNumber);
      const lineCoding = coding.find((c) => c.lineNumber === line.lineNumber);
      await this.db.aiLineClassification.create({
        data: {
          organizationId,
          documentId,
          lineNumber: line.lineNumber,
          rawDescription: line.description.slice(0, 255),
          quantity: decimalOrNull(line.quantity),
          unit: line.unit,
          unitPrice: decimalOrNull(line.unitPrice),
          netAmount: decimalOrNull(line.netAmount),
          taxAmount: decimalOrNull(line.taxAmount),
          totalAmount: decimalOrNull(line.totalAmount),
          productType: line.productType,
          productClassification: line.productClassification,
          taxClassification: line.taxClassification,
          accountingCategory: line.accountingCategory,
          resolvedAccountId: proposed?.accountId ?? null,
          suggestedTaxCodeId: lineCoding?.taxCodeId ?? null,
          accountSource: lineCoding?.accountSource ?? null,
          taxSource: lineCoding?.taxSource ?? null,
          codingReason: lineCoding?.reason.slice(0, 1000) ?? null,
          confidenceScore: new Prisma.Decimal(line.confidence),
        },
      });
    }

    // 4. Confidence (orders the review queue only) and safety check of complete proposals
    const confidence = this.confidenceService.evaluate(
      counterparty ?? { contact: null, matchType: 'NONE', confidence: 0, reason: '' },
      directionResult,
      lines,
      intent,
    );
    if (intent?.isComplete) {
      await this.safety.validateAccountingSafety(organizationId, intent, targetEntity?.id);
    }

    // Field-level validation: report each value as verified / inconsistent / missing. Values are never changed.
    const validation = await this.validator.validate({
      organizationId,
      documentId,
      extraction,
      baseCurrency: doc.organization.baseCurrency,
      verificationIssues: (rawStructuredData.verificationIssues as FieldIssue[]) ?? [],
      issuerContactId: issuerMatch.contact?.id ?? null,
    });
    await this.db.aiExtraction.update({
      where: { id: extractionRow.id },
      data: { validation: validation as unknown as Prisma.InputJsonValue, isConsistent: validation.consistent },
    });
    await this.setStatus(documentId, AiDocumentStatus.VALIDATED);
    await this.audit.logEvent(organizationId, documentId, 'VALIDATED', doc.createdById, {
      consistent: validation.consistent,
      summary: validation.summary,
      rules: validation.findings.map((f) => f.rule),
    });

    const counterpartyParty =
      direction === AiDirection.PURCHASE ? extraction.issuer : direction === AiDirection.SALE ? extraction.recipient : undefined;
    const payload: SuggestionPayload = {
      extraction,
      direction,
      entity: targetEntity ? { id: targetEntity.id, name: targetEntity.name } : null,
      lines,
      accountingIntent: intent,
      coding,
      counterpartyMatch: counterparty
        ? { matchType: counterparty.matchType, confidence: counterparty.confidence, reason: counterparty.reason, candidates: counterparty.candidates }
        : null,
      // Unmatched counterparty: propose a contact from the document's own details (reviewer decides).
      proposedContact:
        !targetEntity && counterpartyParty?.name
          ? {
              type: direction === AiDirection.PURCHASE ? 'SUPPLIER' : 'CUSTOMER',
              name: counterpartyParty.name,
              ...(counterpartyParty.vatNumber ? { vatNumber: counterpartyParty.vatNumber } : {}),
              ...(counterpartyParty.companyNumber ? { companyNumber: counterpartyParty.companyNumber } : {}),
              ...(counterpartyParty.address ? { address: counterpartyParty.address } : {}),
            }
          : null,
    };
    const suggestion = await this.db.aiSuggestion.create({
      data: {
        organizationId,
        documentId,
        suggestionType:
          direction === AiDirection.PURCHASE
            ? 'PURCHASE_BILL_DRAFT'
            : direction === AiDirection.SALE
              ? 'SALES_INVOICE_DRAFT'
              : 'UNCLASSIFIED_DOCUMENT',
        payload: {
          ...payload,
          documentType: docClassification.documentType,
          confidence,
          validation: { consistent: validation.consistent, summary: validation.summary, findings: validation.findings },
        } as unknown as Prisma.InputJsonValue,
        confidenceScore: new Prisma.Decimal(confidence.score),
        confidenceLevel: confidence.level,
        status: AiSuggestionStatus.PENDING_REVIEW,
      },
    });
    await this.audit.logEvent(organizationId, documentId, 'SUGGESTED', doc.createdById, {
      suggestionId: suggestion.id,
      confidenceLevel: confidence.level,
      missing: intent?.missing ?? ['direction'],
    });

    return this.db.aiDocument.update({
      where: { id: documentId },
      data: {
        documentType: docClassification.documentType,
        direction,
        // Every suggestion waits for a person, whatever its confidence.
        status: AiDocumentStatus.AWAITING_REVIEW,
        confidenceScore: new Prisma.Decimal(confidence.score),
        confidenceLevel: confidence.level,
        processedAt: new Date(),
      },
      include: { extractions: true, classifications: true, lineClassifications: true, suggestions: true },
    });
  }

  private async setStatus(documentId: string, status: AiDocumentStatus): Promise<void> {
    await this.db.aiDocument.update({ where: { id: documentId }, data: { status } });
  }

  async assertAiEnabled(organizationId: string): Promise<void> {
    const org = await this.db.organization.findUnique({ where: { id: organizationId }, select: { aiEnabled: true } });
    if (!org?.aiEnabled) {
      throw new DomainException('AI_DISABLED', 'AI features are switched off for this organisation');
    }
  }

  // --- Human review ---

  /**
   * A person approves a suggestion. Sales documents become a DRAFT sales invoice built through
   * InvoicesService (which does all arithmetic). Purchases are refused until supplier bills exist,
   * so a purchase can never be turned into a sales invoice.
   */
  async approveSuggestion(
    organizationId: string,
    documentId: string,
    orgContext: OrgContext,
    actor: Actor,
    targetContactId?: string,
    accountOverrides: Map<number, string> = new Map(),
  ) {
    const suggestion = await this.findPending(organizationId, documentId);
    const payload = suggestion.payload as unknown as SuggestionPayload;

    if (payload.direction === AiDirection.UNKNOWN) {
      throw new DomainException('AI_DIRECTION_UNRESOLVED', 'Sales or purchase could not be determined; nothing was created.');
    }
    const contactId = targetContactId ?? payload.entity?.id;
    if (!contactId) {
      throw new BadRequestException(
        `A ${payload.direction === AiDirection.PURCHASE ? 'supplier' : 'customer'} must be chosen to approve this draft.`,
      );
    }
    if (payload.direction === AiDirection.PURCHASE) {
      // A purchase only ever becomes a DRAFT supplier bill; posting needs bill.approve.
      return this.approveAsBill(organizationId, documentId, suggestion.id, payload, contactId, accountOverrides, orgContext, actor);
    }
    const contact = await this.db.contact.findFirst({ where: { organizationId, id: contactId, status: 'ACTIVE' } });
    if (!contact) {
      throw new BadRequestException('Designated contact is inactive, archived, or not found in this organisation.');
    }

    const dto = await this.buildSalesInvoiceDto(payload, contact.id, accountOverrides);

    if (payload.extraction.invoiceNumber) {
      const duplicate = await this.db.invoice.findFirst({
        where: { organizationId, contactId: contact.id, reference: payload.extraction.invoiceNumber },
        select: { id: true, invoiceNumber: true },
      });
      if (duplicate) {
        throw new DomainException(
          'AI_DUPLICATE_DOCUMENT',
          `Document ${payload.extraction.invoiceNumber} was already recorded as invoice ${duplicate.invoiceNumber}.`,
          { invoiceId: duplicate.id },
        );
      }
    }

    const invoice = await this.invoices.createInvoice(organizationId, dto, orgContext, actor);

    await this.db.aiSuggestion.update({
      where: { id: suggestion.id },
      data: {
        status: AiSuggestionStatus.APPROVED,
        reviewedById: actor.userId,
        reviewedAt: new Date(),
        resultingInvoiceId: invoice.id,
      },
    });
    await this.db.aiDocument.update({ where: { id: documentId }, data: { status: AiDocumentStatus.DRAFT_CREATED } });
    await this.audit.logEvent(organizationId, documentId, 'APPROVED', actor.userId ?? undefined, {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      contactId: contact.id,
    });

    return { success: true, documentId, suggestionId: suggestion.id, invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber };
  }

  private async approveAsBill(
    organizationId: string,
    documentId: string,
    suggestionId: string,
    payload: SuggestionPayload,
    contactId: string,
    accountOverrides: Map<number, string>,
    orgContext: OrgContext,
    actor: Actor,
  ) {
    const { extraction, lines } = payload;
    const missing: string[] = [];
    if (!extraction.invoiceNumber) missing.push("supplier's invoice number");
    if (!extraction.invoiceDate) missing.push('invoice date');
    if (!extraction.currency) missing.push('currency');
    if (lines.length === 0) missing.push('line items');

    const coded = new Map((payload.coding ?? []).map((c) => [c.lineNumber, c]));
    const taxIds = new Map(
      (await this.db.taxCode.findMany({ where: { code: { in: lines.map((l) => l.taxClassification).filter((c): c is string => !!c) } }, select: { id: true, code: true } })).map(
        (t) => [t.code, t.id],
      ),
    );
    const billLines = lines.map((line) => {
      const label = `line ${line.lineNumber}`;
      const accountId =
        accountOverrides.get(line.lineNumber) ??
        coded.get(line.lineNumber)?.accountId ??
        payload.accountingIntent?.lines.find((l) => l.sourceLineNumber === line.lineNumber)?.accountId ??
        null;
      const taxCodeId = coded.get(line.lineNumber)?.taxCodeId ?? (line.taxClassification ? taxIds.get(line.taxClassification) : undefined) ?? null;
      if (!accountId) missing.push(`${label}: account`);
      if (!taxCodeId) missing.push(`${label}: tax code`);
      if (line.netAmount === null && (line.quantity === null || line.unitPrice === null)) missing.push(`${label}: amount`);
      return {
        accountId: accountId ?? '',
        description: line.description,
        ...(line.quantity !== null && line.unitPrice !== null ? { quantity: line.quantity, unitPrice: line.unitPrice } : {}),
        ...(line.netAmount !== null ? { netAmount: line.netAmount } : {}),
        taxCodeId: taxCodeId ?? undefined,
      };
    });
    if (missing.length > 0) {
      throw new DomainException('AI_DRAFT_INCOMPLETE', `The document is missing: ${missing.join('; ')}`, { missing });
    }

    const duplicate = await this.db.bill.findFirst({
      where: { organizationId, contactId, status: { not: 'VOIDED' }, supplierInvoiceNumber: { equals: extraction.invoiceNumber!, mode: 'insensitive' } },
      select: { id: true, billNumber: true },
    });
    if (duplicate) {
      throw new DomainException('AI_DUPLICATE_DOCUMENT', `Supplier invoice ${extraction.invoiceNumber} is already bill ${duplicate.billNumber}.`, {
        billId: duplicate.id,
      });
    }

    return this.db.transaction(async (tx) => {
      const bill = await this.bills.create(
        organizationId,
        {
          contactId,
          supplierInvoiceNumber: extraction.invoiceNumber!,
          issueDate: extraction.invoiceDate!,
          dueDate: extraction.dueDate,
          currency: extraction.currency!,
          sourceDocumentId: documentId,
          lines: billLines,
        } as CreateBillDto,
        orgContext,
        actor,
        tx,
      );
      await tx.aiSuggestion.update({
        where: { id: suggestionId },
        data: { status: AiSuggestionStatus.APPROVED, reviewedById: actor.userId, reviewedAt: new Date(), resultingBillId: bill.id },
      });
      await tx.aiDocument.update({ where: { id: documentId }, data: { status: AiDocumentStatus.DRAFT_CREATED } });
      await this.audit.logEvent(organizationId, documentId, 'APPROVED', actor.userId ?? undefined, { billId: bill.id, billNumber: bill.billNumber, contactId });
      return { success: true, documentId, suggestionId, billId: bill.id, billNumber: bill.billNumber, warnings: bill.warnings };
    });
  }

  async editAndApproveSuggestion(
    organizationId: string,
    documentId: string,
    orgContext: OrgContext,
    actor: Actor,
    modifications: {
      contactId: string;
      lines: Array<{ lineNumber: number; description: string; accountId: string; productClassification?: string }>;
      notes?: string;
    },
  ) {
    const suggestion = await this.findPending(organizationId, documentId);
    const originalLines = (suggestion.payload as unknown as SuggestionPayload).lines ?? [];

    for (const mod of modifications.lines) {
      const orig = originalLines.find((ol) => ol.lineNumber === mod.lineNumber);
      if (orig && mod.productClassification && mod.productClassification !== orig.productClassification) {
        await this.feedback.recordFeedback({
          organizationId,
          suggestionId: suggestion.id,
          supplierOrCustomerId: modifications.contactId,
          productPattern: mod.description || orig.description,
          originalClassification: orig.productClassification,
          correctedClassification: mod.productClassification,
          correctedAccountId: mod.accountId,
          correctedById: actor.userId!,
        });
        await this.audit.logEvent(organizationId, documentId, 'CORRECTED', actor.userId ?? undefined, {
          product: mod.description || orig.description,
          from: orig.productClassification,
          to: mod.productClassification,
        });
      }
    }

    const overrides = new Map(modifications.lines.map((l) => [l.lineNumber, l.accountId]));
    return this.approveSuggestion(organizationId, documentId, orgContext, actor, modifications.contactId, overrides);
  }

  async rejectSuggestion(organizationId: string, documentId: string, reviewedById: string, reason: string) {
    const suggestion = await this.findPending(organizationId, documentId);
    await this.db.aiSuggestion.update({
      where: { id: suggestion.id },
      data: { status: AiSuggestionStatus.REJECTED, reviewedById, reviewedAt: new Date(), reviewNote: reason },
    });
    await this.db.aiDocument.update({ where: { id: documentId }, data: { status: AiDocumentStatus.REJECTED } });
    await this.audit.logEvent(organizationId, documentId, 'REJECTED', reviewedById, { reason });
    return { success: true, documentId, suggestionId: suggestion.id };
  }

  // --- Queries ---

  async listDocuments(organizationId: string) {
    return this.db.aiDocument.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      include: { suggestions: { select: { id: true, status: true, confidenceLevel: true, confidenceScore: true } } },
    });
  }

  async getDocument(organizationId: string, documentId: string) {
    const doc = await this.db.aiDocument.findFirst({
      where: { organizationId, id: documentId },
      include: {
        extractions: true,
        classifications: true,
        lineClassifications: {
          include: {
            account: { select: { id: true, code: true, name: true } },
            suggestedTaxCode: { select: { id: true, code: true, name: true } },
          },
          orderBy: { lineNumber: 'asc' },
        },
        suggestions: true,
        auditEvents: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!doc) throw new NotFoundException(`Document ${documentId} not found.`);
    return doc;
  }

  private async findPending(organizationId: string, documentId: string) {
    const suggestion = await this.db.aiSuggestion.findFirst({
      where: { organizationId, documentId, status: AiSuggestionStatus.PENDING_REVIEW },
    });
    if (!suggestion) throw new NotFoundException('No pending AI suggestion found for this document.');
    return suggestion;
  }

  /** Builds a sales invoice request purely from what the document and reviewer supplied; refuses if anything is missing. */
  private async buildSalesInvoiceDto(
    payload: SuggestionPayload,
    contactId: string,
    accountOverrides: Map<number, string>,
  ): Promise<CreateInvoiceDto> {
    const { extraction, lines, accountingIntent } = payload;
    const missing: string[] = [];
    if (!extraction.invoiceDate) missing.push('invoice date');
    if (!extraction.dueDate) missing.push('due date');
    if (!extraction.currency) missing.push('currency');
    if (lines.length === 0) missing.push('line items');

    const codes = await this.db.taxCode.findMany({
      where: { code: { in: lines.map((l) => l.taxClassification).filter((c): c is string => !!c) } },
      select: { id: true, code: true },
    });
    const codeIds = new Map(codes.map((c) => [c.code, c.id]));

    const dtoLines = lines.map((line) => {
      const label = `line ${line.lineNumber}`;
      const accountId =
        accountOverrides.get(line.lineNumber) ??
        accountingIntent?.lines.find((l) => l.sourceLineNumber === line.lineNumber)?.accountId ??
        null;
      const taxCodeId = line.taxClassification ? codeIds.get(line.taxClassification) : undefined;
      if (!accountId) missing.push(`${label}: account`);
      if (!taxCodeId) missing.push(`${label}: tax code`);
      if (line.quantity === null) missing.push(`${label}: quantity`);
      if (line.unitPrice === null) missing.push(`${label}: unit price`);
      return {
        accountId: accountId ?? '',
        description: line.description,
        quantity: line.quantity ?? '',
        unitPrice: line.unitPrice ?? '',
        taxCodeId,
      };
    });

    if (missing.length > 0) {
      throw new DomainException('AI_DRAFT_INCOMPLETE', `The document is missing: ${missing.join('; ')}`, { missing });
    }

    return {
      contactId,
      issueDate: extraction.invoiceDate!,
      dueDate: extraction.dueDate!,
      currency: extraction.currency!,
      reference: extraction.invoiceNumber,
      lines: dtoLines,
    } as CreateInvoiceDto;
  }
}
