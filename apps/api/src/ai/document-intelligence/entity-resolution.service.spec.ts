import { EntityResolutionService, FUZZY_NAME_THRESHOLD } from './entity-resolution.service';

const contact = (over: Record<string, unknown>) => ({
  id: 'c',
  name: 'Name',
  companyName: null,
  type: 'SUPPLIER',
  status: 'ACTIVE',
  vatNumber: null,
  taxNumber: null,
  companyNumber: null,
  ...over,
});

describe('EntityResolutionService (Stage 9: VAT -> company number -> name)', () => {
  let prisma: any;
  let service: EntityResolutionService;
  const resolve = (entity: Record<string, string>, role: 'SUPPLIER' | 'CUSTOMER' = 'SUPPLIER') =>
    service.resolveEntity('org-1', entity, role);

  beforeEach(() => {
    prisma = {
      contact: { findMany: jest.fn().mockResolvedValue([]) },
      contactPerson: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    service = new EntityResolutionService(prisma);
  });

  it('only considers active contacts of this organisation', async () => {
    await resolve({ name: 'x' });
    expect(prisma.contact.findMany).toHaveBeenCalledWith({ where: { organizationId: 'org-1', status: 'ACTIVE' } });
  });

  it('matches by VAT number first, ignoring spacing and GB prefix, on either VAT field', async () => {
    prisma.contact.findMany.mockResolvedValue([
      contact({ id: 'by-name', name: 'ABC Fuel Ltd' }),
      contact({ id: 'by-vat', name: 'Totally Different Name', taxNumber: '999 9999 73' }),
    ]);
    const r = await resolve({ name: 'ABC Fuel Ltd', vatNumber: 'GB999999973' });
    expect(r).toMatchObject({ matchType: 'EXACT_VAT', contact: { id: 'by-vat' } });
  });

  it('then by company number, ignoring leading zeros', async () => {
    prisma.contact.findMany.mockResolvedValue([contact({ id: 'cn', companyNumber: '01234567' })]);
    expect(await resolve({ name: 'whatever', companyNumber: '1234567' })).toMatchObject({ matchType: 'EXACT_COMPANY_NO', contact: { id: 'cn' } });
  });

  it('then by exact normalised name (Ltd = Limited), preferring the expected role', async () => {
    prisma.contact.findMany.mockResolvedValue([
      contact({ id: 'cust', name: 'ABC Fuel Limited', type: 'CUSTOMER' }),
      contact({ id: 'sup', name: 'ABC Fuel Limited', type: 'SUPPLIER' }),
    ]);
    expect(await resolve({ name: 'abc fuel ltd' })).toMatchObject({ matchType: 'EXACT_NAME', contact: { id: 'sup' } });
  });

  it(`then by fuzzy name only at or above ${FUZZY_NAME_THRESHOLD}`, async () => {
    prisma.contact.findMany.mockResolvedValue([contact({ id: 'nw', name: 'Northwind Trading Company Ltd' })]);
    expect(await resolve({ name: 'Northwind Trading Co' })).toMatchObject({ matchType: 'EXACT_NAME' });
    prisma.contact.findMany.mockResolvedValue([contact({ id: 'nw', name: 'Northwind Traders Ltd' })]);
    const near = await resolve({ name: 'Northwind Trader Ltd' });
    expect(near.contact).toBeNull();
    expect(near.matchType).toBe('NONE');
    expect(near.candidates).toEqual([{ id: 'nw', name: 'Northwind Traders Ltd', score: expect.any(Number) }]);
  });

  it('accepts a single fuzzy match above the threshold', async () => {
    prisma.contact.findMany.mockResolvedValue([contact({ id: 'long', name: 'Greater Manchester Commercial Cleaning Services Ltd' })]);
    const r = await resolve({ name: 'Greater Manchester Commercial Cleaning Service Ltd' });
    expect(r).toMatchObject({ matchType: 'FUZZY_NAME', contact: { id: 'long' } });
    expect(r.confidence).toBeGreaterThanOrEqual(FUZZY_NAME_THRESHOLD);
  });

  it('never matches by name when both sides have different VAT numbers', async () => {
    prisma.contact.findMany.mockResolvedValue([contact({ id: 'other', name: 'ABC Fuel Ltd', vatNumber: 'GB999999918' })]);
    const r = await resolve({ name: 'ABC Fuel Ltd', vatNumber: 'GB999999973' });
    expect(r.contact).toBeNull();
  });

  it('reports ambiguity instead of picking when two contacts share an identifier', async () => {
    prisma.contact.findMany.mockResolvedValue([
      contact({ id: 'a', name: 'A', vatNumber: 'GB999999973' }),
      contact({ id: 'b', name: 'B', vatNumber: 'GB 999999973' }),
    ]);
    const r = await resolve({ vatNumber: 'GB999999973' });
    expect(r).toMatchObject({ matchType: 'AMBIGUOUS', contact: null });
    expect(r.candidates!.map((c) => c.id).sort()).toEqual(['a', 'b']);
  });

  it('returns NONE with no identifiers', async () => {
    expect(await service.resolveEntity('org-1', {}, 'SUPPLIER')).toMatchObject({ matchType: 'NONE', contact: null });
  });
});
