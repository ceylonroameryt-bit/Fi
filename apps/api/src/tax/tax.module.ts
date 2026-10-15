import { Module } from '@nestjs/common';
import { TaxController } from './tax.controller';
import { TaxCodesService } from './tax-codes.service';
import { VatReturnService } from './vat-return.service';

@Module({
  controllers: [TaxController],
  providers: [TaxCodesService, VatReturnService],
  exports: [TaxCodesService, VatReturnService],
})
export class TaxModule {}
