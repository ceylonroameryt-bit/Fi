import { Global, Module } from '@nestjs/common';
import { FinancialYearsController } from './financial-years.controller';
import { FinancialYearsService } from './financial-years.service';
import { AccountingPeriodsController } from '../accounting-periods/accounting-periods.controller';

@Global()
@Module({
  controllers: [FinancialYearsController, AccountingPeriodsController],
  providers: [FinancialYearsService],
  exports: [FinancialYearsService],
})
export class FinancialYearsModule {}
