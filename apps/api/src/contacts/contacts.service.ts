import { Injectable } from '@nestjs/common';
import { ContactStatus, ContactType, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { DomainException } from '../common/errors/domain.exception';
import type { Actor } from '../common/types/request-context.types';
import { AuditService } from '../audit/audit.service';
import { AuditEvents } from '../audit/audit-events';
import { ContactAccountValidationService } from './contact-account-validation.service';
import { ContactSubledgerService } from './contact-subledger.service';
import type {
  ContactFilterQueryDto,
  CreateContactDto,
  CreateContactPersonDto,
  DuplicateCheckQueryDto,
  UpdateContactDto,
  UpdateContactPersonDto,
} from './dto/contact.dto';

@Injectable()
export class ContactsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly accountValidator: ContactAccountValidationService,
    private readonly subledger: ContactSubledgerService,
  ) {}

  /**
   * Server-side paginated contacts list with whitelisted sorting and comprehensive multi-field search.
   */
  async listContacts(organizationId: string, filter: ContactFilterQueryDto) {
    const page = filter.page && filter.page > 0 ? filter.page : 1;
    const pageSize = filter.pageSize && filter.pageSize > 0 ? Math.min(filter.pageSize, 100) : 50;

    const where: Prisma.ContactWhereInput = {
      organizationId,
      ...(filter.type ? { type: filter.type } : {}),
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.search
        ? {
            OR: [
              { name: { contains: filter.search, mode: 'insensitive' } },
              { companyName: { contains: filter.search, mode: 'insensitive' } },
              { email: { contains: filter.search, mode: 'insensitive' } },
              { phone: { contains: filter.search, mode: 'insensitive' } },
              { taxNumber: { contains: filter.search, mode: 'insensitive' } },
              { vatNumber: { contains: filter.search, mode: 'insensitive' } },
              { companyNumber: { contains: filter.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    // Whitelist sorting
    const sortBy = filter.sortBy ?? 'name';
    const sortDirection = filter.sortDirection ?? 'asc';
    const orderBy: Prisma.ContactOrderByWithRelationInput = {
      [sortBy]: sortDirection,
    };

    const [items, total] = await Promise.all([
      this.prisma.contact.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [orderBy, { id: 'asc' }],
        include: {
          _count: { select: { invoices: true, people: true } },
          people: {
            where: { isPrimary: true, isActive: true },
            take: 1,
          },
        },
      }),
      this.prisma.contact.count({ where }),
    ]);

    const totalPages = Math.ceil(total / pageSize) || 1;

    return {
      items: items.map((contact) => ({
        ...contact,
        primaryPerson: contact.people[0] ?? null,
      })),
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  /**
   * Detail view of single contact, including people, linked accounts, and subledger balances.
   */
  async getContact(organizationId: string, contactId: string) {
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, organizationId },
      include: {
        _count: { select: { invoices: true, people: true } },
        receivableAccount: { select: { id: true, code: true, name: true, accountType: true, accountSubtype: true } },
        payableAccount: { select: { id: true, code: true, name: true, accountType: true, accountSubtype: true } },
        people: {
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!contact) {
      throw new DomainException('CONTACT_NOT_FOUND', 'Contact not found in this organisation');
    }

    const [outstandingReceivableBalance, outstandingPayableBalance] = await Promise.all([
      this.subledger.getCustomerBalance(organizationId, contactId),
      this.subledger.getSupplierBalance(organizationId, contactId),
    ]);

    const primaryPerson = contact.people.find((p) => p.isPrimary && p.isActive) ?? null;

    return {
      ...contact,
      primaryPerson,
      outstandingReceivableBalance,
      outstandingPayableBalance,
    };
  }

  /**
   * Organisation-wide contact metrics and subledger aggregates.
   */
  async getSummary(organizationId: string) {
    const [counts, customersWithBalance, suppliersWithBalance] = await Promise.all([
      this.prisma.contact.groupBy({
        by: ['type', 'status'],
        where: { organizationId },
        _count: { _all: true },
      }),
      this.prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(DISTINCT jl.contact_id)::bigint AS count
        FROM journal_lines jl
        JOIN journal_entries je ON jl.organization_id = je.organization_id AND jl.journal_entry_id = je.id
        JOIN accounts a ON jl.organization_id = a.organization_id AND jl.account_id = a.id
        WHERE jl.organization_id = ${organizationId}::uuid
          AND jl.contact_id IS NOT NULL
          AND je.status IN ('POSTED', 'REVERSED')
          AND (a.account_subtype = 'ACCOUNTS_RECEIVABLE' OR a.code = '1100')
        GROUP BY jl.contact_id
        HAVING SUM(jl.debit - jl.credit) > 0.0001
      `,
      this.prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(DISTINCT jl.contact_id)::bigint AS count
        FROM journal_lines jl
        JOIN journal_entries je ON jl.organization_id = je.organization_id AND jl.journal_entry_id = je.id
        JOIN accounts a ON jl.organization_id = a.organization_id AND jl.account_id = a.id
        WHERE jl.organization_id = ${organizationId}::uuid
          AND jl.contact_id IS NOT NULL
          AND je.status IN ('POSTED', 'REVERSED')
          AND (a.account_subtype = 'ACCOUNTS_PAYABLE' OR a.code = '2000')
        GROUP BY jl.contact_id
        HAVING SUM(jl.credit - jl.debit) > 0.0001
      `,
    ]);

    let total = 0;
    let active = 0;
    let archived = 0;
    let customers = 0;
    let suppliers = 0;
    let both = 0;

    for (const group of counts) {
      const count = group._count._all;
      total += count;
      if (group.status === ContactStatus.ACTIVE) active += count;
      if (group.status === ContactStatus.ARCHIVED) archived += count;

      if (group.type === ContactType.CUSTOMER) customers += count;
      else if (group.type === ContactType.SUPPLIER) suppliers += count;
      else if (group.type === ContactType.BOTH) both += count;
    }

    return {
      total,
      active,
      archived,
      customers,
      suppliers,
      both,
      customersWithOutstandingBalance: customersWithBalance.length,
      suppliersWithOutstandingBalance: suppliersWithBalance.length,
    };
  }

  /**
   * Duplicate contact detection: evaluates email, VAT, company number, and name+postcode.
   * Returns warning matches without blocking creation.
   */
  async checkDuplicates(organizationId: string, query: DuplicateCheckQueryDto) {
    const matches: Array<{
      id: string;
      name: string;
      companyName: string | null;
      email: string | null;
      vatNumber: string | null;
      companyNumber: string | null;
      matchReason: 'MATCHING_EMAIL' | 'MATCHING_VAT' | 'MATCHING_COMPANY_NUMBER' | 'MATCHING_NAME_AND_POSTCODE';
      matchDetail: string;
    }> = [];

    const excludeId = query.excludeId;

    if (query.email?.trim()) {
      const email = query.email.trim();
      const existing = await this.prisma.contact.findMany({
        where: {
          organizationId,
          ...(excludeId ? { id: { not: excludeId } } : {}),
          email: { equals: email, mode: 'insensitive' },
        },
        select: { id: true, name: true, companyName: true, email: true, vatNumber: true, companyNumber: true },
      });
      for (const m of existing) {
        matches.push({
          ...m,
          matchReason: 'MATCHING_EMAIL',
          matchDetail: `Existing contact "${m.name}" has the same email address (${m.email})`,
        });
      }
    }

    if (query.vatNumber?.trim()) {
      const vat = query.vatNumber.trim().replace(/\s+/g, '');
      const existing = await this.prisma.contact.findMany({
        where: {
          organizationId,
          ...(excludeId ? { id: { not: excludeId } } : {}),
          vatNumber: { equals: vat, mode: 'insensitive' },
        },
        select: { id: true, name: true, companyName: true, email: true, vatNumber: true, companyNumber: true },
      });
      for (const m of existing) {
        if (!matches.some((e) => e.id === m.id)) {
          matches.push({
            ...m,
            matchReason: 'MATCHING_VAT',
            matchDetail: `Existing contact "${m.name}" has the same VAT number (${m.vatNumber})`,
          });
        }
      }
    }

    if (query.companyNumber?.trim()) {
      const compNum = query.companyNumber.trim().replace(/\s+/g, '');
      const existing = await this.prisma.contact.findMany({
        where: {
          organizationId,
          ...(excludeId ? { id: { not: excludeId } } : {}),
          companyNumber: { equals: compNum, mode: 'insensitive' },
        },
        select: { id: true, name: true, companyName: true, email: true, vatNumber: true, companyNumber: true },
      });
      for (const m of existing) {
        if (!matches.some((e) => e.id === m.id)) {
          matches.push({
            ...m,
            matchReason: 'MATCHING_COMPANY_NUMBER',
            matchDetail: `Existing contact "${m.name}" has the same company registration number (${m.companyNumber})`,
          });
        }
      }
    }

    if (query.name?.trim() && query.postcode?.trim()) {
      const name = query.name.trim();
      const postcode = query.postcode.trim().replace(/\s+/g, '').toUpperCase();
      const existing = await this.prisma.contact.findMany({
        where: {
          organizationId,
          ...(excludeId ? { id: { not: excludeId } } : {}),
          OR: [
            { name: { equals: name, mode: 'insensitive' } },
            { companyName: { equals: name, mode: 'insensitive' } },
          ],
        },
        select: { id: true, name: true, companyName: true, email: true, vatNumber: true, companyNumber: true, postcode: true },
      });
      for (const m of existing) {
        if (m.postcode && m.postcode.replace(/\s+/g, '').toUpperCase() === postcode) {
          if (!matches.some((e) => e.id === m.id)) {
            matches.push({
              id: m.id,
              name: m.name,
              companyName: m.companyName,
              email: m.email,
              vatNumber: m.vatNumber,
              companyNumber: m.companyNumber,
              matchReason: 'MATCHING_NAME_AND_POSTCODE',
              matchDetail: `Existing contact "${m.name}" has the same name and postcode (${m.postcode})`,
            });
          }
        }
      }
    }

    return {
      hasPotentialDuplicates: matches.length > 0,
      matches,
    };
  }

  async createContact(organizationId: string, dto: CreateContactDto, actor: Actor) {
    if (dto.receivableAccountId) {
      await this.accountValidator.validateReceivableAccount(organizationId, dto.receivableAccountId);
    }
    if (dto.payableAccountId) {
      await this.accountValidator.validatePayableAccount(organizationId, dto.payableAccountId);
    }

    return this.prisma.transaction(async (tx) => {
      const contact = await tx.contact.create({
        data: {
          organizationId,
          type: dto.type,
          name: dto.name,
          companyName: dto.companyName,
          companyNumber: dto.companyNumber,
          vatNumber: dto.vatNumber,
          email: dto.email,
          phone: dto.phone,
          website: dto.website,
          taxNumber: dto.taxNumber,
          currency: dto.currency,
          paymentTermsDays: dto.paymentTermsDays ?? 30,
          creditLimit: dto.creditLimit ? new Prisma.Decimal(dto.creditLimit.toString()) : null,
          addressLine1: dto.addressLine1,
          addressLine2: dto.addressLine2,
          city: dto.city,
          state: dto.state,
          postcode: dto.postcode,
          country: dto.country ?? 'GB',
          shippingAddressLine1: dto.shippingAddressLine1,
          shippingAddressLine2: dto.shippingAddressLine2,
          shippingCity: dto.shippingCity,
          shippingState: dto.shippingState,
          shippingPostcode: dto.shippingPostcode,
          shippingCountry: dto.shippingCountry,
          notes: dto.notes,
          receivableAccountId: dto.receivableAccountId,
          payableAccountId: dto.payableAccountId,
          createdById: actor.userId,
        },
      });

      await this.audit.record(tx, actor, {
        organizationId,
        eventType: AuditEvents.CONTACT_CREATED,
        entityType: 'CONTACT',
        entityId: contact.id,
        newValues: { name: contact.name, type: contact.type },
      });

      return contact;
    });
  }

  async updateContact(organizationId: string, contactId: string, dto: UpdateContactDto, actor: Actor) {
    const existing = await this.prisma.contact.findFirst({
      where: { id: contactId, organizationId },
    });
    if (!existing) {
      throw new DomainException('CONTACT_NOT_FOUND', 'Contact not found in this organisation');
    }

    if (dto.receivableAccountId) {
      await this.accountValidator.validateReceivableAccount(organizationId, dto.receivableAccountId);
    }
    if (dto.payableAccountId) {
      await this.accountValidator.validatePayableAccount(organizationId, dto.payableAccountId);
    }

    return this.prisma.transaction(async (tx) => {
      const updated = await tx.contact.update({
        where: { id: contactId },
        data: {
          ...(dto.type !== undefined ? { type: dto.type } : {}),
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.companyName !== undefined ? { companyName: dto.companyName } : {}),
          ...(dto.companyNumber !== undefined ? { companyNumber: dto.companyNumber } : {}),
          ...(dto.vatNumber !== undefined ? { vatNumber: dto.vatNumber } : {}),
          ...(dto.email !== undefined ? { email: dto.email } : {}),
          ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
          ...(dto.website !== undefined ? { website: dto.website } : {}),
          ...(dto.taxNumber !== undefined ? { taxNumber: dto.taxNumber } : {}),
          ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
          ...(dto.paymentTermsDays !== undefined ? { paymentTermsDays: dto.paymentTermsDays } : {}),
          ...(dto.creditLimit !== undefined
            ? { creditLimit: dto.creditLimit ? new Prisma.Decimal(dto.creditLimit.toString()) : null }
            : {}),
          ...(dto.addressLine1 !== undefined ? { addressLine1: dto.addressLine1 } : {}),
          ...(dto.addressLine2 !== undefined ? { addressLine2: dto.addressLine2 } : {}),
          ...(dto.city !== undefined ? { city: dto.city } : {}),
          ...(dto.state !== undefined ? { state: dto.state } : {}),
          ...(dto.postcode !== undefined ? { postcode: dto.postcode } : {}),
          ...(dto.country !== undefined ? { country: dto.country } : {}),
          ...(dto.shippingAddressLine1 !== undefined ? { shippingAddressLine1: dto.shippingAddressLine1 } : {}),
          ...(dto.shippingAddressLine2 !== undefined ? { shippingAddressLine2: dto.shippingAddressLine2 } : {}),
          ...(dto.shippingCity !== undefined ? { shippingCity: dto.shippingCity } : {}),
          ...(dto.shippingState !== undefined ? { shippingState: dto.shippingState } : {}),
          ...(dto.shippingPostcode !== undefined ? { shippingPostcode: dto.shippingPostcode } : {}),
          ...(dto.shippingCountry !== undefined ? { shippingCountry: dto.shippingCountry } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
          ...(dto.receivableAccountId !== undefined ? { receivableAccountId: dto.receivableAccountId } : {}),
          ...(dto.payableAccountId !== undefined ? { payableAccountId: dto.payableAccountId } : {}),
          updatedById: actor.userId,
        },
      });

      await this.audit.record(tx, actor, {
        organizationId,
        eventType: AuditEvents.CONTACT_UPDATED,
        entityType: 'CONTACT',
        entityId: contactId,
        oldValues: existing,
        newValues: updated,
      });

      return updated;
    });
  }

  async archiveContact(organizationId: string, contactId: string, actor: Actor) {
    const existing = await this.prisma.contact.findFirst({
      where: { id: contactId, organizationId },
    });
    if (!existing) {
      throw new DomainException('CONTACT_NOT_FOUND', 'Contact not found in this organisation');
    }
    if (existing.status === ContactStatus.ARCHIVED) {
      return existing;
    }

    return this.prisma.transaction(async (tx) => {
      const updated = await tx.contact.update({
        where: { id: contactId },
        data: {
          status: ContactStatus.ARCHIVED,
          updatedById: actor.userId,
        },
      });

      await this.audit.record(tx, actor, {
        organizationId,
        eventType: AuditEvents.CONTACT_ARCHIVED,
        entityType: 'CONTACT',
        entityId: contactId,
      });

      return updated;
    });
  }

  async restoreContact(organizationId: string, contactId: string, actor: Actor) {
    const existing = await this.prisma.contact.findFirst({
      where: { id: contactId, organizationId },
    });
    if (!existing) {
      throw new DomainException('CONTACT_NOT_FOUND', 'Contact not found in this organisation');
    }
    if (existing.status === ContactStatus.ACTIVE) {
      return existing;
    }

    return this.prisma.transaction(async (tx) => {
      const updated = await tx.contact.update({
        where: { id: contactId },
        data: {
          status: ContactStatus.ACTIVE,
          updatedById: actor.userId,
        },
      });

      await this.audit.record(tx, actor, {
        organizationId,
        eventType: AuditEvents.CONTACT_RESTORED,
        entityType: 'CONTACT',
        entityId: contactId,
      });

      return updated;
    });
  }

  // ────────────────────────── Contact People ──────────────────────────

  async addContactPerson(
    organizationId: string,
    contactId: string,
    dto: CreateContactPersonDto,
    actor: Actor,
  ) {
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, organizationId },
    });
    if (!contact) {
      throw new DomainException('CONTACT_NOT_FOUND', 'Contact not found in this organisation');
    }

    return this.prisma.transaction(async (tx) => {
      if (dto.isPrimary) {
        // Demote existing primary persons for this contact
        await tx.contactPerson.updateMany({
          where: { organizationId, contactId, isPrimary: true },
          data: { isPrimary: false },
        });
      }

      const person = await tx.contactPerson.create({
        data: {
          organizationId,
          contactId,
          firstName: dto.firstName,
          lastName: dto.lastName,
          jobTitle: dto.jobTitle,
          email: dto.email,
          phone: dto.phone,
          mobile: dto.mobile,
          isPrimary: dto.isPrimary ?? false,
          isBillingContact: dto.isBillingContact ?? false,
          isActive: true,
        },
      });

      await this.audit.record(tx, actor, {
        organizationId,
        eventType: AuditEvents.CONTACT_PERSON_CREATED,
        entityType: 'CONTACT_PERSON',
        entityId: person.id,
        newValues: {
          contactId,
          name: `${person.firstName} ${person.lastName}`,
          isPrimary: person.isPrimary,
        },
      });

      return person;
    });
  }

  async updateContactPerson(
    organizationId: string,
    contactId: string,
    personId: string,
    dto: UpdateContactPersonDto,
    actor: Actor,
  ) {
    const existing = await this.prisma.contactPerson.findFirst({
      where: { id: personId, contactId, organizationId },
    });
    if (!existing) {
      throw new DomainException('CONTACT_PERSON_NOT_FOUND', 'Contact person not found');
    }

    return this.prisma.transaction(async (tx) => {
      if (dto.isPrimary) {
        await tx.contactPerson.updateMany({
          where: { organizationId, contactId, isPrimary: true, id: { not: personId } },
          data: { isPrimary: false },
        });
      }

      const updated = await tx.contactPerson.update({
        where: { id: personId },
        data: {
          ...(dto.firstName !== undefined ? { firstName: dto.firstName } : {}),
          ...(dto.lastName !== undefined ? { lastName: dto.lastName } : {}),
          ...(dto.jobTitle !== undefined ? { jobTitle: dto.jobTitle } : {}),
          ...(dto.email !== undefined ? { email: dto.email } : {}),
          ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
          ...(dto.mobile !== undefined ? { mobile: dto.mobile } : {}),
          ...(dto.isPrimary !== undefined ? { isPrimary: dto.isPrimary } : {}),
          ...(dto.isBillingContact !== undefined ? { isBillingContact: dto.isBillingContact } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
      });

      await this.audit.record(tx, actor, {
        organizationId,
        eventType: AuditEvents.CONTACT_PERSON_UPDATED,
        entityType: 'CONTACT_PERSON',
        entityId: personId,
        oldValues: existing,
        newValues: updated,
      });

      if (dto.isPrimary && !existing.isPrimary) {
        await this.audit.record(tx, actor, {
          organizationId,
          eventType: AuditEvents.CONTACT_PRIMARY_PERSON_CHANGED,
          entityType: 'CONTACT',
          entityId: contactId,
          newValues: { primaryPersonId: personId },
        });
      }

      return updated;
    });
  }

  async setPrimaryContactPerson(
    organizationId: string,
    contactId: string,
    personId: string,
    actor: Actor,
  ) {
    const person = await this.prisma.contactPerson.findFirst({
      where: { id: personId, contactId, organizationId },
    });
    if (!person) {
      throw new DomainException('CONTACT_PERSON_NOT_FOUND', 'Contact person not found');
    }

    return this.prisma.transaction(async (tx) => {
      await tx.contactPerson.updateMany({
        where: { organizationId, contactId, isPrimary: true },
        data: { isPrimary: false },
      });

      const updated = await tx.contactPerson.update({
        where: { id: personId },
        data: { isPrimary: true, isActive: true },
      });

      await this.audit.record(tx, actor, {
        organizationId,
        eventType: AuditEvents.CONTACT_PRIMARY_PERSON_CHANGED,
        entityType: 'CONTACT',
        entityId: contactId,
        newValues: { primaryPersonId: personId },
      });

      return updated;
    });
  }

  async deactivateContactPerson(
    organizationId: string,
    contactId: string,
    personId: string,
    actor: Actor,
  ) {
    const person = await this.prisma.contactPerson.findFirst({
      where: { id: personId, contactId, organizationId },
    });
    if (!person) {
      throw new DomainException('CONTACT_PERSON_NOT_FOUND', 'Contact person not found');
    }

    return this.prisma.transaction(async (tx) => {
      const updated = await tx.contactPerson.update({
        where: { id: personId },
        data: { isActive: false, isPrimary: false },
      });

      await this.audit.record(tx, actor, {
        organizationId,
        eventType: AuditEvents.CONTACT_PERSON_DEACTIVATED,
        entityType: 'CONTACT_PERSON',
        entityId: personId,
      });

      return updated;
    });
  }
}
