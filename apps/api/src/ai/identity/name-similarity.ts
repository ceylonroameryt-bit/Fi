const LEGAL_SUFFIXES = new Set(['limited', 'ltd', 'plc', 'llp', 'lp', 'inc', 'incorporated', 'corp', 'corporation', 'co', 'company']);

function words(name: string): string[] {
  const ws = name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
  const start = ws[0] === 'the' ? 1 : 0;
  return ws.slice(start).filter((w) => !LEGAL_SUFFIXES.has(w));
}

/** Trigrams per word with pg_trgm padding (two spaces before, one after). */
function trigrams(name: string): Set<string> {
  const set = new Set<string>();
  for (const w of words(name)) {
    const padded = `  ${w} `;
    for (let i = 0; i + 3 <= padded.length; i++) set.add(padded.slice(i, i + 3));
  }
  return set;
}

/**
 * Similarity of two company names in [0, 1]: shared trigrams / all trigrams (as Postgres pg_trgm
 * similarity), after dropping legal suffixes, a leading "the" and punctuation.
 */
export function nameSimilarity(a: string, b: string): number {
  const ta = trigrams(a);
  const tb = trigrams(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / (ta.size + tb.size - shared);
}
