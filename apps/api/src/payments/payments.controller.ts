import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentActor, CurrentOrg, RequirePermission } from '../common/decorators';
import type { Actor, OrgContext } from '../common/types/request-context.types';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { AllocatePaymentDto } from './dto/allocate-payment.dto';
import { PaymentFilterQueryDto } from './dto/payment-query.dto';
import { VoidPaymentDto } from './dto/void-payment.dto';

@Controller('organizations/:orgId/payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get()
  @RequirePermission('payment.view')
  list(@CurrentOrg() org: OrgContext, @Query() query: PaymentFilterQueryDto) {
    return this.payments.listPayments(org.organizationId, query);
  }

  @Get(':paymentId')
  @RequirePermission('payment.view')
  getOne(
    @CurrentOrg() org: OrgContext,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
  ) {
    return this.payments.getPayment(org.organizationId, paymentId);
  }

  @Post()
  @RequirePermission('payment.create')
  create(
    @CurrentOrg() org: OrgContext,
    @Body() dto: CreatePaymentDto,
    @CurrentActor() actor: Actor,
  ) {
    return this.payments.createPayment(org.organizationId, dto, org, actor);
  }

  @Post(':paymentId/void')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('payment.void')
  void(
    @CurrentOrg() org: OrgContext,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @Body() dto: VoidPaymentDto,
    @CurrentActor() actor: Actor,
  ) {
    return this.payments.voidPayment(org.organizationId, paymentId, dto, org, actor);
  }

  @Post(':paymentId/allocate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('payment.allocate')
  allocate(
    @CurrentOrg() org: OrgContext,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @Body() dto: AllocatePaymentDto,
    @CurrentActor() actor: Actor,
  ) {
    return this.payments.allocatePayment(org.organizationId, paymentId, dto, actor);
  }

  @Delete(':paymentId/allocations/:allocationId')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('payment.allocate')
  reverseAllocation(
    @CurrentOrg() org: OrgContext,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @Param('allocationId', ParseUUIDPipe) allocationId: string,
    @CurrentActor() actor: Actor,
  ) {
    return this.payments.reverseAllocation(org.organizationId, paymentId, allocationId, actor);
  }
}
