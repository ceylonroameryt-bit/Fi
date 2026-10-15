import * as z from 'zod/v4';
import { definePrompt, PromptDefinition } from './prompt-definition';
import { DOCUMENT_EXTRACTION_PROMPT } from './document-extraction.prompt';
import { DIRECTION_PROMPT } from './direction.prompt';
import { CODING_PROMPT } from './coding.prompt';

/**
 * Minimal round trip used by the admin "test AI connection" action: proves the provider,
 * credentials, structured output and usage logging all work for an organisation.
 */
export const CONNECTION_CHECK_PROMPT = definePrompt({
  key: 'ai.connection_check',
  version: 1,
  description: 'Verifies the AI provider is reachable and returns schema-valid JSON',
  feature: 'connection_check',
  system: 'You are a connectivity check for an accounting system. Reply only with the requested JSON.',
  userTemplate: 'Return {"ok": true} and echo this token exactly in "token": {{token}}',
  schema: z.object({ ok: z.boolean(), token: z.string() }),
  maxTokens: 256,
  effort: 'low',
});

/** Every prompt the app can send. Keys must be unique; see registry.spec.ts for pinned hashes. */
export const PROMPT_REGISTRY: ReadonlyArray<PromptDefinition<unknown>> = [
  CONNECTION_CHECK_PROMPT,
  DOCUMENT_EXTRACTION_PROMPT,
  DIRECTION_PROMPT,
  CODING_PROMPT,
];
