import { Block, DetectDocumentTextCommand, TextractClient } from '@aws-sdk/client-textract';
import type { ExtractedPage, OcrProvider, PositionedWord } from './ocr-provider.interface';

/**
 * AWS Textract (synchronous DetectDocumentText). Handles JPEG, PNG, TIFF and single-page PDFs
 * up to 10 MB; multi-page scanned PDFs need the asynchronous S3 API (moves with Stage 6 jobs).
 * Credentials and region come from the standard AWS environment.
 */
export class TextractOcrProvider implements OcrProvider {
  readonly name = 'textract';

  constructor(private readonly client: TextractClient = new TextractClient({})) {}

  supports(mimeType: string): boolean {
    return ['image/jpeg', 'image/png', 'image/tiff', 'application/pdf'].includes(mimeType);
  }

  async recognize(bytes: Buffer): Promise<ExtractedPage[]> {
    const response = await this.client.send(new DetectDocumentTextCommand({ Document: { Bytes: bytes } }));
    return toPages(response.Blocks ?? []);
  }
}

/** Groups Textract blocks into pages: WORD blocks give positions, LINE blocks give reading-order text. */
export function toPages(blocks: Block[]): ExtractedPage[] {
  const pages = new Map<number, ExtractedPage>();
  const page = (n: number) => {
    let p = pages.get(n);
    if (!p) {
      p = { pageNumber: n, width: null, height: null, words: [], text: '' };
      pages.set(n, p);
    }
    return p;
  };

  for (const block of blocks) {
    const n = block.Page ?? 1;
    const box = block.Geometry?.BoundingBox;
    if (block.BlockType === 'WORD' && block.Text && box) {
      const left = box.Left ?? 0;
      const top = box.Top ?? 0;
      const word: PositionedWord = {
        text: block.Text,
        x0: left,
        y0: top,
        x1: left + (box.Width ?? 0),
        y1: top + (box.Height ?? 0),
        ...(block.Confidence !== undefined ? { confidence: block.Confidence / 100 } : {}),
      };
      page(n).words.push(word);
    } else if (block.BlockType === 'LINE' && block.Text) {
      const p = page(n);
      p.text = p.text ? `${p.text}\n${block.Text}` : block.Text;
    }
  }
  return [...pages.values()].sort((a, b) => a.pageNumber - b.pageNumber);
}
