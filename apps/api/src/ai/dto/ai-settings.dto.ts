import { VatScheme } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

export class UpdateAiSettingsDto {
  @IsBoolean()
  enabled: boolean;
}

export class UpdateBusinessProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  industry?: string;

  /** null clears it back to "not stated". */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsEnum(VatScheme)
  vatScheme?: VatScheme | null;
}
