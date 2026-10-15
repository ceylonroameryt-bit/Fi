import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ILlmProvider, RawExtractedEntity, RawExtractedLine, RawExtractionResult } from './llm-provider.interface';

const AMOUNT = String.raw`[£$€]?\s*(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)`;
const VAT_NO = String.raw`(GB\s?\d{3}\s?\d{4}\s?\d{2}(?:\s?\d{3})?)`;
/** Lines that describe the buyer rather than the seller. */
const BUYER_CONTEXT = /\b(customer|buyer|recipient|bill(?:ed)?\s*to|invoice\s*to|sold\s*to|ship\s*to)\b/i;
const SUMMARY_LINE = /^(sub-?\s?total|net\s*total|total|grand\s*total|amount\s*due|balance\s*due|vat|tax)\b/i;

/**
 * Rule-based text extractor used until the LLM extractor (Stage 7) lands.
 * It reads only what is explicitly labelled in the text; anything not found stays undefined.
 * It never invents numbers, dates, currencies, VAT or line items, and does no float arithmetic.
 */
@Injectable()
export class HeuristicLlmProvider implements ILlmProvider {
  async extractDocumentData(input: {
    buffer: Buffer;
    fileName: string;
    mimeType: string;
    text?: string;
  }): Promise<RawExtractionResult> {
    const rawText = input.text ?? input.buffer.toString('utf-8');
    const lines = rawText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const issuer: RawExtractedEntity = {};
    const recipient: RawExtractedEntity = {};
    const items: RawExtractedLine[] = [];
    let invoiceNumber: string | undefined;
    let invoiceDate: string | undefined;
    let dueDate: string | undefined;
    let subtotal: string | undefined;
    let vatTotal: string | undefined;
    let total: string | undefined;

    for (const line of lines) {
      const party = BUYER_CONTEXT.test(line) ? recipient : issuer;

      const vat = new RegExp(String.raw`\bVAT\b[^\n]*?${VAT_NO}`, 'i').exec(line);
      if (vat) {
        party.vatNumber ??= vat[1].replace(/\s/g, '').toUpperCase();
        continue;
      }
      const company = /\bcompany\s*(?:reg(?:istration)?\.?\s*)?(?:no\.?|number)\s*[:-]?\s*([A-Z]{0,2}\d{6,8})\b/i.exec(line);
      if (company) {
        party.companyNumber ??= company[1].toUpperCase();
        continue;
      }

      let m = /^(?:supplier|from|seller|issued\s*by|vendor)\s*[:-]\s*(.+)$/i.exec(line);
      if (m) {
        issuer.name ??= m[1].trim();
        continue;
      }
      m = /^(?:bill(?:ed)?\s*to|invoice\s*to|customer|buyer|sold\s*to)\s*[:-]\s*(.+)$/i.exec(line);
      if (m) {
        recipient.name ??= m[1].trim();
        continue;
      }
      m = /^(?:invoice|inv)\s*(?:no\.?|number|#)\s*[:-]?\s*([A-Za-z0-9][A-Za-z0-9\-_/]*)$/i.exec(line);
      if (m) {
        invoiceNumber ??= m[1];
        continue;
      }
      m = /^(?:due\s*date|payment\s*due)\s*[:-]\s*(.+)$/i.exec(line);
      if (m) {
        dueDate ??= this.parseDate(m[1]);
        continue;
      }
      m = /^(?:invoice\s*date|date|tax\s*point)\s*[:-]\s*(.+)$/i.exec(line);
      if (m) {
        invoiceDate ??= this.parseDate(m[1]);
        continue;
      }

      m = new RegExp(String.raw`^(?:sub-?\s?total|net\s*total)\s*[:-]?\s*${AMOUNT}$`, 'i').exec(line);
      if (m) {
        subtotal ??= this.amount(m[1]);
        continue;
      }
      m = new RegExp(String.raw`^(?:vat|tax)(?:\s*total)?(?:\s*@?\s*\d+(?:\.\d+)?\s*%)?\s*[:-]?\s*${AMOUNT}$`, 'i').exec(line);
      if (m) {
        vatTotal ??= this.amount(m[1]);
        continue;
      }
      m = new RegExp(String.raw`^(?:grand\s*total|total(?:\s*due)?|amount\s*due|balance\s*due)\s*[:-]?\s*${AMOUNT}$`, 'i').exec(line);
      if (m) {
        total ??= this.amount(m[1]);
        continue;
      }

      if (line.includes(':') || SUMMARY_LINE.test(line)) continue;

      // "10,000 litres Diesel £12,000.00"
      m = new RegExp(String.raw`^([\d,]+(?:\.\d+)?)\s*(litres?|ltrs?|kg|units?|hours?|hrs)\s+(.*[A-Za-z].*?)\s+${AMOUNT}$`, 'i').exec(line);
      if (m) {
        items.push({ description: m[3].trim(), quantity: m[1].replace(/,/g, ''), unit: m[2].toLowerCase(), net: this.amount(m[4]) });
        continue;
      }
      // "Widgets 120.00"
      m = new RegExp(String.raw`^(.*[A-Za-z].*?)\s+${AMOUNT}$`).exec(line);
      if (m) items.push({ description: m[1].trim(), net: this.amount(m[2]) });
    }

    return {
      invoiceNumber,
      invoiceDate,
      dueDate,
      currency: this.detectCurrency(rawText),
      issuer,
      recipient,
      lines: items,
      subtotal,
      vatTotal,
      total,
      rawText,
    };
  }

  private amount(raw: string): string {
    return new Prisma.Decimal(raw.replace(/,/g, '')).toFixed(2);
  }

  /** Exactly one currency indicated, or undefined. */
  private detectCurrency(text: string): string | undefined {
    const found = new Set<string>();
    if (/£|\bGBP\b/.test(text)) found.add('GBP');
    if (/€|\bEUR\b/.test(text)) found.add('EUR');
    if (/\$|\bUSD\b/.test(text)) found.add('USD');
    return found.size === 1 ? [...found][0] : undefined;
  }

  /** ISO yyyy-mm-dd or UK dd/mm/yyyy; anything else (or an impossible date) is undefined. */
  private parseDate(raw: string): string | undefined {
    const value = raw.trim();
    let y: number, mo: number, d: number;
    let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (m) {
      [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    } else {
      m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(value);
      if (!m) return undefined;
      [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
    }
    const date = new Date(Date.UTC(y, mo - 1, d));
    if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return undefined;
    return date.toISOString().slice(0, 10);
  }
}
