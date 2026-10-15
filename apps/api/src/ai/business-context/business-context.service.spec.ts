import { BusinessContextService } from './business-context.service';

describe('BusinessContextService (Stage 4)', () => {
  it('does not infer an industry from the organisation name, and does not persist a guess', async () => {
    const prisma: any = {
      organizationBusinessContext: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn() },
      organization: { findUnique: jest.fn().mockResolvedValue({ name: 'Blynt Petrol Station', legalName: null }) },
    };
    const profile = await new BusinessContextService(prisma).getProfile('org-1');
    expect(profile.industry).toBeNull();
    expect(profile.inventoryEnabled).toBe(false);
    expect(prisma.organizationBusinessContext.upsert).not.toHaveBeenCalled();
  });
});
