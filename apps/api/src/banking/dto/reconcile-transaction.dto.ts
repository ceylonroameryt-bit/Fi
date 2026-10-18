import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class MatchTransactionDto {
  @IsOptional()
  @IsUUID()
  matchedPaymentId?: string;

  @IsOptional()
  @IsUUID()
  matchedJournalLineId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class QuickCreateTransactionDto {
  @IsNotEmpty()
  @IsUUID()
  accountId!: string;

  @IsOptional()
  @IsUUID()
  taxCodeId?: string;

  @IsOptional()
  @IsUUID()
  contactId?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
