import { Module } from '@nestjs/common';
import { TrialBalanceService } from './trial-balance.service';
import { ReportsController } from './reports.controller';

@Module({
  controllers: [ReportsController],
  providers: [TrialBalanceService],
  exports: [TrialBalanceService],
})
export class ReportsModule {}
