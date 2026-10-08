import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AiDirection, AiProductType } from '@prisma/client';
import { BusinessContextProfile } from '../business-context/business-context.types';
import { SemanticCategory } from '../ai.constants';
import { RawExtractedLine } from '../providers/llm-provider.interface';

export interface ClassifiedLineResult {
  lineNumber: number;
  description: string;
  quantity: string;
  unit?: string;
  unitPrice: string;
  netAmount: string;
  taxAmount: string;
  totalAmount: string;
  productType: AiProductType;
  productClassification: string;
  taxClassification: string;
  accountingCategory: string;
  confidence: number;
  feedbackApplied?: boolean;
}

@Injectable()
export class LineClassificationService {
  constructor(private readonly db: PrismaService) {}

  async classifyLines(
    organizationId: string,
    lines: RawExtractedLine[],
    direction: AiDirection,
    businessContext: BusinessContextProfile,
    entityId?: string | null,
  ): Promise<ClassifiedLineResult[]> {
    // Load historical feedback preferences for this organization to apply past accountant corrections
    const feedbacks = await this.db.aiFeedback.findMany({
      where: {
        organizationId,
        ...(entityId ? { supplierOrCustomerId: entityId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const results: ClassifiedLineResult[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const desc = line.description.trim();
      const descLower = desc.toLowerCase();

      let productType: AiProductType = AiProductType.EXPENSE;
      let productClassification: string = SemanticCategory.GENERAL_EXPENSE;
      let taxClassification = 'VAT_STANDARD';
      let confidence = 0.85;
      let feedbackApplied = false;

      // 1. Check historical feedback overrides for this exact or matching product
      const matchedFeedback = feedbacks.find(
        (f: { productPattern: string; correctedClassification: string }) =>
          descLower.includes(f.productPattern.toLowerCase()) ||
          f.productPattern.toLowerCase().includes(descLower),
      );

      if (matchedFeedback) {
        productClassification = matchedFeedback.correctedClassification;
        feedbackApplied = true;
        confidence = 0.98;
        if (productClassification.includes('INVENTORY')) {
          productType = AiProductType.INVENTORY;
        } else if (productClassification.includes('ASSET')) {
          productType = AiProductType.FIXED_ASSET;
        } else if (productClassification.includes('SALE')) {
          productType = AiProductType.SERVICE;
        } else {
          productType = AiProductType.EXPENSE;
        }
      } else {
        // 2. Business Context & Industry Heuristics
        // Petrol Station / Fuel Logic
        const isFuel = /diesel|petrol|unleaded|fuel|gas oil|kerosene/i.test(descLower);
        const isLubricant = /lubricant|engine oil|motor oil|grease|brake fluid/i.test(descLower);

        if (isFuel || isLubricant) {
          if (businessContext.industry === 'PETROL_STATION' && businessContext.inventoryEnabled) {
            productType = AiProductType.INVENTORY;
            if (direction === AiDirection.SALE) {
              productClassification = SemanticCategory.FUEL_SALE;
            } else {
              productClassification = SemanticCategory.FUEL_INVENTORY;
            }
            confidence = 0.98;
          } else {
            // General or consulting business: Fuel is vehicle/travel operating expense
            productType = AiProductType.EXPENSE;
            productClassification = SemanticCategory.TRAVEL_EXPENSE;
            confidence = 0.9;
          }
        }
        // Software & Subscriptions
        else if (
          /software|subscription|saas|microsoft|adobe|google workspace|slack|aws|cloud/i.test(descLower)
        ) {
          productType = AiProductType.EXPENSE;
          productClassification = SemanticCategory.SOFTWARE_SUBSCRIPTION;
          confidence = 0.96;
        }
        // Cleaning & Facility Maintenance
        else if (/cleaning|janitorial|washroom|sanitation/i.test(descLower)) {
          productType = AiProductType.SERVICE;
          productClassification = SemanticCategory.CLEANING_EXPENSE;
          confidence = 0.95;
        }
        // Capital / Fixed Asset Equipment
        else if (
          /pos terminal|terminal|pos system|server rack|forklift|vehicle|generator|machinery/i.test(descLower)
        ) {
          productType = AiProductType.FIXED_ASSET;
          productClassification = SemanticCategory.EQUIPMENT_ASSET;
          confidence = 0.93;
        }
        // Construction Materials
        else if (/cement|concrete|timber|bricks|scaffolding|insulation|gravel/i.test(descLower)) {
          if (businessContext.industry === 'CONSTRUCTION' && businessContext.inventoryEnabled) {
            productType = AiProductType.INVENTORY;
            productClassification = SemanticCategory.MATERIALS_INVENTORY;
            confidence = 0.96;
          } else {
            productType = AiProductType.EXPENSE;
            productClassification = SemanticCategory.GENERAL_EXPENSE;
            confidence = 0.85;
          }
        }
        // Default Sale fallback
        else if (direction === AiDirection.SALE) {
          productType = businessContext.inventoryEnabled ? AiProductType.INVENTORY : AiProductType.SERVICE;
          productClassification = businessContext.inventoryEnabled
            ? SemanticCategory.GOODS_SALE
            : SemanticCategory.SERVICE_SALE;
          confidence = 0.85;
        }
      }

      // Financial arithmetic formatting
      const qtyStr = (line.quantity ? String(line.quantity) : '1').replace(/,/g, '');
      const unitPriceStr = (line.unitPrice ? String(line.unitPrice) : '0.00').replace(/,/g, '');
      const netStr = (
        line.net ? String(line.net) : (parseFloat(qtyStr) * parseFloat(unitPriceStr)).toFixed(2)
      ).replace(/,/g, '');
      const vatStr = (line.vat ? String(line.vat) : (parseFloat(netStr) * 0.2).toFixed(2)).replace(/,/g, '');
      const totalStr = (
        line.total ? String(line.total) : (parseFloat(netStr) + parseFloat(vatStr)).toFixed(2)
      ).replace(/,/g, '');

      // Tax classification
      if (parseFloat(vatStr) === 0) {
        taxClassification = 'VAT_ZERO';
      }

      results.push({
        lineNumber: i + 1,
        description: desc || 'Item',
        quantity: qtyStr,
        unit: line.unit,
        unitPrice: unitPriceStr,
        netAmount: netStr,
        taxAmount: vatStr,
        totalAmount: totalStr,
        productType,
        productClassification,
        taxClassification,
        accountingCategory: productClassification,
        confidence,
        feedbackApplied,
      });
    }

    return results;
  }
}
