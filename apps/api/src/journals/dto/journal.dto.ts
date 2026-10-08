import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { JournalType } from '@prisma/client';

import { IsDecimalAmount, ToDecimalString } from '../../common/validation/decimal.validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const upper = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value);

export class JournalLineDto {
  @IsOptional()
  @IsUUID('4')
  id?: string;

  @IsUUID('4', { message: 'accountId must be a valid UUID' })
  @IsNotEmpty()
  accountId: string;

  @IsOptional()
  @IsUUID('4', { message: 'contactId must be a valid UUID' })
  contactId?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(255)
  description?: string;

  @ToDecimalString()
  @IsDecimalAmount(
    { min: 0, maxDecimalPlaces: 4 },
    { message: 'debit must be a non-negative decimal with at most 4 decimal places' },
  )
  debit: string | number = '0';

  @ToDecimalString()
  @IsDecimalAmount(
    { min: 0, maxDecimalPlaces: 4 },
    { message: 'credit must be a non-negative decimal with at most 4 decimal places' },
  )
  credit: string | number = '0';
}

export class CreateJournalDto {
  @IsOptional()
  @IsEnum(JournalType)
  journalType?: JournalType = JournalType.GENERAL;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'journalDate must be in YYYY-MM-DD format' })
  journalDate: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'postingDate must be in YYYY-MM-DD format' })
  postingDate?: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'description is required' })
  @MaxLength(500)
  description: string;

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
  @MaxLength(100)
  idempotencyKey?: string;

  @IsArray()
  @ArrayMinSize(2, { message: 'A journal must contain at least 2 lines' })
  @ValidateNested({ each: true })
  @Type(() => JournalLineDto)
  lines: JournalLineDto[];
}

export class UpdateJournalDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  journalDate?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  postingDate?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  reference?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(2, { message: 'A journal must contain at least 2 lines' })
  @ValidateNested({ each: true })
  @Type(() => JournalLineDto)
  lines?: JournalLineDto[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  version?: number;
}
