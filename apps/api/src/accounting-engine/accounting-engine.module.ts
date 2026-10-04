import { Global, Module } from '@nestjs/common';
import { MoneyService } from './money.service';
import { JournalValidationService } from './journal-validation.service';
import { JournalPostingService } from './journal-posting.service';
import { JournalReversalService } from './journal-reversal.service';
import { AccountingIntegrityService } from './accounting-integrity.service';
import { AccountingIntegrityController } from './accounting-integrity.controller';

@Global()
@Module({
  controllers: [AccountingIntegrityController],
  providers: [
    MoneyService,
    JournalValidationService,
    JournalPostingService,
    JournalReversalService,
    AccountingIntegrityService,
  ],
  exports: [
    MoneyService,
    JournalValidationService,
    JournalPostingService,
    JournalReversalService,
    AccountingIntegrityService,
  ],
})
export class AccountingEngineModule {}
