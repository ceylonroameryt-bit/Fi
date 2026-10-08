import { Injectable } from '@nestjs/common';
import { AiDirection, Contact, ContactType } from '@prisma/client';
import { RawExtractionResult } from '../providers/llm-provider.interface';

export interface DirectionResolutionResult {
  direction: AiDirection;
  confidence: number;
  priorityApplied: number;
  reasoning: string;
}

export interface OrganizationIdentity {
  name: string;
  legalName?: string | null;
  taxNumber?: string | null;
  registrationNumber?: string | null;
}

@Injectable()
export class TransactionDirectionService {
  resolveDirection(
    extracted: RawExtractionResult,
    org: OrganizationIdentity,
    resolvedEntity: Contact | null,
    llmInterpretationDirection?: 'PURCHASE' | 'SALE' | 'UNKNOWN',
  ): DirectionResolutionResult {
    const rawText = (extracted.rawText ?? '').toLowerCase();
    const orgNames = [org.name, org.legalName].filter(Boolean).map((n) => n!.toLowerCase().trim());

    const issuerName = (extracted.issuer?.name ?? '').toLowerCase().trim();
    const recipientName = (extracted.recipient?.name ?? '').toLowerCase().trim();

    // ──────────────── Priority 1: Legal Document Roles ────────────────
    // If the organisation itself is explicitly the issuer -> SALE
    const isOrgIssuer = orgNames.some(
      (on) => on && issuerName && (issuerName.includes(on) || on.includes(issuerName)),
    );
    if (isOrgIssuer && recipientName && !orgNames.some((on) => on && recipientName.includes(on))) {
      return {
        direction: AiDirection.SALE,
        confidence: 0.99,
        priorityApplied: 1,
        reasoning: `Priority 1 (Legal Document Roles): Organisation "${org.name}" is identified as the document issuer/seller.`,
      };
    }

    // If the organisation itself is explicitly the recipient / bill-to -> PURCHASE
    const isOrgRecipient = orgNames.some(
      (on) => on && recipientName && (recipientName.includes(on) || on.includes(recipientName)),
    );
    if (isOrgRecipient && issuerName && !orgNames.some((on) => on && issuerName.includes(on))) {
      return {
        direction: AiDirection.PURCHASE,
        confidence: 0.99,
        priorityApplied: 1,
        reasoning: `Priority 1 (Legal Document Roles): Organisation "${org.name}" is identified as the document recipient/buyer.`,
      };
    }

    // ──────────────── Priority 2: VAT / Business Identifiers ─────────────
    if (org.taxNumber) {
      const cleanOrgVat = org.taxNumber.replace(/[\s-]/g, '').toUpperCase();
      const issuerVat = extracted.issuer?.vatNumber?.replace(/[\s-]/g, '').toUpperCase();
      const recipientVat = extracted.recipient?.vatNumber?.replace(/[\s-]/g, '').toUpperCase();

      if (issuerVat && issuerVat === cleanOrgVat) {
        return {
          direction: AiDirection.SALE,
          confidence: 0.99,
          priorityApplied: 2,
          reasoning: `Priority 2 (VAT Identifier): Document issuer VAT (${issuerVat}) matches organisation VAT ID.`,
        };
      }

      if (recipientVat && recipientVat === cleanOrgVat) {
        return {
          direction: AiDirection.PURCHASE,
          confidence: 0.99,
          priorityApplied: 2,
          reasoning: `Priority 2 (VAT Identifier): Document recipient VAT (${recipientVat}) matches organisation VAT ID.`,
        };
      }
    }

    // ──────────────── Priority 3: Blynt Master Data ─────────────────────
    if (resolvedEntity) {
      if (resolvedEntity.type === ContactType.SUPPLIER) {
        return {
          direction: AiDirection.PURCHASE,
          confidence: 0.95,
          priorityApplied: 3,
          reasoning: `Priority 3 (Master Data): Matched entity "${resolvedEntity.name}" is designated as a Supplier in Blynt.`,
        };
      }
      if (resolvedEntity.type === ContactType.CUSTOMER) {
        return {
          direction: AiDirection.SALE,
          confidence: 0.95,
          priorityApplied: 3,
          reasoning: `Priority 3 (Master Data): Matched entity "${resolvedEntity.name}" is designated as a Customer in Blynt.`,
        };
      }
    }

    // ──────────────── Priority 4: Document Language ─────────────────────
    // Inspect headers such as "Bill To", "Customer", "Invoice To"
    for (const on of orgNames) {
      if (
        rawText.includes(`bill to: ${on}`) ||
        rawText.includes(`bill to:\n${on}`) ||
        rawText.includes(`invoice to: ${on}`) ||
        rawText.includes(`invoice to:\n${on}`) ||
        rawText.includes(`customer: ${on}`)
      ) {
        return {
          direction: AiDirection.PURCHASE,
          confidence: 0.9,
          priorityApplied: 4,
          reasoning: `Priority 4 (Document Language): Explicit billing clause ("Bill To / Invoice To") addresses organisation "${org.name}".`,
        };
      }
    }

    // ──────────────── Priority 5: LLM Interpretation ────────────────────
    if (llmInterpretationDirection && llmInterpretationDirection !== 'UNKNOWN') {
      return {
        direction: llmInterpretationDirection === 'PURCHASE' ? AiDirection.PURCHASE : AiDirection.SALE,
        confidence: 0.75,
        priorityApplied: 5,
        reasoning: `Priority 5 (LLM Interpretation): Heuristic/LLM context interpretation suggests ${llmInterpretationDirection}.`,
      };
    }

    // Fallback: If unknown, default to PURCHASE for vendor invoices with lower confidence requiring review
    return {
      direction: AiDirection.PURCHASE,
      confidence: 0.5,
      priorityApplied: 5,
      reasoning: 'Default purchase assumption with low confidence; human review mandatory.',
    };
  }
}
