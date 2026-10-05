import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { InvoiceStatus } from '@prisma/client';

import { IsDecimalAmount, ToDecimalString } from '../../common/validation/decimal.validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const upper = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value);

export class InvoiceLineDto {
  @IsOptional()
  @IsUUID('4')
  id?: string;

  @IsUUID('4', { message: 'accountId must be a valid nominal account UUID' })
  @IsNotEmpty()
  accountId: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Line description is required' })
  @MaxLength(255)
  description: string;

  @ToDecimalString()
  @IsDecimalAmount(
    { greaterThanZero: true, maxDecimalPlaces: 4 },
    { message: 'quantity must be a positive decimal number with at most 4 decimal places' },
  )
  quantity: string | number = '1';

  @ToDecimalString()
  @IsDecimalAmount(
    { min: 0, maxDecimalPlaces: 4 },
    { message: 'unitPrice must be a non-negative decimal number with at most 4 decimal places' },
  )
  unitPrice: string | number = '0';

  @IsOptional()
  @ToDecimalString()
  @IsDecimalAmount(
    { min: 0, max: 1, maxDecimalPlaces: 4 },
    { message: 'taxRate must be a decimal between 0 and 1 with at most 4 decimal places' },
  )
  taxRate?: string | number = '0';
}

export class CreateInvoiceDto {
  @IsUUID('4', { message: 'contactId must be a valid customer contact UUID' })
  @IsNotEmpty({ message: 'Customer is required' })
  contactId: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'issueDate must be in YYYY-MM-DD format' })
  issueDate: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'dueDate must be in YYYY-MM-DD format' })
  dueDate: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  reference?: string;

  @IsOptional()
  @Transform(upper)
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  terms?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Invoice must contain at least 1 line item' })
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineDto)
  lines: InvoiceLineDto[];
}

export class UpdateInvoiceDto {
  @IsOptional()
  @IsUUID('4')
  contactId?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  issueDate?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dueDate?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  reference?: string;

  @IsOptional()
  @Transform(upper)
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  terms?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineDto)
  lines?: InvoiceLineDto[];
}

export class VoidInvoiceDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(255)
  reason?: string;
}

export class InvoiceFilterQueryDto {
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @IsOptional()
  @IsUUID('4')
  contactId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  pageSize?: number;
}
