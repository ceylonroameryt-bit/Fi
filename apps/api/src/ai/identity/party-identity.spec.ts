import { matchesOrganisation, normaliseCompanyName, normaliseCompanyNumber, normaliseVatNumber } from './party-identity';
import { ORG } from '../__fixtures__/safety-fixtures';

describe('party identity normalisation', () => {
  it.each([
    ['GB 987 6543 21', '987654321'],
    ['gb987654321', '987654321'],
    ['987-654-321', '987654321'],
    ['GB987654321001', '987654321001'],
    ['', null],
    [null, null],
  ])('VAT %p -> %p', (input, expected) => {
    expect(normaliseVatNumber(input)).toBe(expected);
  });

  it.each([
    ['1234567', '01234567'],
    ['01234567', '01234567'],
    ['sc123456', 'SC123456'],
    [' 0123 4567 ', '01234567'],
    ['', null],
  ])('company number %p -> %p', (input, expected) => {
    expect(normaliseCompanyNumber(input)).toBe(expected);
  });

  it.each([
    ['Blynt Petrol Station Limited', 'blyntpetrolstation'],
    ['BLYNT PETROL STATION LTD.', 'blyntpetrolstation'],
    ['The Blynt Petrol Station plc', 'blyntpetrolstation'],
    ['Ltd', null],
  ])('name %p -> %p', (input, expected) => {
    expect(normaliseCompanyName(input)).toBe(expected);
  });

  it('a VAT number that differs from ours overrides a matching name', () => {
    expect(matchesOrganisation({ name: 'Blynt Petrol Station', vatNumber: 'GB111111111' }, ORG)).toBeNull();
  });

  it('prefers the strongest identifier', () => {
    expect(matchesOrganisation({ name: 'x', vatNumber: '987654321' }, ORG)).toBe('VAT');
    expect(matchesOrganisation({ companyNumber: '1234567' }, ORG)).toBe('COMPANY_NUMBER');
    expect(matchesOrganisation({ name: 'Blynt Petrol Station Ltd' }, ORG)).toBe('NAME');
    expect(matchesOrganisation({ name: 'Blynt Petrol' }, ORG)).toBeNull();
    expect(matchesOrganisation(undefined, ORG)).toBeNull();
  });
});
