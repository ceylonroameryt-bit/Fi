import { IsString, IsBoolean, IsArray, IsOptional } from 'class-validator';

export class UpdateBusinessContextDto {
  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsBoolean()
  inventoryEnabled?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  inventoryCategories?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  salesChannels?: string[];

  @IsOptional()
  @IsString()
  accountingMethod?: string;
}
