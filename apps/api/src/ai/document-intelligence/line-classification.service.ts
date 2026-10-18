import { Injectable } from '@nestjs/common';
import { AiDirection, AiProductType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { MoneyService } from '../../accounting-engine/money.service';
import { BusinessContextProfile } from '../business-context/business-context.types';
import { SemanticCategory } from '../ai.constants';
import { RawExtractedLine } from '../providers/llm-provider.interface';

export interface ClassifiedLineResult {
  lineNumber: number;
  description: string;
  /** Amounts are exactly what the document shows (or code-derived from it); null when unknown. */
  quantity: string | null;
  unit?: string;
  unitPrice: string | null;
  netAmount: string | null;
  taxAmount: string | null;
  totalAmount: string | null;
  productType: AiProductType;
  productClassification: string;
  /** Suggested Stage 2 tax code (e.g. UK_SR) or null when the document does not determine it. */
  taxClassification: string | null;
  accountingCategory: string;
  confidence: number;
  feedbackApplied?: boolean;
}

/**
 * Suggests a tax code only when the document's own net and VAT pin down the rate (20% or 5%,
 * within a penny). A zero VAT amount is ambiguous (zero-rated, exempt or outside scope) and gets null.
 */
export function suggestTaxCodeFromAmounts(money: MoneyService, net: string | null, vat: string | null): string | null {
  if (net === null || vat === null) return null;
  const n = money.toDecimal(net);
  const v = money.toDecimal(vat);
  if (n.isZero() || v.isZero()) return null;
  const within = (rate: string) => v.minus(n.mul(rate)).abs().lessThanOrEqualTo('0.01');
  if (within('0.20')) return 'UK_SR';
  if (within('0.05')) return 'UK_RR';
  return null;
}

@Injectable()
export class LineClassificationService {
  constructor(
    private readonly db: PrismaService,
    private readonly money: MoneyService,
  ) {}

  async classifyLines(
    organizationId: string,
    lines: RawExtractedLine[],
    direction: AiDirection,
    businessContext: BusinessContextProfile,
    entityId?: string | null,
    documentTotals: { subtotal?: string; vatTotal?: string } = {},
  ): Promise<ClassifiedLineResult[]> {
    // Past accountant corrections for this organisation (and contact, when known)
    const feedbacks = await this.db.aiFeedback.findMany({
      where: { organizationId, ...(entityId ? { supplierOrCustomerId: entityId } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return lines.map((line, i) => {
      const desc = line.description.trim();
      const { productType, productClassification, confidence, feedbackApplied } = this.classifyProduct(
        desc.toLowerCase(),
        direction,
        businessContext,
        feedbacks,
      );

      const quantity = this.decimalOrNull(line.quantity, 4);
      const printedUnitPrice = this.decimalOrNull(line.unitPrice, 4);
      // Net: as printed, else quantity x unit price (exact decimal arithmetic in code).
      const netAmount =
        this.decimalOrNull(line.net, 2) ??
        (quantity !== null && printedUnitPrice !== null
          ? this.money.round(this.money.toDecimal(quantity).mul(printedUnitPrice), 2).toFixed(2)
          : null);
      const unitPrice = printedUnitPrice ?? this.exactUnitPrice(netAmount, quantity);
      // A single line whose net equals the document subtotal carries the whole document VAT.
      const taxAmount =
        this.decimalOrNull(line.vat, 2) ??
        (lines.length === 1 && netAmount !== null && documentTotals.vatTotal !== undefined &&
        documentTotals.subtotal !== undefined && this.money.toDecimal(documentTotals.subtotal).equals(netAmount)
          ? this.money.toDecimal(documentTotals.vatTotal).toFixed(2)
          : null);
      const totalAmount =
        this.decimalOrNull(line.total, 2) ??
        (netAmount !== null && taxAmount !== null ? this.money.toDecimal(netAmount).plus(taxAmount).toFixed(2) : null);

      return {
        lineNumber: i + 1,
        description: desc,
        quantity,
        unit: line.unit,
        unitPrice,
        netAmount,
        taxAmount,
        totalAmount,
        productType,
        productClassification,
        taxClassification: suggestTaxCodeFromAmounts(this.money, netAmount, taxAmount),
        accountingCategory: productClassification,
        confidence,
        feedbackApplied,
      };
    });
  }

  /** net / quantity only when it divides exactly at 4dp (otherwise unknown, never rounded into place). */
  private exactUnitPrice(net: string | null, quantity: string | null): string | null {
    if (net === null || quantity === null) return null;
    const q = this.money.toDecimal(quantity);
    if (q.isZero()) return null;
    const price = this.money.toDecimal(net).div(q);
    const p4 = price.toDecimalPlaces(4);
    return p4.mul(q).equals(this.money.toDecimal(net)) ? p4.toFixed(4) : null;
  }

  private decimalOrNull(value: string | undefined, dp: number): string | null {
    if (value === undefined || value === null || String(value).trim() === '') return null;
    try {
      return this.money.toDecimal(String(value)).toFixed(dp);
    } catch {
      return null;
    }
  }

  private classifyProduct(
    descLower: string,
    direction: AiDirection,
    ctx: BusinessContextProfile,
    feedbacks: Array<{ productPattern: string; correctedClassification: string }>,
  ): { productType: AiProductType; productClassification: string; confidence: number; feedbackApplied: boolean } {
    const matched = feedbacks.find(
      (f) => descLower.includes(f.productPattern.toLowerCase()) || f.productPattern.toLowerCase().includes(descLower),
    );
    if (matched) {
      const c = matched.correctedClassification;
      const productType = c.includes('INVENTORY')
        ? AiProductType.INVENTORY
        : c.includes('ASSET')
          ? AiProductType.FIXED_ASSET
          : c.includes('SALE')
            ? AiProductType.SERVICE
            : AiProductType.EXPENSE;
      return { productType, productClassification: c, confidence: 0.98, feedbackApplied: true };
    }

    const stocksFuel = ctx.industry === 'PETROL_STATION' && ctx.inventoryEnabled;
    const stocksMaterials = ctx.industry === 'CONSTRUCTION' && ctx.inventoryEnabled;
    const result = (productType: AiProductType, productClassification: string, confidence: number) => ({
      productType,
      productClassification,
      confidence,
      feedbackApplied: false,
    });

    if (/diesel|petrol|unleaded|fuel|gas oil|kerosene|lubricant|engine oil|motor oil|grease|brake fluid/.test(descLower)) {
      if (stocksFuel) {
        return result(
          AiProductType.INVENTORY,
          direction === AiDirection.SALE ? SemanticCategory.FUEL_SALE : SemanticCategory.FUEL_INVENTORY,
          0.98,
        );
      }
      return result(AiProductType.EXPENSE, SemanticCategory.TRAVEL_EXPENSE, 0.9);
    }
    if (/software|subscription|saas|microsoft|adobe|google workspace|slack|aws|cloud/.test(descLower)) {
      return result(AiProductType.EXPENSE, SemanticCategory.SOFTWARE_SUBSCRIPTION, 0.96);
    }
    if (/cleaning|janitorial|washroom|sanitation/.test(descLower)) {
      return result(AiProductType.SERVICE, SemanticCategory.CLEANING_EXPENSE, 0.95);
    }
    if (/pos terminal|terminal|pos system|server rack|forklift|vehicle|generator|machinery/.test(descLower)) {
      return result(AiProductType.FIXED_ASSET, SemanticCategory.EQUIPMENT_ASSET, 0.93);
    }
    if (/cement|concrete|timber|bricks|scaffolding|insulation|gravel/.test(descLower)) {
      return stocksMaterials
        ? result(AiProductType.INVENTORY, SemanticCategory.MATERIALS_INVENTORY, 0.96)
        : result(AiProductType.EXPENSE, SemanticCategory.GENERAL_EXPENSE, 0.85);
    }
    if (direction === AiDirection.SALE) {
      return ctx.inventoryEnabled
        ? result(AiProductType.INVENTORY, SemanticCategory.GOODS_SALE, 0.85)
        : result(AiProductType.SERVICE, SemanticCategory.SERVICE_SALE, 0.85);
    }
    return result(AiProductType.UNKNOWN, SemanticCategory.GENERAL_EXPENSE, 0.5);
  }
}
