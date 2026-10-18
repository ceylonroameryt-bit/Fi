import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { StatementFileFormat } from '@prisma/client';

export class ImportStatementDto {
  @IsNotEmpty()
  @IsUUID()
  bankAccountId!: string;

  @IsNotEmpty()
  @IsEnum(StatementFileFormat)
  fileFormat!: StatementFileFormat;

  @IsNotEmpty()
  @IsString()
  fileName!: string;

  /** Base64 or plain text content of the uploaded file */
  @IsNotEmpty()
  @IsString()
  fileContent!: string;

  @IsOptional()
  columnMapping?: Record<string, string>;
}
