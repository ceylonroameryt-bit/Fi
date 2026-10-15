import * as z from 'zod/v4';
import { AiGatewayService } from './ai-gateway.service';
import { FakeAiProvider } from './providers/fake.provider';
import { definePrompt } from './prompts/prompt-definition';
import type { AiProvider } from './ai-provider.interface';

const ECHO = definePrompt({
  key: 'test.echo',
  version: 1,
  description: 'Echo test prompt',
  feature: 'test',
  system: 'Return the word you are given.',
  userTemplate: 'Word: {{word}}',
  schema: z.object({ word: z.string().nullable() }),
  maxTokens: 256,
});

describe('AiGatewayService', () => {
  let prisma: any;
  let provider: FakeAiProvider;

  const gateway = (p: AiProvider | null = provider) =>
    new AiGatewayService(prisma, p, { AI_MODEL: 'claude-opus-5-5' } as any);
  const logged = () => prisma.aiUsageLog.create.mock.calls.map((c: any) => c[0].data);

  beforeEach(() => {
    prisma = {
      organization: { findUnique: jest.fn().mockResolvedValue({ aiEnabled: true }) },
      aiUsageLog: { create: jest.fn().mockResolvedValue({}) },
    };
    provider = new FakeAiProvider();
  });

  it('runs a prompt, returns schema-validated output and logs usage with cost and prompt version', async () => {
    provider.enqueue({ output: { word: 'ledger' }, model: 'claude-opus-5-5', inputTokens: 1000, outputTokens: 200 });

    const result = await gateway().run({ organizationId: 'org-1', userId: 'u-1', prompt: ECHO, vars: { word: 'ledger' } });

    expect(result).toEqual({ word: 'ledger' });
    expect(provider.requests[0]).toMatchObject({
      model: 'claude-opus-5-5',
      system: 'Return the word you are given.',
      userContent: 'Word: ledger',
      maxTokens: 256,
    });
    const [log] = logged();
    expect(log).toMatchObject({
      organizationId: 'org-1',
      userId: 'u-1',
      feature: 'test',
      provider: 'fake',
      model: 'claude-opus-5-5',
      promptKey: 'test.echo',
      promptVersion: 1,
      promptHash: ECHO.hash,
      status: 'SUCCESS',
      inputTokens: 1000,
      outputTokens: 200,
    });
    // $4/MTok in, $20/MTok out: 0.004 + 0.004
    expect(log.costUsd.toFixed(6)).toBe('0.008000');
  });

  it('refuses to call the model when AI is switched off for the organisation', async () => {
    prisma.organization.findUnique.mockResolvedValue({ aiEnabled: false });
    await expect(gateway().run({ organizationId: 'org-1', prompt: ECHO, vars: { word: 'x' } })).rejects.toMatchObject({
      code: 'AI_DISABLED',
    });
    expect(provider.requests).toHaveLength(0);
    expect(logged()[0]).toMatchObject({ status: 'BLOCKED', errorCode: 'AI_DISABLED' });
  });

  it('reports a missing provider without calling anything', async () => {
    await expect(gateway(null).run({ organizationId: 'org-1', prompt: ECHO, vars: { word: 'x' } })).rejects.toMatchObject({
      code: 'AI_PROVIDER_UNAVAILABLE',
    });
    expect(logged()[0]).toMatchObject({ status: 'BLOCKED', provider: 'none' });
  });

  it('treats a refusal as an error and logs it', async () => {
    provider.enqueue({ output: null, stopReason: 'refusal', model: 'claude-opus-5-5', inputTokens: 10, outputTokens: 0 });
    await expect(gateway().run({ organizationId: 'org-1', prompt: ECHO, vars: { word: 'x' } })).rejects.toMatchObject({
      code: 'AI_REFUSED',
    });
    expect(logged()[0]).toMatchObject({ status: 'REFUSED', inputTokens: 10 });
  });

  it('rejects output that does not match the schema (never passes it through)', async () => {
    provider.enqueue({ output: { word: 42 }, model: 'claude-opus-5-5', inputTokens: 10, outputTokens: 5 });
    await expect(gateway().run({ organizationId: 'org-1', prompt: ECHO, vars: { word: 'x' } })).rejects.toMatchObject({
      code: 'AI_INVALID_OUTPUT',
    });
    expect(logged()[0].status).toBe('INVALID_OUTPUT');
  });

  it('rejects truncated output', async () => {
    provider.enqueue({ output: null, stopReason: 'max_tokens', model: 'claude-opus-5-5', inputTokens: 10, outputTokens: 256 });
    await expect(gateway().run({ organizationId: 'org-1', prompt: ECHO, vars: { word: 'x' } })).rejects.toMatchObject({
      code: 'AI_INVALID_OUTPUT',
    });
  });

  it('logs provider failures and surfaces a domain error', async () => {
    provider.enqueueError(new Error('socket hang up'));
    await expect(gateway().run({ organizationId: 'org-1', prompt: ECHO, vars: { word: 'x' } })).rejects.toMatchObject({
      code: 'AI_PROVIDER_ERROR',
    });
    expect(logged()[0]).toMatchObject({ status: 'ERROR', errorCode: 'AI_PROVIDER_ERROR' });
  });

  it('logs a null cost (not zero) for a model without a known price', async () => {
    provider.enqueue({ output: { word: 'x' }, model: 'some-new-model', inputTokens: 10, outputTokens: 5 });
    await gateway().run({ organizationId: 'org-1', prompt: ECHO, vars: { word: 'x' } });
    expect(logged()[0].costUsd).toBeNull();
  });

  it('rejects missing template variables instead of sending a half-filled prompt', async () => {
    await expect(gateway().run({ organizationId: 'org-1', prompt: ECHO, vars: {} as any })).rejects.toThrow(/word/);
    expect(provider.requests).toHaveLength(0);
  });
});
