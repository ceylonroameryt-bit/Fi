import { VatScheme } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsNumber, IsOptional, Matches, Max, Min, ValidateIf } from 'class-validator';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export class SetVatSchemeDto {
  @IsEnum(VatScheme)
  scheme: VatScheme;

  /** The scheme applies from this date until the next change. */
  @Matches(ISO_DATE, { message: 'startDate must be in YYYY-MM-DD format' })
  startDate: string;

  /** Flat Rate Scheme percentage for the business's sector, as chosen by the user (FLAT_RATE only). */
  @ValidateIf((o: SetVatSchemeDto) => o.scheme === VatScheme.FLAT_RATE || o.flatRatePercent !== undefined)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(16.5)
  flatRatePercent?: number;

  /** Limited cost trader (FLAT_RATE only): the user's own determination; the rate must then be 16.5%. */
  @IsOptional()
  @IsBoolean()
  limitedCostTrader?: boolean;
}

export class FlatRateAdjustmentDto {
  @Matches(ISO_DATE, { message: 'from must be in YYYY-MM-DD format' })
  from: string;

  @Matches(ISO_DATE, { message: 'to must be in YYYY-MM-DD format' })
  to: string;
}
