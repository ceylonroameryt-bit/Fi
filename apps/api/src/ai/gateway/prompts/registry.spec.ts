import { PROMPT_REGISTRY } from './registry';

/**
 * Prompt versioning guard. If this fails you changed a prompt's text: bump its `version`
 * and update the pinned hash below (usage logs keep the old version/hash for audit).
 */
const PINNED: Record<string, { version: number; hash: string }> = {
  'ai.connection_check': { version: 1, hash: 'ee4425883290fc88dc024364d4b5d58bc5b46975193492759e5ca1f3d6d93a2f' },
  'document.extract': { version: 1, hash: 'e0aef6ab1bcb3cd0fe631b3f626a93474e186a08c95a1fa0f3df329b4ad827ef' },
  'document.direction': { version: 1, hash: '87cecbd41a21c191e329a163b85a19049daadbd9f2224febdfcedd32e3d8e0a6' },
};

describe('prompt registry', () => {
  it('has unique keys', () => {
    const keys = PROMPT_REGISTRY.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it.each(PROMPT_REGISTRY.map((p) => [p.key, p] as const))('%s matches its pinned version and hash', (key, prompt) => {
    expect(PINNED[key]).toBeDefined();
    expect({ version: prompt.version, hash: prompt.hash }).toEqual(PINNED[key]);
  });
});
