import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentOrg, RequirePermission } from '../common/decorators';
import type { OrgContext } from '../common/types/request-context.types';
import { GeneralLedgerService } from './general-ledger.service';
import { JournalType } from '@prisma/client';

@Controller('organizations/:orgId/general-ledger')
export class LedgerController {
  constructor(private readonly ledgerService: GeneralLedgerService) {}

  @Get()
  @RequirePermission('ledger.view')
  getGeneralLedger(
    @CurrentOrg() org: OrgContext,
    @Query('accountId') accountId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('financialYearId') financialYearId?: string,
    @Query('periodId') periodId?: string,
    @Query('journalType') journalType?: JournalType,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.ledgerService.getGeneralLedger(org.organizationId, {
      accountId,
      startDate,
      endDate,
      financialYearId,
      periodId,
      journalType,
      search,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  @Get('accounts/:accountId')
  @RequirePermission('ledger.view')
  getAccountLedger(
    @CurrentOrg() org: OrgContext,
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('financialYearId') financialYearId?: string,
    @Query('periodId') periodId?: string,
    @Query('journalType') journalType?: JournalType,
  ) {
    return this.ledgerService.getAccountLedger(org.organizationId, accountId, {
      startDate,
      endDate,
      financialYearId,
      periodId,
      journalType,
    });
  }

  @Get('export')
  @RequirePermission('ledger.export')
  async exportCsv(
    @CurrentOrg() org: OrgContext,
    @Res() res: Response,
    @Query('accountId') accountId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('financialYearId') financialYearId?: string,
    @Query('periodId') periodId?: string,
  ) {
    const csv = await this.ledgerService.exportLedgerCsv(org.organizationId, {
      accountId,
      startDate,
      endDate,
      financialYearId,
      periodId,
    });

    const filename = `general-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }
}
