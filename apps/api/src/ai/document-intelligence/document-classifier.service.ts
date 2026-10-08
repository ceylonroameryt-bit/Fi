import { Injectable } from '@nestjs/common';
import { AiDirection, AiDocumentType } from '@prisma/client';
import { RawExtractionResult } from '../providers/llm-provider.interface';

export interface DocumentClassificationResult {
  documentType: AiDocumentType;
  confidence: number;
  reasoning: string;
}

@Injectable()
export class DocumentClassifierService {
  classify(extracted: RawExtractionResult, direction: AiDirection): DocumentClassificationResult {
    const rawText = (extracted.rawText ?? '').toLowerCase();

    // 1. Credit Note check
    if (
      rawText.includes('credit note') ||
      rawText.includes('credit memo') ||
      rawText.includes('refund note')
    ) {
      if (direction === AiDirection.PURCHASE) {
        return {
          documentType: AiDocumentType.PURCHASE_CREDIT_NOTE,
          confidence: 0.96,
          reasoning: 'Detected credit note keywords with incoming purchase direction.',
        };
      }
      return {
        documentType: AiDocumentType.SALES_CREDIT_NOTE,
        confidence: 0.96,
        reasoning: 'Detected credit note keywords with outgoing sales direction.',
      };
    }

    // 2. Bank statement check
    if (
      rawText.includes('bank statement') ||
      (rawText.includes('account statement') &&
        rawText.includes('opening balance') &&
        rawText.includes('closing balance'))
    ) {
      return {
        documentType: AiDocumentType.BANK_STATEMENT,
        confidence: 0.98,
        reasoning: 'Identified periodic bank balance and transactions layout.',
      };
    }

    // 3. Delivery Note
    if (
      rawText.includes('delivery note') ||
      rawText.includes('dispatch note') ||
      rawText.includes('packing slip')
    ) {
      return {
        documentType: AiDocumentType.DELIVERY_NOTE,
        confidence: 0.95,
        reasoning: 'Identified delivery and shipping manifest markers.',
      };
    }

    // 4. Receipt
    if (
      rawText.includes('till receipt') ||
      rawText.includes('sales receipt') ||
      rawText.includes('cash receipt')
    ) {
      if (direction === AiDirection.PURCHASE) {
        return {
          documentType: AiDocumentType.EXPENSE_RECEIPT,
          confidence: 0.92,
          reasoning: 'Identified point-of-sale receipt for business purchase.',
        };
      }
      return {
        documentType: AiDocumentType.RECEIPT,
        confidence: 0.92,
        reasoning: 'Identified receipt of transaction.',
      };
    }

    // 5. Invoices (The core standard path)
    if (
      rawText.includes('invoice') ||
      rawText.includes('tax invoice') ||
      rawText.includes('bill') ||
      extracted.invoiceNumber
    ) {
      if (direction === AiDirection.SALE) {
        return {
          documentType: AiDocumentType.SALES_INVOICE,
          confidence: 0.97,
          reasoning: 'Commercial invoice issued by the organisation to a customer.',
        };
      }
      if (direction === AiDirection.PURCHASE) {
        return {
          documentType: AiDocumentType.PURCHASE_INVOICE,
          confidence: 0.97,
          reasoning: 'Commercial supplier invoice received by the organisation from a vendor.',
        };
      }
    }

    // Fallback based purely on direction if invoice indicators are present
    if (direction === AiDirection.PURCHASE) {
      return {
        documentType: AiDocumentType.PURCHASE_INVOICE,
        confidence: 0.8,
        reasoning: 'Inferred purchase invoice based on inbound vendor billing context.',
      };
    }
    if (direction === AiDirection.SALE) {
      return {
        documentType: AiDocumentType.SALES_INVOICE,
        confidence: 0.8,
        reasoning: 'Inferred sales invoice based on outbound customer billing context.',
      };
    }

    return {
      documentType: AiDocumentType.UNKNOWN,
      confidence: 0.4,
      reasoning: 'Document does not contain unambiguous commercial billing markers.',
    };
  }
}
