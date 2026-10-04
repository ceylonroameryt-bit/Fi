import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsUUID, MaxLength } from 'class-validator';

const normaliseEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class InviteMemberDto {
  @Transform(normaliseEmail)
  @IsEmail({}, { message: 'must be a valid email address' })
  @MaxLength(254)
  email: string;

  @IsUUID('4', { message: 'roleId must be a valid UUID' })
  @IsNotEmpty()
  roleId: string;
}

export class UpdateMemberRoleDto {
  @IsUUID('4', { message: 'roleId must be a valid UUID' })
  @IsNotEmpty()
  roleId: string;
}
