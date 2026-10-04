import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { CurrentActor, CurrentAuth, RequirePermission } from '../common/decorators';
import type { Actor, AuthContext } from '../common/types/request-context.types';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto, UpdateOrganizationDto } from './dto/organization.dto';

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get()
  list(@CurrentAuth() auth: AuthContext) {
    return this.organizations.listUserOrganizations(auth.userId);
  }

  @Post()
  create(@Body() dto: CreateOrganizationDto, @CurrentActor() actor: Actor) {
    return this.organizations.createOrganization(dto, actor);
  }

  @Get(':id')
  getOne(@Param('id', ParseUUIDPipe) id: string, @CurrentAuth() auth: AuthContext) {
    return this.organizations.getOrganization(id, auth.userId);
  }

  @Patch(':id')
  @RequirePermission('organization.edit')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrganizationDto,
    @CurrentActor() actor: Actor,
  ) {
    return this.organizations.updateOrganization(id, dto, actor);
  }

  @Post(':id/archive')
  @RequirePermission('organization.archive')
  archive(@Param('id', ParseUUIDPipe) id: string, @CurrentActor() actor: Actor) {
    return this.organizations.archiveOrganization(id, actor);
  }

  @Post(':id/switch')
  @HttpCode(HttpStatus.OK)
  switchOrg(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAuth() auth: AuthContext,
    @CurrentActor() actor: Actor,
  ) {
    return this.organizations.switchOrganization(id, auth.userId, auth.sessionId, actor);
  }
}
