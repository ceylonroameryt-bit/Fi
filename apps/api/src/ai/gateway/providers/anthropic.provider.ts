import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { AiCompletionRequest, AiCompletionResult, AiProvider } from '../ai-provider.interface';

/**
 * Claude via the official SDK. Structured outputs (output_config.format) constrain the reply to the
 * prompt's JSON schema. No temperature is sent: current Claude models reject sampling parameters,
 * so determinism comes from the schema and prompt rather than temperature 0.
 */
export class AnthropicAiProvider implements AiProvider {
  readonly name = 'anthropic';

  // Credentials resolve from the environment (ANTHROPIC_API_KEY etc.); never hard-coded.
  constructor(private readonly client: Anthropic = new Anthropic()) {}

  async complete<T>(request: AiCompletionRequest<T>): Promise<AiCompletionResult> {
    const response = await this.client.messages.parse({
      model: request.model,
      max_tokens: request.maxTokens,
      system: request.system,
      messages: [{ role: 'user', content: request.userContent }],
      output_config: {
        format: zodOutputFormat(request.schema),
        effort: request.effort ?? 'medium',
      },
    });

    return {
      output: response.parsed_output ?? null,
      stopReason: response.stop_reason ?? 'unknown',
      model: response.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
      cacheWriteTokens: response.usage.cache_creation_input_tokens ?? 0,
    };
  }
}
