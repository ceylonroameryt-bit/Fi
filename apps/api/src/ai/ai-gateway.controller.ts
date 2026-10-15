import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Optional, Post, Put, Query } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { CurrentActor, CurrentOrg, RequirePermission } from '../common/decorators';
import type { Actor, OrgContext } from '../common/types/request-context.types';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuditEvents } from '../audit/audit-events';
import { DomainException } from '../common/errors/domain.exception';
import { APP_CONFIG } from '../config/config.module';
import type { AppEnv } from '../config/env';
import { AiGatewayService } from './gateway/ai-gateway.service';
import { AiUsageService } from './gateway/ai-usage.service';
import { AI_PROVIDER, AiProvider } from './gateway/ai-provider.interface';
import { CONNECTION_CHECK_PROMPT } from './gateway/prompts/registry';
import { BusinessProfileService } from './business-profile/business-profile.service';
import { UpdateAiSettingsDto, UpdateBusinessProfileDto } from './dto/ai-settings.dto';

@Controller('organizations/:orgId/ai')
export class AiGatewayController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly gateway: AiGatewayService,
    private readonly usage: AiUsageService,
    private readonly profiles: BusinessProfileService,
    @Optional() @Inject(AI_PROVIDER) private readonly provider: AiProvider | null,
    @Inject(APP_CONFIG) private readonly config: Pick<AppEnv, 'AI_MODEL'>,
  ) {}

  @Get('settings')
  @RequirePermission('organization.view')
  async getSettings(@CurrentOrg() org: OrgContext) {
    const row = await this.prisma.organization.findUniqueOrThrow({
      where: { id: org.organizationId },
      select: { aiEnabled: true },
    });
    return { enabled: row.aiEnabled, provider: this.provider?.name ?? 'none', model: this.config.AI_MODEL };
  }

  @Put('settings')
  @RequirePermission('ai.manage')
  async updateSettings(@CurrentOrg() org: OrgContext, @CurrentActor() actor: Actor, @Body() dto: UpdateAiSettingsDto) {
    const before = await this.prisma.organization.findUniqueOrThrow({
      where: { id: org.organizationId },
      select: { aiEnabled: true },
    });
    await this.prisma.organization.update({ where: { id: org.organizationId }, data: { aiEnabled: dto.enabled } });
    await this.audit.record(null, actor, {
      organizationId: org.organizationId,
      eventType: AuditEvents.AI_SETTINGS_UPDATED,
      entityType: 'ORGANIZATION',
      entityId: org.organizationId,
      oldValues: { aiEnabled: before.aiEnabled },
      newValues: { aiEnabled: dto.enabled },
    });
    return this.getSettings(org);
  }

  /** One small schema-checked call to prove provider, credentials and usage logging work. */
  @Post('connection-check')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('ai.manage')
  async connectionCheck(@CurrentOrg() org: OrgContext, @CurrentActor() actor: Actor) {
    const token = randomBytes(6).toString('hex');
    const result = await this.gateway.run({
      organizationId: org.organizationId,
      userId: actor.userId,
      prompt: CONNECTION_CHECK_PROMPT,
      vars: { token },
    });
    if (!result.ok || result.token !== token) {
      throw new DomainException('AI_INVALID_OUTPUT', 'AI provider responded but did not echo the check token');
    }
    return { ok: true, provider: this.provider?.name ?? 'none', model: this.config.AI_MODEL };
  }

  @Get('usage')
  @RequirePermission('ai.usage.view')
  getUsage(@CurrentOrg() org: OrgContext, @Query('from') from: string, @Query('to') to: string) {
    return this.usage.summary(org.organizationId, from, to);
  }

  @Get('business-profile')
  @RequirePermission('organization.view')
  getProfile(@CurrentOrg() org: OrgContext) {
    return this.profiles.get(org.organizationId);
  }

  @Put('business-profile')
  @RequirePermission('ai.manage')
  async updateProfile(@CurrentOrg() org: OrgContext, @CurrentActor() actor: Actor, @Body() dto: UpdateBusinessProfileDto) {
    const before = await this.profiles.get(org.organizationId);
    const after = await this.profiles.update(org.organizationId, dto);
    await this.audit.record(null, actor, {
      organizationId: org.organizationId,
      eventType: AuditEvents.BUSINESS_PROFILE_UPDATED,
      entityType: 'ORGANIZATION',
      entityId: org.organizationId,
      oldValues: { industry: before.industry, vatScheme: before.vatScheme },
      newValues: { industry: after.industry, vatScheme: after.vatScheme },
    });
    return after;
  }

  @Post('business-profile/refresh')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('ai.manage')
  refreshProfile(@CurrentOrg() org: OrgContext) {
    return this.profiles.refresh(org.organizationId);
  }
}
