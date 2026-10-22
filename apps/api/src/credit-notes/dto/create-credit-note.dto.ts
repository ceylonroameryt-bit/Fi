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
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  netAmount!: number;

  @IsOptional()
  @IsUUID()
  taxCodeId?: string;

  // VAT is never taken from the client: it is calculated from the tax code's rate on the issue date.
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
