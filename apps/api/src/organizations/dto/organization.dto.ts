import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const upper = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value);

export class CreateOrganizationDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  legalName?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(50)
  registrationNumber?: string;

  @Transform(upper)
  @IsString()
  @Length(2, 2)
  @Matches(/^[A-Z]{2}$/, { message: 'country must be a 2-letter ISO code' })
  country: string;

  @Transform(upper)
  @IsString()
  @Length(3, 3)
  @Matches(/^[A-Z]{3}$/, { message: 'baseCurrency must be a 3-letter currency code (e.g. GBP)' })
  baseCurrency: string;

  @Transform(trim)
  @IsString()
  @MaxLength(64)
  timezone: string = 'UTC';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  financialYearStartMonth: number = 4;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  financialYearStartDay: number = 1;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(50)
  taxNumber?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  addressLine1?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  addressLine2?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(20)
  postcode?: string;

  @IsOptional()
  @IsBoolean()
  useDefaultChartOfAccounts?: boolean = true;
}

export class UpdateOrganizationDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  legalName?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(50)
  registrationNumber?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(50)
  taxNumber?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  addressLine1?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  addressLine2?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(20)
  postcode?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(64)
  timezone?: string;
}
