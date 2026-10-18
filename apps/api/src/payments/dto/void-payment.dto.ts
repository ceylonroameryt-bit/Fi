import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class VoidPaymentDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  reason!: string;
}
