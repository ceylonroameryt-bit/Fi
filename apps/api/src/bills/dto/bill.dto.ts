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
import { BillStatus } from '@prisma/client';
import { IsDecimalAmount, ToDecimalString } from '../../common/validation/decimal.validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const upper = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export class BillLineDto {
  @IsUUID('4', { message: 'accountId must be a valid nominal account UUID' })
  accountId: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Line description is required' })
  @MaxLength(255)
  description: string;

  /** Give quantity + unitPrice, or netAmount when the bill prints only a line amount. */
  @IsOptional()
  @ToDecimalString()
  @IsDecimalAmount({ greaterThanZero: true, maxDecimalPlaces: 4 }, { message: 'quantity must be a positive decimal with at most 4 decimal places' })
  quantity?: string | number;

  @IsOptional()
  @ToDecimalString()
  @IsDecimalAmount({ min: 0, maxDecimalPlaces: 4 }, { message: 'unitPrice must be a non-negative decimal with at most 4 decimal places' })
  unitPrice?: string | number;

  @IsOptional()
  @ToDecimalString()
  @IsDecimalAmount({ min: 0, maxDecimalPlaces: 2 }, { message: 'netAmount must be a non-negative amount with at most 2 decimal places' })
  netAmount?: string | number;

  /** Required before approval. Never defaulted. */
  @IsOptional()
  @IsUUID('4', { message: 'taxCodeId must be a valid tax code UUID' })
  taxCodeId?: string;
}

export class CreateBillDto {
  @IsUUID('4', { message: 'contactId must be a valid supplier contact UUID' })
  contactId: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: "The supplier's invoice number is required" })
  @MaxLength(100)
  supplierInvoiceNumber: string;

  @Matches(ISO_DATE, { message: 'issueDate must be in YYYY-MM-DD format' })
  issueDate: string;

  /** Omit to calculate from the supplier's payment terms. */
  @IsOptional()
  @Matches(ISO_DATE, { message: 'dueDate must be in YYYY-MM-DD format' })
  dueDate?: string;

  @IsOptional()
  @Transform(upper)
  @Matches(/^[A-Z]{3}$/, { message: 'currency must be a 3-letter ISO code' })
  currency?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  notes?: string;

  /** Uploaded document this bill is based on (must belong to the organisation). */
  @IsOptional()
  @IsUUID('4')
  sourceDocumentId?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'A bill needs at least one line' })
  @ValidateNested({ each: true })
  @Type(() => BillLineDto)
  lines: BillLineDto[];
}

export class UpdateBillDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  supplierInvoiceNumber?: string;

  @IsOptional()
  @Matches(ISO_DATE)
  issueDate?: string;

  @IsOptional()
  @Matches(ISO_DATE)
  dueDate?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BillLineDto)
  lines?: BillLineDto[];
}

export class ApproveBillDto {
  /** Required to approve despite another bill with the same supplier invoice number. Logged. */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(255)
  duplicateOverrideReason?: string;
}

export class VoidBillDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(255)
  reason?: string;
}

export class BillFilterQueryDto {
  @IsOptional()
  @IsEnum(BillStatus)
  status?: BillStatus;

  @IsOptional()
  @IsUUID('4')
  contactId?: string;
}
