import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { BankRuleMatchField, BankRuleMatchType } from '@prisma/client';

export class CreateBankRuleDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsUUID()
  bankAccountId?: string;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean = true;

  @IsNotEmpty()
  @IsEnum(BankRuleMatchField)
  matchField!: BankRuleMatchField;

  @IsOptional()
  @IsEnum(BankRuleMatchType)
  matchType?: BankRuleMatchType = BankRuleMatchType.CONTAINS;

  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  matchValue!: string;

  @IsOptional()
  @IsNumber()
  amountMin?: number;

  @IsOptional()
  @IsNumber()
  amountMax?: number;

  @IsOptional()
  @IsString()
  transactionDirection?: string; // 'IN' or 'OUT'

  @IsOptional()
  @IsUUID()
  suggestedAccountId?: string;

  @IsOptional()
  @IsUUID()
  suggestedTaxCodeId?: string;

  @IsOptional()
  @IsUUID()
  suggestedContactId?: string;

  @IsOptional()
  @IsBoolean()
  autoCategorise?: boolean = false;

  @IsOptional()
  @IsInt()
  @Min(1)
  priority?: number = 100;
}

export class UpdateBankRuleDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsUUID()
  bankAccountId?: string;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsEnum(BankRuleMatchField)
  matchField?: BankRuleMatchField;

  @IsOptional()
  @IsEnum(BankRuleMatchType)
  matchType?: BankRuleMatchType;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  matchValue?: string;

  @IsOptional()
  @IsNumber()
  amountMin?: number;

  @IsOptional()
  @IsNumber()
  amountMax?: number;

  @IsOptional()
  @IsString()
  transactionDirection?: string;

  @IsOptional()
  @IsUUID()
  suggestedAccountId?: string;

  @IsOptional()
  @IsUUID()
  suggestedTaxCodeId?: string;

  @IsOptional()
  @IsUUID()
  suggestedContactId?: string;

  @IsOptional()
  @IsBoolean()
  autoCategorise?: boolean;

  @IsOptional()
  @IsInt()
  priority?: number;
}
