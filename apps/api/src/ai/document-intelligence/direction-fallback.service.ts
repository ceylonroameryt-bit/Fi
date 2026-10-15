import { Inject, Injectable, Optional } from '@nestjs/common';
import { AiDirection } from '@prisma/client';
import { AiGatewayService } from '../gateway/ai-gateway.service';
import { AI_PROVIDER, AiProvider } from '../gateway/ai-provider.interface';
import { DIRECTION_PROMPT } from '../gateway/prompts/direction.prompt';
import { buildDocumentBlock } from '../extraction/llm-extraction.service';
import type { OrganisationIdentity } from '../identity/party-identity';
import type { DirectionResolutionResult } from './transaction-direction.service';

/** A model-suggested direction is always low confidence: the reviewer must confirm it. */
const MODEL_CONFIDENCE = 0.6;

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Asks the model for sales vs purchase only when the identity rules found nothing to go on
 * (basis NONE). The answer is kept only if its evidence quote is really on the document.
 */
@Injectable()
export class DirectionFallbackService {
  constructor(
    private readonly gateway: AiGatewayService,
    @Optional() @Inject(AI_PROVIDER) private readonly provider: AiProvider | null,
  ) {}

  async decide(input: {
    organizationId: string;
    userId?: string | null;
    documentId: string;
    text: string;
    organisation: OrganisationIdentity;
    rules: DirectionResolutionResult;
  }): Promise<DirectionResolutionResult> {
    const { rules } = input;
    if (rules.direction !== AiDirection.UNKNOWN || rules.basis !== 'NONE' || !this.provider) return rules;

    const { nonce, document } = buildDocumentBlock(input.text);
    const v = (x: string | null | undefined) => x || '(not set)';
    const answer = await this.gateway.run({
      organizationId: input.organizationId,
      userId: input.userId,
      documentId: input.documentId,
      prompt: DIRECTION_PROMPT,
      vars: {
        organisation: `Name: ${v(input.organisation.name)}\nLegal name: ${v(input.organisation.legalName)}\nVAT number: ${v(input.organisation.taxNumber)}\nCompany number: ${v(input.organisation.registrationNumber)}`,
        nonce,
        document,
      },
    });

    const evidenceOnDocument = !!answer.evidence && norm(input.text).includes(norm(answer.evidence));
    if (answer.direction === 'UNKNOWN' || !evidenceOnDocument) {
      return {
        ...rules,
        reasoning: `${rules.reasoning} AI fallback could not decide${answer.evidence && !evidenceOnDocument ? ' (its evidence is not on the document)' : ''}.`,
      };
    }
    return {
      direction: answer.direction === 'PURCHASE' ? AiDirection.PURCHASE : AiDirection.SALE,
      confidence: MODEL_CONFIDENCE,
      basis: 'MODEL',
      reasoning: `Suggested by AI (reviewer must confirm): ${answer.reason} Evidence: "${answer.evidence}".`,
    };
  }
}
