export interface BusinessContextProfile {
  industry: string;
  inventoryEnabled: boolean;
  inventoryCategories: string[];
  salesChannels: string[];
  accountingMethod: string;
}

export const DEFAULT_BUSINESS_PROFILES: Record<string, BusinessContextProfile> = {
  PETROL_STATION: {
    industry: 'PETROL_STATION',
    inventoryEnabled: true,
    inventoryCategories: ['PETROL', 'DIESEL', 'LUBRICANTS', 'SHOP_GOODS'],
    salesChannels: ['POS', 'B2B_INVOICE'],
    accountingMethod: 'INVENTORY_BASED',
  },
  CONSTRUCTION: {
    industry: 'CONSTRUCTION',
    inventoryEnabled: true,
    inventoryCategories: ['BUILDING_MATERIALS', 'TOOLS', 'SAFETY_GEAR'],
    salesChannels: ['B2B_INVOICE', 'CONTRACT_PROGRESS_BILLING'],
    accountingMethod: 'INVENTORY_BASED',
  },
  CONSULTING: {
    industry: 'CONSULTING',
    inventoryEnabled: false,
    inventoryCategories: [],
    salesChannels: ['B2B_INVOICE', 'RETAINER'],
    accountingMethod: 'SERVICE_BASED',
  },
  RETAIL: {
    industry: 'RETAIL',
    inventoryEnabled: true,
    inventoryCategories: ['APPAREL', 'MERCHANDISE', 'ACCESSORIES'],
    salesChannels: ['POS', 'ECOMMERCE', 'B2B_INVOICE'],
    accountingMethod: 'INVENTORY_BASED',
  },
  GENERAL: {
    industry: 'GENERAL',
    inventoryEnabled: false,
    inventoryCategories: [],
    salesChannels: ['B2B_INVOICE'],
    accountingMethod: 'STANDARD_ACCRUAL',
  },
};
