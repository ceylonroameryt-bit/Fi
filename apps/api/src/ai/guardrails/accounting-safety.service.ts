import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { MoneyService } from '../../accounting-engine/money.service';
import { ProposedAccountingIntent } from '../document-intelligence/accounting-classification.service';

@Injectable()
export class AccountingSafetyService {
  constructor(
    private readonly db: PrismaService,
    private readonly money: MoneyService,
  ) {}

  async validateAccountingSafety(
    organizationId: string,
    intent: ProposedAccountingIntent,
    contactId?: string | null,
  ): Promise<void> {
    // 1. Strict mathematical balance assertion: sum(debit) === sum(credit)
    let sumDebit = this.money.ZERO;
    let sumCredit = this.money.ZERO;

    for (const line of intent.lines) {
      const debit = this.money.toDecimal(line.debit);
      const credit = this.money.toDecimal(line.credit);

      if (debit.isNegative() || credit.isNegative()) {
        throw new BadRequestException(
          'Negative debit or credit amounts are strictly prohibited in Blynt journals.',
        );
      }

      sumDebit = this.money.add(sumDebit, debit);
      sumCredit = this.money.add(sumCredit, credit);
    }

    if (!sumDebit.equals(sumCredit) || sumDebit.isZero()) {
      throw new BadRequestException(
        `AI proposed journal violates double-entry invariant: Debits (${sumDebit.toFixed(2)}) must equal Credits (${sumCredit.toFixed(2)}) and cannot be zero.`,
      );
    }

    // 2. Tenant isolation verification for every referenced account
    const accountIds = Array.from(new Set(intent.lines.map((l) => l.accountId)));
    const accounts = await this.db.account.findMany({
      where: {
        organizationId,
        id: { in: accountIds },
      },
    });

    if (accounts.length !== accountIds.length) {
      throw new BadRequestException(
        'One or more referenced accounts do not belong to the active organisation.',
      );
    }

    for (const acc of accounts) {
      if (!acc.isActive) {
        throw new BadRequestException(`Account "${acc.name}" (${acc.code}) is inactive or archived.`);
      }
    }

    // 3. Contact verification and active status check
    if (contactId) {
      const contact = await this.db.contact.findFirst({
        where: {
          organizationId,
          id: contactId,
        },
      });

      if (!contact) {
        throw new BadRequestException('Referenced contact does not belong to the active organisation.');
      }

      if (contact.status === 'ARCHIVED') {
        throw new BadRequestException(
          'Referenced contact is archived. Postings to archived contacts are prohibited.',
        );
      }
    }
  }
}
