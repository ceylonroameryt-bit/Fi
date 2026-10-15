import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { IsDecimalAmount, ToDecimalString } from '../../common/validation/decimal.validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export class ReviewedLineDto {
  @IsOptional()
  @IsInt()
  lineNumber?: number;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  description: string;

  @IsOptional()
  @ToDecimalString()
  @IsDecimalAmount({ greaterThanZero: true, maxDecimalPlaces: 4 })
  quantity?: string;

  @IsOptional()
  @ToDecimalString()
  @IsDecimalAmount({ min: 0, maxDecimalPlaces: 4 })
  unitPrice?: string;

  @IsOptional()
  @ToDecimalString()
  @IsDecimalAmount({ min: 0, maxDecimalPlaces: 2 })
  netAmount?: string;

  /** VAT as printed on the document (used for validation; the draft's VAT is calculated by code). */
  @IsOptional()
  @ToDecimalString()
  @IsDecimalAmount({ min: 0, maxDecimalPlaces: 2 })
  vatAmount?: string;

  @IsUUID('4')
  accountId: string;

  @IsUUID('4')
  taxCodeId: string;
}

export class FieldOverrideDto {
  /** Field path as reported by validation, e.g. "issuer.vatNumber" or "lines[2].vat". */
  @IsString()
  @MaxLength(100)
  field: string;

  @Transform(trim)
  @IsString()
  @MinLength(5, { message: 'Give a reason of at least 5 characters for each override' })
  @MaxLength(500)
  reason: string;
}

/** Everything on the review screen is editable; this is the reviewer's final version. */
export class ApproveReviewedDto {
  @IsIn(['PURCHASE', 'SALE'])
  direction: 'PURCHASE' | 'SALE';

  @IsUUID('4')
  contactId: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  invoiceNumber: string;

  @Matches(ISO_DATE)
  invoiceDate: string;

  @IsOptional()
  @Matches(ISO_DATE)
  dueDate?: string;

  @Matches(/^[A-Z]{3}$/)
  currency: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  issuerVatNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  recipientVatNumber?: string;

  @IsOptional()
  @ToDecimalString()
  @IsDecimalAmount({ min: 0, maxDecimalPlaces: 2 })
  subtotal?: string;

  @IsOptional()
  @ToDecimalString()
  @IsDecimalAmount({ min: 0, maxDecimalPlaces: 2 })
  vatTotal?: string;

  @IsOptional()
  @ToDecimalString()
  @IsDecimalAmount({ min: 0, maxDecimalPlaces: 2 })
  total?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReviewedLineDto)
  lines: ReviewedLineDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FieldOverrideDto)
  overrides?: FieldOverrideDto[];
}

export class ReviewQueueQueryDto {
  @IsOptional()
  @IsIn(['confidence_desc', 'confidence_asc', 'oldest'])
  sort?: 'confidence_desc' | 'confidence_asc' | 'oldest';
}
