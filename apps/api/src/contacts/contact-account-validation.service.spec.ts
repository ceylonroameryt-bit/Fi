import { Test, TestingModule } from '@nestjs/testing';
import { AccountSubtype, AccountType } from '@prisma/client';
import { ContactAccountValidationService } from './contact-account-validation.service';
import { PrismaService } from '../database/prisma.service';
import { DomainException } from '../common/errors/domain.exception';

describe('ContactAccountValidationService', () => {
  let service: ContactAccountValidationService;
  let prisma: {
    account: {
      findFirst: jest.Mock;
    };
  };

  const orgId = 'org-1111-2222';
  const recAccountId = 'acc-ar-1100';
  const payAccountId = 'acc-ap-2000';

  beforeEach(async () => {
    prisma = {
      account: {
        findFirst: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContactAccountValidationService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ContactAccountValidationService>(ContactAccountValidationService);
  });

  describe('validateReceivableAccount', () => {
    it('accepts valid active ASSET with ACCOUNTS_RECEIVABLE subtype', async () => {
      prisma.account.findFirst.mockResolvedValue({
        id: recAccountId,
        organizationId: orgId,
        code: '1100',
        name: 'Accounts Receivable',
        accountType: AccountType.ASSET,
        accountSubtype: AccountSubtype.ACCOUNTS_RECEIVABLE,
        isActive: true,
      });

      await expect(service.validateReceivableAccount(orgId, recAccountId)).resolves.toBeUndefined();
    });

    it('rejects if account not found in current organisation', async () => {
      prisma.account.findFirst.mockResolvedValue(null);

      await expect(service.validateReceivableAccount(orgId, recAccountId)).rejects.toThrow(
        new DomainException('ACCOUNT_NOT_FOUND', 'Receivable account does not belong to this organisation'),
      );
    });

    it('rejects inactive receivable account', async () => {
      prisma.account.findFirst.mockResolvedValue({
        id: recAccountId,
        organizationId: orgId,
        code: '1100',
        name: 'Accounts Receivable',
        accountType: AccountType.ASSET,
        accountSubtype: AccountSubtype.ACCOUNTS_RECEIVABLE,
        isActive: false,
      });

      await expect(service.validateReceivableAccount(orgId, recAccountId)).rejects.toThrow(
        new DomainException('INVALID_RECEIVABLE_ACCOUNT', 'Receivable control account must be active'),
      );
    });

    it('rejects Revenue account as AR control account', async () => {
      prisma.account.findFirst.mockResolvedValue({
        id: recAccountId,
        organizationId: orgId,
        code: '4000',
        name: 'Sales Revenue',
        accountType: AccountType.REVENUE,
        accountSubtype: AccountSubtype.SALES,
        isActive: true,
      });

      await expect(service.validateReceivableAccount(orgId, recAccountId)).rejects.toThrow(
        DomainException,
      );
    });
  });

  describe('validatePayableAccount', () => {
    it('accepts valid active LIABILITY with ACCOUNTS_PAYABLE subtype', async () => {
      prisma.account.findFirst.mockResolvedValue({
        id: payAccountId,
        organizationId: orgId,
        code: '2000',
        name: 'Accounts Payable',
        accountType: AccountType.LIABILITY,
        accountSubtype: AccountSubtype.ACCOUNTS_PAYABLE,
        isActive: true,
      });

      await expect(service.validatePayableAccount(orgId, payAccountId)).resolves.toBeUndefined();
    });

    it('rejects if account not found in organisation', async () => {
      prisma.account.findFirst.mockResolvedValue(null);

      await expect(service.validatePayableAccount(orgId, payAccountId)).rejects.toThrow(
        new DomainException('ACCOUNT_NOT_FOUND', 'Payable account does not belong to this organisation'),
      );
    });

    it('rejects inactive payable account', async () => {
      prisma.account.findFirst.mockResolvedValue({
        id: payAccountId,
        organizationId: orgId,
        code: '2000',
        name: 'Accounts Payable',
        accountType: AccountType.LIABILITY,
        accountSubtype: AccountSubtype.ACCOUNTS_PAYABLE,
        isActive: false,
      });

      await expect(service.validatePayableAccount(orgId, payAccountId)).rejects.toThrow(
        new DomainException('INVALID_PAYABLE_ACCOUNT', 'Payable control account must be active'),
      );
    });

    it('rejects Expense account as AP control account', async () => {
      prisma.account.findFirst.mockResolvedValue({
        id: payAccountId,
        organizationId: orgId,
        code: '5000',
        name: 'Cost of Sales',
        accountType: AccountType.EXPENSE,
        accountSubtype: AccountSubtype.COST_OF_SALES,
        isActive: true,
      });

      await expect(service.validatePayableAccount(orgId, payAccountId)).rejects.toThrow(
        DomainException,
      );
    });
  });
});
