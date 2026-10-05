import { AccountType, NormalBalance } from '@prisma/client';
import { getExpectedNormalBalance } from './accounts.constants';

describe('Chart of Accounts Rules', () => {
  it('correctly maps normal balance: ASSET and EXPENSE to DEBIT', () => {
    expect(getExpectedNormalBalance(AccountType.ASSET)).toBe(NormalBalance.DEBIT);
    expect(getExpectedNormalBalance(AccountType.EXPENSE)).toBe(NormalBalance.DEBIT);
  });

  it('correctly maps normal balance: LIABILITY, EQUITY, REVENUE to CREDIT', () => {
    expect(getExpectedNormalBalance(AccountType.LIABILITY)).toBe(NormalBalance.CREDIT);
    expect(getExpectedNormalBalance(AccountType.EQUITY)).toBe(NormalBalance.CREDIT);
    expect(getExpectedNormalBalance(AccountType.REVENUE)).toBe(NormalBalance.CREDIT);
  });

  it('validates account code patterns (must start alphanumeric and allow standard numbering)', () => {
    const validCodes = ['1000', '1010', '1010.1', '2000-A', 'A100'];
    const invalidCodes = ['-100', '.1000', '', '1000!'];

    const pattern = /^[0-9A-Za-z][0-9A-Za-z.-]{0,19}$/;
    validCodes.forEach((code) => expect(pattern.test(code)).toBe(true));
    invalidCodes.forEach((code) => expect(pattern.test(code)).toBe(false));
  });
});
