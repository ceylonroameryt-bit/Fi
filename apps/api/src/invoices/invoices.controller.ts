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
import { CurrentActor, CurrentOrg, RequirePermission } from '../common/decorators';
import type { Actor, OrgContext } from '../common/types/request-context.types';
import { InvoicesService } from './invoices.service';
import {
  CreateInvoiceDto,
  InvoiceFilterQueryDto,
  UpdateInvoiceDto,
  VoidInvoiceDto,
} from './dto/invoice.dto';

@Controller('organizations/:orgId/invoices')
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get()
  @RequirePermission('invoice.view')
  list(@CurrentOrg() org: OrgContext, @Query() query: InvoiceFilterQueryDto) {
    return this.invoices.listInvoices(org.organizationId, query);
  }

  @Get(':invoiceId')
  @RequirePermission('invoice.view')
  getOne(@CurrentOrg() org: OrgContext, @Param('invoiceId', ParseUUIDPipe) invoiceId: string) {
    return this.invoices.getInvoice(org.organizationId, invoiceId);
  }

  @Post()
  @RequirePermission('invoice.create')
  create(
    @CurrentOrg() org: OrgContext,
    @Body() dto: CreateInvoiceDto,
    @CurrentActor() actor: Actor,
  ) {
    return this.invoices.createInvoice(org.organizationId, dto, orgContext(org), actor);
  }

  @Patch(':invoiceId')
  @RequirePermission('invoice.edit_draft')
  update(
    @CurrentOrg() org: OrgContext,
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
    @Body() dto: UpdateInvoiceDto,
    @CurrentActor() actor: Actor,
  ) {
    return this.invoices.updateInvoice(org.organizationId, invoiceId, dto, orgContext(org), actor);
  }

  @Delete(':invoiceId')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('invoice.delete_draft')
  delete(
    @CurrentOrg() org: OrgContext,
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
    @CurrentActor() actor: Actor,
  ) {
    return this.invoices.deleteDraftInvoice(org.organizationId, invoiceId, actor);
  }

  @Post(':invoiceId/post')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('invoice.post')
  post(
    @CurrentOrg() org: OrgContext,
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
    @CurrentActor() actor: Actor,
  ) {
    return this.invoices.postInvoice(org.organizationId, invoiceId, orgContext(org), actor);
  }

  @Post(':invoiceId/void')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('invoice.void')
  void(
    @CurrentOrg() org: OrgContext,
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
    @Body() dto: VoidInvoiceDto,
    @CurrentActor() actor: Actor,
  ) {
    return this.invoices.voidInvoice(org.organizationId, invoiceId, dto, orgContext(org), actor);
  }
}

function orgContext(org: OrgContext): OrgContext {
  return org;
}
