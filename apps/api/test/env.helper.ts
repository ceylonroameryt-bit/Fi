/**
 * Restores an environment variable after a suite overrode it. Assigning `undefined` to
 * process.env stores the string "undefined", which leaks into later suites (same process).
 */
export function restoreEnv(key: string, previous: string | undefined): void {
  if (previous === undefined) delete process.env[key];
  else process.env[key] = previous;
}
