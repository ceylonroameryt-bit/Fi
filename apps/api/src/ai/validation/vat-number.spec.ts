import { checkUkVatNumber } from './vat-number';

describe('checkUkVatNumber', () => {
  it.each([
    ['GB999999973', 'mod-97 (HMRC test number)'],
    ['GB 999 9999 73', 'with spaces'],
    ['gb999999973', 'lower case'],
    ['999999973', 'without prefix'],
    ['GB999999918', 'mod-9755 scheme'],
    ['GB999999973001', '12-digit branch number'],
    ['GBGD001', 'government department'],
    ['GBHA599', 'health authority'],
    ['XI999999973', 'Northern Ireland prefix'],
  ])('accepts %s (%s)', (vat) => {
    expect(checkUkVatNumber(vat)).toEqual({ status: 'valid' });
  });

  it.each([
    ['GB123456789', 'check digits wrong'],
    ['GB999999974', 'check digits off by one'],
    ['GB12345678', 'too short'],
    ['GB1234567890', '10 digits'],
    ['GBGD599', 'GD range is 000-499'],
    ['GBHA001', 'HA range is 500-999'],
    ['GB99999997X', 'letters in the number'],
  ])('rejects %s (%s)', (vat) => {
    expect(checkUkVatNumber(vat).status).toBe('invalid');
  });

  it('does not judge non-UK VAT numbers', () => {
    expect(checkUkVatNumber('DE123456789')).toEqual({ status: 'not_uk' });
  });
});
