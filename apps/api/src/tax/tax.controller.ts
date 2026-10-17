import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put, Query } from '@nestjs/common';
import { CurrentActor, CurrentOrg, RequirePermission } from '../common/decorators';
import type { Actor, OrgContext } from '../common/types/request-context.types';
import { parseIsoDate } from '../common/utils/dates';
import { TaxCodesService } from './tax-codes.service';
import { VatReturnService } from './vat-return.service';
import { VatSchemesService } from './vat-schemes.service';
import { FlatRateAdjustmentDto, SetVatSchemeDto } from './dto/vat-scheme.dto';

@Controller()
export class TaxController {
  constructor(
    private readonly taxCodes: TaxCodesService,
    private readonly vatReturn: VatReturnService,
    private readonly vatSchemes: VatSchemesService,
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

  /** The VAT scheme in force today and its dated history. */
  @Get('organizations/:orgId/vat-scheme')
  @RequirePermission('organization.view')
  getVatScheme(@CurrentOrg() org: OrgContext) {
    return this.vatSchemes.get(org.organizationId);
  }

  /** Records a VAT scheme from a date (forward changes only). */
  @Put('organizations/:orgId/vat-scheme')
  @RequirePermission('organization.edit')
  setVatScheme(@CurrentOrg() org: OrgContext, @CurrentActor() actor: Actor, @Body() dto: SetVatSchemeDto) {
    return this.vatSchemes.set(org.organizationId, dto, actor);
  }

  /** Flat Rate Scheme: posts the period's surplus/shortfall between VAT control and other income. */
  @Post('organizations/:orgId/vat-return/flat-rate-adjustment')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('vat_return.view', 'journal.post')
  postFlatRateAdjustment(@CurrentOrg() org: OrgContext, @CurrentActor() actor: Actor, @Body() dto: FlatRateAdjustmentDto) {
    return this.vatSchemes.postFlatRateAdjustment(org.organizationId, dto, org, actor);
  }
}
