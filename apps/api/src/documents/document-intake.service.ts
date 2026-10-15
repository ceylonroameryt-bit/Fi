import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { AiDocument, AiDocumentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { StorageService } from '../common/storage/storage.service';
import { DomainException } from '../common/errors/domain.exception';
import { APP_CONFIG } from '../config/config.module';
import type { AppEnv } from '../config/env';
import { detectFileType, EXTENSION_FOR } from './file-type';
import { JobQueueService } from '../jobs/job-queue.service';
import { DOCUMENT_JOB } from './document-jobs';

export interface IntakeInput {
  organizationId: string;
  userId: string;
  fileName: string;
  /** What the client claimed; checked against the detected type, never trusted. */
  declaredMimeType: string;
  bytes: Buffer;
}

export interface IntakeResult {
  document: AiDocument;
  duplicate: boolean;
}

/** Client types we accept as "no claim" (browsers send these for unknown files). */
const UNSPECIFIED_TYPES = new Set(['', 'application/octet-stream']);

/**
 * Receives an uploaded document: validates size and real type, stores it privately under the
 * organisation's prefix, de-duplicates by content hash, and queues text extraction.
 */
@Injectable()
export class DocumentIntakeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly queue: JobQueueService,
    @Inject(APP_CONFIG) private readonly config: Pick<AppEnv, 'DOCUMENT_MAX_BYTES'>,
  ) {}

  async intake(input: IntakeInput): Promise<IntakeResult> {
    const { organizationId, bytes } = input;
    if (bytes.length === 0) throw new DomainException('DOCUMENT_EMPTY', 'The uploaded file is empty');
    if (bytes.length > this.config.DOCUMENT_MAX_BYTES) {
      throw new DomainException('DOCUMENT_TOO_LARGE', `Files must be at most ${this.config.DOCUMENT_MAX_BYTES} bytes`);
    }

    const mimeType = detectFileType(bytes);
    if (!mimeType) {
      throw new DomainException('DOCUMENT_TYPE_UNSUPPORTED', 'Only PDF, JPEG, PNG, TIFF and plain-text documents are accepted');
    }
    const declared = input.declaredMimeType.split(';')[0].trim().toLowerCase();
    if (!UNSPECIFIED_TYPES.has(declared) && declared !== mimeType) {
      throw new DomainException('DOCUMENT_TYPE_MISMATCH', `File content is ${mimeType} but was sent as ${declared}`);
    }

    const contentSha256 = createHash('sha256').update(bytes).digest('hex');
    const existing = await this.findByHash(organizationId, contentSha256);
    if (existing) return { document: existing, duplicate: true };

    // Random key under the organisation prefix: no user-controlled path segments.
    const fileKey = `orgs/${organizationId}/documents/${randomUUID()}${EXTENSION_FOR[mimeType]}`;
    await this.storage.putObject({ key: fileKey, body: bytes, contentType: mimeType, metadata: { sha256: contentSha256 } });

    let document: AiDocument;
    try {
      // Document row and its first pipeline job are created together.
      document = await this.prisma.transaction(async (tx) => {
        const created = await tx.aiDocument.create({
          data: {
            organizationId,
            fileKey,
            fileName: safeFileName(input.fileName),
            fileSize: bytes.length,
            mimeType,
            contentSha256,
            createdById: input.userId,
            status: AiDocumentStatus.UPLOADED,
          },
        });
        await this.queue.enqueue(
          {
            organizationId,
            type: DOCUMENT_JOB.EXTRACT_TEXT,
            payload: { documentId: created.id },
            idempotencyKey: `${DOCUMENT_JOB.EXTRACT_TEXT}:${created.id}:initial`,
          },
          tx,
        );
        return created;
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        // Same file uploaded concurrently: keep the first, drop our copy.
        await this.storage.deleteObject(fileKey).catch(() => undefined);
        const winner = await this.findByHash(organizationId, contentSha256);
        if (winner) return { document: winner, duplicate: true };
      }
      throw err;
    }

    return { document, duplicate: false };
  }

  private findByHash(organizationId: string, contentSha256: string) {
    return this.prisma.aiDocument.findUnique({
      where: { organizationId_contentSha256: { organizationId, contentSha256 } },
    });
  }
}

/** Display name only: strip any path, control characters, and cap the length. */
export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? '';
  // eslint-disable-next-line no-control-regex
  const clean = base.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return (clean || 'document').slice(0, 255);
}
