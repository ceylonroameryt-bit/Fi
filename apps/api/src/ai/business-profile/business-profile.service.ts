import { Injectable, Logger } from '@nestjs/common';
import { JournalSourceType, JournalStatus, Prisma, VatScheme } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { MoneyService } from '../../accounting-engine/money.service';
import { toIsoDate } from '../../common/utils/dates';

export interface UsualContact {
  contactId: string;
  name: string;
  transactionCount: number;
  totalAmount: string;
  lastDate: string;
}

export interface CodingHabit {
  contactId: string;
  role: 'SUPPLIER' | 'CUSTOMER';
  accountId: string;
  accountCode: string;
  taxCode: string;
  count: number;
  /** Share of this contact's coded lines using this account + tax code (0–1, 2dp). */
  share: string;
}

export interface BusinessProfile {
  industry: string | null;
  vatScheme: VatScheme | null;
  usualSuppliers: UsualContact[];
  usualCustomers: UsualContact[];
  codingHabits: CodingHabit[];
  profileRefreshedAt: Date | null;
}

const LOOKBACK_DAYS = 365;
const MAX_JOURNALS = 5000;
const TOP_CONTACTS = 20;
const HABITS_PER_CONTACT = 3;

/**
 * Organisation profile used as AI context. Person-entered fields (industry, VAT scheme) are
 * never inferred; the rest is derived purely from posted ledger history by refresh().
 */
@Injectable()
export class BusinessProfileService {
  private readonly logger = new Logger(BusinessProfileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly money: MoneyService,
  ) {}

  async get(organizationId: string): Promise<BusinessProfile> {
    const row = await this.prisma.organizationBusinessContext.findUnique({ where: { organizationId } });
    // The VAT scheme is the organisation's dated setting (Settings → Taxes); null until someone sets it.
    const scheme = await this.prisma.organizationVatScheme.findFirst({ where: { organizationId, startDate: { lte: new Date() } }, orderBy: { startDate: 'desc' } });
    return {
      industry: row?.industry ?? null,
      vatScheme: scheme?.scheme ?? null,
      usualSuppliers: (row?.usualSuppliers as unknown as UsualContact[]) ?? [],
      usualCustomers: (row?.usualCustomers as unknown as UsualContact[]) ?? [],
      codingHabits: (row?.codingHabits as unknown as CodingHabit[]) ?? [],
      profileRefreshedAt: row?.profileRefreshedAt ?? null,
    };
  }

  async update(organizationId: string, changes: { industry?: string }): Promise<BusinessProfile> {
    const data = changes.industry !== undefined ? { industry: changes.industry } : {};
    await this.prisma.organizationBusinessContext.upsert({
      where: { organizationId },
      create: { organizationId, ...data },
      update: data,
    });
    return this.get(organizationId);
  }

  /** Recomputes usual suppliers/customers and coding habits from the last 12 months of posted documents. */
  async refresh(organizationId: string, now = new Date()): Promise<BusinessProfile> {
    const since = new Date(now.getTime() - LOOKBACK_DAYS * 86_400_000);
    const journals = await this.prisma.journalEntry.findMany({
      where: {
        organizationId,
        status: JournalStatus.POSTED,
        sourceType: { in: [JournalSourceType.INVOICE, JournalSourceType.BILL] },
        postingDate: { gte: since },
      },
      select: {
        sourceType: true,
        postingDate: true,
        lines: {
          select: {
            contactId: true,
            debit: true,
            credit: true,
            accountId: true,
            taxCodeId: true,
            account: { select: { code: true, name: true } },
            taxCode: { select: { code: true } },
          },
        },
      },
      orderBy: { postingDate: 'desc' },
      take: MAX_JOURNALS,
    });

    type Totals = { count: number; total: Prisma.Decimal; last: Date };
    const totals = { SUPPLIER: new Map<string, Totals>(), CUSTOMER: new Map<string, Totals>() };
    const habits = new Map<string, Omit<CodingHabit, 'share'>>();
    const codedLinesPerContact = new Map<string, number>();

    for (const journal of journals) {
      const role = journal.sourceType === JournalSourceType.BILL ? 'SUPPLIER' : 'CUSTOMER';
      const controlLine = journal.lines.find((l) => l.contactId);
      if (!controlLine?.contactId) continue;
      const contactId = controlLine.contactId;

      const t = totals[role].get(contactId) ?? { count: 0, total: this.money.ZERO, last: journal.postingDate };
      t.count += 1;
      t.total = t.total.plus(controlLine.debit).plus(controlLine.credit);
      if (journal.postingDate > t.last) t.last = journal.postingDate;
      totals[role].set(contactId, t);

      for (const line of journal.lines) {
        if (!line.taxCodeId || !line.taxCode) continue;
        const key = `${contactId}|${line.accountId}|${line.taxCodeId}`;
        const h = habits.get(key) ?? {
          contactId,
          role,
          accountId: line.accountId,
          accountCode: line.account.code,
          taxCode: line.taxCode.code,
          count: 0,
        };
        h.count += 1;
        habits.set(key, h);
        codedLinesPerContact.set(contactId, (codedLinesPerContact.get(contactId) ?? 0) + 1);
      }
    }

    const contactIds = [...totals.SUPPLIER.keys(), ...totals.CUSTOMER.keys()];
    const contacts = await this.prisma.contact.findMany({
      where: { organizationId, id: { in: contactIds } },
      select: { id: true, name: true },
    });
    const names = new Map(contacts.map((c) => [c.id, c.name]));

    const rank = (map: Map<string, Totals>): UsualContact[] =>
      [...map.entries()]
        .sort(([, a], [, b]) => b.total.comparedTo(a.total) || b.count - a.count)
        .slice(0, TOP_CONTACTS)
        .map(([contactId, t]) => ({
          contactId,
          name: names.get(contactId) ?? '',
          transactionCount: t.count,
          totalAmount: this.money.round(t.total, 2).toFixed(2),
          lastDate: toIsoDate(t.last),
        }));

    const byContact = new Map<string, Array<Omit<CodingHabit, 'share'>>>();
    for (const h of habits.values()) byContact.set(h.contactId, [...(byContact.get(h.contactId) ?? []), h]);
    const codingHabits: CodingHabit[] = [];
    for (const [contactId, list] of byContact) {
      const denominator = codedLinesPerContact.get(contactId)!;
      list
        .sort((a, b) => b.count - a.count || a.accountCode.localeCompare(b.accountCode))
        .slice(0, HABITS_PER_CONTACT)
        .forEach((h) =>
          codingHabits.push({ ...h, share: this.money.round(new Prisma.Decimal(h.count).div(denominator), 2).toFixed(2) }),
        );
    }

    const derived = {
      usualSuppliers: rank(totals.SUPPLIER) as unknown as Prisma.InputJsonValue,
      usualCustomers: rank(totals.CUSTOMER) as unknown as Prisma.InputJsonValue,
      codingHabits: codingHabits as unknown as Prisma.InputJsonValue,
      profileRefreshedAt: now,
    };
    await this.prisma.organizationBusinessContext.upsert({
      where: { organizationId },
      create: { organizationId, ...derived },
      update: derived,
    });

    const current = await this.get(organizationId);
    return {
      ...current,
      usualSuppliers: derived.usualSuppliers as unknown as UsualContact[],
      usualCustomers: derived.usualCustomers as unknown as UsualContact[],
      codingHabits,
      profileRefreshedAt: now,
    };
  }

  /** Background job body: refresh every organisation that has AI switched on. */
  async refreshAll(now = new Date()): Promise<{ refreshed: number; failed: number }> {
    const orgs = await this.prisma.organization.findMany({ where: { aiEnabled: true }, select: { id: true } });
    let failed = 0;
    for (const org of orgs) {
      try {
        await this.refresh(org.id, now);
      } catch (err) {
        failed += 1;
        this.logger.error(`Business profile refresh failed for ${org.id}: ${(err as Error).message}`);
      }
    }
    return { refreshed: orgs.length - failed, failed };
  }
}
