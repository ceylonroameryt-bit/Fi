import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AiDocumentStatus } from '@prisma/client';
import { DocumentIntakeService } from '../documents/document-intake.service';
import { CurrentActor, CurrentOrg, RequirePermission } from '../common/decorators';
import type { Actor, OrgContext } from '../common/types/request-context.types';
import { DocumentIntelligenceService } from './document-intelligence/document-intelligence.service';
import { BusinessContextService } from './business-context/business-context.service';
import { AiFeedbackService } from './feedback/ai-feedback.service';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { ApproveSuggestionDto, EditAndApproveDto, RejectSuggestionDto } from './dto/review-action.dto';
import { UpdateBusinessContextDto } from './dto/business-context.dto';

/** Multer stops reading beyond this; DocumentIntakeService enforces DOCUMENT_MAX_BYTES precisely. */
const MULTER_HARD_LIMIT_BYTES = 50 * 1024 * 1024;

@Controller('organizations/:orgId/ai')
export class DocumentIntelligenceController {
  constructor(
    private readonly docAi: DocumentIntelligenceService,
    private readonly businessContext: BusinessContextService,
    private readonly feedback: AiFeedbackService,
    private readonly intake: DocumentIntakeService,
  ) {}

  /** Multipart upload (field "file"): PDF, JPEG, PNG or TIFF. */
  @Post('documents')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('invoice.create')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MULTER_HARD_LIMIT_BYTES, files: 1 } }))
  async uploadFile(
    @CurrentOrg() org: OrgContext,
    @CurrentActor() actor: Actor,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) throw new BadRequestException('A file is required (multipart field "file")');
    return this.receive(org, actor, { fileName: file.originalname, declaredMimeType: file.mimetype, bytes: file.buffer });
  }

  /** JSON text upload (development / pasted documents). */
  @Post('documents/upload')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('invoice.create')
  async uploadText(@CurrentOrg() org: OrgContext, @CurrentActor() actor: Actor, @Body() dto: UploadDocumentDto) {
    if (!dto.text) throw new BadRequestException('text is required');
    return this.receive(org, actor, {
      fileName: dto.fileName,
      declaredMimeType: 'text/plain',
      bytes: Buffer.from(dto.text, 'utf8'),
    });
  }

  /** Intake (validate, store, dedupe, extract text) then propose; duplicates are not reprocessed. */
  private async receive(
    org: OrgContext,
    actor: Actor,
    file: { fileName: string; declaredMimeType: string; bytes: Buffer },
  ) {
    await this.docAi.assertAiEnabled(org.organizationId);
    const { document, duplicate } = await this.intake.intake({ organizationId: org.organizationId, userId: actor.userId!, ...file });
    if (duplicate) {
      return { ...(await this.docAi.getDocument(org.organizationId, document.id)), duplicate: true };
    }
    if (document.status === AiDocumentStatus.FAILED) {
      return { ...document, duplicate: false };
    }
    // Suggestions only: a person must approve every draft.
    const processed = await this.docAi.processDocument(org.organizationId, document.id);
    return { ...processed, duplicate: false };
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
    return this.docAi.approveSuggestion(org.organizationId, docId, org, actor, dto.contactId);
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
    return this.docAi.editAndApproveSuggestion(org.organizationId, docId, org, actor, dto);
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
  @RequirePermission('ai.manage')
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
