import { AiDirection, ContactType } from '@prisma/client';
import { TransactionDirectionService } from './transaction-direction.service';
import type { EntityMatchResult } from './entity-resolution.service';
import {
  NAME_MATCH_VAT_MISMATCH,
  NO_PARTIES,
  ORG,
  ORG_ON_BOTH_SIDES,
  OWN_SALES_INVOICE,
  SHORT_NAME_ORG,
  SUBSTRING_NAME_INVOICE,
  SUPPLIER_BILL_BY_COMPANY_NUMBER,
} from '../__fixtures__/safety-fixtures';

const noMatch: EntityMatchResult = { contact: null, matchType: 'NONE', confidence: 0, reason: '' };
const contactMatch = (type: ContactType, matchType: EntityMatchResult['matchType']): EntityMatchResult => ({
  contact: { id: 'c-1', name: 'Known Co', type } as any,
  matchType,
  confidence: 0.99,
  reason: '',
});

describe('TransactionDirectionService (Stage 4 safety rules)', () => {
  const service = new TransactionDirectionService();

  it('BUG-01: our own sales invoice is a SALE, decided by our VAT number as issuer', () => {
    const r = service.resolveDirection(OWN_SALES_INVOICE, ORG, noMatch, noMatch);
    expect(r).toMatchObject({ direction: AiDirection.SALE, basis: 'ORG_VAT' });
  });

  it('BUG-02: a bill addressed to our company number is a PURCHASE (leading zeros normalised)', () => {
    const r = service.resolveDirection(SUPPLIER_BILL_BY_COMPANY_NUMBER, ORG, noMatch, noMatch);
    expect(r).toMatchObject({ direction: AiDirection.PURCHASE, basis: 'ORG_COMPANY_NUMBER' });
  });

  it('BUG-03: a short organisation name is never matched as a substring of another name', () => {
    const r = service.resolveDirection(SUBSTRING_NAME_INVOICE, SHORT_NAME_ORG, noMatch, noMatch);
    expect(r.direction).toBe(AiDirection.UNKNOWN);
  });

  it('BUG-04: no identifying data gives UNKNOWN, not a default PURCHASE', () => {
    const r = service.resolveDirection(NO_PARTIES, ORG, noMatch, noMatch);
    expect(r).toMatchObject({ direction: AiDirection.UNKNOWN, basis: 'NONE', confidence: 0 });
  });

  it('BUG-05: a matching name with a different VAT number is not us', () => {
    const r = service.resolveDirection(NAME_MATCH_VAT_MISMATCH, ORG, noMatch, noMatch);
    expect(r.direction).toBe(AiDirection.UNKNOWN);
  });

  it('BUG-06: the organisation on both sides is ambiguous, not a guess', () => {
    const r = service.resolveDirection(ORG_ON_BOTH_SIDES, ORG, noMatch, noMatch);
    expect(r).toMatchObject({ direction: AiDirection.UNKNOWN, basis: 'CONFLICT' });
  });

  it('matches company-suffix variants of our exact name (Ltd / Limited)', () => {
    const r = service.resolveDirection(
      { issuer: { name: 'Acme Fuels' }, recipient: { name: 'BLYNT PETROL STATION LIMITED' }, lines: [] },
      ORG,
      noMatch,
      noMatch,
    );
    expect(r).toMatchObject({ direction: AiDirection.PURCHASE, basis: 'ORG_NAME' });
  });

  it('falls back to a known supplier identified by VAT/company number as issuer', () => {
    const r = service.resolveDirection(
      { issuer: { name: 'Known Co', vatNumber: 'GB123123123' }, recipient: {}, lines: [] },
      ORG,
      contactMatch(ContactType.SUPPLIER, 'EXACT_VAT'),
      noMatch,
    );
    expect(r).toMatchObject({ direction: AiDirection.PURCHASE, basis: 'CONTACT_ROLE' });
  });

  it('does not use a fuzzy/name-only contact match to decide direction', () => {
    const r = service.resolveDirection(
      { issuer: { name: 'Known Co' }, recipient: {}, lines: [] },
      ORG,
      contactMatch(ContactType.SUPPLIER, 'FUZZY_NAME'),
      noMatch,
    );
    expect(r.direction).toBe(AiDirection.UNKNOWN);
  });

  it('does not decide from a contact that is both customer and supplier', () => {
    const r = service.resolveDirection(
      { issuer: { name: 'Known Co', vatNumber: 'GB123123123' }, recipient: {}, lines: [] },
      ORG,
      contactMatch(ContactType.BOTH, 'EXACT_VAT'),
      noMatch,
    );
    expect(r.direction).toBe(AiDirection.UNKNOWN);
  });
});
