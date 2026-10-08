import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { StorageModule } from '../common/storage/storage.module';
import { AccountingEngineModule } from '../accounting-engine/accounting-engine.module';
import { BusinessContextService } from './business-context/business-context.service';
import { HeuristicLlmProvider } from './providers/heuristic-llm.provider';
import { DocumentClassifierService } from './document-intelligence/document-classifier.service';
import { EntityResolutionService } from './document-intelligence/entity-resolution.service';
import { TransactionDirectionService } from './document-intelligence/transaction-direction.service';
import { LineClassificationService } from './document-intelligence/line-classification.service';
import { TaxClassificationService } from './document-intelligence/tax-classification.service';
import { AccountingClassificationService } from './document-intelligence/accounting-classification.service';
import { ConfidenceService } from './document-intelligence/confidence.service';
import { AccountingSafetyService } from './guardrails/accounting-safety.service';
import { AiActionPolicyService } from './guardrails/ai-action-policy.service';
import { AiAuditService } from './audit/ai-audit.service';
import { AiFeedbackService } from './feedback/ai-feedback.service';
import { DocumentIntelligenceService } from './document-intelligence/document-intelligence.service';
import { DocumentIntelligenceController } from './document-intelligence.controller';

@Module({
  imports: [DatabaseModule, StorageModule, AccountingEngineModule],
  controllers: [DocumentIntelligenceController],
  providers: [
    BusinessContextService,
    HeuristicLlmProvider,
    DocumentClassifierService,
    EntityResolutionService,
    TransactionDirectionService,
    LineClassificationService,
    TaxClassificationService,
    AccountingClassificationService,
    ConfidenceService,
    AccountingSafetyService,
    AiActionPolicyService,
    AiAuditService,
    AiFeedbackService,
    DocumentIntelligenceService,
  ],
  exports: [DocumentIntelligenceService, BusinessContextService, AccountingClassificationService],
})
export class AiModule {}
