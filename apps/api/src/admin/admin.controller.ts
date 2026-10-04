import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { SuperAdminGuard } from '../common/guards/super-admin.guard';
import { CurrentActor } from '../common/decorators';
import type { Actor } from '../common/types/request-context.types';
import { AdminService } from './admin.service';
import {
  AdminPaginationQueryDto,
  AdminResetPasswordDto,
  ToggleSuperAdminDto,
  UpdateOrgStatusDto,
  UpdateUserStatusDto,
} from './dto/admin.dto';

@Controller('admin')
@UseGuards(SuperAdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  async getStats() {
    return this.adminService.getPlatformStats();
  }

  @Get('organizations')
  async listOrganizations(@Query() query: AdminPaginationQueryDto) {
    return this.adminService.listOrganizations(query);
  }

  @Get('organizations/:id')
  async getOrganizationDetails(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getOrganizationDetails(id);
  }

  @Patch('organizations/:id/status')
  async updateOrgStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrgStatusDto,
    @CurrentActor() actor: Actor,
  ) {
    return this.adminService.updateOrganizationStatus(id, dto.status, actor);
  }

  @Get('users')
  async listUsers(@Query() query: AdminPaginationQueryDto) {
    return this.adminService.listUsers(query);
  }

  @Patch('users/:id/status')
  async updateUserStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentActor() actor: Actor,
  ) {
    return this.adminService.updateUserStatus(id, dto.status, actor);
  }

  @Patch('users/:id/super-admin')
  async toggleSuperAdmin(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ToggleSuperAdminDto,
    @CurrentActor() actor: Actor,
  ) {
    return this.adminService.toggleSuperAdmin(id, dto.isSuperAdmin, actor);
  }

  @Post('users/:id/reset-password')
  async resetUserPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminResetPasswordDto,
    @CurrentActor() actor: Actor,
  ) {
    return this.adminService.resetUserPassword(id, dto.newPassword, actor);
  }

  @Get('audit-logs')
  async getAuditLogs(@Query() query: AdminPaginationQueryDto) {
    return this.adminService.getAuditLogs(query);
  }
}
