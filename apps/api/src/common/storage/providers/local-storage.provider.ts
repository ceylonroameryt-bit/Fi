import { Injectable } from '@nestjs/common';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
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

@Injectable()
export class LocalStorageProvider extends StorageService {
  private readonly baseDir: string;

  constructor(baseDir?: string) {
    super();
    this.baseDir = baseDir || path.resolve(process.cwd(), 'uploads');
  }

  private resolvePath(key: string): string {
    const safeKey = key.replace(/\.\./g, '').replace(/^\/+/, '');
    return path.join(this.baseDir, safeKey);
  }

  async putObject(input: PutObjectInput): Promise<PutObjectResult> {
    const filePath = this.resolvePath(input.key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    let data: Buffer;
    if (Buffer.isBuffer(input.body)) {
      data = input.body;
    } else if (typeof input.body === 'string') {
      data = Buffer.from(input.body, 'utf-8');
    } else if (input.body instanceof Uint8Array) {
      data = Buffer.from(input.body);
    } else if (input.body instanceof Readable) {
      const chunks: Buffer[] = [];
      for await (const chunk of input.body) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      data = Buffer.concat(chunks);
    } else {
      throw new Error('Unsupported body type for LocalStorageProvider');
    }

    await fs.writeFile(filePath, data);
    return { key: input.key };
  }

  async getObject(key: string): Promise<GetObjectResult> {
    const filePath = this.resolvePath(key);
    try {
      const data = await fs.readFile(filePath);
      const stat = await fs.stat(filePath);
      return {
        key,
        body: data,
        contentLength: stat.size,
        lastModified: stat.mtime,
      };
    } catch (err: unknown) {
      const nodeErr = err as NodeJS.ErrnoException;
      if (nodeErr.code === 'ENOENT') {
        throw new Error(`File not found: ${key}`);
      }
      throw err;
    }
  }

  async getPresignedUrl(input: PresignedUrlInput): Promise<PresignedUrlResult> {
    const expiresInSeconds = input.expiresInSeconds ?? 900;
    const fakeUrl = `http://localhost:4000/api/v1/storage/local/${encodeURIComponent(input.key)}`;
    return {
      url: fakeUrl,
      key: input.key,
      expiresInSeconds,
    };
  }

  async deleteObject(key: string): Promise<DeleteObjectResult> {
    const filePath = this.resolvePath(key);
    try {
      await fs.unlink(filePath);
      return { key, deleted: true };
    } catch (err: unknown) {
      const nodeErr = err as NodeJS.ErrnoException;
      if (nodeErr.code === 'ENOENT') {
        return { key, deleted: false };
      }
      throw err;
    }
  }

  async exists(key: string): Promise<boolean> {
    const filePath = this.resolvePath(key);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
