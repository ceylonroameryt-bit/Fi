import { Inject, Injectable, Optional } from '@nestjs/common';
import { Account, AccountType, JournalSourceType, JournalStatus, TaxDirection, TaxTreatment } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../database/prisma.service';
import { MoneyService } from '../../accounting-engine/money.service';
import { rateOnDate } from '../../tax/tax-codes.service';
import { INPUT_ONLY_TREATMENTS } from '../../tax/vat-boxes';
import { SELF_ACCOUNTED_TREATMENTS } from '../../tax/vat-calculation';
import { AiGatewayService } from '../gateway/ai-gateway.service';
import { AI_PROVIDER, AiProvider } from '../gateway/ai-provider.interface';
import { codingPrompt } from '../gateway/prompts/coding.prompt';
import { nameSimilarity } from '../identity/name-similarity';
import type { ClassifiedLineResult } from '../document-intelligence/line-classification.service';

export type CodingSource = 'HISTORY' | 'RULE' | 'DOCUMENT' | 'MODEL' | 'NONE';

export interface LineCoding {
  lineNumber: number;
  accountId: string | null;
  accountCode: string | null;
  accountSource: CodingSource;
  taxCodeId: string | null;
  taxCode: string | null;
  taxSource: CodingSource;
  /** Shown to the reviewer: why this account / tax code was suggested (or not). */
  reason: string;
}

export interface CodingInput {
  organizationId: string;
  userId?: string | null;
  documentId: string;
  direction: 'PURCHASE' | 'SALE';
  contactId: string | null;
  contactName: string | null;
  lines: ClassifiedLineResult[];
  /** Tax codes must be in force on this date (document date, else today). */
  postingDate: Date | null;
  business?: string;
}

const HISTORY_LIMIT = 200;
const DESCRIPTION_MATCH = 0.6;
const DOMINANT_SHARE = 0.8;
const DOMINANT_MIN_LINES = 3;

type TaxOption = { id: string; code: string; name: string; treatment: TaxTreatment; rate: string };

/**
 * Suggests an account and tax code per line: this supplier's (or customer's) history first,
 * then deterministic rules, then the model choosing only from the organisation's own accounts
 * and the valid tax codes. VAT printed on the document always decides the tax code when it can.
 */
@Injectable()
export class CodingSuggestionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly money: MoneyService,
    private readonly gateway: AiGatewayService,
    @Optional() @Inject(AI_PROVIDER) private readonly provider: AiProvider | null,
  ) {}

  async suggest(input: CodingInput): Promise<LineCoding[]> {
    const date = input.postingDate ?? new Date();
    const [allAccounts, allTax] = await Promise.all([
      this.prisma.account.findMany({ where: { organizationId: input.organizationId } }),
      this.prisma.taxCode.findMany({ where: { isActive: true }, include: { rates: true } }),
    ]);
    const accounts = postableAccounts(allAccounts as Account[], input.direction);
    const accountById = new Map(accounts.map((a) => [a.id, a]));
    const taxOptions: TaxOption[] = allTax
      .map((t) => ({ id: t.id, code: t.code, name: t.name, treatment: t.treatment, rate: rateOnDate(t.rates, date)?.toString() ?? null }))
      .filter((t): t is TaxOption => t.rate !== null)
      .filter((t) => input.direction === 'PURCHASE' || !INPUT_ONLY_TREATMENTS.has(t.treatment));
    const taxByCode = new Map(taxOptions.map((t) => [t.code, t]));
    const taxById = new Map(taxOptions.map((t) => [t.id, t]));

    const result: LineCoding[] = input.lines.map((line) => {
      const docTax = line.taxClassification ? taxByCode.get(line.taxClassification) : undefined;
      return {
        lineNumber: line.lineNumber,
        accountId: null,
        accountCode: null,
        accountSource: 'NONE',
        taxCodeId: docTax?.id ?? null,
        taxCode: docTax?.code ?? null,
        taxSource: docTax ? 'DOCUMENT' : 'NONE',
        reason: docTax ? `Tax code ${docTax.code} from the VAT printed on the line.` : '',
      };
    });

    // 1. History: this counterparty's previously posted, tax-analysed lines.
    if (input.contactId) {
      const history = await this.prisma.journalLine.findMany({
        where: {
          organizationId: input.organizationId,
          taxCodeId: { not: null },
          taxDirection: input.direction === 'PURCHASE' ? TaxDirection.INPUT : TaxDirection.OUTPUT,
          journalEntry: {
            organizationId: input.organizationId,
            status: JournalStatus.POSTED,
            sourceType: { in: [JournalSourceType.INVOICE, JournalSourceType.BILL] },
            lines: { some: { contactId: input.contactId } },
          },
        },
        select: { description: true, accountId: true, taxCodeId: true, journalEntry: { select: { journalNumber: true, postingDate: true } } },
        orderBy: { journalEntry: { postingDate: 'desc' } },
        take: HISTORY_LIMIT,
      });
      const usable = history.filter((h) => accountById.has(h.accountId) && h.taxCodeId && taxById.has(h.taxCodeId));
      const dominant = dominantCoding(usable);
      const who = input.contactName ?? 'this counterparty';

      input.lines.forEach((line, i) => {
        const best = usable
          .map((h) => ({ h, score: nameSimilarity(line.description, h.description ?? '') }))
          .filter((x) => x.score >= DESCRIPTION_MATCH)
          .sort((a, b) => b.score - a.score)[0];
        const pick = best
          ? { accountId: best.h.accountId, taxCodeId: best.h.taxCodeId!, why: `Same as "${best.h.description}" on ${best.h.journalEntry.journalNumber} (${best.h.journalEntry.postingDate.toISOString().slice(0, 10)}) from ${who}.` }
          : dominant
            ? { accountId: dominant.accountId, taxCodeId: dominant.taxCodeId, why: `${who} is coded this way on ${dominant.count} of ${dominant.total} earlier lines.` }
            : null;
        if (!pick) return;
        this.applyAccount(result[i], accountById.get(pick.accountId)!, 'HISTORY');
        this.applyTax(result[i], line, taxById.get(pick.taxCodeId)!, 'HISTORY');
        result[i].reason = joinReason(pick.why, result[i].reason);
      });
    }

    // 2. Rules: a category that identifies exactly one account of the right kind.
    input.lines.forEach((line, i) => {
      if (result[i].accountId) return;
      const account = ruleAccount(accounts, line, input.direction);
      if (account) {
        this.applyAccount(result[i], account, 'RULE');
        result[i].reason = joinReason(`Only ${account.accountSubtype.toLowerCase().replace(/_/g, ' ')} account for a ${line.accountingCategory.toLowerCase().replace(/_/g, ' ')} item.`, result[i].reason);
      }
    });

    // 3. Model: only lines still missing something, only from our lists.
    const open = input.lines.filter((_, i) => !result[i].accountId || !result[i].taxCodeId);
    if (open.length > 0 && this.provider && accounts.length > 0) {
      const nonce = randomBytes(8).toString('hex');
      const answer = await this.gateway.run({
        organizationId: input.organizationId,
        userId: input.userId,
        documentId: input.documentId,
        prompt: codingPrompt(accounts.map((a) => a.code), taxOptions.map((t) => t.code)),
        vars: {
          business: input.business ?? '(not described)',
          counterparty: input.contactName ?? '(not matched)',
          direction: input.direction === 'PURCHASE' ? 'purchase (supplier bill)' : 'sale (sales invoice)',
          accounts: accounts.map((a) => `${a.code} | ${a.name} | ${a.accountType}`).join('\n'),
          taxCodes: taxOptions.map((t) => `${t.code} | ${t.name} | ${this.money.toDecimal(t.rate).mul(100).toFixed(0)}%`).join('\n'),
          nonce,
          lines: open
            .map((l) => `${l.lineNumber}. ${l.description.replace(/<\s*\/\s*lines/gi, '< /lines')} | net ${l.netAmount ?? 'not shown'} | VAT ${l.taxAmount ?? 'not shown'}`)
            .join('\n'),
        },
      });
      const accountByCode = new Map(accounts.map((a) => [a.code, a]));
      for (const a of answer.lines) {
        const i = result.findIndex((r) => r.lineNumber === a.lineNumber);
        if (i < 0 || !open.some((l) => l.lineNumber === a.lineNumber)) continue;
        const line = input.lines[i];
        const notes: string[] = [];
        if (!result[i].accountId && a.accountCode && accountByCode.has(a.accountCode)) {
          this.applyAccount(result[i], accountByCode.get(a.accountCode)!, 'MODEL');
        }
        if (!result[i].taxCodeId && a.taxCode && taxByCode.has(a.taxCode)) {
          if (!this.applyTax(result[i], line, taxByCode.get(a.taxCode)!, 'MODEL')) {
            notes.push(`AI tax code ${a.taxCode} ignored: it contradicts the VAT printed on the line.`);
          }
        }
        result[i].reason = joinReason(result[i].reason, `AI: ${a.reason}`, ...notes);
      }
    }

    for (const r of result) {
      if (!r.reason) r.reason = 'No history for this counterparty and no AI suggestion; a reviewer must choose.';
    }
    return result;
  }

  private applyAccount(target: LineCoding, account: Account, source: CodingSource): void {
    target.accountId = account.id;
    target.accountCode = account.code;
    target.accountSource = source;
  }

  /** Sets the tax code unless the document already decided it or the line's printed VAT contradicts it. */
  private applyTax(target: LineCoding, line: ClassifiedLineResult, tax: TaxOption, source: CodingSource): boolean {
    if (target.taxSource === 'DOCUMENT') return true;
    if (!taxConsistentWithLine(this.money, line, tax)) return false;
    target.taxCodeId = tax.id;
    target.taxCode = tax.code;
    target.taxSource = source;
    return true;
  }
}

/** Accounts a line can be posted to for this direction (never control accounts). */
function postableAccounts(accounts: Account[], direction: 'PURCHASE' | 'SALE'): Account[] {
  const types: AccountType[] = direction === 'PURCHASE' ? [AccountType.EXPENSE, AccountType.ASSET] : [AccountType.REVENUE];
  return accounts
    .filter((a) => a.isActive && !a.isControlAccount && types.includes(a.accountType))
    .filter((a) => !['BANK', 'CASH', 'ACCOUNTS_RECEIVABLE', 'ACCOUNTS_PAYABLE', 'TAX_PAYABLE'].includes(a.accountSubtype))
    .sort((a, b) => a.code.localeCompare(b.code));
}

function ruleAccount(accounts: Account[], line: ClassifiedLineResult, direction: 'PURCHASE' | 'SALE'): Account | null {
  const only = (...subtypes: string[]) => {
    const hits = accounts.filter((a) => subtypes.includes(a.accountSubtype));
    return hits.length === 1 ? hits[0] : null;
  };
  const c = line.accountingCategory;
  if (c.includes('INVENTORY')) return only('INVENTORY');
  if (c.includes('ASSET')) return only('FIXED_ASSET');
  if (direction === 'SALE' && c.endsWith('_SALE')) return only('SALES', 'SERVICE_REVENUE');
  return null;
}

/**
 * A printed VAT amount constrains the code: positive VAT needs a code whose rate gives that VAT
 * (the document rule already set it when it could); 0.00 VAT allows only nil-rate or
 * self-accounted (reverse charge / PIVA) codes. No printed VAT: any code may be suggested.
 */
function taxConsistentWithLine(money: MoneyService, line: ClassifiedLineResult, tax: TaxOption): boolean {
  if (line.taxAmount === null) return true;
  const vat = money.toDecimal(line.taxAmount);
  if (vat.isZero()) return money.toDecimal(tax.rate).isZero() || SELF_ACCOUNTED_TREATMENTS.has(tax.treatment);
  if (line.netAmount === null) return false;
  return vat.minus(money.toDecimal(line.netAmount).mul(tax.rate)).abs().lessThanOrEqualTo('0.01');
}

function dominantCoding(history: Array<{ accountId: string; taxCodeId: string | null }>) {
  if (history.length < DOMINANT_MIN_LINES) return null;
  const counts = new Map<string, number>();
  for (const h of history) {
    const key = `${h.accountId}|${h.taxCodeId}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const [key, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (count / history.length < DOMINANT_SHARE) return null;
  const [accountId, taxCodeId] = key.split('|');
  return { accountId, taxCodeId, count, total: history.length };
}

const joinReason = (...parts: string[]) => parts.filter(Boolean).join(' ');
