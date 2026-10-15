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
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentIntakeService } from '../documents/document-intake.service';
import { DocumentPipelineService } from './pipeline/document-pipeline.service';
import { AiReviewService } from './review/ai-review.service';
import { ApproveReviewedDto, ReviewQueueQueryDto } from './dto/review.dto';
import type { Response } from 'express';
import { CurrentActor, CurrentOrg, RequirePermission } from '../common/decorators';
import type { Actor, OrgContext } from '../common/types/request-context.types';
import { DocumentIntelligenceService } from './document-intelligence/document-intelligence.service';
import { BusinessContextService } from './business-context/business-context.service';
import { AiFeedbackService } from './feedback/ai-feedback.service';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { AcceptProposedContactDto, ApproveSuggestionDto, EditAndApproveDto, RejectSuggestionDto } from './dto/review-action.dto';
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
    private readonly pipeline: DocumentPipelineService,
    private readonly review: AiReviewService,
  ) {}

  /** Multipart upload (field "file"): PDF, JPEG, PNG or TIFF. */
  @Post('documents')
  @HttpCode(HttpStatus.ACCEPTED)
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
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermission('invoice.create')
  async uploadText(@CurrentOrg() org: OrgContext, @CurrentActor() actor: Actor, @Body() dto: UploadDocumentDto) {
    if (!dto.text) throw new BadRequestException('text is required');
    return this.receive(org, actor, {
      fileName: dto.fileName,
      declaredMimeType: 'text/plain',
      bytes: Buffer.from(dto.text, 'utf8'),
    });
  }

  /**
   * Validates, stores and de-duplicates the file, then queues background processing
   * (text -> AI extraction -> validation -> awaiting review). Responds 202 with the document.
   */
  private async receive(
    org: OrgContext,
    actor: Actor,
    file: { fileName: string; declaredMimeType: string; bytes: Buffer },
  ) {
    await this.docAi.assertAiEnabled(org.organizationId);
    const { document, duplicate } = await this.intake.intake({ organizationId: org.organizationId, userId: actor.userId!, ...file });
    return { ...(await this.docAi.getDocument(org.organizationId, document.id)), duplicate };
  }

  @Post('documents/:docId/retry')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermission('invoice.create')
  async retryDocument(@CurrentOrg() org: OrgContext, @Param('docId', ParseUUIDPipe) docId: string) {
    await this.pipeline.retryDocument(org.organizationId, docId);
    return this.docAi.getDocument(org.organizationId, docId);
  }

  /** Create the contact proposed for an unmatched supplier/customer; the document is then re-analysed. */
  @Post('documents/:docId/proposed-contact')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermission('contact.create')
  async acceptProposedContact(
    @CurrentOrg() org: OrgContext,
    @CurrentActor() actor: Actor,
    @Param('docId', ParseUUIDPipe) docId: string,
    @Body() dto: AcceptProposedContactDto,
  ) {
    const contact = await this.pipeline.acceptProposedContact(org.organizationId, docId, actor, dto);
    return { contact, document: await this.docAi.getDocument(org.organizationId, docId) };
  }

  /** Dead-letter queue: jobs that failed permanently or ran out of retries. */
  @Get('jobs/dead')
  @RequirePermission('ai.manage')
  listDeadJobs(@CurrentOrg() org: OrgContext) {
    return this.pipeline.listDeadJobs(org.organizationId);
  }

  @Post('jobs/:jobId/requeue')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermission('ai.manage')
  requeueJob(@CurrentOrg() org: OrgContext, @Param('jobId', ParseUUIDPipe) jobId: string) {
    return this.pipeline.requeueDeadJob(org.organizationId, jobId);
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

  /** Review queue: documents awaiting a person, sorted by confidence (sort key only). */
  @Get('review-queue')
  @RequirePermission('invoice.view')
  reviewQueue(@CurrentOrg() org: OrgContext, @Query() query: ReviewQueueQueryDto) {
    return this.review.queue(org.organizationId, query.sort);
  }

  /** Fields with status, source quote and position on the document, plus the document's pages. */
  @Get('documents/:docId/review')
  @RequirePermission('invoice.view')
  getReview(@CurrentOrg() org: OrgContext, @Param('docId', ParseUUIDPipe) docId: string) {
    return this.review.review(org.organizationId, docId);
  }

  @Get('documents/:docId/file')
  @RequirePermission('invoice.view')
  async getFile(@CurrentOrg() org: OrgContext, @Param('docId', ParseUUIDPipe) docId: string, @Res() res: Response) {
    const file = await this.review.file(org.organizationId, docId);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${file.fileName.replace(/["\r\n]/g, '')}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(file.body);
  }

  /** Approve with the reviewer's final values (every field editable). */
  @Post('documents/:docId/review/approve')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('ai_draft.approve')
  approveReviewed(
    @CurrentOrg() org: OrgContext,
    @CurrentActor() actor: Actor,
    @Param('docId', ParseUUIDPipe) docId: string,
    @Body() dto: ApproveReviewedDto,
  ) {
    return this.review.approve(org.organizationId, docId, dto, org, actor);
  }

  /** Approve the AI values as they are (same rules as a reviewed approval). */
  @Post('documents/:docId/approve')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('ai_draft.approve')
  async approveSuggestion(
    @CurrentOrg() org: OrgContext,
    @CurrentActor() actor: Actor,
    @Param('docId', ParseUUIDPipe) docId: string,
    @Body() dto: ApproveSuggestionDto,
  ) {
    const reviewed = await this.review.fromSuggestion(org.organizationId, docId, dto.contactId);
    return this.review.approve(org.organizationId, docId, reviewed, org, actor);
  }

  /** Approve with a different contact and/or accounts per line. */
  @Post('documents/:docId/edit')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('ai_draft.approve')
  async editAndApprove(
    @CurrentOrg() org: OrgContext,
    @CurrentActor() actor: Actor,
    @Param('docId', ParseUUIDPipe) docId: string,
    @Body() dto: EditAndApproveDto,
  ) {
    const accounts = new Map(dto.lines.map((l) => [l.lineNumber, l.accountId]));
    const reviewed = await this.review.fromSuggestion(org.organizationId, docId, dto.contactId, accounts);
    return this.review.approve(org.organizationId, docId, reviewed, org, actor);
  }

  @Post('documents/:docId/reject')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('ai_draft.approve')
  async rejectSuggestion(
    @CurrentOrg() org: OrgContext,
    @CurrentActor() actor: Actor,
    @Param('docId', ParseUUIDPipe) docId: string,
    @Body() dto: RejectSuggestionDto,
  ) {
    return this.review.reject(org.organizationId, docId, dto.reason, actor);
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
