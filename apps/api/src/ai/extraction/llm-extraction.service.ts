import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { DomainException } from '../../common/errors/domain.exception';
import { AiGatewayService } from '../gateway/ai-gateway.service';
import { DOCUMENT_EXTRACTION_PROMPT, DocumentExtractionOutput } from '../gateway/prompts/document-extraction.prompt';
import type { RawExtractedEntity, RawExtractedLine, RawExtractionResult } from '../providers/llm-provider.interface';
import type { OrganisationIdentity } from '../identity/party-identity';

export type FieldIssueType = 'MISSING_SOURCE' | 'SOURCE_NOT_FOUND' | 'VALUE_NOT_IN_SOURCE' | 'INVALID_FORMAT';

export interface FieldIssue {
  field: string;
  issue: FieldIssueType;
}

export interface LlmExtractionResult {
  result: RawExtractionResult;
  /** Values the model returned that code could not verify against the document (dropped). */
  issues: FieldIssue[];
  /** Raw model output, kept for audit. */
  modelOutput: DocumentExtractionOutput;
  promptKey: string;
  promptVersion: number;
}

/** Documents longer than this are refused rather than silently truncated. */
const MAX_DOCUMENT_CHARS = 200_000;

const CURRENCY_MARKS: Record<string, string[]> = { GBP: ['£', 'gbp'], EUR: ['€', 'eur'], USD: ['$', 'usd'] };

/**
 * LLM-based field extraction through the AI gateway. The model only reads; code then checks
 * every value against the document text and drops anything it cannot verify.
 */
@Injectable()
export class LlmExtractionService {
  constructor(private readonly gateway: AiGatewayService) {}

  async extract(input: {
    organizationId: string;
    userId?: string | null;
    documentId: string;
    text: string;
    organisation: OrganisationIdentity;
  }): Promise<LlmExtractionResult> {
    if (input.text.length > MAX_DOCUMENT_CHARS) {
      throw new DomainException('DOCUMENT_TOO_LONG_FOR_AI', `Document text exceeds ${MAX_DOCUMENT_CHARS} characters`);
    }
    const { nonce, document } = buildDocumentBlock(input.text);
    const modelOutput = await this.gateway.run({
      organizationId: input.organizationId,
      userId: input.userId,
      documentId: input.documentId,
      prompt: DOCUMENT_EXTRACTION_PROMPT,
      vars: { organisation: describeOrganisation(input.organisation), nonce, document },
    });
    const { result, issues } = verifyExtraction(modelOutput, input.text);
    return {
      result,
      issues,
      modelOutput,
      promptKey: DOCUMENT_EXTRACTION_PROMPT.key,
      promptVersion: DOCUMENT_EXTRACTION_PROMPT.version,
    };
  }
}

/** Random tag id plus neutralised closing tags, so document text cannot break out of its data block. */
export function buildDocumentBlock(text: string): { nonce: string; document: string } {
  return { nonce: randomBytes(8).toString('hex'), document: text.replace(/<\s*\/\s*document/gi, '< /document') };
}

function describeOrganisation(org: OrganisationIdentity): string {
  const v = (x: string | null | undefined) => x || '(not set)';
  return [`Name: ${v(org.name)}`, `Legal name: ${v(org.legalName)}`, `VAT number: ${v(org.taxNumber)}`, `Company number: ${v(org.registrationNumber)}`].join('\n');
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
const compact = (s: string) => s.toLowerCase().replace(/[\s,]/g, '');

type Kind = 'text' | 'amount' | 'date' | 'currency' | 'enum';

/** Pure check of model output against the document text (exported for tests). */
export function verifyExtraction(output: DocumentExtractionOutput, documentText: string): { result: RawExtractionResult; issues: FieldIssue[] } {
  const doc = norm(documentText);
  const issues: FieldIssue[] = [];

  const field = (name: string, f: { value: string | null; source: string | null }, kind: Kind): string | undefined => {
    if (f.value === null || f.value === undefined) return undefined;
    if (!f.source) return reject(name, 'MISSING_SOURCE');
    const value = formatValue(f.value, kind);
    if (value === null) return reject(name, 'INVALID_FORMAT');
    if (!doc.includes(norm(f.source))) return reject(name, 'SOURCE_NOT_FOUND');
    if (!valueInSource(value, f.source, kind)) return reject(name, 'VALUE_NOT_IN_SOURCE');
    return value;
  };
  const reject = (name: string, issue: FieldIssueType): undefined => {
    issues.push({ field: name, issue });
    return undefined;
  };

  const party = (prefix: string, p: DocumentExtractionOutput['issuer']): RawExtractedEntity => ({
    name: field(`${prefix}.name`, p.name, 'text'),
    vatNumber: field(`${prefix}.vatNumber`, p.vatNumber, 'text'),
    companyNumber: field(`${prefix}.companyNumber`, p.companyNumber, 'text'),
    address: field(`${prefix}.address`, p.address, 'text'),
  });

  const lines: RawExtractedLine[] = [];
  output.lines.forEach((l, i) => {
    const name = `lines[${i + 1}]`;
    if (!l.source) return void reject(name, 'MISSING_SOURCE');
    if (!doc.includes(norm(l.source))) return void reject(name, 'SOURCE_NOT_FOUND');
    const onLine = (key: keyof typeof l, kind: Kind) =>
      field(`${name}.${String(key)}`, { value: l[key] as string | null, source: l.source }, kind);
    const description = onLine('description', 'text');
    if (!description) return void reject(`${name}.description`, 'MISSING_SOURCE');
    lines.push(
      dropUndefined({
        description,
        quantity: onLine('quantity', 'amount'),
        unitPrice: onLine('unitPrice', 'amount'),
        net: onLine('net', 'amount'),
        vat: onLine('vat', 'amount'),
        total: onLine('total', 'amount'),
      }) as RawExtractedLine,
    );
  });

  const result: RawExtractionResult = {
    documentTypeHint: field('documentType', output.documentType, 'enum'),
    invoiceNumber: field('invoiceNumber', output.invoiceNumber, 'text'),
    invoiceDate: field('invoiceDate', output.invoiceDate, 'date'),
    dueDate: field('dueDate', output.dueDate, 'date'),
    currency: field('currency', output.currency, 'currency'),
    issuer: dropUndefined(party('issuer', output.issuer)),
    recipient: dropUndefined(party('recipient', output.recipient)),
    lines,
    subtotal: field('subtotal', output.subtotal, 'amount'),
    vatTotal: field('vatTotal', output.vatTotal, 'amount'),
    total: field('total', output.total, 'amount'),
    rawText: documentText,
  };
  return { result, issues };
}

function formatValue(raw: string, kind: Kind): string | null {
  const value = raw.trim();
  switch (kind) {
    case 'amount': {
      const clean = value.replace(/[,\s]/g, '');
      return /^-?\d+(\.\d+)?$/.test(clean) ? clean : null;
    }
    case 'date': {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
      if (!m) return null;
      const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
      return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] ? value : null;
    }
    case 'currency':
      return /^[A-Z]{3}$/.test(value) ? value : null;
    default:
      return value.length > 0 ? value : null;
  }
}

function valueInSource(value: string, source: string, kind: Kind): boolean {
  switch (kind) {
    case 'amount': {
      const src = compact(source);
      return src.includes(value) || (value.includes('.') && src.includes(value.replace(/\.?0+$/, '')));
    }
    case 'date':
      return dateInSource(value, source);
    case 'currency':
      return (CURRENCY_MARKS[value] ?? [value.toLowerCase()]).some((mark) => source.toLowerCase().includes(mark));
    case 'enum':
      return true; // a classification of the quoted text, not a copy of it
    default:
      return norm(source).includes(norm(value));
  }
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** The quote must show the same day, month (number or name) and year as the ISO value. */
function dateInSource(iso: string, source: string): boolean {
  const [y, m, d] = iso.split('-').map(Number);
  const s = source.toLowerCase();
  const numbers = (s.match(/\d+/g) ?? []).map(Number);
  const hasYear = numbers.includes(y) || numbers.includes(y % 100);
  const hasMonth = numbers.includes(m) || s.includes(MONTHS[m - 1]);
  const hasDay = numbers.includes(d); // "30th" also yields 30
  return hasYear && hasMonth && hasDay;
}

function dropUndefined<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}
