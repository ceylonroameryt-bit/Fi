import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { CurrentActor, CurrentOrg, RequirePermission } from '../common/decorators';
import type { Actor, OrgContext } from '../common/types/request-context.types';
import { DocumentIntelligenceService } from './document-intelligence/document-intelligence.service';
import { BusinessContextService } from './business-context/business-context.service';
import { AiFeedbackService } from './feedback/ai-feedback.service';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { ApproveSuggestionDto, EditAndApproveDto, RejectSuggestionDto } from './dto/review-action.dto';
import { UpdateBusinessContextDto } from './dto/business-context.dto';
import { PrismaService } from '../database/prisma.service';

@Controller('organizations/:orgId/ai')
export class DocumentIntelligenceController {
  constructor(
    private readonly docAi: DocumentIntelligenceService,
    private readonly businessContext: BusinessContextService,
    private readonly feedback: AiFeedbackService,
    private readonly db: PrismaService,
  ) {}

  @Post('documents/upload')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('invoice.create')
  async uploadAndProcess(
    @CurrentOrg() org: OrgContext,
    @CurrentActor() actor: Actor,
    @Body() dto: UploadDocumentDto,
  ) {
    const fileKey = `docs/${org.organizationId}/${Date.now()}-${dto.fileName}`;

    // Create Document Record
    const doc = await this.db.aiDocument.create({
      data: {
        organizationId: org.organizationId,
        fileKey,
        fileName: dto.fileName,
        fileSize: dto.text ? Buffer.byteLength(dto.text, 'utf-8') : 1024,
        mimeType: dto.mimeType,
        createdById: actor.userId!,
      },
    });

    // Execute background processing
    const processed = await this.docAi.processDocument(org.organizationId, doc.id, {
      text: dto.text,
      autoDraftIfHighConfidence: dto.autoDraftIfHighConfidence ?? false,
    });

    return processed;
  }

  @Get('documents')
  @RequirePermission('invoice.view')
  async listDocuments(@CurrentOrg() org: OrgContext) {
    return this.docAi.listDocuments(org.organizationId);
  }

  @Get('documents/:docId')
  @RequirePermission('invoice.view')
  async getDocument(@CurrentOrg() org: OrgContext, @Param('docId', ParseUUIDPipe) docId: string) {
    return this.docAi.getDocument(org.organizationId, docId);
  }

  @Post('documents/:docId/approve')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('invoice.create')
  async approveSuggestion(
    @CurrentOrg() org: OrgContext,
    @CurrentActor() actor: Actor,
    @Param('docId', ParseUUIDPipe) docId: string,
    @Body() dto: ApproveSuggestionDto,
  ) {
    return this.docAi.approveSuggestion(org.organizationId, docId, actor.userId ?? '', dto.contactId);
  }

  @Post('documents/:docId/edit')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('invoice.create')
  async editAndApprove(
    @CurrentOrg() org: OrgContext,
    @CurrentActor() actor: Actor,
    @Param('docId', ParseUUIDPipe) docId: string,
    @Body() dto: EditAndApproveDto,
  ) {
    return this.docAi.editAndApproveSuggestion(org.organizationId, docId, actor.userId ?? '', dto);
  }

  @Post('documents/:docId/reject')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('invoice.create')
  async rejectSuggestion(
    @CurrentOrg() org: OrgContext,
    @CurrentActor() actor: Actor,
    @Param('docId', ParseUUIDPipe) docId: string,
    @Body() dto: RejectSuggestionDto,
  ) {
    return this.docAi.rejectSuggestion(org.organizationId, docId, actor.userId ?? '', dto.reason);
  }

  @Get('business-context')
  @RequirePermission('invoice.view')
  async getBusinessContext(@CurrentOrg() org: OrgContext) {
    return this.businessContext.getProfile(org.organizationId);
  }

  @Put('business-context')
  @RequirePermission('org.admin')
  async updateBusinessContext(@CurrentOrg() org: OrgContext, @Body() dto: UpdateBusinessContextDto) {
    return this.businessContext.updateProfile(org.organizationId, {
      ...(dto.industry ? { industry: dto.industry } : {}),
      ...(dto.inventoryEnabled !== undefined ? { inventoryEnabled: dto.inventoryEnabled } : {}),
      ...(dto.inventoryCategories ? { inventoryCategories: dto.inventoryCategories } : {}),
      ...(dto.salesChannels ? { salesChannels: dto.salesChannels } : {}),
      ...(dto.accountingMethod ? { accountingMethod: dto.accountingMethod } : {}),
    });
  }

  @Get('feedback')
  @RequirePermission('invoice.view')
  async getRecentFeedback(@CurrentOrg() org: OrgContext) {
    return this.feedback.getRecentFeedback(org.organizationId);
  }
}
