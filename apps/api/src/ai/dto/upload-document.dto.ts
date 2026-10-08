import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class UploadDocumentDto {
  @IsString()
  fileName!: string;

  @IsString()
  mimeType!: string;

  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsBoolean()
  autoDraftIfHighConfidence?: boolean;
}
