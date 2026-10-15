import type * as z from 'zod/v4';

export const AI_PROVIDER = Symbol('AI_PROVIDER');

export type AiEffort = 'low' | 'medium' | 'high';

/** Provider-agnostic request: one system prompt, one user message, one JSON output schema. */
export interface AiCompletionRequest<T> {
  model: string;
  system: string;
  userContent: string;
  schema: z.ZodType<T>;
  maxTokens: number;
  effort?: AiEffort;
}

export interface AiCompletionResult {
  /** Parsed JSON as returned by the provider; the gateway validates it against the schema. */
  output: unknown;
  /** Normalised: 'end_turn' | 'max_tokens' | 'refusal' | other provider values. */
  stopReason: string;
  /** Model that actually served the request. */
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

/** Every model call in Blynt goes through AiGatewayService, which calls one of these. */
export interface AiProvider {
  readonly name: string;
  complete<T>(request: AiCompletionRequest<T>): Promise<AiCompletionResult>;
}
