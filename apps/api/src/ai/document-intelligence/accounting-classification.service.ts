import { Injectable } from '@nestjs/common';
import { Account, AccountSubtype, AiProductType, Contact } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { MoneyService } from '../../accounting-engine/money.service';
import { ClassifiedLineResult } from './line-classification.service';
import { SemanticCategory } from '../ai.constants';

export interface ProposedJournalLine {
  /** null when no account of the organisation fits; a reviewer must choose. */
  accountId: string | null;
  accountCode: string | null;
  accountName: string | null;
  debit: string;
  credit: string;
  description: string;
  contactId?: string;
  category: string;
  /** Document line this proposal came from (absent for VAT and control lines). */
  sourceLineNumber?: number;
}

export interface ProposedAccountingIntent {
  direction: 'PURCHASE' | 'SALE';
  lines: ProposedJournalLine[];
  totalDebit: string;
  totalCredit: string;
  isBalanced: boolean;
  /** True only when every line has an account, a net amount and a VAT amount. */
  isComplete: boolean;
  /** Human-readable list of what a reviewer still has to supply. */
  missing: string[];
  inventoryValuationNotice?: string;
}

/**
 * Turns classified lines into a proposed double entry. All amounts come from the document lines
 * and are summed by code; nothing is filled in when the document or chart of accounts lacks it.
 */
@Injectable()
export class AccountingClassificationService {
  constructor(
    private readonly db: PrismaService,
    private readonly money: MoneyService,
  ) {}

  async buildAccountingIntent(
    organizationId: string,
    direction: 'PURCHASE' | 'SALE',
    lines: ClassifiedLineResult[],
    contact: Contact | null,
  ): Promise<ProposedAccountingIntent> {
    const accounts = await this.db.account.findMany({ where: { organizationId, isActive: true } });
    const missing: string[] = [];
    const proposed: ProposedJournalLine[] = [];
    let totalNet = this.money.ZERO;
    let totalVat = this.money.ZERO;

    if (lines.length === 0) missing.push('No line items were found on the document');

    for (const line of lines) {
      const label = `Line ${line.lineNumber}`;
      if (line.netAmount === null) missing.push(`${label}: net amount`);
      if (line.taxAmount === null) missing.push(`${label}: VAT amount`);
      if (line.taxClassification === null) missing.push(`${label}: tax code`);
      const account = this.accountForLine(accounts, line, direction);
      if (!account) missing.push(`${label}: account`);

      const net = this.money.toDecimal(line.netAmount ?? '0');
      totalNet = totalNet.plus(net);
      totalVat = totalVat.plus(this.money.toDecimal(line.taxAmount ?? '0'));
      proposed.push({
        ...this.accountFields(account),
        debit: direction === 'PURCHASE' ? net.toFixed(2) : '0.00',
        credit: direction === 'SALE' ? net.toFixed(2) : '0.00',
        description: line.description,
        contactId: contact?.id,
        category: line.accountingCategory,
        sourceLineNumber: line.lineNumber,
      });
    }

    if (!totalVat.isZero()) {
      const vatAccount = accounts.find((a) => a.accountSubtype === AccountSubtype.TAX_PAYABLE) ?? null;
      if (!vatAccount) missing.push('VAT control account (subtype TAX_PAYABLE)');
      proposed.push({
        ...this.accountFields(vatAccount),
        debit: direction === 'PURCHASE' ? totalVat.toFixed(2) : '0.00',
        credit: direction === 'SALE' ? totalVat.toFixed(2) : '0.00',
        description: direction === 'PURCHASE' ? 'Input VAT' : 'Output VAT',
        category: direction === 'PURCHASE' ? SemanticCategory.INPUT_VAT : SemanticCategory.OUTPUT_VAT,
      });
    }

    // Control line = net + VAT, calculated here (never the model's or document's total).
    const gross = totalNet.plus(totalVat);
    const control = this.controlAccount(accounts, contact, direction);
    if (!control) missing.push(direction === 'PURCHASE' ? 'Creditors control account' : 'Debtors control account');
    if (!contact) missing.push(direction === 'PURCHASE' ? 'Supplier' : 'Customer');
    proposed.push({
      ...this.accountFields(control),
      debit: direction === 'SALE' ? gross.toFixed(2) : '0.00',
      credit: direction === 'PURCHASE' ? gross.toFixed(2) : '0.00',
      description: direction === 'PURCHASE' ? `Payable to ${contact?.name ?? 'supplier (not matched)'}` : `Receivable from ${contact?.name ?? 'customer (not matched)'}`,
      contactId: contact?.id,
      category: direction === 'PURCHASE' ? SemanticCategory.ACCOUNTS_PAYABLE : SemanticCategory.ACCOUNTS_RECEIVABLE,
    });

    const totalDebit = proposed.reduce((a, l) => a.plus(l.debit), this.money.ZERO);
    const totalCredit = proposed.reduce((a, l) => a.plus(l.credit), this.money.ZERO);

    return {
      direction,
      lines: proposed,
      totalDebit: totalDebit.toFixed(2),
      totalCredit: totalCredit.toFixed(2),
      isBalanced: totalDebit.equals(totalCredit),
      isComplete: missing.length === 0,
      missing,
      inventoryValuationNotice:
        direction === 'SALE' && lines.some((l) => l.productType === AiProductType.INVENTORY)
          ? 'Inventory items identified. Cost of sales must be computed by the stock valuation engine on fulfilment, not estimated by AI.'
          : undefined,
    };
  }

  private accountFields(account: Account | null) {
    return { accountId: account?.id ?? null, accountCode: account?.code ?? null, accountName: account?.name ?? null };
  }

  /** Only categories that identify a specific kind of account; otherwise null (no "first expense account"). */
  private accountForLine(accounts: Account[], line: ClassifiedLineResult, direction: 'PURCHASE' | 'SALE'): Account | null {
    const bySubtype = (...subtypes: AccountSubtype[]) => {
      const matches = accounts.filter((a) => a.accountSubtype && subtypes.includes(a.accountSubtype));
      return matches.length === 1 ? matches[0] : null; // ambiguous when several fit
    };
    const category = line.accountingCategory;
    if (category.includes('INVENTORY')) return bySubtype(AccountSubtype.INVENTORY);
    if (category.includes('ASSET')) return bySubtype(AccountSubtype.FIXED_ASSET);
    if (direction === 'SALE' && category.endsWith('_SALE')) return bySubtype(AccountSubtype.SALES, AccountSubtype.SERVICE_REVENUE);
    return null;
  }

  private controlAccount(accounts: Account[], contact: Contact | null, direction: 'PURCHASE' | 'SALE'): Account | null {
    const preferredId = direction === 'PURCHASE' ? contact?.payableAccountId : contact?.receivableAccountId;
    const preferred = preferredId ? accounts.find((a) => a.id === preferredId) : undefined;
    if (preferred) return preferred;
    const subtype = direction === 'PURCHASE' ? AccountSubtype.ACCOUNTS_PAYABLE : AccountSubtype.ACCOUNTS_RECEIVABLE;
    const matches = accounts.filter((a) => a.accountSubtype === subtype);
    return matches.length === 1 ? matches[0] : null;
  }
}
