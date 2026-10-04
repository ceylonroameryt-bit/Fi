import { Controller, Get, Query } from '@nestjs/common';
import { CurrentOrg, RequirePermission } from '../common/decorators';
import type { OrgContext } from '../common/types/request-context.types';
import { AuditService } from './audit.service';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';

/** Read-only audit trail. No create/update/delete endpoints exist by design. */
@Controller('organizations/:orgId/audit-logs')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @RequirePermission('audit.view')
  list(@CurrentOrg() org: OrgContext, @Query() query: AuditLogQueryDto) {
    return this.audit.list(org.organizationId, query);
  }
}
