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
import { BankTransactionStatus } from '@prisma/client';
import { CurrentActor, CurrentOrg, RequirePermission } from '../common/decorators';
import type { Actor, OrgContext } from '../common/types/request-context.types';
import { StatementImportService } from './statement-import.service';
import { BankReconciliationService } from './bank-reconciliation.service';
import { BankAiCategorisationService } from './bank-ai-categorisation.service';
import { ImportStatementDto } from './dto/import-statement.dto';
import { MatchTransactionDto, QuickCreateTransactionDto } from './dto/reconcile-transaction.dto';
import { AutoCategoriseDto, BatchConfirmDto, ConfirmLineDto, InlineUpdateLineDto } from './dto/ai-categorise.dto';

@Controller('organizations/:orgId/bank-statements')
export class BankStatementsController {
  constructor(
    private readonly importer: StatementImportService,
    private readonly reconciliation: BankReconciliationService,
    private readonly aiCategorisation: BankAiCategorisationService,
  ) {}

  @Post('import')
  @RequirePermission('bank_statement.import')
  importStatement(
    @CurrentOrg() org: OrgContext,
    @Body() dto: ImportStatementDto,
    @CurrentActor() actor: Actor,
  ) {
    return this.importer.importStatement(org.organizationId, dto, actor);
  }

  @Get('imports')
  @RequirePermission('bank_statement.view')
  listImports(
    @CurrentOrg() org: OrgContext,
    @Query('bankAccountId') bankAccountId?: string,
  ) {
    return this.importer.listImports(org.organizationId, bankAccountId);
  }

  @Get('lines')
  @RequirePermission('bank_statement.view')
  listLines(
    @CurrentOrg() org: OrgContext,
    @Query('bankAccountId') bankAccountId?: string,
    @Query('status') status?: BankTransactionStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 50;
    return this.importer.listStatementLines(org.organizationId, bankAccountId, status, pageNum, limitNum);
  }

  @Get('lines/:lineId/suggestions')
  @RequirePermission('bank_reconciliation.manage')
  getSuggestions(
    @CurrentOrg() org: OrgContext,
    @Param('lineId', ParseUUIDPipe) lineId: string,
  ) {
    return this.reconciliation.getSuggestions(org.organizationId, lineId);
  }

  @Post('lines/:lineId/match')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('bank_reconciliation.manage')
  matchTransaction(
    @CurrentOrg() org: OrgContext,
    @Param('lineId', ParseUUIDPipe) lineId: string,
    @Body() dto: MatchTransactionDto,
    @CurrentActor() actor: Actor,
  ) {
    return this.reconciliation.matchTransaction(org.organizationId, lineId, dto, actor);
  }

  @Post('lines/:lineId/unmatch')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('bank_reconciliation.manage')
  unmatchTransaction(
    @CurrentOrg() org: OrgContext,
    @Param('lineId', ParseUUIDPipe) lineId: string,
    @CurrentActor() actor: Actor,
  ) {
    return this.reconciliation.unmatchTransaction(org.organizationId, lineId, actor);
  }

  @Post('lines/:lineId/quick-create')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('bank_reconciliation.manage')
  quickCreate(
    @CurrentOrg() org: OrgContext,
    @Param('lineId', ParseUUIDPipe) lineId: string,
    @Body() dto: QuickCreateTransactionDto,
    @CurrentActor() actor: Actor,
  ) {
    return this.reconciliation.quickCreateAndReconcile(org.organizationId, lineId, dto, org, actor);
  }

  @Post('auto-categorise')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('bank_reconciliation.manage')
  autoCategorise(
    @CurrentOrg() org: OrgContext,
    @Body() dto: AutoCategoriseDto,
  ) {
    return this.aiCategorisation.autoCategoriseLines(org.organizationId, dto?.bankAccountId);
  }

  @Patch('lines/:lineId/inline-update')
  @RequirePermission('bank_reconciliation.manage')
  inlineUpdateLine(
    @CurrentOrg() org: OrgContext,
    @Param('lineId', ParseUUIDPipe) lineId: string,
    @Body() dto: InlineUpdateLineDto,
  ) {
    return this.aiCategorisation.updateLineCategorisation(org.organizationId, lineId, dto);
  }

  @Post('lines/:lineId/confirm')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('bank_reconciliation.manage')
  confirmLine(
    @CurrentOrg() org: OrgContext,
    @Param('lineId', ParseUUIDPipe) lineId: string,
    @Body() dto: ConfirmLineDto,
    @CurrentActor() actor: Actor,
  ) {
    return this.aiCategorisation.confirmLine(org.organizationId, lineId, dto, org, actor);
  }

  @Post('batch-confirm')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('bank_reconciliation.manage')
  batchConfirm(
    @CurrentOrg() org: OrgContext,
    @Body() dto: BatchConfirmDto,
    @CurrentActor() actor: Actor,
  ) {
    return this.aiCategorisation.batchConfirm(org.organizationId, dto, org, actor);
  }
}
