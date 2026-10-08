import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { OrganizationStatus, UserStatus } from '@prisma/client';

export class AdminPaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  superAdminOnly?: boolean;
}

export class UpdateOrgStatusDto {
  @IsEnum(OrganizationStatus)
  status!: OrganizationStatus;
}

export class UpdateUserStatusDto {
  @IsEnum(UserStatus)
  status!: UserStatus;
}

export class ToggleSuperAdminDto {
  @IsBoolean()
  isSuperAdmin!: boolean;
}

export class AdminResetPasswordDto {
  @IsString()
  @MinLength(10, { message: 'Password must be at least 10 characters' })
  newPassword!: string;
}
