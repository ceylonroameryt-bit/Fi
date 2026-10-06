import { Injectable } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'node:stream';
import { StorageService } from '../storage.service';
import type {
  PutObjectInput,
  PutObjectResult,
  GetObjectResult,
  PresignedUrlInput,
  PresignedUrlResult,
  DeleteObjectResult,
} from '../storage.types';

export interface S3StorageConfig {
  bucketName: string;
  region?: string;
  endpoint?: string;
  forcePathStyle?: boolean;
}

@Injectable()
export class S3StorageProvider extends StorageService {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;

  constructor(config?: Partial<S3StorageConfig>) {
    super();
    this.bucketName =
      config?.bucketName || process.env.AWS_S3_BUCKET_NAME || 'blynt-dev-documents';
    const region = config?.region || process.env.AWS_REGION || 'eu-west-2';

    this.s3Client = new S3Client({
      region,
      ...(config?.endpoint ? { endpoint: config.endpoint } : {}),
      ...(config?.forcePathStyle !== undefined
        ? { forcePathStyle: config.forcePathStyle }
        : {}),
    });
  }

  async putObject(input: PutObjectInput): Promise<PutObjectResult> {
    let bodyData: Buffer | Uint8Array | string | Readable;

    if (input.body instanceof Uint8Array || Buffer.isBuffer(input.body)) {
      bodyData = input.body;
    } else if (typeof input.body === 'string') {
      bodyData = Buffer.from(input.body, 'utf-8');
    } else if (input.body instanceof Readable) {
      bodyData = input.body;
    } else {
      throw new Error('Unsupported body type for S3 upload');
    }

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: input.key,
      Body: bodyData,
      ContentType: input.contentType,
      Metadata: input.metadata,
      ServerSideEncryption: 'AES256',
    });

    const response = await this.s3Client.send(command);
    return {
      key: input.key,
      eTag: response.ETag,
      versionId: response.VersionId,
    };
  }

  async getObject(key: string): Promise<GetObjectResult> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    const response = await this.s3Client.send(command);

    if (!response.Body) {
      throw new Error(`Empty body returned for S3 object: ${key}`);
    }

    // Convert S3 Body stream to Buffer
    const stream = response.Body as Readable;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const bodyBuffer = Buffer.concat(chunks);

    return {
      key,
      body: bodyBuffer,
      contentType: response.ContentType,
      contentLength: response.ContentLength,
      lastModified: response.LastModified,
      metadata: response.Metadata,
    };
  }

  async getPresignedUrl(input: PresignedUrlInput): Promise<PresignedUrlResult> {
    const expiresIn = input.expiresInSeconds ?? 900;

    let command: GetObjectCommand | PutObjectCommand;
    if (input.operation === 'putObject') {
      command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: input.key,
        ContentType: input.contentType,
      });
    } else {
      command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: input.key,
      });
    }

    const url = await getSignedUrl(this.s3Client, command, {
      expiresIn,
    });

    return {
      url,
      key: input.key,
      expiresInSeconds: expiresIn,
    };
  }

  async deleteObject(key: string): Promise<DeleteObjectResult> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    await this.s3Client.send(command);
    return {
      key,
      deleted: true,
    };
  }

  async exists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });
      await this.s3Client.send(command);
      return true;
    } catch (err: unknown) {
      const s3Error = err as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (s3Error.name === 'NotFound' || s3Error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw err;
    }
  }
}
