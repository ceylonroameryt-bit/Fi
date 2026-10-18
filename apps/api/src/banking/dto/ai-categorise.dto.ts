import { IsArray, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class InlineUpdateLineDto {
  @IsOptional()
  @IsUUID()
  contactId?: string | null;

  @IsOptional()
  @IsUUID()
  accountId?: string | null;

  @IsOptional()
  @IsString()
  description?: string;
}

export class ConfirmLineDto {
  @IsOptional()
  @IsUUID()
  contactId?: string | null;

  @IsOptional()
  @IsUUID()
  accountId?: string | null;

  @IsOptional()
  @IsString()
  description?: string;
}

export class BatchConfirmDto {
  @IsArray()
  @IsNotEmpty({ each: true })
  @IsUUID('4', { each: true })
  lineIds!: string[];
}

export class AutoCategoriseDto {
  @IsOptional()
  @IsUUID()
  bankAccountId?: string;
}
