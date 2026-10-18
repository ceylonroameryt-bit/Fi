import { Injectable } from '@nestjs/common';
import { Contact, ContactType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { RawExtractedEntity } from '../providers/llm-provider.interface';
import { normaliseCompanyName, normaliseCompanyNumber, normaliseVatNumber } from '../identity/party-identity';
import { nameSimilarity } from '../identity/name-similarity';

/** Fuzzy name matches below this similarity are only offered to the reviewer as candidates. */
export const FUZZY_NAME_THRESHOLD = 0.9;
/** Names at least this similar are listed as candidates when nothing matches. */
const CANDIDATE_THRESHOLD = 0.6;

export interface MatchCandidate {
  id: string;
  name: string;
  score: number;
}

export interface EntityMatchResult {
  contact: Contact | null;
  matchType: 'EXACT_VAT' | 'EXACT_COMPANY_NO' | 'EXACT_NAME' | 'FUZZY_NAME' | 'EMAIL' | 'AMBIGUOUS' | 'NONE';
  confidence: number;
  reason: string;
  /** Possible contacts for the reviewer (ambiguous or near misses). Never auto-selected. */
  candidates?: MatchCandidate[];
}

const NONE: Omit<EntityMatchResult, 'reason'> = { contact: null, matchType: 'NONE', confidence: 0 };

/**
 * Finds the existing contact for a document party: VAT number, then company number, then exact
 * normalised name, then fuzzy name above FUZZY_NAME_THRESHOLD, then a contact person's email.
 * Ties are reported as AMBIGUOUS; nothing is ever created here.
 */
@Injectable()
export class EntityResolutionService {
  constructor(private readonly db: PrismaService) {}

  async resolveEntity(
    organizationId: string,
    entity?: RawExtractedEntity,
    expectedRole?: 'SUPPLIER' | 'CUSTOMER',
  ): Promise<EntityMatchResult> {
    if (!entity || (!entity.name && !entity.vatNumber && !entity.companyNumber && !entity.email)) {
      return { ...NONE, reason: 'No identifying details for this party on the document.' };
    }
    const contacts = await this.db.contact.findMany({ where: { organizationId, status: 'ACTIVE' } });

    // 1. VAT number (either VAT field on the contact)
    const vat = normaliseVatNumber(entity.vatNumber);
    if (vat) {
      const hits = contacts.filter((c) => normaliseVatNumber(c.vatNumber) === vat || normaliseVatNumber(c.taxNumber) === vat);
      const r = this.decide(hits, 'EXACT_VAT', 0.99, `VAT number ${entity.vatNumber}`);
      if (r) return r;
    }

    // 2. Company number
    const companyNumber = normaliseCompanyNumber(entity.companyNumber);
    if (companyNumber) {
      const hits = contacts.filter((c) => normaliseCompanyNumber(c.companyNumber) === companyNumber);
      const r = this.decide(hits, 'EXACT_COMPANY_NO', 0.98, `company number ${entity.companyNumber}`);
      if (r) return r;
    }

    // Name matching only among contacts whose registered identifiers do not contradict the document.
    const eligible = contacts.filter((c) => {
      const theirVat = normaliseVatNumber(c.vatNumber) ?? normaliseVatNumber(c.taxNumber);
      const theirCn = normaliseCompanyNumber(c.companyNumber);
      return !(vat && theirVat && vat !== theirVat) && !(companyNumber && theirCn && companyNumber !== theirCn);
    });
    const preferred = this.preferRole(eligible, expectedRole);

    // 3. Exact normalised name
    const name = entity.name?.trim();
    if (name) {
      const target = normaliseCompanyName(name);
      if (target) {
        const hits = preferred.filter((c) => [c.name, c.companyName].some((n) => n && normaliseCompanyName(n) === target));
        const r = this.decide(hits, 'EXACT_NAME', 0.95, `name "${name}"`);
        if (r) return r;
      }
    }

    // 4. Fuzzy name above the threshold (a clear single best only)
    const scored = name
      ? preferred
          .map((c) => ({ contact: c, score: Math.max(...[c.name, c.companyName].filter((n): n is string => !!n).map((n) => nameSimilarity(name, n))) }))
          .sort((a, b) => b.score - a.score)
      : [];
    const above = scored.filter((s) => s.score >= FUZZY_NAME_THRESHOLD);
    if (above.length === 1) {
      const { contact, score } = above[0];
      return { contact, matchType: 'FUZZY_NAME', confidence: Number(score.toFixed(4)), reason: `Name "${name}" is ${(score * 100).toFixed(0)}% similar to "${contact.name}".` };
    }
    if (above.length > 1) {
      return { ...NONE, matchType: 'AMBIGUOUS', reason: `Several contacts have names similar to "${name}".`, candidates: above.map(toCandidate) };
    }

    // 5. Contact person email
    if (entity.email) {
      const person = await this.db.contactPerson.findFirst({
        where: { organizationId, email: { equals: entity.email, mode: 'insensitive' } },
        include: { contact: true },
      });
      if (person?.contact?.status === 'ACTIVE') {
        return { contact: person.contact, matchType: 'EMAIL', confidence: 0.92, reason: `Contact person email ${entity.email}.` };
      }
    }

    const near = scored.filter((s) => s.score >= CANDIDATE_THRESHOLD).slice(0, 3).map(toCandidate);
    return { ...NONE, reason: 'No existing contact matches this party.', ...(near.length ? { candidates: near } : {}) };
  }

  /** One hit -> match; several -> AMBIGUOUS (no guess); none -> undefined (try next rule). */
  private decide(hits: Contact[], matchType: EntityMatchResult['matchType'], confidence: number, what: string): EntityMatchResult | undefined {
    if (hits.length === 1) return { contact: hits[0], matchType, confidence, reason: `Matched "${hits[0].name}" by ${what}.` };
    if (hits.length > 1) {
      return {
        ...NONE,
        matchType: 'AMBIGUOUS',
        reason: `${hits.length} contacts share ${what}; choose one.`,
        candidates: hits.map((c) => ({ id: c.id, name: c.name, score: 1 })),
      };
    }
    return undefined;
  }

  /** Contacts of the expected role (or BOTH) when any exist, otherwise all. */
  private preferRole(contacts: Contact[], role?: 'SUPPLIER' | 'CUSTOMER'): Contact[] {
    if (!role) return contacts;
    const wanted = role === 'SUPPLIER' ? ContactType.SUPPLIER : ContactType.CUSTOMER;
    const ofRole = contacts.filter((c) => c.type === wanted || c.type === ContactType.BOTH);
    return ofRole.length > 0 ? ofRole : contacts;
  }
}

function toCandidate(s: { contact: Contact; score: number }): MatchCandidate {
  return { id: s.contact.id, name: s.contact.name, score: Number(s.score.toFixed(4)) };
}
