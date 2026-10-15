export type VatNumberCheck = { status: 'valid' } | { status: 'invalid'; reason: string } | { status: 'not_uk' };

const WEIGHTS = [8, 7, 6, 5, 4, 3, 2];

/**
 * UK (GB/XI) VAT registration number format and check digits (HMRC modulus 97 and
 * the newer 97-55 scheme). Only validates; never alters the number.
 */
export function checkUkVatNumber(raw: string): VatNumberCheck {
  const value = raw.toUpperCase().replace(/[\s.-]/g, '');
  const prefixMatch = /^([A-Z]{2})/.exec(value);
  if (prefixMatch && prefixMatch[1] !== 'GB' && prefixMatch[1] !== 'XI') return { status: 'not_uk' };
  const body = prefixMatch ? value.slice(2) : value;

  const special = /^(GD|HA)(\d{3})$/.exec(body);
  if (special) {
    const n = Number(special[2]);
    const ok = special[1] === 'GD' ? n <= 499 : n >= 500;
    return ok ? { status: 'valid' } : { status: 'invalid', reason: `${special[1]} number out of range` };
  }

  if (!/^(\d{9}|\d{12})$/.test(body)) {
    return { status: 'invalid', reason: 'A UK VAT number has 9 or 12 digits' };
  }
  const digits = body.slice(0, 9);
  const total = WEIGHTS.reduce((sum, w, i) => sum + w * Number(digits[i]), 0) + Number(digits.slice(7, 9));
  if (total % 97 === 0 || (total + 55) % 97 === 0) return { status: 'valid' };
  return { status: 'invalid', reason: 'Check digits do not match' };
}
