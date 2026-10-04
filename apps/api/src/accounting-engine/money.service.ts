import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export type DecimalValue = Prisma.Decimal | string | number;

/**
 * MoneyService:
 * Provides exact decimal arithmetic for financial values (using Prisma.Decimal / decimal.js).
 * Avoids any floating-point inaccuracies.
 * Enforces standard accounting scale (e.g. 4 decimal places for internal accounting, 2 for display).
 */
@Injectable()
export class MoneyService {
  readonly ZERO = new Prisma.Decimal(0);
  readonly DEFAULT_SCALE = 4;
  readonly DISPLAY_SCALE = 2;

  toDecimal(val: DecimalValue): Prisma.Decimal {
    if (val instanceof Prisma.Decimal) return val;
    if (typeof val === 'number') {
      if (!Number.isFinite(val)) throw new Error('Cannot convert non-finite number to Decimal');
      return new Prisma.Decimal(val.toString());
    }
    if (typeof val === 'string') {
      const cleaned = val.trim().replace(/,/g, '');
      if (cleaned === '' || isNaN(Number(cleaned))) {
        throw new Error(`Invalid monetary string: "${val}"`);
      }
      return new Prisma.Decimal(cleaned);
    }
    throw new Error(`Unsupported decimal input: ${val}`);
  }

  add(a: DecimalValue, b: DecimalValue): Prisma.Decimal {
    return this.toDecimal(a).add(this.toDecimal(b));
  }

  subtract(a: DecimalValue, b: DecimalValue): Prisma.Decimal {
    return this.toDecimal(a).sub(this.toDecimal(b));
  }

  multiply(a: DecimalValue, factor: DecimalValue): Prisma.Decimal {
    return this.toDecimal(a).mul(this.toDecimal(factor));
  }

  divide(a: DecimalValue, divisor: DecimalValue, scale = this.DEFAULT_SCALE): Prisma.Decimal {
    const d = this.toDecimal(divisor);
    if (d.isZero()) throw new Error('Division by zero in monetary calculation');
    return this.toDecimal(a).div(d).toDecimalPlaces(scale, Prisma.Decimal.ROUND_HALF_UP);
  }

  equals(a: DecimalValue, b: DecimalValue): boolean {
    return this.toDecimal(a).equals(this.toDecimal(b));
  }

  compare(a: DecimalValue, b: DecimalValue): number {
    const decA = this.toDecimal(a);
    const decB = this.toDecimal(b);
    if (decA.lessThan(decB)) return -1;
    if (decA.greaterThan(decB)) return 1;
    return 0;
  }

  isZero(a: DecimalValue): boolean {
    return this.toDecimal(a).isZero();
  }

  isPositive(a: DecimalValue): boolean {
    return this.toDecimal(a).greaterThan(0);
  }

  isNegative(a: DecimalValue): boolean {
    return this.toDecimal(a).lessThan(0);
  }

  sum(values: DecimalValue[]): Prisma.Decimal {
    return values.reduce<Prisma.Decimal>(
      (acc, curr) => acc.add(this.toDecimal(curr)),
      new Prisma.Decimal(0),
    );
  }

  round(a: DecimalValue, decimalPlaces = this.DISPLAY_SCALE): Prisma.Decimal {
    return this.toDecimal(a).toDecimalPlaces(decimalPlaces, Prisma.Decimal.ROUND_HALF_UP);
  }

  format(a: DecimalValue, currency = 'GBP', locale = 'en-GB'): string {
    const num = this.toDecimal(a).toNumber();
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(num);
    } catch {
      return `${currency} ${this.round(a).toFixed(2)}`;
    }
  }

  formatAmount(a: DecimalValue, scale = this.DISPLAY_SCALE): string {
    return this.toDecimal(a).toFixed(scale);
  }
}
