import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { Prisma } from '@prisma/client';

export interface DecimalAmountValidationOptions {
  min?: number | string;
  max?: number | string;
  maxDecimalPlaces?: number;
  allowNegative?: boolean;
  greaterThanZero?: boolean;
  message?: string;
}

// PostgreSQL Decimal(19, 4) maximum: 15 digits before decimal point, 4 after
const DEFAULT_MAX_DECIMAL = '999999999999999.9999';

export function IsDecimalAmount(
  options: DecimalAmountValidationOptions = {},
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isDecimalAmount',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          if (value === undefined || value === null) {
            return false;
          }

          let strVal: string;
          if (typeof value === 'number') {
            if (!Number.isFinite(value)) return false;
            strVal = value.toString();
          } else if (typeof value === 'string') {
            strVal = value.trim();
          } else {
            return false;
          }

          if (strVal === '') return false;

          // Strict regex: optional minus, digits, optional decimal point and digits
          const allowNeg = options.allowNegative ?? false;
          const regex = allowNeg ? /^-?\d+(\.\d+)?$/ : /^\d+(\.\d+)?$/;
          if (!regex.test(strVal)) {
            return false;
          }

          // Check decimal places
          const maxDec = options.maxDecimalPlaces ?? 4;
          const dotIdx = strVal.indexOf('.');
          if (dotIdx !== -1) {
            const decPlaces = strVal.length - dotIdx - 1;
            if (decPlaces > maxDec) {
              return false;
            }
          }

          try {
            const dec = new Prisma.Decimal(strVal);

            if (options.greaterThanZero && !dec.greaterThan(0)) {
              return false;
            }

            if (!allowNeg && dec.lessThan(0)) {
              return false;
            }

            if (options.min !== undefined) {
              const minDec = new Prisma.Decimal(options.min.toString());
              if (dec.lessThan(minDec)) return false;
            }

            const maxLimit = options.max !== undefined ? options.max.toString() : DEFAULT_MAX_DECIMAL;
            const maxDecLimit = new Prisma.Decimal(maxLimit);
            if (dec.greaterThan(maxDecLimit)) return false;

            return true;
          } catch {
            return false;
          }
        },
        defaultMessage(args: ValidationArguments): string {
          if (options.message) return options.message;
          if (options.greaterThanZero) {
            return `${args.property} must be a positive decimal number with at most ${options.maxDecimalPlaces ?? 4} decimal places`;
          }
          return `${args.property} must be a valid decimal number between ${options.min ?? 0} and ${options.max ?? DEFAULT_MAX_DECIMAL} with at most ${options.maxDecimalPlaces ?? 4} decimal places`;
        },
      },
    });
  };
}

/**
 * Transforms numbers or trimmed strings into normalized decimal strings to preserve
 * exact precision without floating point corruption.
 */
export function ToDecimalString() {
  return Transform(({ value }: { value: unknown }) => {
    if (value === undefined || value === null) return value;
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) return 'NaN';
      return value.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 10 });
    }
    if (typeof value === 'string') {
      return value.trim();
    }
    return value;
  });
}
