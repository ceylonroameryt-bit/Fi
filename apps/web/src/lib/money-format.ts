/**
 * Display-only money formatting that never converts to floating point.
 *
 * The API sends money as fixed-point decimal strings (e.g. "1234.5000").
 * This rounds half-up to 2 dp using string arithmetic, adds thousands
 * separators and shows negatives in brackets — the accounting convention.
 * It must not be used for calculations; totals, VAT and balances come from the API.
 */

const SYMBOLS: Record<string, string> = { GBP: '£', EUR: '€', USD: '$' };

/** Adds 1 to a string of digits ("0999" → "1000"). */
function incrementDigits(digits: string): string {
  const arr = digits.split('');
  let i = arr.length - 1;
  while (i >= 0) {
    if (arr[i] === '9') {
      arr[i] = '0';
      i--;
    } else {
      arr[i] = String(Number(arr[i]) + 1);
      return arr.join('');
    }
  }
  return `1${arr.join('')}`;
}

/** Rounds a decimal string half-up to `dp` places. Returns null if not a number. */
export function roundDecimalString(
  value: string,
  dp = 2,
): { negative: boolean; whole: string; fraction: string } | null {
  const match = /^\s*([+-])?(\d*)(?:\.(\d*))?\s*$/.exec(value);
  if (!match || (!match[2] && !match[3])) return null;
  const negative = match[1] === '-';
  const whole = (match[2] || '0').replace(/^0+(?=\d)/, '');
  const frac = match[3] ?? '';
  const kept = frac.padEnd(dp, '0').slice(0, dp);
  const nextDigit = frac.length > dp ? Number(frac[dp]) : 0;

  let combined = whole + kept;
  if (nextDigit >= 5) combined = incrementDigits(combined);
  const w = combined.slice(0, combined.length - dp) || '0';
  const f = dp > 0 ? combined.slice(combined.length - dp) : '';
  const isZero = /^0*$/.test(w + f);
  return { negative: negative && !isZero, whole: w.replace(/^0+(?=\d)/, ''), fraction: f };
}

function groupThousands(whole: string): string {
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export interface FormatMoneyOptions {
  currency?: string;
  /** Show the currency symbol (default true). */
  symbol?: boolean;
  /** Bracket negatives (default true). Otherwise uses a leading minus. */
  brackets?: boolean;
}

export function formatMoney(value: string | null | undefined, options: FormatMoneyOptions = {}): string {
  if (value === null || value === undefined || value === '') return '—';
  const parts = roundDecimalString(String(value), 2);
  if (!parts) return String(value);
  const { currency = 'GBP', symbol = true, brackets = true } = options;
  const sym = symbol ? (SYMBOLS[currency] ?? `${currency} `) : '';
  const body = `${sym}${groupThousands(parts.whole)}.${parts.fraction}`;
  if (!parts.negative) return body;
  return brackets ? `(${body})` : `-${body}`;
}

/** True when a decimal string is exactly zero ("0", "0.00", "-0.0000"). */
export function isZeroDecimal(value: string | null | undefined): boolean {
  if (value === null || value === undefined) return false;
  return /^\s*[+-]?0*(\.0*)?\s*$/.test(String(value)) && /\d/.test(String(value));
}

/** True when a decimal string is negative and not zero. */
export function isNegativeDecimal(value: string | null | undefined): boolean {
  if (value === null || value === undefined) return false;
  return String(value).trim().startsWith('-') && !isZeroDecimal(value);
}
