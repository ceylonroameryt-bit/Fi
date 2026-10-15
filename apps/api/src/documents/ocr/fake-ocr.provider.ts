import type { ExtractedPage, OcrProvider } from './ocr-provider.interface';

/** Deterministic OCR for tests/dev (OCR_PROVIDER=fake): returns whatever was queued. */
export class FakeOcrProvider implements OcrProvider {
  readonly name = 'fake';
  readonly calls: Array<{ mimeType: string; size: number }> = [];
  private readonly queue: ExtractedPage[][] = [];

  enqueue(pages: ExtractedPage[]): this {
    this.queue.push(pages);
    return this;
  }

  supports(mimeType: string): boolean {
    return ['image/jpeg', 'image/png', 'image/tiff', 'application/pdf'].includes(mimeType);
  }

  async recognize(bytes: Buffer, mimeType: string): Promise<ExtractedPage[]> {
    this.calls.push({ mimeType, size: bytes.length });
    const next = this.queue.shift();
    if (!next) throw new Error('FakeOcrProvider: no OCR result queued');
    return next;
  }
}
