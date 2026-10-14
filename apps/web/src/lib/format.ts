/**
 * Formats an amount in the organisation's base currency (never a hard-coded "£").
 * Amounts arrive from the API as decimal strings; they're only converted to numbers for display.
 */
export function formatMoney(amount: string | number | null | undefined, currency = 'GBP', locale = 'en-GB'): string {
  const value = typeof amount === 'number' ? amount : Number(amount ?? 0);
  const safe = Number.isFinite(value) ? value : 0;
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(safe);
  } catch {
    return `${currency} ${safe.toFixed(2)}`;
  }
}

/** The symbol for a currency code, e.g. "£" for GBP, "$" for USD. */
export function currencySymbol(currency = 'GBP', locale = 'en-GB'): string {
  try {
    const part = new Intl.NumberFormat(locale, { style: 'currency', currency })
      .formatToParts(0)
      .find((p) => p.type === 'currency');
    return part?.value ?? currency;
  } catch {
    return currency;
  }
}

/**
 * Normalises a money input for the API: strips thousands separators and spaces and keeps it
 * as a string so no floating-point rounding happens in the browser. Returns '' if not a number.
 */
export function toDecimalInput(raw: string): string {
  const cleaned = raw.replace(/[,\s]/g, '').trim();
  return /^-?\d+(\.\d+)?$/.test(cleaned) ? cleaned : '';
}
