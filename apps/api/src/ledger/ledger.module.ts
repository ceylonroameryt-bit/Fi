import { Module } from '@nestjs/common';
import { GeneralLedgerService } from './general-ledger.service';
import { LedgerController } from './ledger.controller';

@Module({
  controllers: [LedgerController],
  providers: [GeneralLedgerService],
  exports: [GeneralLedgerService],
})
export class LedgerModule {}
