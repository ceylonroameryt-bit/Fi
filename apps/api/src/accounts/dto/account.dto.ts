import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { AccountSubtype, AccountType } from '@prisma/client';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const upper = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value);

export class CreateAccountDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  @Matches(/^[0-9A-Za-z][0-9A-Za-z.\-]{0,19}$/, {
    message: 'code must start with an alphanumeric character and contain only letters, numbers, dots, and hyphens',
  })
  code: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @IsEnum(AccountType)
  accountType: AccountType;

  @IsEnum(AccountSubtype)
  accountSubtype: AccountSubtype;

  @IsOptional()
  @IsUUID('4')
  parentAccountId?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  reportGroup?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @Transform(upper)
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @IsOptional()
  @IsBoolean()
  allowManualPosting?: boolean = true;

  @IsOptional()
  @IsBoolean()
  isControlAccount?: boolean = false;
}

export class UpdateAccountDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsUUID('4')
  parentAccountId?: string | null;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  reportGroup?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsBoolean()
  allowManualPosting?: boolean;

  @IsOptional()
  @IsEnum(AccountSubtype)
  accountSubtype?: AccountSubtype;
}

export class AccountFilterQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(AccountType)
  accountType?: AccountType;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => (value === 'true' || value === true ? true : value === 'false' || value === false ? false : undefined))
  isActive?: boolean;
}
