import { Inject, Injectable, Optional } from '@nestjs/common';
import { DocumentTextSource } from '@prisma/client';
import { DomainException } from '../common/errors/domain.exception';
import { OCR_PROVIDER, ExtractedPage, OcrProvider, PositionedWord } from './ocr/ocr-provider.interface';
import type { SupportedMimeType } from './file-type';

// CommonJS legacy build; works in Node without canvas for text extraction.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfjs = require('pdfjs-dist/legacy/build/pdf.js') as typeof import('pdfjs-dist');

export interface DocumentText {
  source: DocumentTextSource;
  pages: ExtractedPage[];
  text: string;
}

/** Fewer visible characters than this per page means the PDF is a scan and needs OCR. */
const MIN_TEXT_CHARS_PER_PAGE = 20;

interface PdfTextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
  hasEOL?: boolean;
}

/**
 * Turns an uploaded file into text plus word positions. Digital PDFs use their embedded text
 * layer; photos and scanned PDFs go to the configured OCR provider. Nothing is guessed: if text
 * cannot be obtained the call fails with a reason.
 */
@Injectable()
export class DocumentTextService {
  constructor(@Optional() @Inject(OCR_PROVIDER) private readonly ocr: OcrProvider | null) {}

  async extract(bytes: Buffer, mimeType: SupportedMimeType): Promise<DocumentText> {
    if (mimeType === 'text/plain') {
      const text = bytes.toString('utf8');
      return { source: DocumentTextSource.PLAIN_TEXT, pages: [{ pageNumber: 1, width: null, height: null, words: [], text }], text };
    }

    if (mimeType === 'application/pdf') {
      const pages = await this.pdfTextLayer(bytes);
      const visible = pages.reduce((n, p) => n + p.text.replace(/\s/g, '').length, 0);
      if (visible >= MIN_TEXT_CHARS_PER_PAGE * Math.max(1, pages.length)) {
        return { source: DocumentTextSource.PDF_TEXT, pages, text: pages.map((p) => p.text).join('\n\f\n') };
      }
    }

    return this.runOcr(bytes, mimeType);
  }

  private async runOcr(bytes: Buffer, mimeType: string): Promise<DocumentText> {
    if (!this.ocr || !this.ocr.supports(mimeType)) {
      throw new DomainException('OCR_UNAVAILABLE', 'This file needs OCR (photo or scanned PDF) and no OCR provider is configured');
    }
    const pages = await this.ocr.recognize(bytes, mimeType);
    return { source: DocumentTextSource.OCR, pages, text: pages.map((p) => p.text).join('\n\f\n') };
  }

  private async pdfTextLayer(bytes: Buffer): Promise<ExtractedPage[]> {
    const task = pdfjs.getDocument({
      data: new Uint8Array(bytes),
      // Never execute font code from the document (CVE-2024-4367).
      isEvalSupported: false,
      disableFontFace: true,
      useSystemFonts: false,
      verbosity: 0,
    });
    const pdf = await task.promise;
    try {
      const pages: ExtractedPage[] = [];
      for (let n = 1; n <= pdf.numPages; n++) {
        const page = await pdf.getPage(n);
        const { width, height } = page.getViewport({ scale: 1 });
        const content = await page.getTextContent();
        const words: PositionedWord[] = [];
        let text = '';
        for (const raw of content.items) {
          if (!('str' in raw)) continue;
          const item = raw as PdfTextItem;
          words.push(...splitItem(item, width, height));
          text += item.str + (item.hasEOL ? '\n' : '');
        }
        pages.push({ pageNumber: n, width, height, words, text: text.trim() });
        page.cleanup();
      }
      return pages;
    } finally {
      await pdf.destroy();
    }
  }
}

/** Splits a PDF text run into words, spreading its width across characters proportionally. */
function splitItem(item: PdfTextItem, pageWidth: number, pageHeight: number): PositionedWord[] {
  const [, , , , x, baseline] = item.transform;
  const fontHeight = item.height || Math.abs(item.transform[3]) || 0;
  const charWidth = item.str.length > 0 ? item.width / item.str.length : 0;
  const top = 1 - (baseline + fontHeight) / pageHeight;
  const bottom = 1 - baseline / pageHeight;
  const words: PositionedWord[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(item.str))) {
    const start = x + m.index * charWidth;
    words.push({
      text: m[0],
      x0: clamp(start / pageWidth),
      y0: clamp(top),
      x1: clamp((start + m[0].length * charWidth) / pageWidth),
      y1: clamp(bottom),
    });
  }
  return words;
}

const clamp = (v: number) => Math.min(1, Math.max(0, Number(v.toFixed(5))));
