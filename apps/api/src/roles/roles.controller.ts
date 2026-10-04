import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { CurrentActor, CurrentOrg, RequirePermission } from '../common/decorators';
import type { Actor, OrgContext } from '../common/types/request-context.types';
import { RolesService } from './roles.service';
import { CreateRoleDto, UpdateRoleDto } from './dto/role.dto';

@Controller('organizations/:orgId/roles')
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get()
  @RequirePermission('roles.view')
  list(@CurrentOrg() org: OrgContext) {
    return this.roles.listRoles(org.organizationId);
  }

  @Get('permissions')
  @RequirePermission('roles.view')
  listPermissions() {
    return this.roles.listPermissions();
  }

  @Get(':roleId')
  @RequirePermission('roles.view')
  getOne(@CurrentOrg() org: OrgContext, @Param('roleId', ParseUUIDPipe) roleId: string) {
    return this.roles.getRole(org.organizationId, roleId);
  }

  @Post()
  @RequirePermission('roles.manage')
  create(
    @CurrentOrg() org: OrgContext,
    @Body() dto: CreateRoleDto,
    @CurrentActor() actor: Actor,
  ) {
    return this.roles.createRole(org.organizationId, dto, actor);
  }

  @Patch(':roleId')
  @RequirePermission('roles.manage')
  update(
    @CurrentOrg() org: OrgContext,
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Body() dto: UpdateRoleDto,
    @CurrentActor() actor: Actor,
  ) {
    return this.roles.updateRole(org.organizationId, roleId, dto, actor);
  }
}
