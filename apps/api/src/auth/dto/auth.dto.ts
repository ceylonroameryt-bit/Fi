import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, Length, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const normaliseEmail = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);

export class RegisterDto {
  @Transform(normaliseEmail)
  @IsEmail({}, { message: 'must be a valid email address' })
  @MaxLength(254)
  email: string;

  @IsString()
  @Length(1, 128)
  password: string;

  @Transform(trim)
  @IsString()
  @Length(1, 100)
  firstName: string;

  @Transform(trim)
  @IsString()
  @Length(1, 100)
  lastName: string;
}

export class LoginDto {
  @Transform(normaliseEmail)
  @IsEmail({}, { message: 'must be a valid email address' })
  @MaxLength(254)
  email: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password: string;
}

export class RequestPasswordResetDto {
  @Transform(normaliseEmail)
  @IsEmail({}, { message: 'must be a valid email address' })
  @MaxLength(254)
  email: string;
}

export class ResetPasswordDto {
  @IsString()
  @Length(20, 200)
  token: string;

  @IsString()
  @Length(1, 128)
  password: string;
}

export class VerifyEmailDto {
  @IsString()
  @Length(20, 200)
  token: string;
}
