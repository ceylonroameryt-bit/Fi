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
import { PaymentKind } from '@prisma/client';

export class PaymentInitialAllocationDto {
  @IsOptional()
  @IsUUID()
  invoiceId?: string;

  @IsOptional()
  @IsUUID()
  billId?: string;

  @IsNotEmpty()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.01)
  amount!: number;
}

export class CreatePaymentDto {
  @IsNotEmpty()
  @IsEnum(PaymentKind)
  kind!: PaymentKind;

  @IsNotEmpty()
  @IsUUID()
  contactId!: string;

  @IsOptional()
  @IsUUID()
  bankAccountNominalId?: string;

  @IsNotEmpty()
  @IsDateString()
  paymentDate!: string;

  @IsNotEmpty()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentInitialAllocationDto)
  allocations?: PaymentInitialAllocationDto[];
}
