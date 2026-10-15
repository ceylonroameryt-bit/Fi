import { detectFileType } from './file-type';
import { JPEG_BYTES, makeTextPdf, PNG_BYTES } from './__fixtures__/pdf-builder';

describe('detectFileType (magic bytes, never the file name)', () => {
  it.each([
    [makeTextPdf(['x']), 'application/pdf'],
    [PNG_BYTES, 'image/png'],
    [JPEG_BYTES, 'image/jpeg'],
    [Buffer.from('49492a0008000000', 'hex'), 'image/tiff'],
    [Buffer.from('4d4d002a00000008', 'hex'), 'image/tiff'],
    [Buffer.from('Invoice No: 1\nTotal 10.00', 'utf8'), 'text/plain'],
  ])('detects %#', (buf, expected) => {
    expect(detectFileType(buf)).toBe(expected);
  });

  it.each([
    ['an executable', Buffer.from('4d5a90000300000004000000', 'hex')],
    ['a zip / docx', Buffer.from('504b030414000600', 'hex')],
    ['binary with NUL bytes', Buffer.from([0x41, 0x00, 0x42, 0x43])],
    ['invalid UTF-8', Buffer.from([0xc3, 0x28, 0x41])],
    ['HTML disguised as text', Buffer.from('<html><script>alert(1)</script></html>')],
    ['empty', Buffer.alloc(0)],
  ])('rejects %s', (_, buf) => {
    expect(detectFileType(buf)).toBeNull();
  });
});
