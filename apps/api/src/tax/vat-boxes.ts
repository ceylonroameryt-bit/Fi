import { Prisma, TaxDirection, TaxTreatment } from '@prisma/client';

export const VAT_BOXES = ['box1', 'box2', 'box3', 'box4', 'box5', 'box6', 'box7', 'box8', 'box9'] as const;
export type VatBox = (typeof VAT_BOXES)[number];
/** Boxes fed directly by ledger lines (3 and 5 are derived; 2, 8, 9 are NI/EU only). */
export const SOURCE_BOXES: ReadonlySet<VatBox> = new Set(['box1', 'box2', 'box4', 'box6', 'box7', 'box8', 'box9']);

/** Treatments that are only valid on purchases. */
export const INPUT_ONLY_TREATMENTS: ReadonlySet<TaxTreatment> = new Set([
  TaxTreatment.REVERSE_CHARGE_SERVICES,
  TaxTreatment.POSTPONED_IMPORT_VAT,
]);

/**
 * Which VAT return boxes a single tax-analysed ledger line contributes to (HMRC VAT Notice 700/12).
 * `net` and `vat` are signed (credit notes / reversals are negative). For reverse-charge treatments
 * `vat` is the self-accounted VAT.
 *
 * Boxes 2, 8 and 9 (Northern Ireland / EU goods) are not supported yet and are always zero.
 */
export function vatBoxContributions(
  direction: TaxDirection,
  treatment: TaxTreatment,
  net: Prisma.Decimal,
  vat: Prisma.Decimal,
): Array<[VatBox, Prisma.Decimal]> {
  if (treatment === TaxTreatment.OUTSIDE_SCOPE) return [];

  if (direction === TaxDirection.OUTPUT) {
    if (INPUT_ONLY_TREATMENTS.has(treatment)) {
      throw new Error(`Tax treatment ${treatment} cannot be used on sales`);
    }
    // Supplier under the domestic reverse charge: net only, the customer accounts for the VAT.
    if (treatment === TaxTreatment.DOMESTIC_REVERSE_CHARGE) return [['box6', net]];
    return [
      ['box1', vat],
      ['box6', net],
    ];
  }

  switch (treatment) {
    case TaxTreatment.DOMESTIC_REVERSE_CHARGE:
    case TaxTreatment.POSTPONED_IMPORT_VAT:
      return [
        ['box1', vat],
        ['box4', vat],
        ['box7', net],
      ];
    case TaxTreatment.REVERSE_CHARGE_SERVICES:
      return [
        ['box1', vat],
        ['box4', vat],
        ['box6', net],
        ['box7', net],
      ];
    default:
      return [
        ['box4', vat],
        ['box7', net],
      ];
  }
}
