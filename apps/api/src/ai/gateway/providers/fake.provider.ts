import type { AiCompletionRequest, AiCompletionResult, AiProvider } from '../ai-provider.interface';

type Scripted = Partial<AiCompletionResult> & { output: unknown };
type ScriptedFn = (request: AiCompletionRequest<unknown>) => Scripted;

/**
 * Deterministic provider for tests and local development (AI_PROVIDER=fake).
 * Responses are scripted with enqueue(); calling with an empty queue fails loudly.
 */
export class FakeAiProvider implements AiProvider {
  readonly name = 'fake';
  readonly requests: Array<AiCompletionRequest<unknown>> = [];
  private readonly queue: Array<Scripted | ScriptedFn | Error> = [];

  /** A fixed response, or a function of the request (e.g. to echo input back). */
  enqueue(response: Scripted | ScriptedFn): this {
    this.queue.push(response);
    return this;
  }

  enqueueError(error: Error): this {
    this.queue.push(error);
    return this;
  }

  async complete<T>(request: AiCompletionRequest<T>): Promise<AiCompletionResult> {
    this.requests.push(request as AiCompletionRequest<unknown>);
    const next = this.queue.shift();
    if (!next) throw new Error('FakeAiProvider: no scripted response queued');
    if (next instanceof Error) throw next;
    const scripted = typeof next === 'function' ? next(request as AiCompletionRequest<unknown>) : next;
    return {
      stopReason: 'end_turn',
      model: request.model,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      ...scripted,
    };
  }
}
