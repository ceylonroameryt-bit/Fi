import { Injectable } from '@nestjs/common';
import { AiConfidenceLevel } from '@prisma/client';
import { HIGH_CONFIDENCE_THRESHOLD, MEDIUM_CONFIDENCE_THRESHOLD } from '../ai.constants';
import { EntityMatchResult } from './entity-resolution.service';
import { DirectionResolutionResult } from './transaction-direction.service';
import { ClassifiedLineResult } from './line-classification.service';
import { ProposedAccountingIntent } from './accounting-classification.service';

export interface ConfidenceEvaluationResult {
  score: number;
  level: AiConfidenceLevel;
  breakdown: {
    entityScore: number;
    directionScore: number;
    linesScore: number;
    balanceScore: number;
  };
  reasons: string[];
}

@Injectable()
export class ConfidenceService {
  evaluate(
    entityMatch: EntityMatchResult,
    directionResult: DirectionResolutionResult,
    classifiedLines: ClassifiedLineResult[],
    accountingIntent: ProposedAccountingIntent,
  ): ConfidenceEvaluationResult {
    const reasons: string[] = [];

    // 1. Entity Match Component (weight: 0.35)
    let entityScore = 0.1;
    if (entityMatch.matchType === 'EXACT_VAT' || entityMatch.matchType === 'EXACT_COMPANY_NO') {
      entityScore = 0.35;
      reasons.push('Verified tax or corporate registration ID match.');
    } else if (entityMatch.matchType === 'EXACT_NAME' || entityMatch.matchType === 'EMAIL') {
      entityScore = 0.3;
      reasons.push('Exact directory contact match.');
    } else if (entityMatch.matchType === 'FUZZY_NAME') {
      entityScore = 0.22;
      reasons.push('Fuzzy contact name match.');
    } else {
      reasons.push('Contact not registered in directory; manual verification recommended.');
    }

    // 2. Transaction Direction Component (weight: 0.30)
    let directionScore = 0.1;
    if (directionResult.priorityApplied <= 2) {
      directionScore = 0.3;
      reasons.push('Direction verified by legal document roles or VAT identity.');
    } else if (directionResult.priorityApplied === 3) {
      directionScore = 0.25;
      reasons.push('Direction aligned with existing supplier/customer master role.');
    } else if (directionResult.priorityApplied === 4) {
      directionScore = 0.2;
      reasons.push('Direction inferred from billing language clause.');
    } else {
      reasons.push('Direction inferred with lower confidence.');
    }

    // 3. Line Items Component (weight: 0.25)
    let avgLineConfidence = 0.8;
    if (classifiedLines.length > 0) {
      const sum = classifiedLines.reduce((acc, l) => acc + l.confidence, 0);
      avgLineConfidence = sum / classifiedLines.length;
    }
    const linesScore = parseFloat((avgLineConfidence * 0.25).toFixed(4));
    if (classifiedLines.some((l) => l.feedbackApplied)) {
      reasons.push('Historical accountant feedback applied to line classification.');
    }

    // 4. Mathematical Balance Component (weight: 0.10)
    let balanceScore = 0.0;
    if (accountingIntent.isBalanced) {
      balanceScore = 0.1;
      reasons.push('Proposed double-entry journal is mathematically balanced.');
    } else {
      reasons.push('Unbalanced debit/credit intent detected.');
    }

    const totalScore = parseFloat(
      Math.min(1.0, entityScore + directionScore + linesScore + balanceScore).toFixed(4),
    );

    let level: AiConfidenceLevel = AiConfidenceLevel.LOW;
    if (totalScore >= HIGH_CONFIDENCE_THRESHOLD) {
      level = AiConfidenceLevel.HIGH;
    } else if (totalScore >= MEDIUM_CONFIDENCE_THRESHOLD) {
      level = AiConfidenceLevel.MEDIUM;
    }

    return {
      score: totalScore,
      level,
      breakdown: {
        entityScore,
        directionScore,
        linesScore,
        balanceScore,
      },
      reasons,
    };
  }
}
