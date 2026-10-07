import { Injectable } from '@nestjs/common';
import { AccountSubtype, AccountType } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { DomainException } from '../common/errors/domain.exception';

@Injectable()
export class ContactAccountValidationService {
  constructor(private readonly prisma: PrismaService) {}

  async validateReceivableAccount(organizationId: string, accountId: string): Promise<void> {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, organizationId },
    });

    if (!account) {
      throw new DomainException('ACCOUNT_NOT_FOUND', 'Receivable account does not belong to this organisation');
    }

    if (!account.isActive) {
      throw new DomainException('INVALID_RECEIVABLE_ACCOUNT', 'Receivable control account must be active');
    }

    if (account.accountType !== AccountType.ASSET || account.accountSubtype !== AccountSubtype.ACCOUNTS_RECEIVABLE) {
      throw new DomainException(
        'INVALID_RECEIVABLE_ACCOUNT',
        `Account ${account.code} (${account.name}) cannot be used as Accounts Receivable control account. Must be an ASSET with ACCOUNTS_RECEIVABLE subtype`,
      );
    }
  }

  async validatePayableAccount(organizationId: string, accountId: string): Promise<void> {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, organizationId },
    });

    if (!account) {
      throw new DomainException('ACCOUNT_NOT_FOUND', 'Payable account does not belong to this organisation');
    }

    if (!account.isActive) {
      throw new DomainException('INVALID_PAYABLE_ACCOUNT', 'Payable control account must be active');
    }

    if (account.accountType !== AccountType.LIABILITY || account.accountSubtype !== AccountSubtype.ACCOUNTS_PAYABLE) {
      throw new DomainException(
        'INVALID_PAYABLE_ACCOUNT',
        `Account ${account.code} (${account.name}) cannot be used as Accounts Payable control account. Must be a LIABILITY with ACCOUNTS_PAYABLE subtype`,
      );
    }
  }
}
