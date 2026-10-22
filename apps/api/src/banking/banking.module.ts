import { Module } from '@nestjs/common';
import { TaxModule } from '../tax/tax.module';
import { BankAccountsController } from './bank-accounts.controller';
import { BankAccountsService } from './bank-accounts.service';
import { BankStatementsController } from './bank-statements.controller';
import { StatementImportService } from './statement-import.service';
import { BankRulesController } from './bank-rules.controller';
import { BankRulesService } from './bank-rules.service';
import { BankReconciliationService } from './bank-reconciliation.service';
import { BankAiCategorisationService } from './bank-ai-categorisation.service';

@Module({
  imports: [TaxModule],
  controllers: [
    BankAccountsController,
    BankStatementsController,
    BankRulesController,
  ],
  providers: [
    BankAccountsService,
    StatementImportService,
    BankRulesService,
    BankReconciliationService,
    BankAiCategorisationService,
  ],
  exports: [
    BankAccountsService,
    StatementImportService,
    BankRulesService,
    BankReconciliationService,
    BankAiCategorisationService,
  ],
})
export class BankingModule {}
