import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { JournalStatus } from '@prisma/client';
import { CurrentActor, CurrentOrg, RequirePermission } from '../common/decorators';
import type { Actor, OrgContext } from '../common/types/request-context.types';
import { JournalsService } from './journals.service';
import { CreateJournalDto, UpdateJournalDto } from './dto/journal.dto';
import { JournalPostingService } from '../accounting-engine/journal-posting.service';
import { JournalReversalService, ReverseJournalDto } from '../accounting-engine/journal-reversal.service';

@Controller('organizations/:orgId/journals')
export class JournalsController {
  constructor(
    private readonly journals: JournalsService,
    private readonly postingService: JournalPostingService,
    private readonly reversalService: JournalReversalService,
  ) {}

  @Get()
  @RequirePermission('journal.view')
  list(
    @CurrentOrg() org: OrgContext,
    @Query('status') status?: JournalStatus,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.journals.listJournals(org.organizationId, {
      status,
      search,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  @Get(':journalId')
  @RequirePermission('journal.view')
  getOne(@CurrentOrg() org: OrgContext, @Param('journalId', ParseUUIDPipe) journalId: string) {
    return this.journals.getJournal(org.organizationId, journalId);
  }

  @Post()
  @RequirePermission('journal.create')
  create(
    @CurrentOrg() org: OrgContext,
    @Body() dto: CreateJournalDto,
    @CurrentActor() actor: Actor,
  ) {
    return this.journals.createDraftJournal(org.organizationId, dto, org, actor);
  }

  @Patch(':journalId')
  @RequirePermission('journal.edit_draft')
  update(
    @CurrentOrg() org: OrgContext,
    @Param('journalId', ParseUUIDPipe) journalId: string,
    @Body() dto: UpdateJournalDto,
    @CurrentActor() actor: Actor,
  ) {
    return this.journals.updateDraftJournal(org.organizationId, journalId, dto, org, actor);
  }

  @Delete(':journalId')
  @RequirePermission('journal.delete_draft')
  delete(
    @CurrentOrg() org: OrgContext,
    @Param('journalId', ParseUUIDPipe) journalId: string,
    @CurrentActor() actor: Actor,
  ) {
    return this.journals.deleteDraftJournal(org.organizationId, journalId, actor);
  }

  @Post(':journalId/duplicate')
  @RequirePermission('journal.create')
  duplicate(
    @CurrentOrg() org: OrgContext,
    @Param('journalId', ParseUUIDPipe) journalId: string,
    @CurrentActor() actor: Actor,
  ) {
    return this.journals.duplicateDraftJournal(org.organizationId, journalId, org, actor);
  }

  @Post(':journalId/validate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('journal.validate')
  validate(
    @CurrentOrg() org: OrgContext,
    @Param('journalId', ParseUUIDPipe) journalId: string,
    @CurrentActor() actor: Actor,
  ) {
    return this.journals.validateJournal(org.organizationId, journalId, org, actor);
  }

  @Get(':journalId/post/preview')
  @RequirePermission('journal.post')
  previewPost(
    @CurrentOrg() org: OrgContext,
    @Param('journalId', ParseUUIDPipe) journalId: string,
  ) {
    return this.postingService.previewPosting(org.organizationId, journalId, org);
  }

  @Post(':journalId/post')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('journal.post')
  post(
    @CurrentOrg() org: OrgContext,
    @Param('journalId', ParseUUIDPipe) journalId: string,
    @CurrentActor() actor: Actor,
  ) {
    return this.postingService.postJournal(org.organizationId, journalId, org, actor);
  }

  @Get(':journalId/reverse/preview')
  @RequirePermission('journal.reverse')
  previewReverse(
    @CurrentOrg() org: OrgContext,
    @Param('journalId', ParseUUIDPipe) journalId: string,
    @Query('reversalDate') reversalDate?: string,
    @Query('reason') reason?: string,
  ) {
    return this.reversalService.previewReversal(org.organizationId, journalId, { reversalDate, reason }, org);
  }

  @Post(':journalId/reverse')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('journal.reverse')
  reverse(
    @CurrentOrg() org: OrgContext,
    @Param('journalId', ParseUUIDPipe) journalId: string,
    @Body() dto: ReverseJournalDto,
    @CurrentActor() actor: Actor,
  ) {
    return this.reversalService.reverseJournal(org.organizationId, journalId, dto ?? {}, org, actor);
  }
}
