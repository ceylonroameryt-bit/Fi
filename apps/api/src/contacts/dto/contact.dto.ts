import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ContactStatus, ContactType } from '@prisma/client';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const upper = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value);
const normalizeTaxOrCompanyNum = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, '') : value;

export class CreateContactDto {
  @IsEnum(ContactType)
  @IsOptional()
  type?: ContactType = ContactType.CUSTOMER;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Contact name is required' })
  @MaxLength(200)
  name: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  companyName?: string;

  @IsOptional()
  @Transform(normalizeTaxOrCompanyNum)
  @IsString()
  @MaxLength(50)
  companyNumber?: string;

  @IsOptional()
  @Transform(normalizeTaxOrCompanyNum)
  @IsString()
  @MaxLength(50)
  vatNumber?: string;

  @IsOptional()
  @Transform(trim)
  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  website?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(50)
  taxNumber?: string;

  @IsOptional()
  @Transform(upper)
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  paymentTermsDays?: number = 30;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  creditLimit?: number;

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
  @MaxLength(100)
  state?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(20)
  postcode?: string;

  @IsOptional()
  @Transform(upper)
  @IsString()
  @MaxLength(2)
  country?: string = 'GB';

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  shippingAddressLine1?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  shippingAddressLine2?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  shippingCity?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  shippingState?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(20)
  shippingPostcode?: string;

  @IsOptional()
  @Transform(upper)
  @IsString()
  @MaxLength(2)
  shippingCountry?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsUUID('4')
  receivableAccountId?: string;

  @IsOptional()
  @IsUUID('4')
  payableAccountId?: string;
}

export class UpdateContactDto {
  @IsOptional()
  @IsEnum(ContactType)
  type?: ContactType;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  companyName?: string;

  @IsOptional()
  @Transform(normalizeTaxOrCompanyNum)
  @IsString()
  @MaxLength(50)
  companyNumber?: string;

  @IsOptional()
  @Transform(normalizeTaxOrCompanyNum)
  @IsString()
  @MaxLength(50)
  vatNumber?: string;

  @IsOptional()
  @Transform(trim)
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  website?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(50)
  taxNumber?: string;

  @IsOptional()
  @Transform(upper)
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  paymentTermsDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  creditLimit?: number;

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
  @MaxLength(100)
  state?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(20)
  postcode?: string;

  @IsOptional()
  @Transform(upper)
  @IsString()
  @MaxLength(2)
  country?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  shippingAddressLine1?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  shippingAddressLine2?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  shippingCity?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  shippingState?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(20)
  shippingPostcode?: string;

  @IsOptional()
  @Transform(upper)
  @IsString()
  @MaxLength(2)
  shippingCountry?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsUUID('4')
  receivableAccountId?: string;

  @IsOptional()
  @IsUUID('4')
  payableAccountId?: string;
}

export const CONTACT_SORT_FIELDS = ['name', 'companyName', 'createdAt', 'updatedAt'] as const;
export type ContactSortField = (typeof CONTACT_SORT_FIELDS)[number];

export class ContactFilterQueryDto {
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
  pageSize?: number = 50;

  @IsOptional()
  @IsEnum(ContactType)
  type?: ContactType;

  @IsOptional()
  @IsEnum(ContactStatus)
  status?: ContactStatus;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(CONTACT_SORT_FIELDS)
  sortBy?: ContactSortField = 'name';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDirection?: 'asc' | 'desc' = 'asc';
}

export class CreateContactPersonDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'First name is required' })
  @MaxLength(100)
  firstName: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Last name is required' })
  @MaxLength(100)
  lastName: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  jobTitle?: string;

  @IsOptional()
  @Transform(trim)
  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(50)
  mobile?: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean = false;

  @IsOptional()
  @IsBoolean()
  isBillingContact?: boolean = false;
}

export class UpdateContactPersonDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  jobTitle?: string;

  @IsOptional()
  @Transform(trim)
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(50)
  mobile?: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @IsOptional()
  @IsBoolean()
  isBillingContact?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class DuplicateCheckQueryDto {
  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  vatNumber?: string;

  @IsOptional()
  @IsString()
  companyNumber?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  postcode?: string;

  @IsOptional()
  @IsUUID('4')
  excludeId?: string;
}

export class ContactStatementQueryDto {
  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

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
  pageSize?: number = 50;
}

export class ContactActivityQueryDto {
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
  pageSize?: number = 20;
}
