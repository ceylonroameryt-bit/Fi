import { Module } from '@nestjs/common';
import { CreditNotesController } from './credit-notes.controller';
import { CreditNotesService } from './credit-notes.service';
import { TaxModule } from '../tax/tax.module';

@Module({
  controllers: [CreditNotesController],
  imports: [TaxModule],
  providers: [CreditNotesService],
  exports: [CreditNotesService],
})
export class CreditNotesModule {}
