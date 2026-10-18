import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { CurrentOrg, RequirePermission } from '../../common/decorators';
import type { OrgContext } from '../../common/types/request-context.types';
import { AiAssistantService } from './ai-assistant.service';

export class DraftInvoiceDto {
  @IsString()
  @IsNotEmpty()
  prompt!: string;
}

export class DraftJournalDto {
  @IsString()
  @IsNotEmpty()
  prompt!: string;
}

export class ReportInsightsDto {
  @IsString()
  @IsNotEmpty()
  reportType!: string;

  @IsOptional()
  data?: Record<string, unknown>;
}

@Controller('organizations/:orgId/ai')
export class AiAssistantController {
  constructor(private readonly assistant: AiAssistantService) {}

  @Post('draft-invoice')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('invoice.create')
  async draftInvoice(
    @CurrentOrg() org: OrgContext,
    @Body() dto: DraftInvoiceDto,
  ) {
    return this.assistant.draftInvoice(org.organizationId, dto.prompt);
  }

  @Post('draft-journal')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('journal:create')
  async draftJournal(
    @CurrentOrg() org: OrgContext,
    @Body() dto: DraftJournalDto,
  ) {
    return this.assistant.draftJournal(org.organizationId, dto.prompt);
  }

  @Post('report-insights')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('organization.view')
  async getReportInsights(
    @CurrentOrg() org: OrgContext,
    @Body() dto: ReportInsightsDto,
  ) {
    return this.assistant.generateReportInsights(org.organizationId, dto.reportType, dto.data);
  }
}
