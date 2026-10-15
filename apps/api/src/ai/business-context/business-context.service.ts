import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { BusinessContextProfile, NEUTRAL_BUSINESS_PROFILE } from './business-context.types';

@Injectable()
export class BusinessContextService {
  constructor(private readonly db: PrismaService) {}

  async getProfile(organizationId: string): Promise<BusinessContextProfile> {
    const record = await this.db.organizationBusinessContext.findUnique({
      where: { organizationId },
    });

    if (record) {
      return {
        industry: record.industry,
        inventoryEnabled: record.inventoryEnabled,
        inventoryCategories: Array.isArray(record.inventoryCategories)
          ? (record.inventoryCategories as string[])
          : [],
        salesChannels: Array.isArray(record.salesChannels) ? (record.salesChannels as string[]) : [],
        accountingMethod: record.accountingMethod,
      };
    }

    // Not described yet: neutral profile. Industry is never inferred from the organisation name.
    return { ...NEUTRAL_BUSINESS_PROFILE };
  }

  async updateProfile(
    organizationId: string,
    update: Partial<BusinessContextProfile>,
  ): Promise<BusinessContextProfile> {
    const existing = await this.getProfile(organizationId);
    const updated = {
      ...existing,
      ...update,
    };

    await this.db.organizationBusinessContext.upsert({
      where: { organizationId },
      create: {
        organizationId,
        industry: updated.industry ?? undefined,
        inventoryEnabled: updated.inventoryEnabled,
        inventoryCategories: updated.inventoryCategories,
        salesChannels: updated.salesChannels,
        accountingMethod: updated.accountingMethod,
      },
      update: {
        industry: updated.industry ?? undefined,
        inventoryEnabled: updated.inventoryEnabled,
        inventoryCategories: updated.inventoryCategories,
        salesChannels: updated.salesChannels,
        accountingMethod: updated.accountingMethod,
      },
    });

    return updated;
  }
}
