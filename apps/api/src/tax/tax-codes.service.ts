import { Injectable } from '@nestjs/common';
import { Prisma, TaxTreatment } from '@prisma/client';
import { PrismaService, Tx } from '../database/prisma.service';
import { DomainException } from '../common/errors/domain.exception';
import { toIsoDate } from '../common/utils/dates';

export interface ResolvedTaxCode {
  id: string;
  code: string;
  name: string;
  treatment: TaxTreatment;
  rate: Prisma.Decimal;
}

type RateRow = { rate: Prisma.Decimal; effectiveFrom: Date; effectiveTo: Date | null };

/** Picks the rate row in force on `date` (dates compared as calendar days). */
export function rateOnDate(rates: RateRow[], date: Date): Prisma.Decimal | null {
  const day = toIsoDate(date);
  const match = rates.find(
    (r) => toIsoDate(r.effectiveFrom) <= day && (r.effectiveTo === null || toIsoDate(r.effectiveTo) >= day),
  );
  return match ? match.rate : null;
}

/** UK VAT codes are system reference data shared by every organisation (not tenant data). */
@Injectable()
export class TaxCodesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Active codes with the rate in force on `date` (default today). */
  async list(date = new Date()) {
    const codes = await this.prisma.taxCode.findMany({
      where: { isActive: true },
      include: { rates: { orderBy: { effectiveFrom: 'desc' } } },
      orderBy: { code: 'asc' },
    });
    return codes
      .map((c) => ({ id: c.id, code: c.code, name: c.name, description: c.description, treatment: c.treatment, rate: rateOnDate(c.rates, date) }))
      .filter((c) => c.rate !== null)
      .map((c) => ({ ...c, rate: c.rate!.toFixed(4) }));
  }

  /** Resolves a code and its rate on a date; throws rather than ever falling back to a default. */
  async resolve(taxCodeId: string, date: Date, tx?: Tx): Promise<ResolvedTaxCode> {
    const client = tx ?? this.prisma;
    const code = await client.taxCode.findUnique({ where: { id: taxCodeId }, include: { rates: true } });
    if (!code || !code.isActive) {
      throw new DomainException('TAX_CODE_NOT_FOUND', 'Tax code was not found or is inactive');
    }
    const rate = rateOnDate(code.rates, date);
    if (rate === null) {
      throw new DomainException('TAX_CODE_NOT_EFFECTIVE', `Tax code ${code.code} has no rate in force on ${toIsoDate(date)}`);
    }
    return { id: code.id, code: code.code, name: code.name, treatment: code.treatment, rate };
  }
}
