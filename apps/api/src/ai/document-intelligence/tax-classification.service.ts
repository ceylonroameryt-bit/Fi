import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { STANDARD_VAT_RATE, ZERO_VAT_RATE } from '../ai.constants';

export interface ResolvedTaxInfo {
  taxCode: string;
  rate: string;
  isRecoverable: boolean;
  taxAccountId?: string;
}

@Injectable()
export class TaxClassificationService {
  constructor(private readonly db: PrismaService) {}

  async resolveTax(
    organizationId: string,
    taxClassification: string,
    direction: 'PURCHASE' | 'SALE',
  ): Promise<ResolvedTaxInfo> {
    const isPurchase = direction === 'PURCHASE';

    // Look for Tax Payable / Tax Input account in organisation
    const taxAccount = await this.db.account.findFirst({
      where: {
        organizationId,
        accountSubtype: 'TAX_PAYABLE',
        isActive: true,
      },
    });

    if (taxClassification === 'VAT_ZERO' || taxClassification === 'EXEMPT') {
      return {
        taxCode: taxClassification,
        rate: ZERO_VAT_RATE,
        isRecoverable: isPurchase,
        taxAccountId: taxAccount?.id,
      };
    }

    return {
      taxCode: 'VAT_STANDARD_20',
      rate: STANDARD_VAT_RATE,
      isRecoverable: isPurchase,
      taxAccountId: taxAccount?.id,
    };
  }
}
