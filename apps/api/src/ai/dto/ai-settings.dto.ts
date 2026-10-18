import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateAiSettingsDto {
  @IsBoolean()
  enabled: boolean;
}

export class UpdateBusinessProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  industry?: string;

  // The VAT scheme is no longer set here: it is the organisation's dated setting (PUT /organizations/:orgId/vat-scheme).
}
