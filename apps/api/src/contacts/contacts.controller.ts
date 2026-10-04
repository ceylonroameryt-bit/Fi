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
import { CurrentActor, CurrentOrg, RequirePermission } from '../common/decorators';
import type { Actor, OrgContext } from '../common/types/request-context.types';
import { ContactsService } from './contacts.service';
import { ContactFilterQueryDto, CreateContactDto, UpdateContactDto } from './dto/contact.dto';

@Controller('organizations/:orgId/contacts')
export class ContactsController {
  constructor(private readonly contacts: ContactsService) {}

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
}
