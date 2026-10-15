/**
 * Exact, normalised comparison of a document party with the organisation's own identity.
 * Used to decide sales vs purchase. Deliberately has no fuzzy or substring matching.
 */

export interface PartyIdentifiers {
  name?: string | null;
  vatNumber?: string | null;
  companyNumber?: string | null;
}

export interface OrganisationIdentity {
  name: string;
  legalName?: string | null;
  taxNumber?: string | null;
  registrationNumber?: string | null;
}

export type OrganisationMatch = 'VAT' | 'COMPANY_NUMBER' | 'NAME';

/** UK VAT numbers: drop the GB prefix and separators; 9 or 12 digits remain. */
export function normaliseVatNumber(value: string | null | undefined): string | null {
  if (!value) return null;
  const clean = value.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^GB/, '');
  return clean.length > 0 ? clean : null;
}

/** Companies House numbers are 8 characters; purely numeric ones lose leading zeros in print. */
export function normaliseCompanyNumber(value: string | null | undefined): string | null {
  if (!value) return null;
  const clean = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!clean) return null;
  return /^\d+$/.test(clean) && clean.length < 8 ? clean.padStart(8, '0') : clean;
}

const LEGAL_SUFFIXES = /\b(limited|ltd|plc|llp|lp|inc|incorporated|corp|corporation|co|company)\b\.?/g;

/** Lower-case, drop a leading "the", legal-form suffixes and all punctuation/whitespace. */
export function normaliseCompanyName(value: string | null | undefined): string | null {
  if (!value) return null;
  const clean = value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/^\s*the\s+/, '')
    .replace(LEGAL_SUFFIXES, ' ')
    .replace(/[^a-z0-9]/g, '');
  return clean.length > 0 ? clean : null;
}

/**
 * Does this party identify as the organisation? A registered identifier on both sides decides
 * the answer outright, so a matching name with a different VAT/company number is NOT a match.
 */
export function matchesOrganisation(
  party: PartyIdentifiers | null | undefined,
  org: OrganisationIdentity,
): OrganisationMatch | null {
  if (!party) return null;

  const partyVat = normaliseVatNumber(party.vatNumber);
  const orgVat = normaliseVatNumber(org.taxNumber);
  if (partyVat && orgVat) return partyVat === orgVat ? 'VAT' : null;

  const partyCn = normaliseCompanyNumber(party.companyNumber);
  const orgCn = normaliseCompanyNumber(org.registrationNumber);
  if (partyCn && orgCn) return partyCn === orgCn ? 'COMPANY_NUMBER' : null;

  const partyName = normaliseCompanyName(party.name);
  if (!partyName) return null;
  const orgNames = [org.name, org.legalName].map(normaliseCompanyName).filter((n): n is string => !!n);
  return orgNames.includes(partyName) ? 'NAME' : null;
}
