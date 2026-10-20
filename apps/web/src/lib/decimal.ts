/**
 * Exact decimal arithmetic for the few summaries the UI composes from API figures
 * (e.g. adding bank-account balances). Uses BigInt scaled to 4 dp — the same
 * precision as the ledger (NUMERIC(19,4)) — so there is no floating-point drift.
 * Ledger totals, VAT and posting maths stay on the server.
 */

const SCALE = 4;
const FACTOR = BigInt(10 ** SCALE);

/** Parses "1234.5", "-0.0001", "12" into an integer number of 1/10,000ths. Throws on bad input. */
export function toUnits(value: string | number | null | undefined): bigint {
  if (value === null || value === undefined || value === '') return BigInt(0);
  const s = String(value).trim();
  const m = /^([+-])?(\d*)(?:\.(\d*))?$/.exec(s);
  if (!m || (!m[2] && !m[3])) throw new Error(`Not a decimal: ${value}`);
  const neg = m[1] === '-';
  const whole = m[2] || '0';
  const frac = m[3] ?? '';
  let units = BigInt(whole) * FACTOR + BigInt(frac.padEnd(SCALE, '0').slice(0, SCALE) || '0');
  // Round half-up on the 5th decimal (away from zero).
  if (frac.length > SCALE && Number(frac[SCALE]) >= 5) units += BigInt(1);
  return neg ? -units : units;
}

export function fromUnits(units: bigint): string {
  const neg = units < BigInt(0);
  const abs = neg ? -units : units;
  const whole = abs / FACTOR;
  const frac = (abs % FACTOR).toString().padStart(SCALE, '0');
  return `${neg ? '-' : ''}${whole.toString()}.${frac}`;
}

export function addDecimals(...values: (string | null | undefined)[]): string {
  return fromUnits(values.reduce<bigint>((sum, v) => sum + toUnits(v), BigInt(0)));
}

export function subtractDecimals(a: string | null | undefined, b: string | null | undefined): string {
  return fromUnits(toUnits(a) - toUnits(b));
}

export function compareDecimals(a: string | null | undefined, b: string | null | undefined): -1 | 0 | 1 {
  const d = toUnits(a) - toUnits(b);
  return d < BigInt(0) ? -1 : d > BigInt(0) ? 1 : 0;
}

export function isPositiveDecimal(v: string | null | undefined): boolean {
  return toUnits(v) > BigInt(0);
}
