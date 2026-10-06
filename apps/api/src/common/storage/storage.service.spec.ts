import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { LocalStorageProvider } from './providers/local-storage.provider';

describe('StorageService (LocalStorageProvider)', () => {
  let tempDir: string;
  let provider: LocalStorageProvider;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'blynt-storage-test-'));
    provider = new LocalStorageProvider(tempDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  it('should store and retrieve a buffer object', async () => {
    const key = 'invoices/org-123/inv-001.pdf';
    const content = Buffer.from('mock pdf content', 'utf-8');

    const putRes = await provider.putObject({
      key,
      body: content,
      contentType: 'application/pdf',
    });

    expect(putRes.key).toBe(key);

    const exists = await provider.exists(key);
    expect(exists).toBe(true);

    const getRes = await provider.getObject(key);
    expect(getRes.key).toBe(key);
    expect(getRes.body.toString('utf-8')).toBe('mock pdf content');
    expect(getRes.contentLength).toBe(content.length);
  });

  it('should generate presigned url and delete object', async () => {
    const key = 'documents/doc.txt';
    await provider.putObject({
      key,
      body: 'test document',
    });

    const presigned = await provider.getPresignedUrl({
      key,
      operation: 'getObject',
      expiresInSeconds: 300,
    });

    expect(presigned.url).toContain(encodeURIComponent(key));
    expect(presigned.expiresInSeconds).toBe(300);

    const delRes = await provider.deleteObject(key);
    expect(delRes.deleted).toBe(true);

    const exists = await provider.exists(key);
    expect(exists).toBe(false);
  });

  it('should throw error when getting non-existent file', async () => {
    await expect(provider.getObject('non-existent.txt')).rejects.toThrow('File not found');
  });
});
