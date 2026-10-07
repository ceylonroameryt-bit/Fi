import { Module } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { ContactsController } from './contacts.controller';
import { ContactAccountValidationService } from './contact-account-validation.service';
import { ContactSubledgerService } from './contact-subledger.service';

@Module({
  controllers: [ContactsController],
  providers: [
    ContactsService,
    ContactAccountValidationService,
    ContactSubledgerService,
  ],
  exports: [
    ContactsService,
    ContactAccountValidationService,
    ContactSubledgerService,
  ],
})
export class ContactsModule {}
