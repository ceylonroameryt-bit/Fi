import { IsString, IsOptional, IsBoolean, MaxLength, IsNotEmpty, Matches } from 'class-validator';

export class UploadDocumentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileName!: string;

  @IsString()
  @MaxLength(100)
  @Matches(/^[\w.+-]+\/[\w.+-]+$/, { message: 'mimeType must look like type/subtype' })
  mimeType!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200_000)
  text?: string;

  @IsOptional()
  @IsBoolean()
  autoDraftIfHighConfidence?: boolean;
}
