import { Module, Global } from '@nestjs/common';
import { StorageService, STORAGE_SERVICE } from './storage.service';
import { LocalStorageProvider } from './providers/local-storage.provider';
import { S3StorageProvider } from './providers/s3-storage.provider';

@Global()
@Module({
  providers: [
    {
      provide: StorageService,
      useFactory: () => {
        const driver = process.env.STORAGE_DRIVER || 'local';
        if (driver === 's3') {
          return new S3StorageProvider();
        }
        return new LocalStorageProvider();
      },
    },
    {
      provide: STORAGE_SERVICE,
      useExisting: StorageService,
    },
  ],
  exports: [StorageService, STORAGE_SERVICE],
})
export class StorageModule {}
