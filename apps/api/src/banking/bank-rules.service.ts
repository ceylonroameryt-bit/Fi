import { Injectable } from '@nestjs/common';
import {
  BankRule,
  BankRuleMatchField,
  BankRuleMatchType,
  Prisma,
} from '@prisma/client';
import { PrismaService, Tx } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuditEvents } from '../audit/audit-events';
import { DomainException } from '../common/errors/domain.exception';
import type { Actor } from '../common/types/request-context.types';
import { CreateBankRuleDto, UpdateBankRuleDto } from './dto/bank-rule.dto';
import { ParsedStatementLine } from './parsers/statement-parser';

export interface RuleMatchResult {
  matchedRuleId?: string;
  suggestedAccountId?: string;
  suggestedTaxCodeId?: string;
  suggestedContactId?: string;
  autoCategorise: boolean;
  confidence?: number;
  explanation?: string;
}

@Injectable()
export class BankRulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async createRule(organizationId: string, dto: CreateBankRuleDto, actor: Actor) {
    const rule = await this.prisma.bankRule.create({
      data: {
        organizationId,
        name: dto.name,
        bankAccountId: dto.bankAccountId ?? null,
        isEnabled: dto.isEnabled ?? true,
        matchField: dto.matchField,
        matchType: dto.matchType ?? BankRuleMatchType.CONTAINS,
        matchValue: dto.matchValue,
        amountMin: dto.amountMin ? new Prisma.Decimal(dto.amountMin.toString()) : null,
        amountMax: dto.amountMax ? new Prisma.Decimal(dto.amountMax.toString()) : null,
        transactionDirection: dto.transactionDirection ?? null,
        suggestedAccountId: dto.suggestedAccountId ?? null,
        suggestedTaxCodeId: dto.suggestedTaxCodeId ?? null,
        suggestedContactId: dto.suggestedContactId ?? null,
        autoCategorise: dto.autoCategorise ?? false,
        priority: dto.priority ?? 100,
        createdById: actor.userId,
      },
    });

    await this.audit.record(null, actor, {
      organizationId,
      eventType: AuditEvents.BANK_RULE_CREATED,
      entityType: 'bank_rule',
      entityId: rule.id,
      newValues: { name: rule.name, matchField: rule.matchField, matchValue: rule.matchValue },
    });

    return rule;
  }

  async listRules(organizationId: string, bankAccountId?: string) {
    return this.prisma.bankRule.findMany({
      where: {
        organizationId,
        ...(bankAccountId ? { OR: [{ bankAccountId }, { bankAccountId: null }] } : {}),
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async updateRule(organizationId: string, id: string, dto: UpdateBankRuleDto, actor: Actor) {
    const existing = await this.prisma.bankRule.findFirst({
      where: { id, organizationId },
    });
    if (!existing) {
      throw new DomainException('BANK_RULE_NOT_FOUND', 'Bank rule not found in this organisation');
    }

    const updated = await this.prisma.bankRule.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.bankAccountId !== undefined ? { bankAccountId: dto.bankAccountId } : {}),
        ...(dto.isEnabled !== undefined ? { isEnabled: dto.isEnabled } : {}),
        ...(dto.matchField ? { matchField: dto.matchField } : {}),
        ...(dto.matchType ? { matchType: dto.matchType } : {}),
        ...(dto.matchValue ? { matchValue: dto.matchValue } : {}),
        ...(dto.amountMin !== undefined
          ? { amountMin: dto.amountMin ? new Prisma.Decimal(dto.amountMin.toString()) : null }
          : {}),
        ...(dto.amountMax !== undefined
          ? { amountMax: dto.amountMax ? new Prisma.Decimal(dto.amountMax.toString()) : null }
          : {}),
        ...(dto.transactionDirection !== undefined ? { transactionDirection: dto.transactionDirection } : {}),
        ...(dto.suggestedAccountId !== undefined ? { suggestedAccountId: dto.suggestedAccountId } : {}),
        ...(dto.suggestedTaxCodeId !== undefined ? { suggestedTaxCodeId: dto.suggestedTaxCodeId } : {}),
        ...(dto.suggestedContactId !== undefined ? { suggestedContactId: dto.suggestedContactId } : {}),
        ...(dto.autoCategorise !== undefined ? { autoCategorise: dto.autoCategorise } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
      },
    });

    await this.audit.record(null, actor, {
      organizationId,
      eventType: AuditEvents.BANK_RULE_UPDATED,
      entityType: 'bank_rule',
      entityId: id,
      newValues: dto,
    });

    return updated;
  }

  async deleteRule(organizationId: string, id: string) {
    const existing = await this.prisma.bankRule.findFirst({
      where: { id, organizationId },
    });
    if (!existing) {
      throw new DomainException('BANK_RULE_NOT_FOUND', 'Bank rule not found in this organisation');
    }

    await this.prisma.bankRule.delete({ where: { id } });
    return { success: true };
  }

  async getActiveRules(organizationId: string, bankAccountId: string, tx?: Tx): Promise<BankRule[]> {
    const client = tx ?? this.prisma;
    return client.bankRule.findMany({
      where: {
        organizationId,
        isEnabled: true,
        OR: [{ bankAccountId }, { bankAccountId: null }],
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
    });
  }

  matchLineAgainstRules(line: ParsedStatementLine, rules: BankRule[]): RuleMatchResult {
    for (const rule of rules) {
      // 1. Check transaction direction
      if (rule.transactionDirection) {
        const isMoneyIn = new Prisma.Decimal(line.amount).greaterThan(0);
        if (rule.transactionDirection === 'IN' && !isMoneyIn) continue;
        if (rule.transactionDirection === 'OUT' && isMoneyIn) continue;
      }

      // 2. Check amount range
      const absAmount = new Prisma.Decimal(line.amount).abs();
      if (rule.amountMin && absAmount.lessThan(rule.amountMin)) continue;
      if (rule.amountMax && absAmount.greaterThan(rule.amountMax)) continue;

      // 3. Check field text match
      let targetText = '';
      if (rule.matchField === BankRuleMatchField.DESCRIPTION) {
        targetText = line.description || '';
      } else if (rule.matchField === BankRuleMatchField.PAYEE) {
        targetText = line.payee || line.description || '';
      } else if (rule.matchField === BankRuleMatchField.REFERENCE) {
        targetText = line.reference || '';
      } else if (rule.matchField === BankRuleMatchField.AMOUNT_EXACT) {
        let targetVal: Prisma.Decimal | null = null;
        try {
          targetVal = new Prisma.Decimal(rule.matchValue.trim());
        } catch {
          targetVal = null;
        }
        if (targetVal && absAmount.equals(targetVal)) {
          return {
            matchedRuleId: rule.id,
            suggestedAccountId: rule.suggestedAccountId ?? undefined,
            suggestedTaxCodeId: rule.suggestedTaxCodeId ?? undefined,
            suggestedContactId: rule.suggestedContactId ?? undefined,
            autoCategorise: rule.autoCategorise && Boolean(rule.suggestedAccountId),
            confidence: 1.0,
            explanation: `Rule: ${rule.name} (Exact amount match)`,
          };
        }
        continue;
      }

      const matchPattern = rule.matchValue.toLowerCase().trim();
      const candidate = targetText.toLowerCase();

      let matched = false;
      if (rule.matchType === BankRuleMatchType.CONTAINS) {
        matched = candidate.includes(matchPattern);
      } else if (rule.matchType === BankRuleMatchType.EQUALS) {
        matched = candidate === matchPattern;
      } else if (rule.matchType === BankRuleMatchType.STARTS_WITH) {
        matched = candidate.startsWith(matchPattern);
      } else if (rule.matchType === BankRuleMatchType.REGEX) {
        try {
          const re = new RegExp(rule.matchValue, 'i');
          matched = re.test(targetText);
        } catch {
          matched = false;
        }
      }

      if (matched) {
        return {
          matchedRuleId: rule.id,
          suggestedAccountId: rule.suggestedAccountId ?? undefined,
          suggestedTaxCodeId: rule.suggestedTaxCodeId ?? undefined,
          suggestedContactId: rule.suggestedContactId ?? undefined,
          autoCategorise: rule.autoCategorise && Boolean(rule.suggestedAccountId),
          confidence: 1.0,
          explanation: `Rule: ${rule.name}`,
        };
      }
    }

    return { autoCategorise: false };
  }
}
