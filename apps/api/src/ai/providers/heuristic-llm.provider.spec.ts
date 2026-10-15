import { HeuristicLlmProvider } from './heuristic-llm.provider';
import {
  CUSTOMER_VAT_ON_SUPPLIER_BILL_TEXT,
  LINES_WITHOUT_VAT_TEXT,
  SPARSE_DOCUMENT_TEXT,
  UNPARSEABLE_DATE_TEXT,
} from '../__fixtures__/safety-fixtures';

const extract = (text: string) =>
  new HeuristicLlmProvider().extractDocumentData({ buffer: Buffer.from(text), fileName: 'f.txt', mimeType: 'text/plain', text });

describe('HeuristicLlmProvider – never fabricates (Stage 4)', () => {
  it('BUG-07: leaves invoice number, dates and currency empty when the document has none', async () => {
    const r = await extract(SPARSE_DOCUMENT_TEXT);
    expect(r.invoiceNumber).toBeUndefined();
    expect(r.invoiceDate).toBeUndefined();
    expect(r.dueDate).toBeUndefined();
    expect(r.currency).toBeUndefined();
  });

  it('BUG-09: does not invent a "Standard Line Item" when no lines are found', async () => {
    const r = await extract(SPARSE_DOCUMENT_TEXT);
    expect(r.lines).toEqual([]);
    expect(r.total).toBe('250.00');
    expect(r.subtotal).toBeUndefined();
    expect(r.vatTotal).toBeUndefined();
  });

  it('BUG-08: never assumes 20% VAT on lines that show none', async () => {
    const r = await extract(LINES_WITHOUT_VAT_TEXT);
    expect(r.lines).toEqual([
      { description: 'Widgets', net: '120.00' },
      { description: 'Bolts', net: '30.00' },
    ]);
    for (const l of r.lines) {
      expect(l.vat).toBeUndefined();
      expect(l.total).toBeUndefined();
    }
  });

  it('BUG-11: an unparseable date is left empty, not replaced with today', async () => {
    const r = await extract(UNPARSEABLE_DATE_TEXT);
    expect(r.invoiceDate).toBeUndefined();
  });

  it('BUG-12: a customer VAT number is not taken as the issuer VAT number', async () => {
    const r = await extract(CUSTOMER_VAT_ON_SUPPLIER_BILL_TEXT);
    expect(r.issuer).toMatchObject({ name: 'ABC Fuel Ltd', vatNumber: 'GB123456789' });
    expect(r.recipient).toMatchObject({ name: 'Blynt Petrol Station Ltd', vatNumber: 'GB987654321' });
  });

  it('reads labelled totals exactly (no float maths, "Subtotal" is not "Total", "VAT 20%" is not £20)', async () => {
    const r = await extract(CUSTOMER_VAT_ON_SUPPLIER_BILL_TEXT);
    expect(r).toMatchObject({
      invoiceNumber: 'ABC-1001',
      invoiceDate: '2026-09-30',
      currency: 'GBP',
      subtotal: '1000.00',
      vatTotal: '200.00',
      total: '1200.00',
    });
  });

  it('converts UK dd/mm/yyyy dates and rejects impossible ones', async () => {
    expect((await extract('Invoice Date: 05/04/2026')).invoiceDate).toBe('2026-04-05');
    expect((await extract('Invoice Date: 31/02/2026')).invoiceDate).toBeUndefined();
  });
});
