export type SupportedMimeType = 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/tiff' | 'text/plain';

export const EXTENSION_FOR: Record<SupportedMimeType, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/tiff': '.tif',
  'text/plain': '.txt',
};

const startsWith = (buf: Buffer, hex: string) => buf.subarray(0, hex.length / 2).equals(Buffer.from(hex, 'hex'));

/**
 * Identifies an upload from its content (magic bytes). The declared type and file name are
 * never trusted. Anything not positively recognised is rejected.
 */
export function detectFileType(buf: Buffer): SupportedMimeType | null {
  if (buf.length === 0) return null;
  if (startsWith(buf, '255044462d')) return 'application/pdf'; // %PDF-
  if (startsWith(buf, 'ffd8ff')) return 'image/jpeg';
  if (startsWith(buf, '89504e470d0a1a0a')) return 'image/png';
  if (startsWith(buf, '49492a00') || startsWith(buf, '4d4d002a')) return 'image/tiff';
  return isPlainText(buf) ? 'text/plain' : null;
}

function isPlainText(buf: Buffer): boolean {
  if (buf.includes(0)) return false;
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    return false;
  }
  // Markup is not accepted as "text" (it could be rendered somewhere later).
  return !/<\s*(html|script|svg|iframe|body)\b/i.test(text);
}
