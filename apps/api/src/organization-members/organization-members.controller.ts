import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { CurrentActor, CurrentOrg, RequirePermission } from '../common/decorators';
import type { Actor, OrgContext } from '../common/types/request-context.types';
import { OrganizationMembersService } from './organization-members.service';
import { InviteMemberDto, UpdateMemberRoleDto } from './dto/member.dto';

@Controller('organizations/:orgId/members')
export class OrganizationMembersController {
  constructor(private readonly members: OrganizationMembersService) {}

  @Get()
  @RequirePermission('users.view')
  list(@CurrentOrg() org: OrgContext) {
    return this.members.listMembers(org.organizationId);
  }

  @Post()
  @RequirePermission('users.manage')
  invite(
    @CurrentOrg() org: OrgContext,
    @Body() dto: InviteMemberDto,
    @CurrentActor() actor: Actor,
  ) {
    return this.members.inviteMember(org.organizationId, dto, actor);
  }

  @Patch(':memberId')
  @RequirePermission('users.manage')
  updateRole(
    @CurrentOrg() org: OrgContext,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: UpdateMemberRoleDto,
    @CurrentActor() actor: Actor,
  ) {
    return this.members.updateMemberRole(org.organizationId, memberId, dto, actor);
  }

  @Delete(':memberId')
  @RequirePermission('users.manage')
  remove(
    @CurrentOrg() org: OrgContext,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @CurrentActor() actor: Actor,
  ) {
    return this.members.removeMember(org.organizationId, memberId, actor);
  }
}
