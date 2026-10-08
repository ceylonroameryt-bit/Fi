import { Injectable } from '@nestjs/common';
import { AiConfidenceLevel } from '@prisma/client';

export type PolicyAction = 'AUTO_DRAFT' | 'REQUIRE_HUMAN_REVIEW' | 'FLAG_FOR_AUDIT';

@Injectable()
export class AiActionPolicyService {
  determineAction(confidenceLevel: AiConfidenceLevel, hasArchivedEntity: boolean): PolicyAction {
    if (hasArchivedEntity) {
      return 'REQUIRE_HUMAN_REVIEW';
    }

    switch (confidenceLevel) {
      case AiConfidenceLevel.HIGH:
        return 'AUTO_DRAFT';
      case AiConfidenceLevel.MEDIUM:
      case AiConfidenceLevel.LOW:
      default:
        return 'REQUIRE_HUMAN_REVIEW';
    }
  }
}
