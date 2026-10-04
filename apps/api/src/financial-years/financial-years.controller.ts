import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { CurrentActor, CurrentOrg, RequirePermission } from '../common/decorators';
import type { Actor, OrgContext } from '../common/types/request-context.types';
import { FinancialYearsService } from './financial-years.service';
import { CreateFinancialYearDto, UpdateFinancialYearDto } from './dto/financial-year.dto';

@Controller('organizations/:orgId/financial-years')
export class FinancialYearsController {
  constructor(private readonly fyService: FinancialYearsService) {}

  @Get()
  @RequirePermission('financial_year.view')
  list(@CurrentOrg() org: OrgContext) {
    return this.fyService.listFinancialYears(org.organizationId);
  }

  @Get(':id')
  @RequirePermission('financial_year.view')
  getOne(@CurrentOrg() org: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.fyService.getFinancialYear(org.organizationId, id);
  }

  @Post()
  @RequirePermission('financial_year.create')
  create(
    @CurrentOrg() org: OrgContext,
    @Body() dto: CreateFinancialYearDto,
    @CurrentActor() actor: Actor,
  ) {
    return this.fyService.createFinancialYear(org.organizationId, dto, actor);
  }

  @Patch(':id')
  @RequirePermission('financial_year.edit')
  update(
    @CurrentOrg() org: OrgContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFinancialYearDto,
    @CurrentActor() actor: Actor,
  ) {
    return this.fyService.updateFinancialYear(org.organizationId, id, dto, actor);
  }
}
