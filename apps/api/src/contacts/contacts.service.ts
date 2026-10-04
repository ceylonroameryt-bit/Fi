import { Injectable } from '@nestjs/common';
import { ContactStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { DomainException } from '../common/errors/domain.exception';
import type { Actor } from '../common/types/request-context.types';
import { AuditService } from '../audit/audit.service';
import { AuditEvents } from '../audit/audit-events';
import type { ContactFilterQueryDto, CreateContactDto, UpdateContactDto } from './dto/contact.dto';

@Injectable()
export class ContactsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listContacts(organizationId: string, filter: ContactFilterQueryDto) {
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
            ],
          }
        : {}),
    };

    return this.prisma.contact.findMany({
      where,
      orderBy: [{ name: 'asc' }],
      include: {
        _count: { select: { invoices: true } },
      },
    });
  }

  async getContact(organizationId: string, contactId: string) {
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, organizationId },
      include: {
        _count: { select: { invoices: true } },
      },
    });

    if (!contact) {
      throw new DomainException('CONTACT_NOT_FOUND', 'Contact not found in this organisation');
    }

    return contact;
  }

  async createContact(organizationId: string, dto: CreateContactDto, actor: Actor) {
    return this.prisma.transaction(async (tx) => {
      const contact = await tx.contact.create({
        data: {
          organizationId,
          type: dto.type,
          name: dto.name,
          companyName: dto.companyName,
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
    const existing = await this.getContact(organizationId, contactId);

    return this.prisma.transaction(async (tx) => {
      const updated = await tx.contact.update({
        where: { id: contactId },
        data: {
          ...(dto.type !== undefined ? { type: dto.type } : {}),
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.companyName !== undefined ? { companyName: dto.companyName } : {}),
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
    const existing = await this.getContact(organizationId, contactId);
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
    const existing = await this.getContact(organizationId, contactId);
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
}
