export interface BusinessContextProfile {
  /** null = not stated by a person; never guessed. */
  industry: string | null;
  inventoryEnabled: boolean;
  inventoryCategories: string[];
  salesChannels: string[];
  accountingMethod: string;
}

/** Used when an organisation has not described itself: no industry, no inventory assumptions. */
export const NEUTRAL_BUSINESS_PROFILE: BusinessContextProfile = {
  industry: null,
  inventoryEnabled: false,
  inventoryCategories: [],
  salesChannels: [],
  accountingMethod: 'STANDARD_ACCRUAL',
};
