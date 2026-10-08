import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class AiAuditService {
  constructor(private readonly db: PrismaService) {}

  async logEvent(
    organizationId: string,
    documentId: string,
    action:
      | 'REQUESTED'
      | 'EXTRACTED'
      | 'CLASSIFIED'
      | 'SUGGESTED'
      | 'REVIEWED'
      | 'APPROVED'
      | 'REJECTED'
      | 'CORRECTED'
      | 'DRAFTED'
      | 'POSTED',
    actorId?: string,
    payload?: Record<string, unknown>,
  ): Promise<void> {
    await this.db.aiAuditEvent.create({
      data: {
        organizationId,
        documentId,
        action,
        actorId,
        payload: payload as Prisma.InputJsonValue,
      },
    });
  }
}
