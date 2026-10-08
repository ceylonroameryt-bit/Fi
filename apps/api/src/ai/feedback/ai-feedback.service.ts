import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface RecordFeedbackInput {
  organizationId: string;
  suggestionId?: string;
  supplierOrCustomerId?: string;
  productPattern: string;
  originalClassification: string;
  correctedClassification: string;
  correctedAccountId?: string;
  correctedById: string;
}

@Injectable()
export class AiFeedbackService {
  constructor(private readonly db: PrismaService) {}

  async recordFeedback(input: RecordFeedbackInput): Promise<void> {
    await this.db.aiFeedback.create({
      data: {
        organizationId: input.organizationId,
        suggestionId: input.suggestionId,
        supplierOrCustomerId: input.supplierOrCustomerId,
        productPattern: input.productPattern,
        originalClassification: input.originalClassification,
        correctedClassification: input.correctedClassification,
        correctedAccountId: input.correctedAccountId,
        correctedById: input.correctedById,
      },
    });
  }

  async getRecentFeedback(organizationId: string, limit = 20) {
    return this.db.aiFeedback.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        correctedBy: {
          select: { firstName: true, lastName: true, email: true },
        },
      },
    });
  }
}
