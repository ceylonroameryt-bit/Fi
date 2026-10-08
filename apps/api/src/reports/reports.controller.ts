import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentOrg, RequirePermission } from '../common/decorators';
import type { OrgContext } from '../common/types/request-context.types';
import { TrialBalanceService } from './trial-balance.service';
import { ProfitAndLossService } from './profit-and-loss.service';
import { BalanceSheetService } from './balance-sheet.service';

@Controller('organizations/:orgId/reports')
export class ReportsController {
  constructor(
    private readonly trialBalanceService: TrialBalanceService,
    private readonly pnlService: ProfitAndLossService,
    private readonly balanceSheetService: BalanceSheetService,
  ) {}

  @Get('trial-balance')
  @RequirePermission('trial_balance.view')
  getTrialBalance(
    @CurrentOrg() org: OrgContext,
    @Query('asOfDate') asOfDate?: string,
    @Query('financialYearId') financialYearId?: string,
    @Query('periodId') periodId?: string,
  ) {
    return this.trialBalanceService.generateTrialBalance(org.organizationId, {
      asOfDate,
      financialYearId,
      periodId,
    });
  }

  @Get('trial-balance/export')
  @RequirePermission('trial_balance.export')
  async exportTrialBalance(
    @CurrentOrg() org: OrgContext,
    @Res() res: Response,
    @Query('asOfDate') asOfDate?: string,
    @Query('financialYearId') financialYearId?: string,
    @Query('periodId') periodId?: string,
  ) {
    const csv = await this.trialBalanceService.exportTrialBalanceCsv(org.organizationId, {
      asOfDate,
      financialYearId,
      periodId,
    });

    const filename = `trial-balance-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }

  @Get('profit-and-loss')
  @RequirePermission('trial_balance.view')
  getProfitAndLoss(
    @CurrentOrg() org: OrgContext,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('financialYearId') financialYearId?: string,
    @Query('periodId') periodId?: string,
  ) {
    return this.pnlService.generateProfitAndLoss(org.organizationId, {
      startDate,
      endDate,
      financialYearId,
      periodId,
    });
  }

  @Get('profit-and-loss/export')
  @RequirePermission('trial_balance.export')
  async exportProfitAndLoss(
    @CurrentOrg() org: OrgContext,
    @Res() res: Response,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('financialYearId') financialYearId?: string,
    @Query('periodId') periodId?: string,
  ) {
    const csv = await this.pnlService.exportProfitAndLossCsv(org.organizationId, {
      startDate,
      endDate,
      financialYearId,
      periodId,
    });

    const filename = `profit-and-loss-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }

  @Get('balance-sheet')
  @RequirePermission('trial_balance.view')
  getBalanceSheet(
    @CurrentOrg() org: OrgContext,
    @Query('asOfDate') asOfDate?: string,
    @Query('financialYearId') financialYearId?: string,
    @Query('periodId') periodId?: string,
  ) {
    return this.balanceSheetService.generateBalanceSheet(org.organizationId, {
      asOfDate,
      financialYearId,
      periodId,
    });
  }

  @Get('balance-sheet/export')
  @RequirePermission('trial_balance.export')
  async exportBalanceSheet(
    @CurrentOrg() org: OrgContext,
    @Res() res: Response,
    @Query('asOfDate') asOfDate?: string,
    @Query('financialYearId') financialYearId?: string,
    @Query('periodId') periodId?: string,
  ) {
    const csv = await this.balanceSheetService.exportBalanceSheetCsv(org.organizationId, {
      asOfDate,
      financialYearId,
      periodId,
    });

    const filename = `balance-sheet-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }
}
