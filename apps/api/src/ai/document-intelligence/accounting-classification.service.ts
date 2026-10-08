import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { MoneyService } from '../../accounting-engine/money.service';
import { Account, AccountSubtype, Contact } from '@prisma/client';
import { ClassifiedLineResult } from './line-classification.service';
import { ResolvedTaxInfo } from './tax-classification.service';
import { SemanticCategory } from '../ai.constants';

export interface ProposedJournalLine {
  accountId: string;
  accountCode: string;
  accountName: string;
  debit: string;
  credit: string;
  description: string;
  contactId?: string;
  category: string;
}

export interface ProposedAccountingIntent {
  direction: 'PURCHASE' | 'SALE';
  lines: ProposedJournalLine[];
  totalDebit: string;
  totalCredit: string;
  isBalanced: boolean;
  inventoryValuationNotice?: string;
}

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
    _taxInfo: ResolvedTaxInfo,
    contact: Contact | null,
  ): Promise<ProposedAccountingIntent> {
    const orgAccounts = await this.db.account.findMany({
      where: { organizationId, isActive: true },
    });

    const proposedLines: ProposedJournalLine[] = [];
    let runningNet = this.money.ZERO;
    let runningVat = this.money.ZERO;
    let runningTotal = this.money.ZERO;

    // 1. Process document product lines
    for (const line of lines) {
      const net = this.money.toDecimal(line.netAmount);
      const vat = this.money.toDecimal(line.taxAmount);
      const total = this.money.toDecimal(line.totalAmount);

      runningNet = this.money.add(runningNet, net);
      runningVat = this.money.add(runningVat, vat);
      runningTotal = this.money.add(runningTotal, total);

      const targetAccount = this.resolveAccountForCategory(orgAccounts, line.accountingCategory, direction);

      if (direction === 'PURCHASE') {
        // Purchase line = DEBIT (Expense, Inventory asset, or Fixed asset)
        proposedLines.push({
          accountId: targetAccount.id,
          accountCode: targetAccount.code,
          accountName: targetAccount.name,
          debit: net.toFixed(2),
          credit: '0.00',
          description: line.description,
          contactId: contact?.id,
          category: line.accountingCategory,
        });
      } else {
        // Sale line = CREDIT (Sales revenue)
        proposedLines.push({
          accountId: targetAccount.id,
          accountCode: targetAccount.code,
          accountName: targetAccount.name,
          debit: '0.00',
          credit: net.toFixed(2),
          description: line.description,
          contactId: contact?.id,
          category: line.accountingCategory,
        });
      }
    }

    // 2. Tax Line (Input VAT or Output VAT)
    if (!runningVat.isZero()) {
      const taxAccount = this.resolveTaxAccount(orgAccounts);
      if (direction === 'PURCHASE') {
        // Input VAT is DEBIT (Asset / Recoverable tax)
        proposedLines.push({
          accountId: taxAccount.id,
          accountCode: taxAccount.code,
          accountName: taxAccount.name,
          debit: runningVat.toFixed(2),
          credit: '0.00',
          description: 'Input VAT (Recoverable purchase tax)',
          category: SemanticCategory.INPUT_VAT,
        });
      } else {
        // Output VAT is CREDIT (Tax liability)
        proposedLines.push({
          accountId: taxAccount.id,
          accountCode: taxAccount.code,
          accountName: taxAccount.name,
          debit: '0.00',
          credit: runningVat.toFixed(2),
          description: 'Output VAT (Collected sales tax)',
          category: SemanticCategory.OUTPUT_VAT,
        });
      }
    }

    // 3. Subledger Balance Sheet Control Line (AP or AR)
    if (direction === 'PURCHASE') {
      // Purchase total is CREDIT to Accounts Payable
      const apAccount = this.resolveApAccount(orgAccounts, contact);
      proposedLines.push({
        accountId: apAccount.id,
        accountCode: apAccount.code,
        accountName: apAccount.name,
        debit: '0.00',
        credit: runningTotal.toFixed(2),
        description: `Payable to ${contact?.name ?? 'Supplier'}`,
        contactId: contact?.id,
        category: SemanticCategory.ACCOUNTS_PAYABLE,
      });
    } else {
      // Sale total is DEBIT to Accounts Receivable
      const arAccount = this.resolveArAccount(orgAccounts, contact);
      proposedLines.push({
        accountId: arAccount.id,
        accountCode: arAccount.code,
        accountName: arAccount.name,
        debit: runningTotal.toFixed(2),
        credit: '0.00',
        description: `Receivable from ${contact?.name ?? 'Customer'}`,
        contactId: contact?.id,
        category: SemanticCategory.ACCOUNTS_RECEIVABLE,
      });
    }

    // Mathematical balance check
    let sumDebit = this.money.ZERO;
    let sumCredit = this.money.ZERO;
    for (const pl of proposedLines) {
      sumDebit = this.money.add(sumDebit, pl.debit);
      sumCredit = this.money.add(sumCredit, pl.credit);
    }

    const isBalanced = sumDebit.equals(sumCredit);

    // If sale of inventory items, include deterministic notice regarding COGS
    let inventoryValuationNotice: string | undefined;
    const hasInventory = lines.some((l) => l.productType === 'INVENTORY');
    if (direction === 'SALE' && hasInventory) {
      inventoryValuationNotice =
        'Inventory items identified. Cost of Goods Sold (Dr COGS / Cr Inventory) must be computed by Blynt stock valuation engine upon fulfillment, not estimated by LLM.';
    }

    return {
      direction,
      lines: proposedLines,
      totalDebit: sumDebit.toFixed(2),
      totalCredit: sumCredit.toFixed(2),
      isBalanced,
      inventoryValuationNotice,
    };
  }

  // --- Account Resolution Helpers ---

  private resolveAccountForCategory(
    accounts: Account[],
    category: string,
    direction: 'PURCHASE' | 'SALE',
  ): Account {
    // 1. Explicit Category Match
    if (category.includes('INVENTORY')) {
      const invAcc = accounts.find((a) => a.accountSubtype === AccountSubtype.INVENTORY);
      if (invAcc) return invAcc;
    }

    if (category.includes('ASSET')) {
      const assetAcc = accounts.find((a) => a.accountSubtype === AccountSubtype.FIXED_ASSET);
      if (assetAcc) return assetAcc;
    }

    if (category.includes('SOFTWARE') || category.includes('SUBSCRIPTION')) {
      const softAcc = accounts.find((a) => a.name.toLowerCase().includes('software') || a.code === '6200');
      if (softAcc) return softAcc;
    }

    if (direction === 'SALE') {
      const salesAcc = accounts.find(
        (a) =>
          a.accountSubtype === AccountSubtype.SALES || a.accountSubtype === AccountSubtype.SERVICE_REVENUE,
      );
      if (salesAcc) return salesAcc;
    }

    // Default Expense
    const expenseAcc = accounts.find(
      (a) => a.accountSubtype === AccountSubtype.OPERATING_EXPENSE || a.accountType === 'EXPENSE',
    );
    if (expenseAcc) return expenseAcc;

    // Fallback first available
    return accounts[0];
  }

  private resolveTaxAccount(accounts: Account[]): Account {
    const taxAcc = accounts.find((a) => a.accountSubtype === AccountSubtype.TAX_PAYABLE);
    if (taxAcc) return taxAcc;
    return (
      accounts.find((a) => a.name.toLowerCase().includes('vat') || a.name.toLowerCase().includes('tax')) ??
      accounts[0]
    );
  }

  private resolveApAccount(accounts: Account[], contact: Contact | null): Account {
    if (contact?.payableAccountId) {
      const acc = accounts.find((a) => a.id === contact.payableAccountId);
      if (acc) return acc;
    }
    const apAcc = accounts.find((a) => a.accountSubtype === AccountSubtype.ACCOUNTS_PAYABLE);
    if (apAcc) return apAcc;
    return accounts.find((a) => a.name.toLowerCase().includes('payable')) ?? accounts[0];
  }

  private resolveArAccount(accounts: Account[], contact: Contact | null): Account {
    if (contact?.receivableAccountId) {
      const acc = accounts.find((a) => a.id === contact.receivableAccountId);
      if (acc) return acc;
    }
    const arAcc = accounts.find((a) => a.accountSubtype === AccountSubtype.ACCOUNTS_RECEIVABLE);
    if (arAcc) return arAcc;
    return accounts.find((a) => a.name.toLowerCase().includes('receivable')) ?? accounts[0];
  }
}
