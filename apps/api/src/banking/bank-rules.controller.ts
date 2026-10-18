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
import { BankRulesService } from './bank-rules.service';
import { CreateBankRuleDto, UpdateBankRuleDto } from './dto/bank-rule.dto';

@Controller('organizations/:orgId/bank-rules')
export class BankRulesController {
  constructor(private readonly rules: BankRulesService) {}

  @Get()
  @RequirePermission('bank_rules.manage')
  list(
    @CurrentOrg() org: OrgContext,
    @Query('bankAccountId') bankAccountId?: string,
  ) {
    return this.rules.listRules(org.organizationId, bankAccountId);
  }

  @Post()
  @RequirePermission('bank_rules.manage')
  create(
    @CurrentOrg() org: OrgContext,
    @Body() dto: CreateBankRuleDto,
    @CurrentActor() actor: Actor,
  ) {
    return this.rules.createRule(org.organizationId, dto, actor);
  }

  @Patch(':ruleId')
  @RequirePermission('bank_rules.manage')
  update(
    @CurrentOrg() org: OrgContext,
    @Param('ruleId', ParseUUIDPipe) ruleId: string,
    @Body() dto: UpdateBankRuleDto,
    @CurrentActor() actor: Actor,
  ) {
    return this.rules.updateRule(org.organizationId, ruleId, dto, actor);
  }

  @Delete(':ruleId')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('bank_rules.manage')
  delete(
    @CurrentOrg() org: OrgContext,
    @Param('ruleId', ParseUUIDPipe) ruleId: string,
  ) {
    return this.rules.deleteRule(org.organizationId, ruleId);
  }
}
