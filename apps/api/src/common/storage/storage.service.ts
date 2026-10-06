import { Injectable } from '@nestjs/common';
import type {
  IStorageService,
  PutObjectInput,
  PutObjectResult,
  GetObjectResult,
  PresignedUrlInput,
  PresignedUrlResult,
  DeleteObjectResult,
} from './storage.types';

export const STORAGE_SERVICE = 'STORAGE_SERVICE';

@Injectable()
export abstract class StorageService implements IStorageService {
  abstract putObject(input: PutObjectInput): Promise<PutObjectResult>;
  abstract getObject(key: string): Promise<GetObjectResult>;
  abstract getPresignedUrl(input: PresignedUrlInput): Promise<PresignedUrlResult>;
  abstract deleteObject(key: string): Promise<DeleteObjectResult>;
  abstract exists(key: string): Promise<boolean>;
}
