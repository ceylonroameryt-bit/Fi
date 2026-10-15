import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { DocumentIntakeService } from './document-intake.service';
import { DocumentTextService } from './document-text.service';
import { makeTextPdf, PNG_BYTES } from './__fixtures__/pdf-builder';

describe('DocumentIntakeService', () => {
  let prisma: any;
  let storage: any;
  let service: DocumentIntakeService;
  let created: Record<string, unknown> = {};
  const pdf = makeTextPdf(['Supplier: ABC Fuel Ltd', 'Invoice No: ABC-1001', 'Total: 1200.00']);
  const input = (over: Record<string, unknown> = {}) => ({
    organizationId: 'org-1',
    userId: 'user-1',
    fileName: '../../etc/passwd invoice.pdf',
    declaredMimeType: 'application/pdf',
    bytes: pdf,
    ...over,
  });

  beforeEach(() => {
    prisma = {
      aiDocument: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => {
          created = { id: 'doc-1', ...data };
          return Promise.resolve(created);
        }),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...created, ...data })),
      },
      aiDocumentPage: { createMany: jest.fn() },
      transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(prisma)),
    };
    storage = { putObject: jest.fn().mockResolvedValue({}), deleteObject: jest.fn().mockResolvedValue({ deleted: true }) };
    service = new DocumentIntakeService(prisma, storage, new DocumentTextService(null), { DOCUMENT_MAX_BYTES: 1024 * 1024 } as any);
  });

  it('stores the file under a private, organisation-scoped key that never contains the file name', async () => {
    const { document, duplicate } = await service.intake(input());
    expect(duplicate).toBe(false);
    const key: string = storage.putObject.mock.calls[0][0].key;
    expect(key).toMatch(/^orgs\/org-1\/documents\/[0-9a-f-]{36}\.pdf$/);
    expect(key).not.toContain('passwd');
    expect(document).toMatchObject({
      organizationId: 'org-1',
      mimeType: 'application/pdf',
      contentSha256: createHash('sha256').update(pdf).digest('hex'),
      textSource: 'PDF_TEXT',
      pageCount: 1,
    });
    expect(document.fileName).toBe('passwd invoice.pdf');
    expect(prisma.aiDocumentPage.createMany.mock.calls[0][0].data[0]).toMatchObject({ organizationId: 'org-1', pageNumber: 1 });
  });

  it('returns the existing document for an identical upload (same organisation) without storing it again', async () => {
    prisma.aiDocument.findUnique.mockResolvedValue({ id: 'existing', organizationId: 'org-1' });
    const { document, duplicate } = await service.intake(input());
    expect(duplicate).toBe(true);
    expect(document.id).toBe('existing');
    expect(storage.putObject).not.toHaveBeenCalled();
    expect(prisma.aiDocument.findUnique).toHaveBeenCalledWith({
      where: { organizationId_contentSha256: { organizationId: 'org-1', contentSha256: expect.any(String) } },
    });
  });

  it('handles a concurrent duplicate (unique violation) by returning the winner and removing its own copy', async () => {
    prisma.aiDocument.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' }));
    prisma.aiDocument.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'winner' });
    const { document, duplicate } = await service.intake(input());
    expect(duplicate).toBe(true);
    expect(document.id).toBe('winner');
    expect(storage.deleteObject).toHaveBeenCalled();
  });

  it.each([
    ['empty files', { bytes: Buffer.alloc(0) }, 'DOCUMENT_EMPTY'],
    ['oversized files', { bytes: Buffer.alloc(1024 * 1024 + 1, 0x41) }, 'DOCUMENT_TOO_LARGE'],
    ['unsupported content', { bytes: Buffer.from('504b030414000600', 'hex'), declaredMimeType: 'application/zip' }, 'DOCUMENT_TYPE_UNSUPPORTED'],
    ['a PNG declared as PDF', { bytes: PNG_BYTES }, 'DOCUMENT_TYPE_MISMATCH'],
  ])('rejects %s', async (_, over, code) => {
    await expect(service.intake(input(over))).rejects.toMatchObject({ code });
    expect(storage.putObject).not.toHaveBeenCalled();
  });

  it('keeps the document but records why when text cannot be obtained (photo without OCR)', async () => {
    const { document } = await service.intake(input({ bytes: PNG_BYTES, declaredMimeType: 'image/png', fileName: 'p.png' }));
    expect(storage.putObject).toHaveBeenCalled();
    expect(document).toMatchObject({ status: 'FAILED', errorMessage: expect.stringContaining('OCR_UNAVAILABLE') });
  });
});
