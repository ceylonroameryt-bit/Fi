import { Injectable } from '@nestjs/common';
import { AiDirection, ContactType } from '@prisma/client';
import { RawExtractionResult } from '../providers/llm-provider.interface';
import type { EntityMatchResult } from './entity-resolution.service';
import { matchesOrganisation, OrganisationIdentity, OrganisationMatch } from '../identity/party-identity';

export type { OrganisationIdentity } from '../identity/party-identity';

export type DirectionBasis = 'ORG_VAT' | 'ORG_COMPANY_NUMBER' | 'ORG_NAME' | 'CONTACT_ROLE' | 'CONFLICT' | 'NONE';

export interface DirectionResolutionResult {
  direction: AiDirection;
  /** Ordering signal for the review queue only; never used to auto-approve. */
  confidence: number;
  basis: DirectionBasis;
  reasoning: string;
}

const BASIS_FOR: Record<OrganisationMatch, { basis: DirectionBasis; confidence: number; label: string }> = {
  VAT: { basis: 'ORG_VAT', confidence: 0.99, label: 'VAT number' },
  COMPANY_NUMBER: { basis: 'ORG_COMPANY_NUMBER', confidence: 0.98, label: 'company number' },
  NAME: { basis: 'ORG_NAME', confidence: 0.9, label: 'registered name' },
};

/** Contact matches strong enough to infer direction from the contact's role. */
const STRONG_CONTACT_MATCHES: ReadonlySet<EntityMatchResult['matchType']> = new Set(['EXACT_VAT', 'EXACT_COMPANY_NO']);

/**
 * Sales vs purchase is decided by comparing the document's parties with the organisation's own
 * VAT number, company number and name. If that is inconclusive the answer is UNKNOWN and a
 * person decides; there is no default direction.
 */
@Injectable()
export class TransactionDirectionService {
  resolveDirection(
    extracted: RawExtractionResult,
    org: OrganisationIdentity,
    issuerContact: EntityMatchResult,
    recipientContact: EntityMatchResult,
  ): DirectionResolutionResult {
    const asIssuer = matchesOrganisation(extracted.issuer, org);
    const asRecipient = matchesOrganisation(extracted.recipient, org);

    if (asIssuer && asRecipient) {
      return {
        direction: AiDirection.UNKNOWN,
        confidence: 0,
        basis: 'CONFLICT',
        reasoning: `The organisation matches both the issuer (${BASIS_FOR[asIssuer].label}) and the recipient (${BASIS_FOR[asRecipient].label}).`,
      };
    }
    if (asIssuer) {
      const b = BASIS_FOR[asIssuer];
      return { direction: AiDirection.SALE, confidence: b.confidence, basis: b.basis, reasoning: `Issuer matches the organisation's ${b.label}.` };
    }
    if (asRecipient) {
      const b = BASIS_FOR[asRecipient];
      return { direction: AiDirection.PURCHASE, confidence: b.confidence, basis: b.basis, reasoning: `Recipient matches the organisation's ${b.label}.` };
    }

    // Neither party is identifiably us: only a registered-identifier match to a single-role contact counts.
    if (STRONG_CONTACT_MATCHES.has(issuerContact.matchType) && issuerContact.contact?.type === ContactType.SUPPLIER) {
      return {
        direction: AiDirection.PURCHASE,
        confidence: 0.8,
        basis: 'CONTACT_ROLE',
        reasoning: `Issuer is existing supplier "${issuerContact.contact.name}" (${issuerContact.matchType}).`,
      };
    }
    if (STRONG_CONTACT_MATCHES.has(recipientContact.matchType) && recipientContact.contact?.type === ContactType.CUSTOMER) {
      return {
        direction: AiDirection.SALE,
        confidence: 0.8,
        basis: 'CONTACT_ROLE',
        reasoning: `Recipient is existing customer "${recipientContact.contact.name}" (${recipientContact.matchType}).`,
      };
    }

    return {
      direction: AiDirection.UNKNOWN,
      confidence: 0,
      basis: 'NONE',
      reasoning: 'Neither party could be matched to the organisation or a known contact; a reviewer must choose.',
    };
  }
}
