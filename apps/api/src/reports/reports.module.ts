import { Module } from '@nestjs/common';
import { TrialBalanceService } from './trial-balance.service';
import { ProfitAndLossService } from './profit-and-loss.service';
import { BalanceSheetService } from './balance-sheet.service';
import { ArApAgeingService } from './ar-ap-ageing.service';
import { ReportsController } from './reports.controller';

@Module({
  controllers: [ReportsController],
  providers: [TrialBalanceService, ProfitAndLossService, BalanceSheetService, ArApAgeingService],
  exports: [TrialBalanceService, ProfitAndLossService, BalanceSheetService, ArApAgeingService],
})
export class ReportsModule {}
