import { Test, TestingModule } from '@nestjs/testing';
import {
  BankRule,
  BankRuleMatchField,
  BankRuleMatchType,
  Prisma,
} from '@prisma/client';
import { BankRulesService } from './bank-rules.service';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ParsedStatementLine } from './parsers/statement-parser';

describe('BankRulesService', () => {
  let service: BankRulesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BankRulesService,
        {
          provide: PrismaService,
          useValue: {
            bankRule: {
              create: jest.fn(),
              findMany: jest.fn(),
              findFirst: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
        {
          provide: AuditService,
          useValue: { record: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = module.get<BankRulesService>(BankRulesService);
  });

  describe('matchLineAgainstRules', () => {
    const baseLine: ParsedStatementLine = {
      transactionDate: new Date('2026-10-18'),
      description: 'Monthly Cloudflare Pro Subscription',
      payee: 'Cloudflare Inc',
      amount: -20.00,
    };

    const makeRule = (over: Partial<BankRule>): BankRule => ({
      id: 'rule-1',
      organizationId: 'org-1',
      name: 'Cloudflare Subscription',
      bankAccountId: null,
      isEnabled: true,
      matchField: BankRuleMatchField.DESCRIPTION,
      matchType: BankRuleMatchType.CONTAINS,
      matchValue: 'Cloudflare',
      amountMin: null,
      amountMax: null,
      transactionDirection: null,
      suggestedAccountId: 'acc-software-subscriptions',
      suggestedTaxCodeId: 'tc-standard',
      suggestedContactId: 'contact-cloudflare',
      autoCategorise: true,
      priority: 100,
      timesApplied: 0,
      createdById: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...over,
    });

    it('matches rule when description contains matchValue', () => {
      const rule = makeRule({ matchValue: 'Cloudflare' });
      const result = service.matchLineAgainstRules(baseLine, [rule]);

      expect(result.matchedRuleId).toBe('rule-1');
      expect(result.suggestedAccountId).toBe('acc-software-subscriptions');
      expect(result.autoCategorise).toBe(true);
      expect(result.confidence).toBe(1.0);
    });

    it('enforces transaction direction filter', () => {
      // rule expects incoming credit ('IN'), but line is outgoing debit (-20)
      const rule = makeRule({ transactionDirection: 'IN' });
      const result = service.matchLineAgainstRules(baseLine, [rule]);

      expect(result.matchedRuleId).toBeUndefined();
      expect(result.autoCategorise).toBe(false);
    });

    it('enforces min and max amount boundary conditions', () => {
      // Line is 20.00. Rule expects between 50 and 100.
      const rule = makeRule({
        amountMin: new Prisma.Decimal('50.00'),
        amountMax: new Prisma.Decimal('100.00'),
      });
      const result = service.matchLineAgainstRules(baseLine, [rule]);
      expect(result.matchedRuleId).toBeUndefined();

      // Rule expecting between 10 and 30 should match
      const ruleInRange = makeRule({
        amountMin: new Prisma.Decimal('10.00'),
        amountMax: new Prisma.Decimal('30.00'),
      });
      const matchResult = service.matchLineAgainstRules(baseLine, [ruleInRange]);
      expect(matchResult.matchedRuleId).toBe('rule-1');
    });

    it('supports regex matching', () => {
      const regexRule = makeRule({
        matchType: BankRuleMatchType.REGEX,
        matchValue: 'monthly.*pro',
      });
      const result = service.matchLineAgainstRules(baseLine, [regexRule]);
      expect(result.matchedRuleId).toBe('rule-1');
    });
  });
});
