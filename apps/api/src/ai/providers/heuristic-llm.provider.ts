import { Injectable } from '@nestjs/common';
import {
  ILlmProvider,
  LLMInterpretationResult,
  PromptContext,
  RawExtractedLine,
  RawExtractionResult,
} from './llm-provider.interface';
import { SemanticCategory } from '../ai.constants';

@Injectable()
export class HeuristicLlmProvider implements ILlmProvider {
  async extractDocumentData(input: {
    buffer: Buffer;
    fileName: string;
    mimeType: string;
    text?: string;
  }): Promise<RawExtractionResult> {
    const rawText = input.text ?? input.buffer.toString('utf-8');

    const invoiceNumber =
      this.extractRegex(rawText, [
        /(?:invoice\s*(?:no|number|#)?[:\s]+)([A-Za-z0-9-_]+)/i,
        /(?:inv[-#\s]*)([A-Za-z0-9-_]+)/i,
      ]) ?? `INV-${Date.now().toString().slice(-5)}`;

    const invoiceDate =
      this.extractRegex(rawText, [
        /(?:invoice\s*date|date)[:\s]+(\d{4}-\d{2}-\d{2})/i,
        /(?:date)[:\s]+(\d{1,2}[/-]\d{1,2}[/-]\d{4})/i,
      ]) ?? new Date().toISOString().slice(0, 10);

    const dueDate = this.extractRegex(rawText, [
      /(?:due\s*date)[:\s]+(\d{4}-\d{2}-\d{2})/i,
      /(?:payment\s*due)[:\s]+(\d{4}-\d{2}-\d{2})/i,
    ]);

    const currency = this.detectCurrency(rawText);

    // Entity extraction
    const issuer = this.extractIssuer(rawText);
    const recipient = this.extractRecipient(rawText);

    // Line items extraction
    const lines = this.extractLines(rawText);

    // Totals
    const subtotal = this.extractRegex(
      rawText,
      /(?:subtotal|net(?:\s*total)?|sub-total)[:\s£$€]*([\d,]+(?:\.\d{2})?)/i,
    )?.replace(/,/g, '');
    const vatTotal = this.extractRegex(
      rawText,
      /(?:vat|tax|vat\s*total)[:\s£$€]*([\d,]+(?:\.\d{2})?)/i,
    )?.replace(/,/g, '');
    const total = this.extractRegex(
      rawText,
      /(?:total|amount\s*due|grand\s*total)[:\s£$€]*([\d,]+(?:\.\d{2})?)/i,
    )?.replace(/,/g, '');

    // Fallback totals from lines if missing
    const computedSubtotal = lines.reduce((acc, l) => acc + (parseFloat(l.net ?? '0') || 0), 0);
    const computedVat = lines.reduce((acc, l) => acc + (parseFloat(l.vat ?? '0') || 0), 0);
    const computedTotal = lines.reduce((acc, l) => acc + (parseFloat(l.total ?? '0') || 0), 0);

    return {
      invoiceNumber,
      invoiceDate: this.normalizeDate(invoiceDate),
      dueDate: dueDate ? this.normalizeDate(dueDate) : undefined,
      currency,
      issuer,
      recipient,
      lines:
        lines.length > 0
          ? lines
          : [
              {
                description: 'Standard Line Item',
                quantity: 1,
                unit: 'unit',
                unitPrice: subtotal ?? computedSubtotal.toFixed(2),
                net: subtotal ?? computedSubtotal.toFixed(2),
                vat: vatTotal ?? computedVat.toFixed(2),
                total: total ?? computedTotal.toFixed(2),
              },
            ],
      subtotal: subtotal ?? (computedSubtotal > 0 ? computedSubtotal.toFixed(2) : undefined),
      vatTotal: vatTotal ?? (computedVat > 0 ? computedVat.toFixed(2) : undefined),
      total: total ?? (computedTotal > 0 ? computedTotal.toFixed(2) : undefined),
      rawText,
    };
  }

  async interpretClassification(context: PromptContext): Promise<LLMInterpretationResult> {
    const { extracted, organizationName, industry, inventoryEnabled } = context;
    const rawText = (extracted.rawText ?? '').toLowerCase();
    const orgLower = organizationName.toLowerCase();

    // 1. Detect Direction
    let detectedDirection: 'PURCHASE' | 'SALE' | 'UNKNOWN' = 'UNKNOWN';

    const issuerName = (extracted.issuer?.name ?? '').toLowerCase();
    const recipientName = (extracted.recipient?.name ?? '').toLowerCase();

    if (issuerName && (issuerName.includes(orgLower) || orgLower.includes(issuerName))) {
      detectedDirection = 'SALE';
    } else if (recipientName && (recipientName.includes(orgLower) || orgLower.includes(recipientName))) {
      detectedDirection = 'PURCHASE';
    } else if (
      rawText.includes('bill to:\n' + orgLower) ||
      rawText.includes('bill to: ' + orgLower) ||
      rawText.includes('customer: ' + orgLower)
    ) {
      detectedDirection = 'PURCHASE';
    } else if (rawText.includes('bill to:') && !rawText.includes(orgLower)) {
      // If we are issuing bill to someone else
      if (
        rawText.startsWith(orgLower) ||
        (extracted.issuer?.name && extracted.issuer.name.toLowerCase().includes(orgLower))
      ) {
        detectedDirection = 'SALE';
      }
    }

    // 2. Classify Lines
    const lineInterpretations = extracted.lines.map((line, idx) => {
      const desc = line.description.toLowerCase();
      let productType: 'INVENTORY' | 'EXPENSE' | 'FIXED_ASSET' | 'SERVICE' | 'UNKNOWN' = 'EXPENSE';
      let semanticCategory = SemanticCategory.GENERAL_EXPENSE;
      let confidence = 0.85;

      // Petrol Station / Fuel Domain
      if (
        desc.includes('diesel') ||
        desc.includes('petrol') ||
        desc.includes('unleaded') ||
        desc.includes('fuel') ||
        desc.includes('gas oil')
      ) {
        if (industry === 'PETROL_STATION' && inventoryEnabled) {
          productType = 'INVENTORY';
          if (detectedDirection === 'SALE') {
            semanticCategory = SemanticCategory.FUEL_SALE;
          } else {
            semanticCategory = SemanticCategory.FUEL_INVENTORY;
          }
          confidence = 0.98;
        } else {
          // If a consulting or service firm buys fuel, it's a vehicle/travel expense
          productType = 'EXPENSE';
          semanticCategory = SemanticCategory.TRAVEL_EXPENSE;
          confidence = 0.9;
        }
      } else if (desc.includes('lubricant') || desc.includes('engine oil') || desc.includes('motor oil')) {
        if (industry === 'PETROL_STATION' && inventoryEnabled) {
          productType = 'INVENTORY';
          semanticCategory = SemanticCategory.FUEL_INVENTORY;
          confidence = 0.95;
        } else {
          productType = 'EXPENSE';
          semanticCategory = SemanticCategory.GENERAL_EXPENSE;
          confidence = 0.85;
        }
      } else if (
        desc.includes('software') ||
        desc.includes('subscription') ||
        desc.includes('microsoft') ||
        desc.includes('adobe') ||
        desc.includes('saas')
      ) {
        productType = 'EXPENSE';
        semanticCategory = SemanticCategory.SOFTWARE_SUBSCRIPTION;
        confidence = 0.96;
      } else if (desc.includes('cleaning') || desc.includes('janitorial')) {
        productType = 'SERVICE';
        semanticCategory = SemanticCategory.CLEANING_EXPENSE;
        confidence = 0.94;
      } else if (
        desc.includes('pos terminal') ||
        desc.includes('computer') ||
        desc.includes('laptop') ||
        desc.includes('server')
      ) {
        productType = 'FIXED_ASSET';
        semanticCategory = SemanticCategory.EQUIPMENT_ASSET;
        confidence = 0.92;
      } else if (
        desc.includes('cement') ||
        desc.includes('timber') ||
        desc.includes('bricks') ||
        desc.includes('steel')
      ) {
        if (industry === 'CONSTRUCTION' && inventoryEnabled) {
          productType = 'INVENTORY';
          semanticCategory = SemanticCategory.MATERIALS_INVENTORY;
          confidence = 0.95;
        } else {
          productType = 'EXPENSE';
          semanticCategory = SemanticCategory.GENERAL_EXPENSE;
          confidence = 0.8;
        }
      } else if (detectedDirection === 'SALE') {
        productType = 'SERVICE';
        semanticCategory = SemanticCategory.SERVICE_SALE;
        confidence = 0.85;
      }

      return {
        lineNumber: idx + 1,
        productType,
        semanticCategory,
        confidence,
      };
    });

    return {
      detectedDirection,
      reasoning: `Classified based on legal document headers, entity resolution (${organizationName}), and ${industry} industry profile.`,
      lineInterpretations,
    };
  }

  // --- Private Helpers ---

  private extractRegex(text: string, patterns: RegExp | RegExp[]): string | undefined {
    const list = Array.isArray(patterns) ? patterns : [patterns];
    for (const pat of list) {
      const match = text.match(pat);
      if (match?.[1]) {
        return match[1].trim();
      }
    }
    return undefined;
  }

  private detectCurrency(text: string): string {
    if (text.includes('£') || text.includes('GBP')) return 'GBP';
    if (text.includes('€') || text.includes('EUR')) return 'EUR';
    if (text.includes('$') || text.includes('USD')) return 'USD';
    return 'GBP';
  }

  private normalizeDate(dateStr: string): string {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    const parts = dateStr.split(/[/-]/);
    if (parts.length === 3) {
      if (parts[2].length === 4) {
        // DD/MM/YYYY
        const [d, m, y] = parts;
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
    }
    return new Date().toISOString().slice(0, 10);
  }

  private extractIssuer(text: string): { name?: string; vatNumber?: string; address?: string } {
    const vatMatch = text.match(/(?:VAT(?:\s*Reg|\s*No|\s*Number)?:?\s*)(GB\d{9}|\d{9})/i);
    const vatNumber = vatMatch ? vatMatch[1].toUpperCase() : undefined;

    // First line before "Invoice" or "Bill To" is often issuer
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    let name: string | undefined;

    for (const line of lines) {
      if (
        !line.toLowerCase().includes('invoice') &&
        !line.toLowerCase().includes('bill to') &&
        !line.toLowerCase().includes('date') &&
        line.length > 3 &&
        line.length < 80
      ) {
        name = line;
        break;
      }
    }

    return { name, vatNumber };
  }

  private extractRecipient(text: string): { name?: string; vatNumber?: string; address?: string } {
    const billToMatch = text.match(/(?:bill\s*to|customer|buyer|recipient)[:\s\n]+([^\n]+)/i);
    let name = billToMatch ? billToMatch[1].trim() : undefined;

    const vatMatch = text.match(/(?:customer\s*vat|recipient\s*vat)[:\s]*(GB\d{9}|\d{9})/i);
    const vatNumber = vatMatch ? vatMatch[1].toUpperCase() : undefined;

    if (name?.toLowerCase().includes('vat')) {
      name = name.split(/vat/i)[0].trim();
    }

    return { name, vatNumber };
  }

  private extractLines(text: string): RawExtractedLine[] {
    const lines: RawExtractedLine[] = [];
    const rawLines = text.split('\n');

    // Pattern: 10,000 litres Diesel £12,000 VAT £2,400 Total £14,400
    // or: Diesel, 10000, 1.20, 12000
    for (const line of rawLines) {
      const trimmed = line.trim();
      if (
        !trimmed ||
        trimmed.toLowerCase().startsWith('invoice') ||
        trimmed.toLowerCase().startsWith('total')
      ) {
        continue;
      }

      // Match pattern with quantity and unit: e.g. "10,000 litres Diesel £12,000"
      const fuelMatch = trimmed.match(
        /([\d,]+)\s*(litres?|ltr|kg|unit|hours?)?\s+([A-Za-z0-9\s-]+?)\s+[£$€]?([\d,]+(?:\.\d{2})?)/i,
      );
      if (fuelMatch) {
        const qty = parseFloat(fuelMatch[1].replace(/,/g, ''));
        const unit = fuelMatch[2] ?? 'unit';
        const desc = fuelMatch[3].trim();
        const netStr = fuelMatch[4].replace(/,/g, '');
        const netNum = parseFloat(netStr) || 0;
        const unitPrice = qty > 0 ? (netNum / qty).toFixed(2) : netStr;
        const vatNum = (netNum * 0.2).toFixed(2);
        const totalNum = (netNum * 1.2).toFixed(2);

        lines.push({
          description: desc,
          quantity: qty,
          unit,
          unitPrice,
          net: netNum.toFixed(2),
          vat: vatNum,
          total: totalNum,
        });
        continue;
      }

      // Check simple line item: "Description £150"
      const simpleMatch = trimmed.match(/^([A-Za-z0-9\s-]{3,40})\s+[£$€]?([\d,]+(?:\.\d{2})?)$/);
      if (simpleMatch) {
        const desc = simpleMatch[1].trim();
        const netStr = simpleMatch[2].replace(/,/g, '');
        const netNum = parseFloat(netStr) || 0;
        const vatNum = (netNum * 0.2).toFixed(2);
        const totalNum = (netNum * 1.2).toFixed(2);

        lines.push({
          description: desc,
          quantity: 1,
          unit: 'unit',
          unitPrice: netNum.toFixed(2),
          net: netNum.toFixed(2),
          vat: vatNum,
          total: totalNum,
        });
      }
    }

    return lines;
  }
}
