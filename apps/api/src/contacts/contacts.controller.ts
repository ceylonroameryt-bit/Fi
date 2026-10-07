import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ContactType } from '@prisma/client';
import { CurrentActor, CurrentOrg, RequirePermission } from '../common/decorators';
import type { Actor, OrgContext } from '../common/types/request-context.types';
import { ContactsService } from './contacts.service';
import { ContactSubledgerService } from './contact-subledger.service';
import {
  ContactActivityQueryDto,
  ContactFilterQueryDto,
  ContactStatementQueryDto,
  CreateContactDto,
  CreateContactPersonDto,
  DuplicateCheckQueryDto,
  UpdateContactDto,
  UpdateContactPersonDto,
} from './dto/contact.dto';

@Controller('organizations/:orgId/contacts')
export class ContactsController {
  constructor(
    private readonly contacts: ContactsService,
    private readonly subledger: ContactSubledgerService,
  ) {}

  @Get('summary')
  @RequirePermission('contact.view')
  getSummary(@CurrentOrg() org: OrgContext) {
    return this.contacts.getSummary(org.organizationId);
  }

  @Get('duplicate-check')
  @RequirePermission('contact.view')
  checkDuplicates(@CurrentOrg() org: OrgContext, @Query() query: DuplicateCheckQueryDto) {
    return this.contacts.checkDuplicates(org.organizationId, query);
  }

  @Get()
  @RequirePermission('contact.view')
  list(@CurrentOrg() org: OrgContext, @Query() query: ContactFilterQueryDto) {
    return this.contacts.listContacts(org.organizationId, query);
  }

  @Get(':contactId')
  @RequirePermission('contact.view')
  getOne(@CurrentOrg() org: OrgContext, @Param('contactId', ParseUUIDPipe) contactId: string) {
    return this.contacts.getContact(org.organizationId, contactId);
  }

  @Post()
  @RequirePermission('contact.create')
  create(
    @CurrentOrg() org: OrgContext,
    @Body() dto: CreateContactDto,
    @CurrentActor() actor: Actor,
  ) {
    return this.contacts.createContact(org.organizationId, dto, actor);
  }

  @Patch(':contactId')
  @RequirePermission('contact.edit')
  update(
    @CurrentOrg() org: OrgContext,
    @Param('contactId', ParseUUIDPipe) contactId: string,
    @Body() dto: UpdateContactDto,
    @CurrentActor() actor: Actor,
  ) {
    return this.contacts.updateContact(org.organizationId, contactId, dto, actor);
  }

  @Post(':contactId/archive')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('contact.archive')
  archive(
    @CurrentOrg() org: OrgContext,
    @Param('contactId', ParseUUIDPipe) contactId: string,
    @CurrentActor() actor: Actor,
  ) {
    return this.contacts.archiveContact(org.organizationId, contactId, actor);
  }

  @Post(':contactId/restore')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('contact.archive')
  restore(
    @CurrentOrg() org: OrgContext,
    @Param('contactId', ParseUUIDPipe) contactId: string,
    @CurrentActor() actor: Actor,
  ) {
    return this.contacts.restoreContact(org.organizationId, contactId, actor);
  }

  // ────────────────────────── Subledger & Statements ──────────────────────────

  @Get(':contactId/statement')
  @RequirePermission('contact.view')
  async getStatement(
    @CurrentOrg() org: OrgContext,
    @Param('contactId', ParseUUIDPipe) contactId: string,
    @Query() query: ContactStatementQueryDto & { statementType?: 'CUSTOMER' | 'SUPPLIER' },
  ) {
    const contact = await this.contacts.getContact(org.organizationId, contactId);
    if (query.statementType === 'SUPPLIER' || contact.type === ContactType.SUPPLIER) {
      return this.subledger.getSupplierStatement(org.organizationId, contactId, query);
    }
    return this.subledger.getCustomerStatement(org.organizationId, contactId, query);
  }

  @Get(':contactId/activity')
  @RequirePermission('contact.view')
  getActivity(
    @CurrentOrg() org: OrgContext,
    @Param('contactId', ParseUUIDPipe) contactId: string,
    @Query() query: ContactActivityQueryDto,
  ) {
    return this.subledger.getContactActivity(org.organizationId, contactId, query);
  }

  // ────────────────────────── Contact People ──────────────────────────

  @Post(':contactId/people')
  @RequirePermission('contact.edit')
  addPerson(
    @CurrentOrg() org: OrgContext,
    @Param('contactId', ParseUUIDPipe) contactId: string,
    @Body() dto: CreateContactPersonDto,
    @CurrentActor() actor: Actor,
  ) {
    return this.contacts.addContactPerson(org.organizationId, contactId, dto, actor);
  }

  @Patch(':contactId/people/:personId')
  @RequirePermission('contact.edit')
  updatePerson(
    @CurrentOrg() org: OrgContext,
    @Param('contactId', ParseUUIDPipe) contactId: string,
    @Param('personId', ParseUUIDPipe) personId: string,
    @Body() dto: UpdateContactPersonDto,
    @CurrentActor() actor: Actor,
  ) {
    return this.contacts.updateContactPerson(org.organizationId, contactId, personId, dto, actor);
  }

  @Post(':contactId/people/:personId/primary')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('contact.edit')
  setPrimaryPerson(
    @CurrentOrg() org: OrgContext,
    @Param('contactId', ParseUUIDPipe) contactId: string,
    @Param('personId', ParseUUIDPipe) personId: string,
    @CurrentActor() actor: Actor,
  ) {
    return this.contacts.setPrimaryContactPerson(org.organizationId, contactId, personId, actor);
  }

  @Post(':contactId/people/:personId/deactivate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('contact.edit')
  deactivatePerson(
    @CurrentOrg() org: OrgContext,
    @Param('contactId', ParseUUIDPipe) contactId: string,
    @Param('personId', ParseUUIDPipe) personId: string,
    @CurrentActor() actor: Actor,
  ) {
    return this.contacts.deactivateContactPerson(org.organizationId, contactId, personId, actor);
  }
}
