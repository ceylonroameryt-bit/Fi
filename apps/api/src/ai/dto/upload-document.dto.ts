import { IsString, IsOptional } from 'class-validator';

export class UploadDocumentDto {
  @IsString()
  fileName!: string;

  @IsString()
  mimeType!: string;

  @IsOptional()
  @IsString()
  text?: string;
}
