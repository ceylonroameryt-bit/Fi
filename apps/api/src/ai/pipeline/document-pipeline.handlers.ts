import { Injectable, OnModuleInit } from '@nestjs/common';
import { AiDocumentStatus, Job, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { StorageService } from '../../common/storage/storage.service';
import { JobQueueService } from '../../jobs/job-queue.service';
import { JobFailure, JobHandler, JobWorkerService, PermanentJobError } from '../../jobs/job-worker.service';
import { DocumentTextService } from '../../documents/document-text.service';
import { DOCUMENT_JOB } from '../../documents/document-jobs';
import { detectFileType } from '../../documents/file-type';
import { DocumentIntelligenceService } from '../document-intelligence/document-intelligence.service';

interface DocumentJobPayload {
  documentId: string;
}

/** States from which analysis may (re)start; partial results from an interrupted run are discarded. */
const ANALYSABLE: AiDocumentStatus[] = [AiDocumentStatus.TEXT_EXTRACTED, AiDocumentStatus.AI_EXTRACTED, AiDocumentStatus.VALIDATED];

/** Marks a document FAILED with a machine-readable reason (used when its job is dead-lettered). */
async function failDocument(prisma: PrismaService, job: Job, failure: JobFailure) {
  const { documentId } = job.payload as unknown as DocumentJobPayload;
  await prisma.aiDocument.updateMany({
    where: { id: documentId, organizationId: job.organizationId, status: { notIn: [AiDocumentStatus.DRAFT_CREATED, AiDocumentStatus.REJECTED] } },
    data: { status: AiDocumentStatus.FAILED, failureCode: failure.code.slice(0, 64), errorMessage: failure.message.slice(0, 500) },
  });
}

/** UPLOADED -> TEXT_EXTRACTED. */
@Injectable()
export class ExtractTextJobHandler implements JobHandler, OnModuleInit {
  readonly type = DOCUMENT_JOB.EXTRACT_TEXT;
  readonly rateLimited = true;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly text: DocumentTextService,
    private readonly queue: JobQueueService,
    private readonly worker: JobWorkerService,
  ) {}

  onModuleInit(): void {
    this.worker.register(this);
  }

  async handle(job: Job): Promise<void> {
    const { documentId } = job.payload as unknown as DocumentJobPayload;
    const doc = await this.prisma.aiDocument.findFirst({ where: { id: documentId, organizationId: job.organizationId } });
    if (!doc) throw new PermanentJobError('DOCUMENT_NOT_FOUND', `Document ${documentId} not found`);
    if (doc.status !== AiDocumentStatus.UPLOADED) return; // already done by an earlier attempt

    const bytes = (await this.storage.getObject(doc.fileKey)).body; // transient storage errors are retried
    const mimeType = detectFileType(bytes);
    if (!mimeType) throw new PermanentJobError('DOCUMENT_TYPE_UNSUPPORTED', 'Stored file is not a supported type');
    const result = await this.text.extract(bytes, mimeType); // OCR_UNAVAILABLE etc. are permanent

    await this.prisma.transaction(async (tx) => {
      const moved = await tx.aiDocument.updateMany({
        where: { id: doc.id, status: AiDocumentStatus.UPLOADED },
        data: {
          status: AiDocumentStatus.TEXT_EXTRACTED,
          textSource: result.source,
          extractedText: result.text,
          pageCount: result.pages.length,
        },
      });
      if (moved.count === 0) return; // another worker got there first
      await tx.aiDocumentPage.deleteMany({ where: { documentId: doc.id } });
      await tx.aiDocumentPage.createMany({
        data: result.pages.map((p) => ({
          organizationId: doc.organizationId,
          documentId: doc.id,
          pageNumber: p.pageNumber,
          width: p.width,
          height: p.height,
          words: p.words as unknown as Prisma.InputJsonValue,
          text: p.text,
        })),
      });
      await this.queue.enqueue(
        {
          organizationId: doc.organizationId,
          type: DOCUMENT_JOB.ANALYSE,
          payload: { documentId: doc.id },
          idempotencyKey: `${DOCUMENT_JOB.ANALYSE}:${doc.id}:${job.id}`,
        },
        tx,
      );
    });
  }

  onDead(job: Job, failure: JobFailure): Promise<void> {
    return failDocument(this.prisma, job, failure);
  }
}

/** TEXT_EXTRACTED -> AI_EXTRACTED -> VALIDATED -> AWAITING_REVIEW. */
@Injectable()
export class AnalyseDocumentJobHandler implements JobHandler, OnModuleInit {
  readonly type = DOCUMENT_JOB.ANALYSE;
  readonly rateLimited = true;

  constructor(
    private readonly prisma: PrismaService,
    private readonly docAi: DocumentIntelligenceService,
    private readonly worker: JobWorkerService,
  ) {}

  onModuleInit(): void {
    this.worker.register(this);
  }

  async handle(job: Job): Promise<void> {
    const { documentId } = job.payload as unknown as DocumentJobPayload;
    const doc = await this.prisma.aiDocument.findFirst({ where: { id: documentId, organizationId: job.organizationId } });
    if (!doc) throw new PermanentJobError('DOCUMENT_NOT_FOUND', `Document ${documentId} not found`);
    if (!ANALYSABLE.includes(doc.status)) return; // already analysed (or rejected/failed meanwhile)
    await this.docAi.processDocument(job.organizationId, documentId); // AI_DISABLED, cost limit etc. are permanent
  }

  onDead(job: Job, failure: JobFailure): Promise<void> {
    return failDocument(this.prisma, job, failure);
  }
}
