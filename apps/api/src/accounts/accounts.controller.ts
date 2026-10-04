import {
  Body,
  Controller,
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
import { AccountsService } from './accounts.service';
import { AccountFilterQueryDto, CreateAccountDto, UpdateAccountDto } from './dto/account.dto';

@Controller('organizations/:orgId/accounts')
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Get()
  @RequirePermission('account.view')
  list(@CurrentOrg() org: OrgContext, @Query() query: AccountFilterQueryDto) {
    return this.accounts.listAccounts(org.organizationId, query);
  }

  @Get('hierarchy')
  @RequirePermission('account.view')
  getHierarchy(@CurrentOrg() org: OrgContext) {
    return this.accounts.getAccountHierarchy(org.organizationId);
  }

  @Get(':accountId')
  @RequirePermission('account.view')
  getOne(@CurrentOrg() org: OrgContext, @Param('accountId', ParseUUIDPipe) accountId: string) {
    return this.accounts.getAccount(org.organizationId, accountId);
  }

  @Post()
  @RequirePermission('account.create')
  create(
    @CurrentOrg() org: OrgContext,
    @Body() dto: CreateAccountDto,
    @CurrentActor() actor: Actor,
  ) {
    return this.accounts.createAccount(org.organizationId, dto, actor);
  }

  @Patch(':accountId')
  @RequirePermission('account.edit')
  update(
    @CurrentOrg() org: OrgContext,
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Body() dto: UpdateAccountDto,
    @CurrentActor() actor: Actor,
  ) {
    return this.accounts.updateAccount(org.organizationId, accountId, dto, actor);
  }

  @Post(':accountId/archive')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('account.archive')
  archive(
    @CurrentOrg() org: OrgContext,
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @CurrentActor() actor: Actor,
  ) {
    return this.accounts.archiveAccount(org.organizationId, accountId, actor);
  }

  @Post(':accountId/restore')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('account.archive')
  restore(
    @CurrentOrg() org: OrgContext,
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @CurrentActor() actor: Actor,
  ) {
    return this.accounts.restoreAccount(org.organizationId, accountId, actor);
  }
}
