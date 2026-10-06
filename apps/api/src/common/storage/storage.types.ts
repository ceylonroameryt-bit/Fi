import { Readable } from 'node:stream';

export interface PutObjectInput {
  key: string;
  body: Buffer | Uint8Array | string | Readable;
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface PutObjectResult {
  key: string;
  eTag?: string;
  versionId?: string;
}

export interface GetObjectResult {
  key: string;
  body: Buffer;
  contentType?: string;
  contentLength?: number;
  lastModified?: Date;
  metadata?: Record<string, string>;
}

export interface PresignedUrlInput {
  key: string;
  operation: 'getObject' | 'putObject';
  expiresInSeconds?: number;
  contentType?: string;
}

export interface PresignedUrlResult {
  url: string;
  key: string;
  expiresInSeconds: number;
}

export interface DeleteObjectResult {
  key: string;
  deleted: boolean;
}

export interface IStorageService {
  putObject(input: PutObjectInput): Promise<PutObjectResult>;
  getObject(key: string): Promise<GetObjectResult>;
  getPresignedUrl(input: PresignedUrlInput): Promise<PresignedUrlResult>;
  deleteObject(key: string): Promise<DeleteObjectResult>;
  exists(key: string): Promise<boolean>;
}
