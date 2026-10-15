import { IsString, IsOptional, IsArray, ValidateNested, IsNumber, MaxLength } from 'class-validator';
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

export class AcceptProposedContactDto {
  /** Optional corrected name; identifiers always come from the document. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;
}
