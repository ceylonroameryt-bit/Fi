import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentActor, CurrentOrg, RequirePermission } from '../common/decorators';
import type { Actor, OrgContext } from '../common/types/request-context.types';
import { BankAccountsService } from './bank-accounts.service';
import { CreateBankAccountDto, UpdateBankAccountDto } from './dto/create-bank-account.dto';

@Controller('organizations/:orgId/bank-accounts')
export class BankAccountsController {
  constructor(private readonly accounts: BankAccountsService) {}

  @Get()
  @RequirePermission('bank_account.view')
  list(@CurrentOrg() org: OrgContext) {
    return this.accounts.listBankAccounts(org.organizationId);
  }

  @Get(':accountId')
  @RequirePermission('bank_account.view')
  getOne(
    @CurrentOrg() org: OrgContext,
    @Param('accountId', ParseUUIDPipe) accountId: string,
  ) {
    return this.accounts.getBankAccount(org.organizationId, accountId);
  }

  @Post()
  @RequirePermission('bank_account.manage')
  create(
    @CurrentOrg() org: OrgContext,
    @Body() dto: CreateBankAccountDto,
    @CurrentActor() actor: Actor,
  ) {
    return this.accounts.createBankAccount(org.organizationId, dto, actor);
  }

  @Patch(':accountId')
  @RequirePermission('bank_account.manage')
  update(
    @CurrentOrg() org: OrgContext,
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Body() dto: UpdateBankAccountDto,
    @CurrentActor() actor: Actor,
  ) {
    return this.accounts.updateBankAccount(org.organizationId, accountId, dto, actor);
  }

  @Delete(':accountId')
  @RequirePermission('bank_account.manage')
  delete(
    @CurrentOrg() org: OrgContext,
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @CurrentActor() actor: Actor,
  ) {
    return this.accounts.deleteBankAccount(org.organizationId, accountId, actor);
  }
}
