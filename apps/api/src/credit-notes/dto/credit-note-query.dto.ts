import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreditNoteKind, CreditNoteStatus } from '@prisma/client';

export class CreditNoteFilterQueryDto {
  @IsOptional()
  @IsEnum(CreditNoteKind)
  kind?: CreditNoteKind;

  @IsOptional()
  @IsEnum(CreditNoteStatus)
  status?: CreditNoteStatus;

  @IsOptional()
  @IsUUID()
  contactId?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;
}
