import { DocumentTextService } from './document-text.service';
import { FakeOcrProvider } from './ocr/fake-ocr.provider';
import { toPages } from './ocr/textract-ocr.provider';
import { makeBlankPdf, makeTextPdf, PNG_BYTES } from './__fixtures__/pdf-builder';

const page = (text: string) => [{ pageNumber: 1, width: null, height: null, text, words: [{ text, x0: 0.1, y0: 0.1, x1: 0.2, y1: 0.12 }] }];

describe('DocumentTextService', () => {
  it('uses the embedded text layer of a digital PDF, with word positions, and skips OCR', async () => {
    const ocr = new FakeOcrProvider();
    const result = await new DocumentTextService(ocr).extract(
      makeTextPdf(['Supplier: ABC Fuel Ltd', 'Invoice No: ABC-1001', 'Total: 1200.00']),
      'application/pdf',
    );
    expect(result.source).toBe('PDF_TEXT');
    expect(ocr.calls).toHaveLength(0);
    expect(result.text).toContain('Invoice No: ABC-1001');
    const [p] = result.pages;
    expect(p).toMatchObject({ pageNumber: 1, width: 595, height: 842 });
    const word = p.words.find((w) => w.text === 'ABC-1001')!;
    expect(word).toBeDefined();
    // Second line sits below the first; boxes are normalised and ordered.
    const supplier = p.words.find((w) => w.text === 'Supplier:')!;
    expect(word.y0).toBeGreaterThan(supplier.y0);
    for (const w of p.words) {
      expect(w.x0).toBeGreaterThanOrEqual(0);
      expect(w.x1).toBeGreaterThan(w.x0);
      expect(w.y1).toBeGreaterThan(w.y0);
      expect(w.y1).toBeLessThanOrEqual(1);
    }
  });

  it('sends a scanned PDF (no text layer) to OCR', async () => {
    const ocr = new FakeOcrProvider().enqueue(page('Invoice No: SCAN-1'));
    const result = await new DocumentTextService(ocr).extract(makeBlankPdf(), 'application/pdf');
    expect(result.source).toBe('OCR');
    expect(result.text).toBe('Invoice No: SCAN-1');
    expect(ocr.calls[0].mimeType).toBe('application/pdf');
  });

  it('sends photos to OCR', async () => {
    const ocr = new FakeOcrProvider().enqueue(page('Total 9.99'));
    const result = await new DocumentTextService(ocr).extract(PNG_BYTES, 'image/png');
    expect(result).toMatchObject({ source: 'OCR', text: 'Total 9.99' });
  });

  it('fails clearly (never invents text) when OCR is needed but not configured', async () => {
    await expect(new DocumentTextService(null).extract(PNG_BYTES, 'image/png')).rejects.toMatchObject({ code: 'OCR_UNAVAILABLE' });
    await expect(new DocumentTextService(null).extract(makeBlankPdf(), 'application/pdf')).rejects.toMatchObject({
      code: 'OCR_UNAVAILABLE',
    });
  });

  it('passes plain text through', async () => {
    const result = await new DocumentTextService(null).extract(Buffer.from('Total 5.00'), 'text/plain');
    expect(result).toMatchObject({ source: 'PLAIN_TEXT', text: 'Total 5.00' });
  });
});

describe('Textract block mapping', () => {
  it('maps WORD boxes and LINE text per page, confidence to 0..1', () => {
    const pages = toPages([
      { BlockType: 'PAGE', Page: 1 },
      { BlockType: 'LINE', Page: 1, Text: 'Total 9.99' },
      { BlockType: 'WORD', Page: 1, Text: 'Total', Confidence: 99.5, Geometry: { BoundingBox: { Left: 0.1, Top: 0.2, Width: 0.05, Height: 0.01 } } },
      { BlockType: 'WORD', Page: 2, Text: 'p2', Confidence: 80, Geometry: { BoundingBox: { Left: 0, Top: 0, Width: 0.1, Height: 0.1 } } },
    ] as any);
    expect(pages).toHaveLength(2);
    expect(pages[0].text).toBe('Total 9.99');
    expect(pages[0].words[0]).toEqual({ text: 'Total', x0: 0.1, y0: 0.2, x1: 0.15000000000000002, y1: 0.21000000000000002, confidence: 0.995 });
  });
});
