import { Logger, Module } from '@nestjs/common';
import { APP_CONFIG } from '../config/config.module';
import type { AppEnv } from '../config/env';
import { DocumentIntakeService } from './document-intake.service';
import { DocumentTextService } from './document-text.service';
import { OCR_PROVIDER, OcrProvider } from './ocr/ocr-provider.interface';
import { FakeOcrProvider } from './ocr/fake-ocr.provider';
import { TextractOcrProvider } from './ocr/textract-ocr.provider';

function createOcrProvider(config: AppEnv): OcrProvider | null {
  switch (config.OCR_PROVIDER) {
    case 'textract':
      try {
        return new TextractOcrProvider();
      } catch (err) {
        new Logger('DocumentsModule').error(`Textract unavailable: ${(err as Error).message}`);
        return null;
      }
    case 'fake':
      return new FakeOcrProvider();
    default:
      return null;
  }
}

/** Upload intake, private storage, de-duplication and text/word-position extraction. */
@Module({
  providers: [
    DocumentIntakeService,
    DocumentTextService,
    { provide: OCR_PROVIDER, inject: [APP_CONFIG], useFactory: createOcrProvider },
  ],
  exports: [DocumentIntakeService, DocumentTextService, OCR_PROVIDER],
})
export class DocumentsModule {}
