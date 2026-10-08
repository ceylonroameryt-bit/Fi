import { Module } from '@nestjs/common';
import { TrialBalanceService } from './trial-balance.service';
import { ProfitAndLossService } from './profit-and-loss.service';
import { BalanceSheetService } from './balance-sheet.service';
import { ReportsController } from './reports.controller';

@Module({
  controllers: [ReportsController],
  providers: [TrialBalanceService, ProfitAndLossService, BalanceSheetService],
  exports: [TrialBalanceService, ProfitAndLossService, BalanceSheetService],
})
export class ReportsModule {}
