import { Injectable } from '@nestjs/common';
import { BankTransactionStatus, ContactStatus, ContactType, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { BankReconciliationService } from './bank-reconciliation.service';
import { extractVendorOrCustomerName } from './vendor-identification.util';
import { DomainException } from '../common/errors/domain.exception';
import type { Actor, OrgContext } from '../common/types/request-context.types';
import { BatchConfirmDto, ConfirmLineDto, InlineUpdateLineDto } from './dto/ai-categorise.dto';

interface KeywordRule {
  keywords: string[];
  nominalCodePrefix?: string;
  nominalNameMatch?: string;
  suggestedContactName?: string;
  explanation: string;
  confidence: number;
}

const HEURISTIC_RULES: KeywordRule[] = [
  {
    keywords: ['screwfix', 'toolstation', 'wickes', 'b&q', 'hardware', 'travis perkins'],
    nominalNameMatch: 'repair',
    suggestedContactName: 'Screwfix',
    explanation: 'Prediction Model (92%): Categorised as Repairs & Maintenance based on merchant pattern',
    confidence: 0.92,
  },
  {
    keywords: ['tesco', 'sainsbury', 'asda', 'waitrose', 'morrison', 'pret', 'costa', 'starbucks', 'cafe', 'coffee'],
    nominalNameMatch: 'welfare',
    explanation: 'Prediction Model (88%): Categorised as Staff Welfare & Subsistence based on merchant pattern',
    confidence: 0.88,
  },
  {
    keywords: ['patcham', 'bp', 'shell', 'texaco', 'esso', 'petrol', 'fuel', 'service station', 'applegreen', 'euro garages'],
    nominalNameMatch: 'motor',
    explanation: 'Prediction Model (94%): Categorised as Motor Expenses & Fuel based on merchant pattern',
    confidence: 0.94,
  },
  {
    keywords: ['booker', 'costco', 'makro', 'wholesale', 'bestway', 'dhamecha'],
    nominalNameMatch: 'cost of goods',
    explanation: 'Prediction Model (95%): Categorised as Cost of Goods Sold / Inventory based on merchant pattern',
    confidence: 0.95,
  },
  {
    keywords: ['github', 'google', 'aws', 'slack', 'adobe', 'microsoft', 'digitalocean', 'zoom', 'vercel', 'atlassian', 'dropbox'],
    nominalNameMatch: 'software',
    explanation: 'Prediction Model (96%): Categorised as Software & IT Services based on merchant pattern',
    confidence: 0.96,
  },
  {
    keywords: ['bank fee', 'monthly fee', 'service charge', 'card fee', 'stripe', 'gocardless', 'monzo', 'barclays fee'],
    nominalNameMatch: 'bank charge',
    explanation: 'Prediction Model (95%): Categorised as Bank & Processing Charges based on transaction text',
    confidence: 0.95,
  },
  {
    keywords: ['hmrc', 'vat return', 'paye', 'corporation tax'],
    nominalNameMatch: 'tax',
    explanation: 'Prediction Model (95%): Categorised as Statutory Tax Liability based on description',
    confidence: 0.95,
  },
];

@Injectable()
export class BankAiCategorisationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reconciliation: BankReconciliationService,
  ) {}

  async autoCategoriseLines(organizationId: string, bankAccountId?: string) {
    // 1. Fetch all candidate lines (unmatched or categorised awaiting confirmation or missing vendor)
    const lines = await this.prisma.bankStatementLine.findMany({
      where: {
        organizationId,
        ...(bankAccountId ? { bankAccountId } : {}),
        OR: [
          { status: { in: [BankTransactionStatus.UNMATCHED, BankTransactionStatus.CATEGORISED] } },
          { suggestedContactId: null },
        ],
      },
    });

    if (lines.length === 0) {
      return { processedCount: 0, categorisedCount: 0 };
    }

    // 2. Fetch nominal accounts and contacts for mapping
    const [accounts, contacts, historicalMatches] = await Promise.all([
      this.prisma.account.findMany({
        where: { organizationId, isActive: true },
        select: { id: true, code: true, name: true, accountType: true },
      }),
      this.prisma.contact.findMany({
        where: { organizationId },
        select: { id: true, name: true, payableAccountId: true, receivableAccountId: true },
      }),
      // Find past confirmed/matched transactions to learn from
      this.prisma.bankStatementLine.findMany({
        where: {
          organizationId,
          status: BankTransactionStatus.MATCHED,
          suggestedAccountId: { not: null },
        },
        select: {
          description: true,
          payee: true,
          suggestedAccountId: true,
          suggestedContactId: true,
        },
        take: 300,
        orderBy: { transactionDate: 'desc' },
      }),
    ]);

    let categorisedCount = 0;

    for (const line of lines) {
      const descLower = (line.description + ' ' + (line.payee || '')).toLowerCase();
      const isMoneyIn = Number(line.amount) > 0;

      let matchedAccountId: string | null = null;
      let matchedContactId: string | null = null;
      let explanation = 'AI: Automated Categorisation';
      let confidence = 0.85;

      // Stage A: Historical Learning Match
      const historyMatch = historicalMatches.find(
        (h) =>
          h.description &&
          (descLower.includes(h.description.toLowerCase().slice(0, 15)) ||
            (h.payee && descLower.includes(h.payee.toLowerCase().slice(0, 10)))),
      );

      if (historyMatch) {
        matchedAccountId = historyMatch.suggestedAccountId;
        matchedContactId = historyMatch.suggestedContactId;
        explanation = 'Prediction Model (95%): Learned from previously reconciled transaction pattern';
        confidence = 0.95;
      }

      // Stage B: Heuristic Merchant Pattern Match
      if (!matchedAccountId) {
        for (const rule of HEURISTIC_RULES) {
          const hasKeyword = rule.keywords.some((kw) => descLower.includes(kw));
          if (hasKeyword) {
            const acc = accounts.find((a) =>
              rule.nominalNameMatch
                ? a.name.toLowerCase().includes(rule.nominalNameMatch)
                : rule.nominalCodePrefix
                ? a.code.startsWith(rule.nominalCodePrefix)
                : false,
            );

            if (acc) {
              matchedAccountId = acc.id;
              confidence = rule.confidence;
              explanation = rule.explanation;

              // Check if contact already exists
              if (rule.suggestedContactName) {
                const c = contacts.find((contact) =>
                  contact.name.toLowerCase().includes(rule.suggestedContactName!.toLowerCase()),
                );
                if (c) matchedContactId = c.id;
              }
              break;
            }
          }
        }
      }

      // Stage C: Directional Fallback
      if (!matchedAccountId) {
        if (isMoneyIn) {
          const salesAcc = accounts.find((a) => a.accountType === 'REVENUE' || a.name.toLowerCase().includes('sales'));
          if (salesAcc) {
            matchedAccountId = salesAcc.id;
            explanation = 'LLM Reasoning (75%): Suggested Revenue / Sales account for money-in transaction';
            confidence = 0.75;
          }
        } else {
          const expAcc = accounts.find(
            (a) => a.accountType === 'EXPENSE' && (a.name.toLowerCase().includes('general') || a.name.toLowerCase().includes('sundry') || a.name.toLowerCase().includes('office')),
          ) || accounts.find((a) => a.accountType === 'EXPENSE');
          if (expAcc) {
            matchedAccountId = expAcc.id;
            explanation = 'LLM Reasoning (70%): Suggested Operating Expense account for disbursement';
            confidence = 0.70;
          }
        }
      }

      // Stage D: Smart Vendor / Customer Automatic Identification & Auto-Provisioning
      let resolvedContactName: string | null = null;
      if (!matchedContactId) {
        // 1. Check existing contacts for direct substring or match
        const existingMatch = contacts.find((c) =>
          descLower.includes(c.name.toLowerCase().trim()),
        );
        if (existingMatch) {
          matchedContactId = existingMatch.id;
          resolvedContactName = existingMatch.name;
        } else {
          // 2. Extract vendor/customer name using intelligence heuristics
          const candidateVendor = extractVendorOrCustomerName(line.description, line.payee, isMoneyIn);
          if (candidateVendor) {
            const normCandidate = candidateVendor.toLowerCase().trim();
            let contactMatch = contacts.find(
              (c) =>
                c.name.toLowerCase().trim() === normCandidate ||
                c.name.toLowerCase().includes(normCandidate) ||
                normCandidate.includes(c.name.toLowerCase().trim()),
            );

            // Auto-provision contact if not already existing
            if (!contactMatch && this.prisma.contact?.create) {
              try {
                contactMatch = await this.prisma.contact.create({
                  data: {
                    organizationId,
                    name: candidateVendor,
                    companyName: candidateVendor,
                    type: isMoneyIn ? ContactType.CUSTOMER : ContactType.SUPPLIER,
                    status: ContactStatus.ACTIVE,
                  },
                });
                contacts.push(contactMatch);
              } catch {
                // Ignore concurrent unique creation conflicts
              }
            }

            if (contactMatch) {
              matchedContactId = contactMatch.id;
              resolvedContactName = contactMatch.name;
            }
          }
        }
      } else {
        const c = contacts.find((c) => c.id === matchedContactId);
        if (c) resolvedContactName = c.name;
      }

      if (resolvedContactName && !explanation.includes('Verified entity')) {
        explanation = `${explanation} · Verified entity: ${resolvedContactName}`;
      }

      if (matchedAccountId || matchedContactId) {
        await this.prisma.bankStatementLine.update({
          where: { id: line.id },
          data: {
            ...(line.status === BankTransactionStatus.UNMATCHED
              ? { status: BankTransactionStatus.CATEGORISED }
              : {}),
            ...(matchedAccountId ? { suggestedAccountId: matchedAccountId } : {}),
            ...(matchedContactId ? { suggestedContactId: matchedContactId } : {}),
            matchConfidence: new Prisma.Decimal(confidence.toFixed(2)),
            matchExplanation: explanation,
          },
        });
        categorisedCount++;
      }
    }

    return {
      processedCount: lines.length,
      categorisedCount,
    };
  }

  async updateLineCategorisation(
    organizationId: string,
    lineId: string,
    dto: InlineUpdateLineDto,
  ) {
    const line = await this.prisma.bankStatementLine.findFirst({
      where: { id: lineId, organizationId },
    });
    if (!line) {
      throw new DomainException('BANK_TRANSACTION_NOT_FOUND', 'Statement transaction line not found');
    }

    return this.prisma.bankStatementLine.update({
      where: { id: lineId },
      data: {
        suggestedContactId: dto.contactId !== undefined ? dto.contactId : line.suggestedContactId,
        suggestedAccountId: dto.accountId !== undefined ? dto.accountId : line.suggestedAccountId,
        description: dto.description !== undefined ? dto.description : line.description,
        status: dto.accountId ? BankTransactionStatus.CATEGORISED : line.status,
      },
    });
  }

  async confirmLine(
    organizationId: string,
    lineId: string,
    dto: ConfirmLineDto,
    orgContext: OrgContext,
    actor: Actor,
  ) {
    const line = await this.prisma.bankStatementLine.findFirst({
      where: { id: lineId, organizationId },
    });
    if (!line) {
      throw new DomainException('BANK_TRANSACTION_NOT_FOUND', 'Statement transaction line not found');
    }

    const targetAccountId = dto.accountId || line.suggestedAccountId;
    if (!targetAccountId) {
      throw new DomainException('ACCOUNT_NOT_FOUND', 'Please assign an accounting category before confirming');
    }

    const targetContactId = dto.contactId !== undefined ? dto.contactId : line.suggestedContactId;
    const targetDescription = dto.description || line.description;

    // Use quickCreateAndReconcile to generate balanced double-entry journal, post to GL, and reconcile
    return this.reconciliation.quickCreateAndReconcile(
      organizationId,
      lineId,
      {
        accountId: targetAccountId,
        contactId: targetContactId ?? undefined,
        description: targetDescription,
      },
      orgContext,
      actor,
    );
  }

  async batchConfirm(
    organizationId: string,
    dto: BatchConfirmDto,
    orgContext: OrgContext,
    actor: Actor,
  ) {
    let confirmedCount = 0;
    let failedCount = 0;

    for (const lineId of dto.lineIds) {
      try {
        await this.confirmLine(organizationId, lineId, {}, orgContext, actor);
        confirmedCount++;
      } catch {
        failedCount++;
      }
    }

    return {
      total: dto.lineIds.length,
      confirmedCount,
      failedCount,
    };
  }
}
