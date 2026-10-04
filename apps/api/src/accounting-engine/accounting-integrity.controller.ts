import { Controller, Get } from '@nestjs/common';
import { CurrentActor, CurrentOrg, RequirePermission } from '../common/decorators';
import type { Actor, OrgContext } from '../common/types/request-context.types';
import { AccountingIntegrityService } from './accounting-integrity.service';

@Controller('organizations/:orgId/accounting-integrity')
export class AccountingIntegrityController {
  constructor(private readonly integrityService: AccountingIntegrityService) {}

  @Get()
  @RequirePermission('accounting_integrity.view')
  check(
    @CurrentOrg() org: OrgContext,
    @CurrentActor() actor: Actor,
  ) {
    return this.integrityService.runIntegrityChecks(org.organizationId, actor);
  }
}
