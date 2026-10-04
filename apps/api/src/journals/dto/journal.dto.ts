import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { JournalType } from '@prisma/client';

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
  @Transform(trim)
  @IsString()
  @MaxLength(255)
  description?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0, { message: 'debit cannot be negative' })
  debit: number = 0;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0, { message: 'credit cannot be negative' })
  credit: number = 0;
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
}
