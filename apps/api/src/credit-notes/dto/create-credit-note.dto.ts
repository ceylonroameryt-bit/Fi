import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreditNoteKind } from '@prisma/client';

export class CreateCreditNoteLineDto {
  @IsNotEmpty()
  @IsUUID()
  accountId!: string;

  @IsNotEmpty()
  @IsString()
  description!: string;

  @IsOptional()
  @IsNumber()
  quantity?: number = 1;

  @IsOptional()
  @IsNumber()
  unitPrice?: number;

  @IsNotEmpty()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.01)
  netAmount!: number;

  @IsOptional()
  @IsUUID()
  taxCodeId?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  taxRate?: number = 0;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  taxAmount?: number = 0;
}

export class CreateCreditNoteDto {
  @IsNotEmpty()
  @IsEnum(CreditNoteKind)
  kind!: CreditNoteKind;

  @IsNotEmpty()
  @IsUUID()
  contactId!: string;

  @IsNotEmpty()
  @IsDateString()
  issueDate!: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsUUID()
  relatedInvoiceId?: string;

  @IsOptional()
  @IsUUID()
  relatedBillId?: string;

  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCreditNoteLineDto)
  lines!: CreateCreditNoteLineDto[];
}
