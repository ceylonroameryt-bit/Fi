import { MoneyService } from './money.service';

describe('MoneyService (Decimal precision)', () => {
  let money: MoneyService;

  beforeEach(() => {
    money = new MoneyService();
  });

  it('performs exact decimal addition without floating point inaccuracies', () => {
    // 0.1 + 0.2 in standard JS floating point is 0.30000000000000004
    const result = money.add('0.1', '0.2');
    expect(result.toString()).toBe('0.3');
  });

  it('correctly calculates difference and checks equality', () => {
    const debit = money.toDecimal('10000.00');
    const credit = money.toDecimal('10000.00');
    expect(money.equals(debit, credit)).toBe(true);
    expect(money.subtract(debit, credit).isZero()).toBe(true);
  });

  it('detects unbalanced differences', () => {
    const debit = money.toDecimal('10000.00');
    const credit = money.toDecimal('9500.00');
    const diff = money.subtract(debit, credit);
    expect(diff.toString()).toBe('500');
    expect(diff.isZero()).toBe(false);
  });

  it('sums multiple decimal lines accurately', () => {
    const lines = ['123.45', '678.90', '0.05', '197.60'];
    const total = money.sum(lines);
    expect(total.toString()).toBe('1000');
  });

  it('formats currency correctly according to ISO currency and locale', () => {
    const formatted = money.format('25000.00', 'GBP', 'en-GB');
    expect(formatted).toContain('25,000.00');
  });
});
