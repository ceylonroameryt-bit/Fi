import { Injectable } from '@nestjs/common';
import { AiDocumentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { MoneyService } from '../../accounting-engine/money.service';
import type { RawExtractedLine, RawExtractionResult } from '../providers/llm-provider.interface';
import type { FieldIssue } from '../extraction/llm-extraction.service';
import { normaliseCompanyName, normaliseVatNumber } from '../identity/party-identity';
import { checkUkVatNumber } from './vat-number';

export type FieldStatus = 'verified' | 'inconsistent' | 'missing';

export interface FieldValidation {
  status: FieldStatus;
  findings: string[];
}

export interface ValidationFinding {
  rule: string;
  fields: string[];
  message: string;
}

export interface ExtractionValidation {
  /** Keyed by field path, e.g. "total", "issuer.vatNumber", "lines[2].vat" (1-based lines). */
  fields: Record<string, FieldValidation>;
  findings: ValidationFinding[];
  summary: Record<FieldStatus, number>;
  /** True when no field is inconsistent (missing fields do not make it inconsistent). */
  consistent: boolean;
}

export interface ValidationInput {
  organizationId: string;
  documentId: string;
  extraction: RawExtractionResult;
  baseCurrency: string;
  /** Values dropped by Stage 7 source verification. */
  verificationIssues?: FieldIssue[];
  /** Contact matched as the issuer, if any (for duplicate detection). */
  issuerContactId?: string | null;
  today?: Date;
}

const PENNY = new Prisma.Decimal('0.01');
const UK_RATES = ['0', '0.05', '0.20'].map((r) => new Prisma.Decimal(r));
const MAX_DAYS_AHEAD = 31;
const MAX_YEARS_OLD = 6;
const LINE_FIELDS: Array<keyof RawExtractedLine> = ['description', 'quantity', 'unitPrice', 'net', 'vat', 'total'];
const INACTIVE: AiDocumentStatus[] = [AiDocumentStatus.REJECTED, AiDocumentStatus.FAILED];

/**
 * Cross-checks extracted values with each other and with known rules. Read-only: it reports
 * each field as verified, inconsistent or missing and never changes a value.
 */
@Injectable()
export class ExtractionValidationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly money: MoneyService,
  ) {}

  async validate(input: ValidationInput): Promise<ExtractionValidation> {
    const x = input.extraction;
    const fields: Record<string, FieldValidation> = {};
    const findings: ValidationFinding[] = [];

    // 1. Presence of every field we expect on a bill/invoice.
    const register = (path: string, value: unknown) => {
      fields[path] = { status: value === undefined || value === null || value === '' ? 'missing' : 'verified', findings: [] };
    };
    register('invoiceNumber', x.invoiceNumber);
    register('invoiceDate', x.invoiceDate);
    register('dueDate', x.dueDate);
    register('currency', x.currency);
    register('issuer.name', x.issuer?.name);
    register('issuer.vatNumber', x.issuer?.vatNumber);
    if (x.issuer?.companyNumber) register('issuer.companyNumber', x.issuer.companyNumber);
    register('recipient.name', x.recipient?.name);
    if (x.recipient?.vatNumber) register('recipient.vatNumber', x.recipient.vatNumber);
    register('subtotal', x.subtotal);
    register('vatTotal', x.vatTotal);
    register('total', x.total);
    x.lines.forEach((line, i) => LINE_FIELDS.forEach((f) => register(`lines[${i + 1}].${f}`, line[f])));
    for (const issue of input.verificationIssues ?? []) {
      fields[issue.field] ??= { status: 'missing', findings: [] };
      fields[issue.field].findings.push(`Value dropped by extraction check: ${issue.issue}`);
    }

    const flag = (rule: string, paths: string[], message: string) => {
      findings.push({ rule, fields: paths, message });
      for (const p of paths) {
        fields[p] ??= { status: 'inconsistent', findings: [] };
        fields[p].status = 'inconsistent';
        fields[p].findings.push(message);
      }
    };
    const d = (v: string) => this.money.toDecimal(v);
    const fmt = (v: Prisma.Decimal) => v.toFixed(2);

    // 2. Arithmetic (only when every number involved is present).
    const nets = x.lines.map((l) => l.net);
    if (x.subtotal && x.lines.length > 0 && nets.every((n) => n !== undefined)) {
      const sum = nets.reduce((a, n) => a.plus(d(n!)), this.money.ZERO);
      if (!sum.equals(d(x.subtotal))) {
        flag('LINES_SUM_TO_SUBTOTAL', ['subtotal', ...x.lines.map((_, i) => `lines[${i + 1}].net`)], `Line nets add up to ${fmt(sum)} but the subtotal is ${fmt(d(x.subtotal))}`);
      }
    }
    if (x.subtotal && x.vatTotal && x.total) {
      const gross = d(x.subtotal).plus(d(x.vatTotal));
      if (!gross.equals(d(x.total))) {
        flag('NET_PLUS_VAT_EQUALS_TOTAL', ['subtotal', 'vatTotal', 'total'], `${fmt(d(x.subtotal))} + ${fmt(d(x.vatTotal))} = ${fmt(gross)}, but the total is ${fmt(d(x.total))}`);
      }
    }
    x.lines.forEach((line, i) => {
      const n = i + 1;
      if (line.net !== undefined && line.vat !== undefined) {
        const net = d(line.net);
        const vat = d(line.vat);
        const matchesRate = UK_RATES.some((r) => vat.minus(net.mul(r)).abs().lessThanOrEqualTo(PENNY));
        if (!matchesRate) {
          flag('LINE_VAT_MATCHES_RATE', [`lines[${n}].vat`], `VAT ${fmt(vat)} is not 0%, 5% or 20% of ${fmt(net)} (within 1p)`);
        }
        if (line.total !== undefined && !net.plus(vat).equals(d(line.total))) {
          flag('LINE_NET_PLUS_VAT', [`lines[${n}].total`], `Line ${n}: ${fmt(net)} + ${fmt(vat)} is not ${fmt(d(line.total))}`);
        }
      }
    });
    if (x.vatTotal && x.lines.length > 0 && x.lines.every((l) => l.vat !== undefined)) {
      const sum = x.lines.reduce((a, l) => a.plus(d(l.vat!)), this.money.ZERO);
      if (!sum.equals(d(x.vatTotal))) {
        flag('LINES_VAT_SUM_TO_VAT_TOTAL', ['vatTotal', ...x.lines.map((_, i) => `lines[${i + 1}].vat`)], `Line VAT adds up to ${fmt(sum)} but the VAT total is ${fmt(d(x.vatTotal))}`);
      }
    }

    // 3. Identifiers, dates, currency.
    for (const side of ['issuer', 'recipient'] as const) {
      const vat = x[side]?.vatNumber;
      if (!vat) continue;
      const check = checkUkVatNumber(vat);
      if (check.status === 'invalid') flag('UK_VAT_NUMBER', [`${side}.vatNumber`], `${vat}: ${check.reason}`);
    }
    const today = input.today ?? new Date();
    if (x.invoiceDate) {
      const date = new Date(`${x.invoiceDate}T00:00:00Z`);
      const latest = new Date(today.getTime() + MAX_DAYS_AHEAD * 86_400_000);
      const earliest = new Date(Date.UTC(today.getUTCFullYear() - MAX_YEARS_OLD, today.getUTCMonth(), today.getUTCDate()));
      if (date > latest) flag('PLAUSIBLE_DATE', ['invoiceDate'], `Invoice date ${x.invoiceDate} is more than ${MAX_DAYS_AHEAD} days in the future`);
      if (date < earliest) flag('PLAUSIBLE_DATE', ['invoiceDate'], `Invoice date ${x.invoiceDate} is more than ${MAX_YEARS_OLD} years old`);
      if (x.dueDate && x.dueDate < x.invoiceDate) flag('PLAUSIBLE_DATE', ['dueDate'], `Due date ${x.dueDate} is before the invoice date ${x.invoiceDate}`);
    }
    if (x.currency && x.currency !== input.baseCurrency) {
      flag('CURRENCY', ['currency'], `Currency ${x.currency} differs from the organisation's ${input.baseCurrency}; foreign currency is not supported yet`);
    }

    // 4. Duplicate: same supplier and invoice number on another active document.
    if (x.invoiceNumber) {
      const duplicate = await this.findDuplicate(input);
      if (duplicate) {
        flag('DUPLICATE_DOCUMENT', ['invoiceNumber'], `Invoice ${x.invoiceNumber} from this supplier is already document ${duplicate}`);
      }
    }

    const summary: Record<FieldStatus, number> = { verified: 0, inconsistent: 0, missing: 0 };
    for (const f of Object.values(fields)) summary[f.status]++;
    return { fields, findings, summary, consistent: summary.inconsistent === 0 };
  }

  private async findDuplicate(input: ValidationInput): Promise<string | null> {
    const x = input.extraction;
    const candidates = await this.prisma.aiExtraction.findMany({
      where: {
        organizationId: input.organizationId,
        documentId: { not: input.documentId },
        invoiceNumber: { equals: x.invoiceNumber, mode: 'insensitive' },
      },
      select: {
        documentId: true,
        issuerTaxId: true,
        issuerName: true,
        document: { select: { status: true, classifications: { select: { entityId: true } } } },
      },
    });
    const ourVat = normaliseVatNumber(x.issuer?.vatNumber);
    const ourName = normaliseCompanyName(x.issuer?.name);
    for (const c of candidates) {
      if (INACTIVE.includes(c.document.status)) continue;
      const theirVat = normaliseVatNumber(c.issuerTaxId);
      const sameSupplier =
        ourVat && theirVat
          ? ourVat === theirVat
          : (!!input.issuerContactId && c.document.classifications.some((k) => k.entityId === input.issuerContactId)) ||
            (!!ourName && ourName === normaliseCompanyName(c.issuerName));
      if (sameSupplier) return c.documentId;
    }
    return null;
  }
}
