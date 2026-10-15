import { Controller, Get, Param, Query } from '@nestjs/common';
import { CurrentOrg, RequirePermission } from '../common/decorators';
import type { OrgContext } from '../common/types/request-context.types';
import { parseIsoDate } from '../common/utils/dates';
import { TaxCodesService } from './tax-codes.service';
import { VatReturnService } from './vat-return.service';

@Controller()
export class TaxController {
  constructor(
    private readonly taxCodes: TaxCodesService,
    private readonly vatReturn: VatReturnService,
  ) {}

  /** System UK VAT codes with the rate in force on `date` (default today). */
  @Get('tax-codes')
  listTaxCodes(@Query('date') date?: string) {
    return this.taxCodes.list(date ? parseIsoDate(date, 'date') : new Date());
  }

  @Get('organizations/:orgId/vat-return')
  @RequirePermission('vat_return.view')
  getVatReturn(@CurrentOrg() org: OrgContext, @Query('from') from: string, @Query('to') to: string) {
    return this.vatReturn.getReturn(org.organizationId, { from, to });
  }

  @Get('organizations/:orgId/vat-return/boxes/:box/lines')
  @RequirePermission('vat_return.view')
  getVatBoxLines(
    @CurrentOrg() org: OrgContext,
    @Param('box') box: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.vatReturn.getBoxLines(org.organizationId, { from, to }, box);
  }
}
