import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { BusinessContextProfile, DEFAULT_BUSINESS_PROFILES } from './business-context.types';

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

    // Default fallback based on organization name heuristics
    const org = await this.db.organization.findUnique({
      where: { id: organizationId },
      select: { name: true, legalName: true },
    });

    const combined = `${org?.name ?? ''} ${org?.legalName ?? ''}`.toLowerCase();
    let detectedIndustry = 'GENERAL';

    if (
      combined.includes('petrol') ||
      combined.includes('fuel') ||
      combined.includes('oil') ||
      combined.includes('station')
    ) {
      detectedIndustry = 'PETROL_STATION';
    } else if (
      combined.includes('construction') ||
      combined.includes('build') ||
      combined.includes('contract')
    ) {
      detectedIndustry = 'CONSTRUCTION';
    } else if (
      combined.includes('consult') ||
      combined.includes('advisory') ||
      combined.includes('services')
    ) {
      detectedIndustry = 'CONSULTING';
    } else if (combined.includes('retail') || combined.includes('shop') || combined.includes('store')) {
      detectedIndustry = 'RETAIL';
    }

    const defaultProfile = DEFAULT_BUSINESS_PROFILES[detectedIndustry] ?? DEFAULT_BUSINESS_PROFILES.GENERAL;

    // Seed into DB for future persistence
    await this.db.organizationBusinessContext.upsert({
      where: { organizationId },
      create: {
        organizationId,
        industry: defaultProfile.industry,
        inventoryEnabled: defaultProfile.inventoryEnabled,
        inventoryCategories: defaultProfile.inventoryCategories,
        salesChannels: defaultProfile.salesChannels,
        accountingMethod: defaultProfile.accountingMethod,
      },
      update: {},
    });

    return defaultProfile;
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
        industry: updated.industry,
        inventoryEnabled: updated.inventoryEnabled,
        inventoryCategories: updated.inventoryCategories,
        salesChannels: updated.salesChannels,
        accountingMethod: updated.accountingMethod,
      },
      update: {
        industry: updated.industry,
        inventoryEnabled: updated.inventoryEnabled,
        inventoryCategories: updated.inventoryCategories,
        salesChannels: updated.salesChannels,
        accountingMethod: updated.accountingMethod,
      },
    });

    return updated;
  }
}
