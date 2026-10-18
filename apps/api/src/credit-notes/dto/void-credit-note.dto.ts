import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class VoidCreditNoteDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  reason!: string;
}
