export const OCR_PROVIDER = Symbol('OCR_PROVIDER');

/** A word with its box normalised to 0..1 (origin top-left of the page). */
export interface PositionedWord {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** 0..1 when the engine reports it. */
  confidence?: number;
}

export interface ExtractedPage {
  pageNumber: number;
  width: number | null;
  height: number | null;
  words: PositionedWord[];
  text: string;
}

/** Optical character recognition for photos and scanned PDFs. */
export interface OcrProvider {
  readonly name: string;
  supports(mimeType: string): boolean;
  recognize(bytes: Buffer, mimeType: string): Promise<ExtractedPage[]>;
}
