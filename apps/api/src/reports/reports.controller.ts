import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentOrg, RequirePermission } from '../common/decorators';
import type { OrgContext } from '../common/types/request-context.types';
import { TrialBalanceService } from './trial-balance.service';

@Controller('organizations/:orgId/reports')
export class ReportsController {
  constructor(private readonly trialBalanceService: TrialBalanceService) {}

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
}
