import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { BankAccountStatus } from '@prisma/client';

export class CreateBankAccountDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsNotEmpty()
  @IsUUID()
  nominalAccountId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string = 'GBP';

  @IsOptional()
  @IsString()
  @MaxLength(10)
  sortCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  accountNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(34)
  iban?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  bankName?: string;

  @IsOptional()
  @IsEnum(BankAccountStatus)
  status?: BankAccountStatus = BankAccountStatus.ACTIVE;
}

export class UpdateBankAccountDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  sortCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  accountNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(34)
  iban?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  bankName?: string;

  @IsOptional()
  @IsUUID()
  nominalAccountId?: string;

  @IsOptional()
  @IsEnum(BankAccountStatus)
  status?: BankAccountStatus;
}
