import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { AiCallStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { DomainException } from '../../common/errors/domain.exception';
import { APP_CONFIG } from '../../config/config.module';
import type { AppEnv } from '../../config/env';
import { AI_PROVIDER, AiCompletionResult, AiProvider } from './ai-provider.interface';
import type { PromptDefinition } from './prompts/prompt-definition';
import { costUsd } from './pricing';

export interface AiRunInput<T> {
  organizationId: string;
  userId?: string | null;
  documentId?: string | null;
  prompt: PromptDefinition<T>;
  vars: Record<string, string>;
}

/**
 * The single entry point for model calls. Enforces the per-organisation AI switch,
 * validates output against the prompt's schema, and logs usage/cost for every attempt.
 * It returns model output only; callers turn it into drafts and code does all arithmetic.
 */
@Injectable()
export class AiGatewayService {
  private readonly logger = new Logger(AiGatewayService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(AI_PROVIDER) private readonly provider: AiProvider | null,
    @Inject(APP_CONFIG) private readonly config: Pick<AppEnv, 'AI_MODEL'>,
  ) {}

  async run<T>(input: AiRunInput<T>): Promise<T> {
    const { prompt } = input;
    // Render first: a missing variable is a programming error, not a model call.
    const userContent = prompt.render(input.vars);

    const org = await this.prisma.organization.findUnique({
      where: { id: input.organizationId },
      select: { aiEnabled: true },
    });
    if (!org?.aiEnabled) {
      await this.log(input, { status: AiCallStatus.BLOCKED, errorCode: 'AI_DISABLED' });
      throw new DomainException('AI_DISABLED', 'AI features are switched off for this organisation');
    }
    if (!this.provider) {
      await this.log(input, { status: AiCallStatus.BLOCKED, errorCode: 'AI_PROVIDER_UNAVAILABLE' });
      throw new DomainException('AI_PROVIDER_UNAVAILABLE', 'No AI provider is configured');
    }

    const started = Date.now();
    let result: AiCompletionResult;
    try {
      result = await this.provider.complete({
        model: this.config.AI_MODEL,
        system: prompt.system,
        userContent,
        schema: prompt.schema,
        maxTokens: prompt.maxTokens,
        effort: prompt.effort,
      });
    } catch (err) {
      this.logger.warn(`AI provider error for ${prompt.key}: ${(err as Error).message}`);
      await this.log(input, { status: AiCallStatus.ERROR, errorCode: 'AI_PROVIDER_ERROR', latencyMs: Date.now() - started });
      throw new DomainException('AI_PROVIDER_ERROR', 'The AI provider request failed');
    }
    const latencyMs = Date.now() - started;

    if (result.stopReason === 'refusal') {
      await this.log(input, { status: AiCallStatus.REFUSED, errorCode: 'AI_REFUSED', latencyMs, result });
      throw new DomainException('AI_REFUSED', 'The AI model declined this request');
    }

    const parsed = result.stopReason === 'max_tokens' ? null : prompt.schema.safeParse(result.output);
    if (!parsed?.success) {
      await this.log(input, { status: AiCallStatus.INVALID_OUTPUT, errorCode: 'AI_INVALID_OUTPUT', latencyMs, result });
      throw new DomainException('AI_INVALID_OUTPUT', 'The AI response was incomplete or did not match the expected format');
    }

    await this.log(input, { status: AiCallStatus.SUCCESS, latencyMs, result });
    return parsed.data;
  }

  private async log<T>(
    input: AiRunInput<T>,
    entry: { status: AiCallStatus; errorCode?: string; latencyMs?: number; result?: AiCompletionResult },
  ): Promise<void> {
    const r = entry.result;
    const usage = {
      inputTokens: r?.inputTokens ?? 0,
      outputTokens: r?.outputTokens ?? 0,
      cacheReadTokens: r?.cacheReadTokens ?? 0,
      cacheWriteTokens: r?.cacheWriteTokens ?? 0,
    };
    const data: Prisma.AiUsageLogUncheckedCreateInput = {
      organizationId: input.organizationId,
      userId: input.userId ?? null,
      documentId: input.documentId ?? null,
      feature: input.prompt.feature,
      provider: this.provider?.name ?? 'none',
      model: r?.model ?? null,
      promptKey: input.prompt.key,
      promptVersion: input.prompt.version,
      promptHash: input.prompt.hash,
      status: entry.status,
      errorCode: entry.errorCode ?? null,
      ...usage,
      costUsd: r ? costUsd(r.model, usage) : null,
      latencyMs: entry.latencyMs ?? 0,
    };
    try {
      await this.prisma.aiUsageLog.create({ data });
    } catch (err) {
      // Never let logging failure hide the real outcome, but make it visible.
      this.logger.error(`Failed to write AI usage log: ${(err as Error).message}`);
    }
  }
}
