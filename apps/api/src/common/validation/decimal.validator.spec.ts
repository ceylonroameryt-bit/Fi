import { IsOptional, validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { IsDecimalAmount, ToDecimalString } from './decimal.validator';

class TestDto {
  @ToDecimalString()
  @IsDecimalAmount({ greaterThanZero: true, maxDecimalPlaces: 4 })
  quantity: string | number;

  @ToDecimalString()
  @IsDecimalAmount({ min: 0, maxDecimalPlaces: 4 })
  unitPrice: string | number;

  @IsOptional()
  @ToDecimalString()
  @IsDecimalAmount({ min: 0, max: 1, maxDecimalPlaces: 4 })
  taxRate?: string | number;
}

describe('Decimal Validator & Transformer', () => {
  it('accepts valid decimal strings and numbers within range and precision', async () => {
    const input = {
      quantity: '0.0001',
      unitPrice: 0.5,
      taxRate: '0.2000',
    };
    const dto = plainToInstance(TestDto, input);
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.quantity).toBe('0.0001');
    expect(dto.unitPrice).toBe('0.5');
    expect(dto.taxRate).toBe('0.2000');
  });

  it('rejects values with more than 4 decimal places', async () => {
    const input = {
      quantity: '0.00001', // 5 decimal places
      unitPrice: '10.55555', // 5 decimal places
    };
    const dto = plainToInstance(TestDto, input);
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects zero or negative quantities when greaterThanZero is set', async () => {
    const input1 = plainToInstance(TestDto, { quantity: '0', unitPrice: '10' });
    const errors1 = await validate(input1);
    expect(errors1.some((e) => e.property === 'quantity')).toBe(true);

    const input2 = plainToInstance(TestDto, { quantity: '-5', unitPrice: '10' });
    const errors2 = await validate(input2);
    expect(errors2.some((e) => e.property === 'quantity')).toBe(true);
  });

  it('rejects non-numeric values and exponential notation', async () => {
    const input = plainToInstance(TestDto, { quantity: 'abc', unitPrice: '1e4' });
    const errors = await validate(input);
    expect(errors.length).toBe(2);
  });

  it('handles large values within PostgreSQL Decimal(19, 4) range', async () => {
    const input = plainToInstance(TestDto, {
      quantity: '1',
      unitPrice: '999999999999999.9999',
    });
    const errors = await validate(input);
    expect(errors).toHaveLength(0);

    const overflow = plainToInstance(TestDto, {
      quantity: '1',
      unitPrice: '1000000000000000.0000', // 16 digits before decimal
    });
    const overflowErrors = await validate(overflow);
    expect(overflowErrors.some((e) => e.property === 'unitPrice')).toBe(true);
  });
});
