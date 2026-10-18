import { Module } from '@nestjs/common';
import { TaxController } from './tax.controller';
import { TaxCodesService } from './tax-codes.service';
import { VatReturnService } from './vat-return.service';
import { VatSchemesService } from './vat-schemes.service';

@Module({
  controllers: [TaxController],
  providers: [TaxCodesService, VatReturnService, VatSchemesService],
  exports: [TaxCodesService, VatReturnService, VatSchemesService],
})
export class TaxModule {}
