import { createHash } from 'node:crypto';
import type * as z from 'zod/v4';
import type { AiEffort } from '../ai-provider.interface';

export interface PromptSpec<T> {
  /** Stable identifier, e.g. 'bill.extract'. */
  key: string;
  /** Bump whenever system, userTemplate or schema changes; old versions stay in usage logs. */
  version: number;
  description: string;
  /** Usage/cost grouping, e.g. 'extraction'. */
  feature: string;
  system: string;
  /** `{{name}}` placeholders, filled from vars. Untrusted data must be passed as vars, never concatenated into system. */
  userTemplate: string;
  schema: z.ZodType<T>;
  maxTokens: number;
  effort?: AiEffort;
}

export interface PromptDefinition<T> extends PromptSpec<T> {
  /** sha256 of key, version, system and template; pinned by tests so edits require a version bump. */
  hash: string;
  render(vars: Record<string, string>): string;
}

const PLACEHOLDER = /\{\{(\w+)\}\}/g;

export function definePrompt<T>(spec: PromptSpec<T>): PromptDefinition<T> {
  const hash = createHash('sha256')
    .update(JSON.stringify([spec.key, spec.version, spec.system, spec.userTemplate]))
    .digest('hex');
  return {
    ...spec,
    hash,
    render(vars) {
      return spec.userTemplate.replace(PLACEHOLDER, (_, name: string) => {
        const value = vars[name];
        if (value === undefined || value === null) {
          throw new Error(`Prompt ${spec.key} v${spec.version}: missing variable "${name}"`);
        }
        return value;
      });
    },
  };
}
