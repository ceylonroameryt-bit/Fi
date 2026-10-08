import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { StorageService } from '../../common/storage/storage.service';
import { MoneyService } from '../../accounting-engine/money.service';
import { BusinessContextService } from '../business-context/business-context.service';
import { HeuristicLlmProvider } from '../providers/heuristic-llm.provider';
import { RawExtractionResult } from '../providers/llm-provider.interface';
import { DocumentClassifierService } from './document-classifier.service';
import { EntityResolutionService } from './entity-resolution.service';
import { TransactionDirectionService } from './transaction-direction.service';
import { LineClassificationService, ClassifiedLineResult } from './line-classification.service';
import { TaxClassificationService } from './tax-classification.service';
import {
  AccountingClassificationService,
  ProposedAccountingIntent,
} from './accounting-classification.service';
import { ConfidenceService } from './confidence.service';
import { AccountingSafetyService } from '../guardrails/accounting-safety.service';
import { AiActionPolicyService } from '../guardrails/ai-action-policy.service';
import { AiAuditService } from '../audit/ai-audit.service';
import { AiFeedbackService } from '../feedback/ai-feedback.service';
import { AiDirection, AiDocumentStatus, AiSuggestionStatus, InvoiceStatus, Prisma } from '@prisma/client';

export interface ProcessDocumentOptions {
  buffer?: Buffer;
  text?: string;
  autoDraftIfHighConfidence?: boolean;
}

@Injectable()
export class DocumentIntelligenceService {
  private readonly logger = new Logger(DocumentIntelligenceService.name);

  constructor(
    private readonly db: PrismaService,
    private readonly storage: StorageService,
    private readonly money: MoneyService,
    private readonly businessContext: BusinessContextService,
    private readonly llmProvider: HeuristicLlmProvider,
    private readonly classifier: DocumentClassifierService,
    private readonly entityResolver: EntityResolutionService,
    private readonly directionResolver: TransactionDirectionService,
    private readonly lineClassifier: LineClassificationService,
    private readonly taxClassifier: TaxClassificationService,
    private readonly accountingClassifier: AccountingClassificationService,
    private readonly confidenceService: ConfidenceService,
    private readonly safety: AccountingSafetyService,
    private readonly policy: AiActionPolicyService,
    private readonly audit: AiAuditService,
    private readonly feedback: AiFeedbackService,
  ) {}

  async processDocument(organizationId: string, documentId: string, options?: ProcessDocumentOptions) {
    const doc = await this.db.aiDocument.findFirst({
      where: { organizationId, id: documentId },
      include: { organization: true },
    });

    if (!doc) {
      throw new NotFoundException(`Document ${documentId} not found for this organisation.`);
    }

    try {
      await this.audit.logEvent(organizationId, documentId, 'REQUESTED', doc.createdById);

      // 1. Retrieve file content
      let fileBuffer = options?.buffer;
      if (!fileBuffer && doc.fileKey) {
        try {
          const res = await this.storage.getObject(doc.fileKey);
          fileBuffer = res.body;
        } catch {
          this.logger.warn(
            `Storage object ${doc.fileKey} not found; utilizing plain text fallback if available.`,
          );
        }
      }

      // 2. OCR / Extraction Step
      const extractionResult = await this.llmProvider.extractDocumentData({
        buffer: fileBuffer ?? Buffer.from(options?.text ?? ''),
        fileName: doc.fileName,
        mimeType: doc.mimeType,
        text: options?.text,
      });

      // Save extraction to database
      await this.db.aiExtraction.create({
        data: {
          organizationId,
          documentId,
          invoiceNumber: extractionResult.invoiceNumber,
          invoiceDate: extractionResult.invoiceDate ? new Date(extractionResult.invoiceDate) : null,
          dueDate: extractionResult.dueDate ? new Date(extractionResult.dueDate) : null,
          currency: extractionResult.currency ?? doc.organization.baseCurrency,
          issuerName: extractionResult.issuer?.name,
          issuerTaxId: extractionResult.issuer?.vatNumber,
          issuerAddress: extractionResult.issuer?.address,
          recipientName: extractionResult.recipient?.name,
          recipientTaxId: extractionResult.recipient?.vatNumber,
          recipientAddress: extractionResult.recipient?.address,
          subtotal: extractionResult.subtotal ? new Prisma.Decimal(extractionResult.subtotal) : null,
          taxAmount: extractionResult.vatTotal ? new Prisma.Decimal(extractionResult.vatTotal) : null,
          totalAmount: extractionResult.total ? new Prisma.Decimal(extractionResult.total) : null,
          rawStructuredData: extractionResult as unknown as Prisma.InputJsonValue,
          modelVersion: 'blynt-heuristic-v1',
        },
      });

      await this.audit.logEvent(organizationId, documentId, 'EXTRACTED', doc.createdById, {
        invoiceNumber: extractionResult.invoiceNumber,
        total: extractionResult.total,
      });

      // 3. Organization Business Context Profile
      const businessProfile = await this.businessContext.getProfile(organizationId);

      // 4. Entity Resolution (Supplier / Customer Directory Match)
      // We check both issuer and recipient
      const issuerMatch = await this.entityResolver.resolveEntity(
        organizationId,
        extractionResult.issuer,
        'SUPPLIER',
      );
      const recipientMatch = await this.entityResolver.resolveEntity(
        organizationId,
        extractionResult.recipient,
        'CUSTOMER',
      );

      // 5. Transaction Direction Resolution (5-Tier Priority Hierarchy)
      const directionResult = this.directionResolver.resolveDirection(
        extractionResult,
        {
          name: doc.organization.name,
          legalName: doc.organization.legalName,
          taxNumber: doc.organization.taxNumber,
          registrationNumber: doc.organization.registrationNumber,
        },
        issuerMatch.contact ?? recipientMatch.contact,
      );

      const targetEntity =
        directionResult.direction === AiDirection.PURCHASE ? issuerMatch.contact : recipientMatch.contact;

      const entityMatchReason =
        directionResult.direction === AiDirection.PURCHASE ? issuerMatch.reason : recipientMatch.reason;

      // 6. Document Type Classification
      const docClassification = this.classifier.classify(extractionResult, directionResult.direction);

      // Persist document classification
      await this.db.aiClassification.create({
        data: {
          organizationId,
          documentId,
          direction: directionResult.direction,
          entityType: directionResult.direction === AiDirection.PURCHASE ? 'SUPPLIER' : 'CUSTOMER',
          entityId: targetEntity?.id,
          entityMatchReason,
          classification: docClassification.documentType,
          confidenceScore: new Prisma.Decimal(directionResult.confidence),
          reasoning: directionResult.reasoning,
        },
      });

      await this.audit.logEvent(organizationId, documentId, 'CLASSIFIED', doc.createdById, {
        direction: directionResult.direction,
        documentType: docClassification.documentType,
        matchedEntity: targetEntity?.name,
      });

      // 7. Line Items Product Classification
      const classifiedLines = await this.lineClassifier.classifyLines(
        organizationId,
        extractionResult.lines,
        directionResult.direction,
        businessProfile,
        targetEntity?.id,
      );

      // 8. Tax Classification
      const taxInfo = await this.taxClassifier.resolveTax(
        organizationId,
        classifiedLines[0]?.taxClassification ?? 'VAT_STANDARD',
        directionResult.direction === AiDirection.PURCHASE ? 'PURCHASE' : 'SALE',
      );

      // 9. Accounting Classification & Proposed Double-Entry Intent
      const accountingIntent = await this.accountingClassifier.buildAccountingIntent(
        organizationId,
        directionResult.direction === AiDirection.PURCHASE ? 'PURCHASE' : 'SALE',
        classifiedLines,
        taxInfo,
        targetEntity,
      );

      // Persist line classifications
      for (const cl of classifiedLines) {
        const lineAccount = accountingIntent.lines.find((l) => l.description === cl.description);
        await this.db.aiLineClassification.create({
          data: {
            organizationId,
            documentId,
            lineNumber: cl.lineNumber,
            rawDescription: cl.description,
            quantity: new Prisma.Decimal(cl.quantity),
            unit: cl.unit,
            unitPrice: new Prisma.Decimal(cl.unitPrice),
            netAmount: new Prisma.Decimal(cl.netAmount),
            taxAmount: new Prisma.Decimal(cl.taxAmount),
            totalAmount: new Prisma.Decimal(cl.totalAmount),
            productType: cl.productType,
            productClassification: cl.productClassification,
            taxClassification: cl.taxClassification,
            accountingCategory: cl.accountingCategory,
            resolvedAccountId: lineAccount?.accountId,
            confidenceScore: new Prisma.Decimal(cl.confidence),
          },
        });
      }

      // 10. Multi-Factor Confidence Score
      const confidenceResult = this.confidenceService.evaluate(
        directionResult.direction === AiDirection.PURCHASE ? issuerMatch : recipientMatch,
        directionResult,
        classifiedLines,
        accountingIntent,
      );

      // 11. Accounting Safety Guardrail Check
      await this.safety.validateAccountingSafety(organizationId, accountingIntent, targetEntity?.id);

      // 12. Create AI Accounting Suggestion
      const suggestion = await this.db.aiSuggestion.create({
        data: {
          organizationId,
          documentId,
          suggestionType:
            directionResult.direction === AiDirection.PURCHASE
              ? 'PURCHASE_BILL_DRAFT'
              : 'SALES_INVOICE_DRAFT',
          payload: {
            extraction: extractionResult,
            direction: directionResult.direction,
            documentType: docClassification.documentType,
            entity: targetEntity ? { id: targetEntity.id, name: targetEntity.name } : null,
            lines: classifiedLines,
            accountingIntent,
            confidence: confidenceResult,
          } as unknown as Prisma.InputJsonValue,
          confidenceScore: new Prisma.Decimal(confidenceResult.score),
          confidenceLevel: confidenceResult.level,
          status: AiSuggestionStatus.PENDING_REVIEW,
        },
      });

      await this.audit.logEvent(organizationId, documentId, 'SUGGESTED', doc.createdById, {
        suggestionId: suggestion.id,
        confidenceLevel: confidenceResult.level,
        score: confidenceResult.score,
      });

      // 13. Evaluate Policy Action (Auto-draft vs Human Review)
      const actionPolicy = this.policy.determineAction(
        confidenceResult.level,
        targetEntity?.status === 'ARCHIVED',
      );
      let docStatus: AiDocumentStatus = AiDocumentStatus.REQUIRES_REVIEW;

      if (actionPolicy === 'AUTO_DRAFT' && options?.autoDraftIfHighConfidence && targetEntity) {
        // High confidence and caller enabled auto-draft: convert to draft invoice
        const createdInvoice = await this.createInvoiceDraftFromSuggestion(
          organizationId,
          doc.createdById,
          suggestion.id,
          targetEntity.id,
          extractionResult,
          classifiedLines,
          accountingIntent,
        );

        await this.db.aiSuggestion.update({
          where: { id: suggestion.id },
          data: {
            status: AiSuggestionStatus.APPROVED,
            resultingInvoiceId: createdInvoice.id,
            reviewedAt: new Date(),
          },
        });

        docStatus = AiDocumentStatus.DRAFTED;
        await this.audit.logEvent(organizationId, documentId, 'DRAFTED', doc.createdById, {
          invoiceId: createdInvoice.id,
          invoiceNumber: createdInvoice.invoiceNumber,
        });
      }

      // Update parent AiDocument record
      const updatedDoc = await this.db.aiDocument.update({
        where: { id: documentId },
        data: {
          documentType: docClassification.documentType,
          direction: directionResult.direction,
          status: docStatus,
          confidenceScore: new Prisma.Decimal(confidenceResult.score),
          confidenceLevel: confidenceResult.level,
          processedAt: new Date(),
        },
        include: {
          extractions: true,
          classifications: true,
          lineClassifications: true,
          suggestions: true,
        },
      });

      return updatedDoc;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Document processing failed for document ${documentId}: ${errorMsg}`, err);

      await this.db.aiDocument.update({
        where: { id: documentId },
        data: {
          status: AiDocumentStatus.FAILED,
          errorMessage: errorMsg.slice(0, 500),
          processedAt: new Date(),
        },
      });

      throw err;
    }
  }

  // --- Human Review Approval & Edit Endpoints ---

  async approveSuggestion(
    organizationId: string,
    documentId: string,
    reviewedById: string,
    targetContactId?: string,
  ) {
    const suggestion = await this.db.aiSuggestion.findFirst({
      where: {
        organizationId,
        documentId,
        status: AiSuggestionStatus.PENDING_REVIEW,
      },
    });

    if (!suggestion) {
      throw new NotFoundException('No pending AI suggestion found for this document.');
    }

    const payload = suggestion.payload as Record<string, unknown>;
    const extraction = payload.extraction as Record<string, unknown>;
    const lines = payload.lines as ClassifiedLineResult[];
    const accountingIntent = payload.accountingIntent as Record<string, unknown>;
    const entity = (payload.entity as { id?: string; name?: string }) ?? {};

    const contactId = targetContactId ?? entity.id;
    if (!contactId) {
      throw new BadRequestException('A valid active contact must be designated or matched to approve draft.');
    }

    const contact = await this.db.contact.findFirst({
      where: { organizationId, id: contactId, status: 'ACTIVE' },
    });
    if (!contact) {
      throw new BadRequestException(
        'Designated contact is inactive, archived, or not found in this organisation.',
      );
    }

    // Create Draft Invoice in Blynt
    const invoice = await this.createInvoiceDraftFromSuggestion(
      organizationId,
      reviewedById,
      suggestion.id,
      contact.id,
      extraction as unknown as Record<string, unknown>,
      lines,
      accountingIntent as unknown as Record<string, unknown>,
    );

    // Update Suggestion & Document Status
    await this.db.aiSuggestion.update({
      where: { id: suggestion.id },
      data: {
        status: AiSuggestionStatus.APPROVED,
        reviewedById,
        reviewedAt: new Date(),
        resultingInvoiceId: invoice.id,
      },
    });

    await this.db.aiDocument.update({
      where: { id: documentId },
      data: { status: AiDocumentStatus.APPROVED },
    });

    await this.audit.logEvent(organizationId, documentId, 'APPROVED', reviewedById, {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      contactId: contact.id,
    });

    return {
      success: true,
      documentId,
      suggestionId: suggestion.id,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
    };
  }

  async editAndApproveSuggestion(
    organizationId: string,
    documentId: string,
    reviewedById: string,
    modifications: {
      contactId: string;
      lines: Array<{
        lineNumber: number;
        description: string;
        accountId: string;
        productClassification?: string;
      }>;
      notes?: string;
    },
  ) {
    const suggestion = await this.db.aiSuggestion.findFirst({
      where: {
        organizationId,
        documentId,
        status: AiSuggestionStatus.PENDING_REVIEW,
      },
    });

    if (!suggestion) {
      throw new NotFoundException('No pending AI suggestion found for this document.');
    }

    const payload = suggestion.payload as Record<string, unknown>;
    const originalLines = (payload.lines as ClassifiedLineResult[]) ?? [];

    // Capture Feedback / Accountant Corrections for each modified line
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
          correctedById: reviewedById,
        });

        await this.audit.logEvent(organizationId, documentId, 'CORRECTED', reviewedById, {
          product: mod.description || orig.description,
          from: orig.productClassification,
          to: mod.productClassification,
        });
      }
    }

    // Now proceed with approval using modified contact and accounts
    return this.approveSuggestion(organizationId, documentId, reviewedById, modifications.contactId);
  }

  async rejectSuggestion(organizationId: string, documentId: string, reviewedById: string, reason: string) {
    const suggestion = await this.db.aiSuggestion.findFirst({
      where: {
        organizationId,
        documentId,
        status: AiSuggestionStatus.PENDING_REVIEW,
      },
    });

    if (!suggestion) {
      throw new NotFoundException('No pending AI suggestion found for this document.');
    }

    await this.db.aiSuggestion.update({
      where: { id: suggestion.id },
      data: {
        status: AiSuggestionStatus.REJECTED,
        reviewedById,
        reviewedAt: new Date(),
        reviewNote: reason,
      },
    });

    await this.db.aiDocument.update({
      where: { id: documentId },
      data: { status: AiDocumentStatus.REJECTED },
    });

    await this.audit.logEvent(organizationId, documentId, 'REJECTED', reviewedById, { reason });

    return { success: true, documentId, suggestionId: suggestion.id };
  }

  // --- Document Query Endpoints ---

  async listDocuments(organizationId: string) {
    return this.db.aiDocument.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      include: {
        suggestions: {
          select: { id: true, status: true, confidenceLevel: true, confidenceScore: true },
        },
      },
    });
  }

  async getDocument(organizationId: string, documentId: string) {
    const doc = await this.db.aiDocument.findFirst({
      where: { organizationId, id: documentId },
      include: {
        extractions: true,
        classifications: true,
        lineClassifications: {
          include: { account: { select: { id: true, code: true, name: true } } },
        },
        suggestions: true,
        auditEvents: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!doc) {
      throw new NotFoundException(`Document ${documentId} not found.`);
    }

    return doc;
  }

  // --- Invoice Draft Assembly ---

  private async createInvoiceDraftFromSuggestion(
    organizationId: string,
    createdById: string,
    suggestionId: string,
    contactId: string,
    extraction: Record<string, unknown> | RawExtractionResult,
    lines: ClassifiedLineResult[],
    accountingIntent: ProposedAccountingIntent | Record<string, unknown>,
  ) {
    const rawInvNum = (extraction.invoiceNumber as string) || `INV-${Date.now().toString().slice(-6)}`;
    const issueDate = extraction.invoiceDate ? new Date(extraction.invoiceDate as string) : new Date();
    const dueDate = extraction.dueDate
      ? new Date(extraction.dueDate as string)
      : new Date(Date.now() + 30 * 86400000);
    const currency = (extraction.currency as string) || 'GBP';

    // Disambiguate invoice number if already taken
    let invoiceNumber = rawInvNum;
    const existing = await this.db.invoice.findFirst({
      where: { organizationId, invoiceNumber },
    });
    if (existing) {
      invoiceNumber = `${rawInvNum}-${Date.now().toString().slice(-4)}`;
    }

    const proposedLines = (accountingIntent.lines as Array<{ accountId: string; description: string }>) ?? [];

    let subtotal = this.money.ZERO;
    let taxTotal = this.money.ZERO;
    let totalAmount = this.money.ZERO;

    for (const l of lines) {
      subtotal = this.money.add(subtotal, this.money.toDecimal(l.netAmount));
      taxTotal = this.money.add(taxTotal, this.money.toDecimal(l.taxAmount));
      totalAmount = this.money.add(totalAmount, this.money.toDecimal(l.totalAmount));
    }

    // Default line account fallback
    const defaultExpenseAccount = await this.db.account.findFirst({
      where: { organizationId, isActive: true },
    });

    return this.db.invoice.create({
      data: {
        organizationId,
        contactId,
        invoiceNumber,
        reference: `AI Processed (${suggestionId.slice(0, 8)})`,
        issueDate,
        dueDate,
        currency,
        exchangeRate: new Prisma.Decimal(1),
        subtotal: new Prisma.Decimal(subtotal.toFixed(4)),
        taxTotal: new Prisma.Decimal(taxTotal.toFixed(4)),
        totalAmount: new Prisma.Decimal(totalAmount.toFixed(4)),
        amountPaid: new Prisma.Decimal(0),
        status: InvoiceStatus.DRAFT,
        createdById,
        lines: {
          create: lines.map((l, idx) => {
            const mappedAcc = proposedLines[idx]?.accountId ?? defaultExpenseAccount?.id;
            return {
              organizationId,
              lineNumber: idx + 1,
              accountId: mappedAcc!,
              description: l.description,
              quantity: new Prisma.Decimal(l.quantity),
              unitPrice: new Prisma.Decimal(l.unitPrice),
              taxRate: new Prisma.Decimal(l.taxClassification === 'VAT_ZERO' ? 0 : 0.2),
              taxAmount: new Prisma.Decimal(l.taxAmount),
              lineTotal: new Prisma.Decimal(l.totalAmount),
            };
          }),
        },
      },
    });
  }
}
