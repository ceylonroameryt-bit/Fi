import { AiDirection } from '@prisma/client';
import { AiGatewayService } from '../gateway/ai-gateway.service';
import { FakeAiProvider } from '../gateway/providers/fake.provider';
import { DirectionFallbackService } from './direction-fallback.service';
import type { DirectionResolutionResult } from './transaction-direction.service';

const DOC = 'Sold to: Blynt Petrol Station\nFrom: Hilltop Garage\n2 tyres 180.00';
const ORG = { name: 'Blynt Petrol Station', legalName: null, taxNumber: null, registrationNumber: null };

describe('DirectionFallbackService (model only when rules are inconclusive)', () => {
  const prisma: any = {
    organization: { findUnique: jest.fn().mockResolvedValue({ aiEnabled: true, aiMonthlyCostLimitUsd: null }) },
    aiUsageLog: { create: jest.fn(), aggregate: jest.fn().mockResolvedValue({ _sum: { costUsd: null } }) },
  };
  let provider: FakeAiProvider;
  let service: DirectionFallbackService;
  const unknown: DirectionResolutionResult = { direction: AiDirection.UNKNOWN, confidence: 0, basis: 'NONE', reasoning: 'rules: none' };

  beforeEach(() => {
    provider = new FakeAiProvider();
    const gateway = new AiGatewayService(prisma, provider, { AI_MODEL: 'claude-opus-5-5', AI_MONTHLY_COST_LIMIT_USD: 50 } as any);
    service = new DirectionFallbackService(gateway, provider);
  });

  const decide = (rules: DirectionResolutionResult = unknown) =>
    service.decide({ organizationId: 'org-1', documentId: 'doc-1', text: DOC, organisation: ORG, rules });

  it('does not call the model when the rules already decided', async () => {
    const rules = { direction: AiDirection.SALE, confidence: 0.99, basis: 'ORG_VAT' as const, reasoning: 'r' };
    expect(await decide(rules)).toBe(rules);
    expect(provider.requests).toHaveLength(0);
  });

  it('does not call the model when the rules found a conflict (a person decides)', async () => {
    const rules = { ...unknown, basis: 'CONFLICT' as const };
    expect(await decide(rules)).toBe(rules);
    expect(provider.requests).toHaveLength(0);
  });

  it('uses the model answer when its evidence is on the document, marked as a model suggestion', async () => {
    provider.enqueue({ output: { direction: 'PURCHASE', evidence: 'Sold to: Blynt Petrol Station', reason: 'Addressed to the organisation' } });
    const r = await decide();
    expect(r).toMatchObject({ direction: AiDirection.PURCHASE, basis: 'MODEL' });
    expect(r.confidence).toBeLessThan(0.8);
    expect(r.reasoning).toContain('Sold to: Blynt Petrol Station');
  });

  it('stays UNKNOWN when the evidence is not on the document', async () => {
    provider.enqueue({ output: { direction: 'SALE', evidence: 'Invoice from Blynt Petrol Station', reason: 'x' } });
    expect((await decide()).direction).toBe(AiDirection.UNKNOWN);
  });

  it('stays UNKNOWN when the model says UNKNOWN or gives no evidence', async () => {
    provider.enqueue({ output: { direction: 'PURCHASE', evidence: null, reason: 'x' } });
    expect((await decide()).direction).toBe(AiDirection.UNKNOWN);
    provider.enqueue({ output: { direction: 'UNKNOWN', evidence: null, reason: 'unclear' } });
    expect((await decide()).direction).toBe(AiDirection.UNKNOWN);
  });

  it('does nothing without an AI provider', async () => {
    const noAi = new DirectionFallbackService({} as any, null);
    expect(await noAi.decide({ organizationId: 'o', documentId: 'd', text: DOC, organisation: ORG, rules: unknown })).toBe(unknown);
  });
});
