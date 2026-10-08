import { IsString, IsOptional, IsArray, ValidateNested, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class LineModificationDto {
  @IsNumber()
  lineNumber!: number;

  @IsString()
  description!: string;

  @IsString()
  accountId!: string;

  @IsOptional()
  @IsString()
  productClassification?: string;
}

export class EditAndApproveDto {
  @IsString()
  contactId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LineModificationDto)
  lines!: LineModificationDto[];

  @IsOptional()
  @IsString()
  notes?: string;
}

export class RejectSuggestionDto {
  @IsString()
  reason!: string;
}

export class ApproveSuggestionDto {
  @IsOptional()
  @IsString()
  contactId?: string;
}
