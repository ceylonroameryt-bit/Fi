import { Injectable, NotFoundException } from '@nestjs/common';
import { AiDirection, AiDocumentStatus, AiSuggestionStatus, BillStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { DomainException } from '../../common/errors/domain.exception';
import type { Actor, OrgContext } from '../../common/types/request-context.types';
import { StorageService } from '../../common/storage/storage.service';
import { MoneyService } from '../../accounting-engine/money.service';
import { InvoicesService } from '../../invoices/invoices.service';
import type { CreateInvoiceDto } from '../../invoices/dto/invoice.dto';
import { BillsService } from '../../bills/bills.service';
import type { CreateBillDto } from '../../bills/dto/bill.dto';
import { AiAuditService } from '../audit/ai-audit.service';
import { AiFeedbackService } from '../feedback/ai-feedback.service';
import { ExtractionValidationService, ExtractionValidation } from '../validation/extraction-validation.service';
import type { SuggestionPayload } from '../document-intelligence/document-intelligence.service';
import type { RawExtractionResult } from '../providers/llm-provider.interface';
import type { DocumentExtractionOutput } from '../gateway/prompts/document-extraction.prompt';
import type { ApproveReviewedDto, ReviewedLineDto } from '../dto/review.dto';
import { findBoxes, HighlightBox } from './highlight';

type FieldStatus = 'verified' | 'inconsistent' | 'missing';

interface ReviewField {
  path: string;
  label: string;
  value: string | null;
  status: FieldStatus;
  findings: string[];
  /** Verbatim text the value was read from (LLM extraction), else null. */
  source: string | null;
  boxes: HighlightBox[];
}

const HEADER_FIELDS: Array<[string, string]> = [
  ['invoiceNumber', 'Invoice number'],
  ['invoiceDate', 'Invoice date'],
  ['dueDate', 'Due date'],
  ['currency', 'Currency'],
  ['issuer.name', 'Issuer'],
  ['issuer.vatNumber', 'Issuer VAT number'],
  ['recipient.name', 'Recipient'],
  ['recipient.vatNumber', 'Recipient VAT number'],
  ['subtotal', 'Net total'],
  ['vatTotal', 'VAT total'],
  ['total', 'Total'],
];

/** Comparable snapshot of the values a draft is created from (AI proposal vs reviewer's final). */
interface DraftValues {
  direction: string;
  contactId: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  currency: string | null;
  issuerVatNumber: string | null;
  recipientVatNumber: string | null;
  subtotal: string | null;
  vatTotal: string | null;
  total: string | null;
  lines: Array<{
    description: string;
    quantity: string | null;
    unitPrice: string | null;
    netAmount: string | null;
    vatAmount: string | null;
    accountId: string | null;
    taxCodeId: string | null;
  }>;
}

const get = (obj: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), obj);

/**
 * Human review of AI drafts (Stage 12). Confidence only orders the queue. Every approval goes
 * through approve(): permission ai_draft.approve, re-validation of the final values, an explicit
 * reason for each inconsistent field left as is, and a side-by-side log of AI vs approved values.
 */
@Injectable()
export class AiReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly money: MoneyService,
    private readonly storage: StorageService,
    private readonly invoices: InvoicesService,
    private readonly bills: BillsService,
    private readonly validator: ExtractionValidationService,
    private readonly feedback: AiFeedbackService,
    private readonly audit: AiAuditService,
  ) {}

  /** Documents awaiting review. Confidence is a sort key only. */
  async queue(organizationId: string, sort: 'confidence_desc' | 'confidence_asc' | 'oldest' = 'confidence_desc') {
    const docs = await this.prisma.aiDocument.findMany({
      where: { organizationId, status: AiDocumentStatus.AWAITING_REVIEW },
      include: {
        extractions: { select: { invoiceNumber: true, totalAmount: true, isConsistent: true, validation: true, issuerName: true, recipientName: true } },
        classifications: { select: { entityId: true, contact: { select: { name: true } } } },
      },
    });
    const rows = docs.map((d) => {
      const x = d.extractions[0];
      const summary = (x?.validation as unknown as ExtractionValidation | null)?.summary;
      return {
        id: d.id,
        fileName: d.fileName,
        direction: d.direction,
        createdAt: d.createdAt,
        confidenceScore: d.confidenceScore ? Number(d.confidenceScore) : 0,
        confidenceLevel: d.confidenceLevel,
        invoiceNumber: x?.invoiceNumber ?? null,
        total: x?.totalAmount?.toFixed(2) ?? null,
        counterparty: d.classifications[0]?.contact?.name ?? (d.direction === AiDirection.SALE ? x?.recipientName : x?.issuerName) ?? null,
        consistent: x?.isConsistent ?? null,
        inconsistentFields: summary?.inconsistent ?? null,
        missingFields: summary?.missing ?? null,
      };
    });
    rows.sort((a, b) =>
      sort === 'oldest'
        ? a.createdAt.getTime() - b.createdAt.getTime()
        : sort === 'confidence_asc'
          ? a.confidenceScore - b.confidenceScore
          : b.confidenceScore - a.confidenceScore,
    );
    return rows;
  }

  /** Everything the review screen shows: fields with status, source and position on the document. */
  async review(organizationId: string, documentId: string) {
    const doc = await this.prisma.aiDocument.findFirst({
      where: { id: documentId, organizationId },
      include: {
        pages: { orderBy: { pageNumber: 'asc' } },
        extractions: true,
        classifications: true,
        suggestions: { orderBy: { createdAt: 'desc' }, take: 1 },
        bill: { select: { id: true, billNumber: true, status: true } },
      },
    });
    if (!doc) throw new NotFoundException('Document not found');
    const extraction = doc.extractions[0];
    const suggestion = doc.suggestions[0];
    const payload = suggestion?.payload as unknown as (SuggestionPayload & { validation?: ExtractionValidation }) | undefined;
    const raw = (extraction?.rawStructuredData ?? {}) as { result?: RawExtractionResult; modelOutput?: DocumentExtractionOutput };
    const result: RawExtractionResult = raw.result ?? payload?.extraction ?? { lines: [] };
    const validation = (extraction?.validation as unknown as ExtractionValidation | null) ?? null;
    const pages = doc.pages.map((p) => ({
      pageNumber: p.pageNumber,
      width: p.width,
      height: p.height,
      text: p.text,
      words: p.words as unknown as Array<{ text: string; x0: number; y0: number; x1: number; y1: number }>,
    }));
    const sourceOf = (path: string): string | null => {
      const q = get(raw.modelOutput, path) as { source?: string | null } | undefined;
      return q?.source ?? null;
    };
    const fieldStatus = (path: string, value: unknown) =>
      validation?.fields[path] ?? { status: (value === undefined || value === null ? 'missing' : 'verified') as FieldStatus, findings: [] };

    const fields: ReviewField[] = HEADER_FIELDS.map(([path, label]) => {
      const value = (get(result, path) as string | undefined) ?? null;
      const source = sourceOf(path);
      const v = fieldStatus(path, value);
      return { path, label, value, status: v.status, findings: v.findings, source, boxes: value ? findBoxes(pages, source ?? value) : [] };
    });

    const coding = new Map((payload?.coding ?? []).map((c) => [c.lineNumber, c]));
    const lines = (payload?.lines ?? []).map((l) => {
      const source = raw.modelOutput?.lines[l.lineNumber - 1]?.source ?? null;
      const status = (f: string) => fieldStatus(`lines[${l.lineNumber}].${f}`, (l as unknown as Record<string, unknown>)[f]);
      return {
        lineNumber: l.lineNumber,
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        netAmount: l.netAmount,
        vatAmount: l.taxAmount,
        accountId: coding.get(l.lineNumber)?.accountId ?? null,
        accountSource: coding.get(l.lineNumber)?.accountSource ?? 'NONE',
        taxCodeId: coding.get(l.lineNumber)?.taxCodeId ?? null,
        taxCode: coding.get(l.lineNumber)?.taxCode ?? null,
        taxSource: coding.get(l.lineNumber)?.taxSource ?? 'NONE',
        codingReason: coding.get(l.lineNumber)?.reason ?? null,
        status: { net: status('net'), vat: status('vat'), description: status('description') },
        source,
        boxes: findBoxes(pages, source ?? l.description),
      };
    });

    return {
      document: {
        id: doc.id,
        fileName: doc.fileName,
        mimeType: doc.mimeType,
        status: doc.status,
        textSource: doc.textSource,
        direction: doc.direction,
        directionReason: doc.classifications[0]?.reasoning ?? null,
        confidenceScore: doc.confidenceScore ? Number(doc.confidenceScore) : null,
        confidenceLevel: doc.confidenceLevel,
        fileUrl: `/ai/documents/${doc.id}/file`,
        extractedText: doc.extractedText,
        bill: doc.bill,
      },
      suggestionId: suggestion?.id ?? null,
      suggestionStatus: suggestion?.status ?? null,
      counterparty: {
        entity: payload?.entity ?? null,
        match: payload?.counterpartyMatch ?? null,
        proposedContact: payload?.proposedContact ?? null,
      },
      fields,
      lines,
      validation: validation ? { consistent: validation.consistent, summary: validation.summary, findings: validation.findings } : null,
      missing: payload?.accountingIntent?.missing ?? [],
      pages,
    };
  }

  /** The stored file, for the review screen's document viewer. */
  async file(organizationId: string, documentId: string) {
    const doc = await this.prisma.aiDocument.findFirst({ where: { id: documentId, organizationId }, select: { fileKey: true, fileName: true, mimeType: true } });
    if (!doc) throw new NotFoundException('Document not found');
    const obj = await this.storage.getObject(doc.fileKey);
    return { body: obj.body, fileName: doc.fileName, mimeType: doc.mimeType };
  }

  /**
   * Turns the AI suggestion (plus optional contact / account choices) into an approval request.
   * Refuses with AI_DRAFT_INCOMPLETE, listing what is missing, instead of filling anything in.
   */
  async fromSuggestion(
    organizationId: string,
    documentId: string,
    contactId?: string,
    accountOverrides: Map<number, string> = new Map(),
  ): Promise<ApproveReviewedDto> {
    const { payload } = await this.pending(organizationId, documentId);
    if (payload.direction === AiDirection.UNKNOWN) {
      throw new DomainException('AI_DIRECTION_UNRESOLVED', 'Sales or purchase could not be determined; nothing was created.');
    }
    const purchase = payload.direction === AiDirection.PURCHASE;
    const contact = contactId ?? payload.entity?.id;
    if (!contact) {
      throw new DomainException('VALIDATION_FAILED', `A ${purchase ? 'supplier' : 'customer'} must be chosen to approve this draft.`);
    }
    const x = payload.extraction;
    const coding = new Map((payload.coding ?? []).map((c) => [c.lineNumber, c]));
    const taxIds = new Map(
      (
        await this.prisma.taxCode.findMany({
          where: { code: { in: payload.lines.map((l) => l.taxClassification).filter((c): c is string => !!c) } },
          select: { id: true, code: true },
        })
      ).map((t) => [t.code, t.id]),
    );

    const missing: string[] = [];
    if (purchase && !x.invoiceNumber) missing.push("supplier's invoice number");
    if (!x.invoiceDate) missing.push('invoice date');
    if (!purchase && !x.dueDate) missing.push('due date');
    if (!x.currency) missing.push('currency');
    if (payload.lines.length === 0) missing.push('line items');

    const lines: ReviewedLineDto[] = payload.lines.map((l) => {
      const label = `line ${l.lineNumber}`;
      const accountId =
        accountOverrides.get(l.lineNumber) ??
        coding.get(l.lineNumber)?.accountId ??
        payload.accountingIntent?.lines.find((p) => p.sourceLineNumber === l.lineNumber)?.accountId ??
        null;
      const taxCodeId = coding.get(l.lineNumber)?.taxCodeId ?? (l.taxClassification ? taxIds.get(l.taxClassification) : undefined) ?? null;
      if (!accountId) missing.push(`${label}: account`);
      if (!taxCodeId) missing.push(`${label}: tax code`);
      if (purchase) {
        if (l.netAmount === null && (l.quantity === null || l.unitPrice === null)) missing.push(`${label}: amount`);
      } else {
        if (l.quantity === null) missing.push(`${label}: quantity`);
        if (l.unitPrice === null) missing.push(`${label}: unit price`);
      }
      return {
        lineNumber: l.lineNumber,
        description: l.description,
        quantity: l.quantity ?? undefined,
        unitPrice: l.unitPrice ?? undefined,
        netAmount: l.netAmount ?? undefined,
        vatAmount: l.taxAmount ?? undefined,
        accountId: accountId ?? '',
        taxCodeId: taxCodeId ?? '',
      };
    });
    if (missing.length > 0) {
      throw new DomainException('AI_DRAFT_INCOMPLETE', `The document is missing: ${missing.join('; ')}`, { missing });
    }
    return {
      direction: purchase ? 'PURCHASE' : 'SALE',
      contactId: contact,
      invoiceNumber: x.invoiceNumber ?? '',
      invoiceDate: x.invoiceDate!,
      dueDate: x.dueDate,
      currency: x.currency!,
      issuerVatNumber: x.issuer?.vatNumber,
      recipientVatNumber: x.recipient?.vatNumber,
      subtotal: x.subtotal,
      vatTotal: x.vatTotal,
      total: x.total,
      lines,
      overrides: [],
    };
  }

  /** The single approval path for AI drafts. */
  async approve(organizationId: string, documentId: string, dto: ApproveReviewedDto, orgContext: OrgContext, actor: Actor) {
    const { suggestion, payload } = await this.pending(organizationId, documentId);
    const purchase = dto.direction === 'PURCHASE';
    const needed = purchase ? 'bill.create' : 'invoice.create';
    if (!orgContext.permissions.has(needed)) {
      throw new DomainException('PERMISSION_DENIED', `You do not have the required permission: ${needed}`, { requiredPermission: needed });
    }
    const contact = await this.prisma.contact.findFirst({ where: { organizationId, id: dto.contactId, status: 'ACTIVE' } });
    if (!contact) throw new DomainException('CONTACT_NOT_FOUND', 'Contact is inactive, archived or not in this organisation');

    // Re-validate the reviewer's final values: inconsistent fields need an edit or a stated reason.
    const finalExtraction = this.toExtraction(dto, payload.extraction);
    const validation = await this.validator.validate({
      organizationId,
      documentId,
      extraction: finalExtraction,
      baseCurrency: orgContext.baseCurrency,
      issuerContactId: purchase ? dto.contactId : null,
    });
    const overrides = new Map((dto.overrides ?? []).map((o) => [o.field, o.reason]));
    const inconsistent = Object.entries(validation.fields).filter(([, f]) => f.status === 'inconsistent');
    const unexplained = inconsistent.filter(([path]) => !overrides.has(path));
    if (unexplained.length > 0) {
      throw new DomainException('AI_REVIEW_INCONSISTENT', 'Correct these fields or give a reason to accept them as they are', {
        fields: unexplained.map(([path, f]) => ({ field: path, findings: f.findings })),
      });
    }
    const acceptedOverrides = inconsistent.map(([path, f]) => ({ field: path, reason: overrides.get(path)!, findings: f.findings }));

    const aiValues = this.snapshotFromPayload(payload);
    const finalValues = this.snapshotFromDto(dto);
    const changedFields = diffSnapshots(aiValues, finalValues);
    const outcome = changedFields.length > 0 ? 'EDITED' : 'APPROVED';

    const created = purchase
      ? await this.createBill(organizationId, documentId, dto, orgContext, actor)
      : await this.createInvoice(organizationId, dto, orgContext, actor);

    await this.prisma.transaction(async (tx) => {
      await tx.aiReviewDecision.create({
        data: {
          organizationId,
          documentId,
          suggestionId: suggestion.id,
          reviewerId: actor.userId!,
          outcome,
          aiValues: aiValues as unknown as Prisma.InputJsonValue,
          finalValues: finalValues as unknown as Prisma.InputJsonValue,
          changedFields: changedFields as unknown as Prisma.InputJsonValue,
          overrides: acceptedOverrides as unknown as Prisma.InputJsonValue,
          resultingBillId: created.kind === 'bill' ? created.id : null,
          resultingInvoiceId: created.kind === 'invoice' ? created.id : null,
        },
      });
      await tx.aiSuggestion.update({
        where: { id: suggestion.id },
        data: {
          status: outcome === 'EDITED' ? AiSuggestionStatus.EDITED : AiSuggestionStatus.APPROVED,
          reviewedById: actor.userId,
          reviewedAt: new Date(),
          ...(created.kind === 'bill' ? { resultingBillId: created.id } : { resultingInvoiceId: created.id }),
        },
      });
      await tx.aiDocument.update({ where: { id: documentId }, data: { status: AiDocumentStatus.DRAFT_CREATED } });
    });

    // Learn from account corrections (feeds Stage 10 classification next time).
    for (const [i, line] of dto.lines.entries()) {
      const before = aiValues.lines[i];
      if (before && before.accountId !== line.accountId) {
        await this.feedback.recordFeedback({
          organizationId,
          suggestionId: suggestion.id,
          supplierOrCustomerId: dto.contactId,
          productPattern: line.description.slice(0, 255),
          originalClassification: before.accountId ?? 'NONE',
          correctedClassification: line.accountId,
          correctedAccountId: line.accountId,
          correctedById: actor.userId!,
        });
      }
    }
    await this.audit.logEvent(organizationId, documentId, 'APPROVED', actor.userId ?? undefined, {
      outcome,
      changedFields,
      overrides: acceptedOverrides.map((o) => o.field),
      [created.kind === 'bill' ? 'billId' : 'invoiceId']: created.id,
    });

    return {
      success: true,
      documentId,
      suggestionId: suggestion.id,
      outcome,
      changedFields,
      ...(created.kind === 'bill'
        ? { billId: created.id, billNumber: created.number, warnings: created.warnings }
        : { invoiceId: created.id, invoiceNumber: created.number }),
    };
  }

  async reject(organizationId: string, documentId: string, reason: string, actor: Actor) {
    const { suggestion, payload } = await this.pending(organizationId, documentId);
    await this.prisma.transaction(async (tx) => {
      await tx.aiReviewDecision.create({
        data: {
          organizationId,
          documentId,
          suggestionId: suggestion.id,
          reviewerId: actor.userId!,
          outcome: 'REJECTED',
          aiValues: this.snapshotFromPayload(payload) as unknown as Prisma.InputJsonValue,
          finalValues: {},
          reason,
        },
      });
      await tx.aiSuggestion.update({
        where: { id: suggestion.id },
        data: { status: AiSuggestionStatus.REJECTED, reviewedById: actor.userId, reviewedAt: new Date(), reviewNote: reason },
      });
      await tx.aiDocument.update({ where: { id: documentId }, data: { status: AiDocumentStatus.REJECTED } });
    });
    await this.audit.logEvent(organizationId, documentId, 'REJECTED', actor.userId ?? undefined, { reason });
    return { success: true, documentId, suggestionId: suggestion.id };
  }

  // --- helpers ---

  private async pending(organizationId: string, documentId: string) {
    const doc = await this.prisma.aiDocument.findFirst({ where: { id: documentId, organizationId }, select: { status: true } });
    if (!doc) throw new NotFoundException('Document not found');
    const suggestion = await this.prisma.aiSuggestion.findFirst({
      where: { organizationId, documentId, status: AiSuggestionStatus.PENDING_REVIEW },
    });
    if (!suggestion || doc.status !== AiDocumentStatus.AWAITING_REVIEW) {
      throw new NotFoundException('No pending AI suggestion found for this document.');
    }
    return { suggestion, payload: suggestion.payload as unknown as SuggestionPayload };
  }

  private async createBill(organizationId: string, documentId: string, dto: ApproveReviewedDto, orgContext: OrgContext, actor: Actor) {
    const duplicate = await this.prisma.bill.findFirst({
      where: {
        organizationId,
        contactId: dto.contactId,
        status: { not: BillStatus.VOIDED },
        supplierInvoiceNumber: { equals: dto.invoiceNumber, mode: 'insensitive' },
      },
      select: { id: true, billNumber: true },
    });
    if (duplicate) {
      throw new DomainException('AI_DUPLICATE_DOCUMENT', `Supplier invoice ${dto.invoiceNumber} is already bill ${duplicate.billNumber}.`, { billId: duplicate.id });
    }
    const bill = await this.bills.create(
      organizationId,
      {
        contactId: dto.contactId,
        supplierInvoiceNumber: dto.invoiceNumber,
        issueDate: dto.invoiceDate,
        dueDate: dto.dueDate,
        currency: dto.currency,
        sourceDocumentId: documentId,
        lines: dto.lines.map((l) => ({
          accountId: l.accountId,
          description: l.description,
          ...(l.quantity !== undefined && l.unitPrice !== undefined ? { quantity: l.quantity, unitPrice: l.unitPrice } : {}),
          ...(l.netAmount !== undefined ? { netAmount: l.netAmount } : {}),
          taxCodeId: l.taxCodeId,
        })),
      } as CreateBillDto,
      orgContext,
      actor,
    );
    return { kind: 'bill' as const, id: bill.id, number: bill.billNumber, warnings: bill.warnings };
  }

  private async createInvoice(organizationId: string, dto: ApproveReviewedDto, orgContext: OrgContext, actor: Actor) {
    if (!dto.dueDate) throw new DomainException('AI_DRAFT_INCOMPLETE', 'The document is missing: due date', { missing: ['due date'] });
    const incomplete = dto.lines.filter((l) => l.quantity === undefined || l.unitPrice === undefined).map((l, i) => `line ${l.lineNumber ?? i + 1}: quantity and unit price`);
    if (incomplete.length > 0) {
      throw new DomainException('AI_DRAFT_INCOMPLETE', `The document is missing: ${incomplete.join('; ')}`, { missing: incomplete });
    }
    const duplicate = await this.prisma.invoice.findFirst({
      where: { organizationId, contactId: dto.contactId, reference: dto.invoiceNumber },
      select: { id: true, invoiceNumber: true },
    });
    if (duplicate) {
      throw new DomainException('AI_DUPLICATE_DOCUMENT', `Document ${dto.invoiceNumber} was already recorded as invoice ${duplicate.invoiceNumber}.`, {
        invoiceId: duplicate.id,
      });
    }
    const invoice = await this.invoices.createInvoice(
      organizationId,
      {
        contactId: dto.contactId,
        issueDate: dto.invoiceDate,
        dueDate: dto.dueDate,
        currency: dto.currency,
        reference: dto.invoiceNumber,
        lines: dto.lines.map((l) => ({
          accountId: l.accountId,
          description: l.description,
          quantity: l.quantity!,
          unitPrice: l.unitPrice!,
          taxCodeId: l.taxCodeId,
        })),
      } as CreateInvoiceDto,
      orgContext,
      actor,
    );
    return { kind: 'invoice' as const, id: invoice.id, number: invoice.invoiceNumber };
  }

  /** The reviewer's values in the shape validation expects (amounts as printed, never recalculated here). */
  private toExtraction(dto: ApproveReviewedDto, ai: RawExtractionResult): RawExtractionResult {
    return {
      invoiceNumber: dto.invoiceNumber,
      invoiceDate: dto.invoiceDate,
      dueDate: dto.dueDate,
      currency: dto.currency,
      issuer: { ...ai.issuer, vatNumber: dto.issuerVatNumber ?? undefined },
      recipient: { ...ai.recipient, vatNumber: dto.recipientVatNumber ?? undefined },
      subtotal: dto.subtotal,
      vatTotal: dto.vatTotal,
      total: dto.total,
      lines: dto.lines.map((l) => ({
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        net:
          l.netAmount ??
          (l.quantity !== undefined && l.unitPrice !== undefined ? this.money.round(this.money.toDecimal(l.quantity).mul(l.unitPrice), 2).toFixed(2) : undefined),
        vat: l.vatAmount,
      })),
    };
  }

  private snapshotFromPayload(p: SuggestionPayload): DraftValues {
    const coding = new Map((p.coding ?? []).map((c) => [c.lineNumber, c]));
    const x = p.extraction;
    return {
      direction: p.direction,
      contactId: p.entity?.id ?? null,
      invoiceNumber: x.invoiceNumber ?? null,
      invoiceDate: x.invoiceDate ?? null,
      dueDate: x.dueDate ?? null,
      currency: x.currency ?? null,
      issuerVatNumber: x.issuer?.vatNumber ?? null,
      recipientVatNumber: x.recipient?.vatNumber ?? null,
      subtotal: x.subtotal ?? null,
      vatTotal: x.vatTotal ?? null,
      total: x.total ?? null,
      lines: p.lines.map((l) => ({
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        netAmount: l.netAmount,
        vatAmount: l.taxAmount,
        accountId: coding.get(l.lineNumber)?.accountId ?? null,
        taxCodeId: coding.get(l.lineNumber)?.taxCodeId ?? null,
      })),
    };
  }

  private snapshotFromDto(d: ApproveReviewedDto): DraftValues {
    const n = (v: string | undefined) => (v === undefined ? null : v);
    return {
      direction: d.direction,
      contactId: d.contactId,
      invoiceNumber: d.invoiceNumber,
      invoiceDate: d.invoiceDate,
      dueDate: n(d.dueDate),
      currency: d.currency,
      issuerVatNumber: n(d.issuerVatNumber),
      recipientVatNumber: n(d.recipientVatNumber),
      subtotal: n(d.subtotal),
      vatTotal: n(d.vatTotal),
      total: n(d.total),
      lines: d.lines.map((l) => ({
        description: l.description,
        quantity: n(l.quantity),
        unitPrice: n(l.unitPrice),
        netAmount: n(l.netAmount),
        vatAmount: n(l.vatAmount),
        accountId: l.accountId,
        taxCodeId: l.taxCodeId,
      })),
    };
  }
}

/** Field paths whose values differ (decimal strings compared as decimals, so 120 = 120.00). */
export function diffSnapshots(a: DraftValues, b: DraftValues): string[] {
  const same = (x: string | null, y: string | null) => {
    if (x === y) return true;
    if (x === null || y === null) return false;
    const decimal = /^-?\d+(\.\d+)?$/;
    return decimal.test(x) && decimal.test(y) ? new Prisma.Decimal(x).equals(y) : x.trim() === y.trim();
  };
  const changed: string[] = [];
  for (const key of Object.keys(a) as Array<keyof DraftValues>) {
    if (key === 'lines') continue;
    if (!same(a[key] as string | null, b[key] as string | null)) changed.push(key);
  }
  const count = Math.max(a.lines.length, b.lines.length);
  for (let i = 0; i < count; i++) {
    const la = a.lines[i];
    const lb = b.lines[i];
    if (!la || !lb) {
      changed.push(`lines[${i + 1}]`);
      continue;
    }
    for (const key of Object.keys(la) as Array<keyof typeof la>) {
      if (!same(la[key], lb[key])) changed.push(`lines[${i + 1}].${key}`);
    }
  }
  return changed;
}
