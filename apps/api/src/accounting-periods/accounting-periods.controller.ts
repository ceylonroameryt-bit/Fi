import { Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { CurrentActor, CurrentOrg, RequirePermission } from '../common/decorators';
import type { Actor, OrgContext } from '../common/types/request-context.types';
import { FinancialYearsService } from '../financial-years/financial-years.service';

@Controller('organizations/:orgId/periods')
export class AccountingPeriodsController {
  constructor(private readonly fyService: FinancialYearsService) {}

  @Get()
  @RequirePermission('period.view')
  list(@CurrentOrg() org: OrgContext, @Query('financialYearId') financialYearId?: string) {
    return this.fyService.listPeriods(org.organizationId, financialYearId);
  }

  @Post(':id/soft-lock')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('period.lock')
  softLock(
    @CurrentOrg() org: OrgContext,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentActor() actor: Actor,
  ) {
    return this.fyService.softLockPeriod(org.organizationId, id, actor);
  }

  @Post(':id/hard-lock')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('period.lock')
  hardLock(
    @CurrentOrg() org: OrgContext,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentActor() actor: Actor,
  ) {
    return this.fyService.hardLockPeriod(org.organizationId, id, actor);
  }

  @Post(':id/unlock')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('period.unlock')
  unlock(
    @CurrentOrg() org: OrgContext,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentActor() actor: Actor,
  ) {
    return this.fyService.unlockPeriod(org.organizationId, id, actor);
  }
}
