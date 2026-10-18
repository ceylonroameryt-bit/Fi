import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentActor, CurrentOrg, RequirePermission } from '../common/decorators';
import type { Actor, OrgContext } from '../common/types/request-context.types';
import { CreditNotesService } from './credit-notes.service';
import { CreateCreditNoteDto } from './dto/create-credit-note.dto';
import { AllocateCreditNoteDto } from './dto/allocate-credit-note.dto';
import { CreditNoteFilterQueryDto } from './dto/credit-note-query.dto';
import { VoidCreditNoteDto } from './dto/void-credit-note.dto';

@Controller('organizations/:orgId/credit-notes')
export class CreditNotesController {
  constructor(private readonly creditNotes: CreditNotesService) {}

  @Get()
  @RequirePermission('credit_note.view')
  list(@CurrentOrg() org: OrgContext, @Query() query: CreditNoteFilterQueryDto) {
    return this.creditNotes.listCreditNotes(org.organizationId, query);
  }

  @Get(':creditNoteId')
  @RequirePermission('credit_note.view')
  getOne(
    @CurrentOrg() org: OrgContext,
    @Param('creditNoteId', ParseUUIDPipe) creditNoteId: string,
  ) {
    return this.creditNotes.getCreditNote(org.organizationId, creditNoteId);
  }

  @Post()
  @RequirePermission('credit_note.create')
  create(
    @CurrentOrg() org: OrgContext,
    @Body() dto: CreateCreditNoteDto,
    @CurrentActor() actor: Actor,
  ) {
    return this.creditNotes.createCreditNote(org.organizationId, dto, org, actor);
  }

  @Post(':creditNoteId/post')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('credit_note.post')
  post(
    @CurrentOrg() org: OrgContext,
    @Param('creditNoteId', ParseUUIDPipe) creditNoteId: string,
    @CurrentActor() actor: Actor,
  ) {
    return this.creditNotes.postCreditNote(org.organizationId, creditNoteId, org, actor);
  }

  @Post(':creditNoteId/void')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('credit_note.void')
  void(
    @CurrentOrg() org: OrgContext,
    @Param('creditNoteId', ParseUUIDPipe) creditNoteId: string,
    @Body() dto: VoidCreditNoteDto,
    @CurrentActor() actor: Actor,
  ) {
    return this.creditNotes.voidCreditNote(org.organizationId, creditNoteId, dto, org, actor);
  }

  @Post(':creditNoteId/allocate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('credit_note.post')
  allocate(
    @CurrentOrg() org: OrgContext,
    @Param('creditNoteId', ParseUUIDPipe) creditNoteId: string,
    @Body() dto: AllocateCreditNoteDto,
    @CurrentActor() actor: Actor,
  ) {
    return this.creditNotes.allocateCreditNote(org.organizationId, creditNoteId, dto, actor);
  }
}
