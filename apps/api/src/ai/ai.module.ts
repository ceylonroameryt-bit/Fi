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
import { Logger } from '@nestjs/common';
import { APP_CONFIG } from '../config/config.module';
import type { AppEnv } from '../config/env';
import { AI_PROVIDER, AiProvider } from './gateway/ai-provider.interface';
import { AnthropicAiProvider } from './gateway/providers/anthropic.provider';
import { FakeAiProvider } from './gateway/providers/fake.provider';
import { AiGatewayService } from './gateway/ai-gateway.service';
import { AiUsageService } from './gateway/ai-usage.service';
import { BusinessProfileService } from './business-profile/business-profile.service';
import { BusinessProfileScheduler } from './business-profile/business-profile.scheduler';
import { AiGatewayController } from './ai-gateway.controller';

/** Picks the model provider from AI_PROVIDER; null means AI calls are blocked (and logged as such). */
function createAiProvider(config: AppEnv): AiProvider | null {
  switch (config.AI_PROVIDER) {
    case 'anthropic':
      try {
        return new AnthropicAiProvider();
      } catch (err) {
        new Logger('AiModule').error(`Anthropic provider unavailable: ${(err as Error).message}`);
        return null;
      }
    case 'fake':
      return new FakeAiProvider();
    default:
      return null;
  }
}

@Module({
  imports: [DatabaseModule, StorageModule, AccountingEngineModule],
  controllers: [DocumentIntelligenceController, AiGatewayController],
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
    { provide: AI_PROVIDER, inject: [APP_CONFIG], useFactory: createAiProvider },
    AiGatewayService,
    AiUsageService,
    BusinessProfileService,
    BusinessProfileScheduler,
  ],
  exports: [
    DocumentIntelligenceService,
    BusinessContextService,
    AccountingClassificationService,
    AiGatewayService,
    BusinessProfileService,
  ],
})
export class AiModule {}
