import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AiDocumentStatus, AiSuggestionStatus, ContactType, Job, JobStatus } from '@prisma/client';
import type { Actor } from '../../common/types/request-context.types';
import { ContactsService } from '../../contacts/contacts.service';
import type { CreateContactDto } from '../../contacts/dto/contact.dto';
import { AiAuditService } from '../audit/ai-audit.service';
import type { SuggestionPayload } from '../document-intelligence/document-intelligence.service';
import { PrismaService } from '../../database/prisma.service';
import { DomainException } from '../../common/errors/domain.exception';
import { JobQueueService } from '../../jobs/job-queue.service';
import { DOCUMENT_JOB } from '../../documents/document-jobs';

/** Status a document must be in for each job type to do its work. */
const ENTRY_STATUS: Record<string, AiDocumentStatus> = {
  [DOCUMENT_JOB.EXTRACT_TEXT]: AiDocumentStatus.UPLOADED,
  [DOCUMENT_JOB.ANALYSE]: AiDocumentStatus.TEXT_EXTRACTED,
};

/** Operator actions on the document pipeline: retry failed documents, inspect and requeue dead jobs. */
@Injectable()
export class DocumentPipelineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: JobQueueService,
    private readonly contacts: ContactsService,
    private readonly audit: AiAuditService,
  ) {}

  /**
   * A reviewer accepts the contact proposed for an unmatched supplier/customer. The contact is
   * created through ContactsService (normal validation and audit), then the document is analysed
   * again so it matches the new contact by its identifiers. Nothing is ever created automatically.
   */
  async acceptProposedContact(organizationId: string, documentId: string, actor: Actor, overrides: { name?: string } = {}) {
    const doc = await this.prisma.aiDocument.findFirst({ where: { id: documentId, organizationId } });
    if (!doc) throw new NotFoundException('Document not found');
    if (doc.status !== AiDocumentStatus.AWAITING_REVIEW) {
      throw new DomainException('CONFLICT', `Document is ${doc.status}, not awaiting review`);
    }
    const suggestion = await this.prisma.aiSuggestion.findFirst({
      where: { organizationId, documentId, status: AiSuggestionStatus.PENDING_REVIEW },
    });
    const proposed = (suggestion?.payload as unknown as SuggestionPayload | undefined)?.proposedContact;
    if (!suggestion || !proposed) throw new DomainException('CONFLICT', 'This document has no proposed contact');

    const contact = await this.contacts.createContact(
      organizationId,
      {
        type: proposed.type === 'SUPPLIER' ? ContactType.SUPPLIER : ContactType.CUSTOMER,
        name: overrides.name?.trim() || proposed.name,
        vatNumber: proposed.vatNumber,
        companyNumber: proposed.companyNumber,
      } as CreateContactDto,
      actor,
    );

    await this.prisma.transaction(async (tx) => {
      await tx.aiDocument.update({ where: { id: documentId }, data: { status: AiDocumentStatus.TEXT_EXTRACTED } });
      await this.queue.enqueue(
        {
          organizationId,
          type: DOCUMENT_JOB.ANALYSE,
          payload: { documentId },
          idempotencyKey: `${DOCUMENT_JOB.ANALYSE}:${documentId}:contact-${contact.id}`,
        },
        tx,
      );
    });
    await this.audit.logEvent(organizationId, documentId, 'REVIEWED', actor.userId ?? undefined, {
      action: 'PROPOSED_CONTACT_ACCEPTED',
      contactId: contact.id,
      proposed: proposed as unknown as Record<string, unknown>,
    });
    return contact;
  }

  listDeadJobs(organizationId: string) {
    return this.queue.listDead(organizationId);
  }

  /** Requeues a dead job; for document jobs the document is put back in the state the job expects. */
  async requeueDeadJob(organizationId: string, jobId: string): Promise<Job> {
    const job = await this.prisma.job.findFirst({ where: { id: jobId, organizationId, status: JobStatus.DEAD } });
    if (!job) throw new NotFoundException('Dead job not found in this organisation');
    await this.prisma.transaction(async (tx) => {
      const documentId = (job.payload as { documentId?: string }).documentId;
      const entry = ENTRY_STATUS[job.type];
      if (documentId && entry) {
        await tx.aiDocument.updateMany({
          where: { id: documentId, organizationId, status: AiDocumentStatus.FAILED },
          data: { status: entry, failureCode: null, errorMessage: null },
        });
      }
      await tx.job.update({
        where: { id: job.id },
        data: { status: JobStatus.QUEUED, attempts: 0, runAt: new Date(), finishedAt: null, lastError: null },
      });
    });
    return this.prisma.job.findUniqueOrThrow({ where: { id: job.id } });
  }

  /** Retry a FAILED document from the step that failed. */
  async retryDocument(organizationId: string, documentId: string) {
    const doc = await this.prisma.aiDocument.findFirst({ where: { id: documentId, organizationId } });
    if (!doc) throw new NotFoundException('Document not found');
    if (doc.status !== AiDocumentStatus.FAILED) {
      throw new DomainException('CONFLICT', `Only failed documents can be retried (status is ${doc.status})`);
    }

    const dead = await this.prisma.job.findFirst({
      where: { organizationId, status: JobStatus.DEAD, payload: { path: ['documentId'], equals: documentId } },
      orderBy: { finishedAt: 'desc' },
    });
    if (dead) return this.requeueDeadJob(organizationId, dead.id);

    // No dead job (e.g. failed before Stage 6): start again from the right step.
    const type = doc.textSource ? DOCUMENT_JOB.ANALYSE : DOCUMENT_JOB.EXTRACT_TEXT;
    await this.prisma.transaction(async (tx) => {
      await tx.aiDocument.update({
        where: { id: doc.id },
        data: { status: ENTRY_STATUS[type], failureCode: null, errorMessage: null },
      });
      await this.queue.enqueue(
        { organizationId, type, payload: { documentId }, idempotencyKey: `${type}:${documentId}:retry-${randomUUID()}` },
        tx,
      );
    });
    return null;
  }
}
