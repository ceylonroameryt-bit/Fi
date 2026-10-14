/**
 * Builds compact before/after audit payloads containing only the fields that changed.
 * Storing whole records (with relations) bloats the append-only audit table and copies
 * personal data into it.
 */
export function auditDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  ignore: string[] = ['updatedAt', 'updatedById', 'version'],
): { oldValues: Record<string, unknown>; newValues: Record<string, unknown> } {
  const oldValues: Record<string, unknown> = {};
  const newValues: Record<string, unknown> = {};
  for (const key of Object.keys(after)) {
    if (ignore.includes(key)) continue;
    const a = normalise(before[key]);
    const b = normalise(after[key]);
    if (a === undefined && !(key in before)) continue; // relation or field the "before" didn't load
    if (typeof b === 'object' && b !== null) continue; // skip nested relations
    if (a !== b) {
      oldValues[key] = a ?? null;
      newValues[key] = b ?? null;
    }
  }
  return { oldValues, newValues };
}

function normalise(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (value !== null && typeof value === 'object' && typeof (value as { toFixed?: unknown }).toFixed === 'function') {
    return String(value); // Prisma.Decimal
  }
  return value;
}
