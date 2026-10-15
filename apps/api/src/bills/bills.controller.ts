import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentActor, CurrentOrg, RequirePermission } from '../common/decorators';
import type { Actor, OrgContext } from '../common/types/request-context.types';
import { BillsService } from './bills.service';
import { ApproveBillDto, BillFilterQueryDto, CreateBillDto, UpdateBillDto, VoidBillDto } from './dto/bill.dto';

@Controller('organizations/:orgId/bills')
export class BillsController {
  constructor(private readonly bills: BillsService) {}

  @Get()
  @RequirePermission('bill.view')
  list(@CurrentOrg() org: OrgContext, @Query() query: BillFilterQueryDto) {
    return this.bills.list(org.organizationId, query);
  }

  @Get(':billId')
  @RequirePermission('bill.view')
  get(@CurrentOrg() org: OrgContext, @Param('billId', ParseUUIDPipe) billId: string) {
    return this.bills.get(org.organizationId, billId);
  }

  /** The source document (PDF/photo) attached to the bill. */
  @Get(':billId/attachment')
  @RequirePermission('bill.view')
  async attachment(@CurrentOrg() org: OrgContext, @Param('billId', ParseUUIDPipe) billId: string, @Res() res: Response) {
    const file = await this.bills.attachment(org.organizationId, billId);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${file.fileName.replace(/["\r\n]/g, '')}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(file.body);
  }

  @Post()
  @RequirePermission('bill.create')
  create(@CurrentOrg() org: OrgContext, @CurrentActor() actor: Actor, @Body() dto: CreateBillDto) {
    return this.bills.create(org.organizationId, dto, org, actor);
  }

  @Patch(':billId')
  @RequirePermission('bill.edit_draft')
  update(@CurrentOrg() org: OrgContext, @CurrentActor() actor: Actor, @Param('billId', ParseUUIDPipe) billId: string, @Body() dto: UpdateBillDto) {
    return this.bills.update(org.organizationId, billId, dto, actor);
  }

  @Delete(':billId')
  @RequirePermission('bill.delete_draft')
  remove(@CurrentOrg() org: OrgContext, @CurrentActor() actor: Actor, @Param('billId', ParseUUIDPipe) billId: string) {
    return this.bills.remove(org.organizationId, billId, actor);
  }

  /** Approve and post (Dr expense/asset, Dr input VAT, Cr creditors). */
  @Post(':billId/approve')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('bill.approve')
  approve(@CurrentOrg() org: OrgContext, @CurrentActor() actor: Actor, @Param('billId', ParseUUIDPipe) billId: string, @Body() dto: ApproveBillDto) {
    return this.bills.approve(org.organizationId, billId, dto, org, actor);
  }

  @Post(':billId/void')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('bill.void')
  void(@CurrentOrg() org: OrgContext, @CurrentActor() actor: Actor, @Param('billId', ParseUUIDPipe) billId: string, @Body() dto: VoidBillDto) {
    return this.bills.void(org.organizationId, billId, dto, org, actor);
  }
}
