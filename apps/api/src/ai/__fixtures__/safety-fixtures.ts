/**
 * Stage 4 (Phase 41) regression fixtures. Each one reproduces a defect found in the
 * original AI prototype; the matching test names the defect it guards against.
 * Organisation under test: Blynt Petrol Station Ltd.
 */
import type { RawExtractionResult } from '../providers/llm-provider.interface';

export const ORG = {
  name: 'Blynt Petrol Station',
  legalName: 'Blynt Petrol Station Ltd',
  taxNumber: 'GB 987 6543 21',
  registrationNumber: '01234567',
};

/** BUG-01: our own sales invoice must be a SALE, decided by our VAT number on the issuer side. */
export const OWN_SALES_INVOICE: RawExtractionResult = {
  invoiceNumber: 'BPS-2026-0042',
  issuer: { name: 'Blynt Petrol Station Limited', vatNumber: 'GB987654321' },
  recipient: { name: 'Haulage Co Ltd', vatNumber: 'GB111222333' },
  lines: [{ description: 'Diesel 1000 litres', quantity: '1000', unitPrice: '1.40', net: '1400.00', vat: '280.00', total: '1680.00' }],
};

/** BUG-02: supplier bill addressed to us by company number only (no VAT on recipient). */
export const SUPPLIER_BILL_BY_COMPANY_NUMBER: RawExtractionResult = {
  invoiceNumber: 'ABC-991',
  issuer: { name: 'ABC Fuel Ltd', vatNumber: 'GB123456789' },
  recipient: { name: 'BPS', companyNumber: '1234567' },
  lines: [],
};

/** BUG-03: substring name match. An org called "ABC" must not "issue" an invoice from "ABC Supplies Ltd". */
export const SHORT_NAME_ORG = { name: 'ABC', legalName: null, taxNumber: null, registrationNumber: null };
export const SUBSTRING_NAME_INVOICE: RawExtractionResult = {
  issuer: { name: 'ABC Supplies Ltd' },
  recipient: { name: 'Northwind Traders' },
  lines: [],
};

/** BUG-04: no identifying party data used to default to PURCHASE (confidence 0.5). */
export const NO_PARTIES: RawExtractionResult = { lines: [] };

/** BUG-05: issuer name matches us but issuer VAT number is someone else's: not our document. */
export const NAME_MATCH_VAT_MISMATCH: RawExtractionResult = {
  issuer: { name: 'Blynt Petrol Station Ltd', vatNumber: 'GB555666777' },
  recipient: { name: 'Someone Else Ltd' },
  lines: [],
};

/** BUG-06: we appear as both issuer and recipient (e.g. internal transfer or bad OCR): ambiguous. */
export const ORG_ON_BOTH_SIDES: RawExtractionResult = {
  issuer: { name: 'Blynt Petrol Station', vatNumber: 'GB987654321' },
  recipient: { name: 'Blynt Petrol Station Ltd' },
  lines: [],
};

/**
 * BUG-07..10: document text with no invoice number, no date, no currency marker, no VAT
 * figures and no parseable line items. The prototype invented INV-<timestamp>, today's date,
 * GBP, 20% VAT on every line and a "Standard Line Item".
 */
export const SPARSE_DOCUMENT_TEXT = ['Northwind Traders', 'Thank you for your business', 'Total 250.00'].join('\n');

/** BUG-08: line items with a net amount but no VAT shown. VAT must stay null, not 20% of net. */
export const LINES_WITHOUT_VAT_TEXT = ['Supplier: Northwind Traders', 'Invoice No: NW-77', 'Widgets 120.00', 'Bolts 30.00'].join('\n');

/** BUG-11: a British date the prototype could not parse fell back to today. */
export const UNPARSEABLE_DATE_TEXT = ['Supplier: Northwind Traders', 'Invoice No: NW-78', 'Date: 31st of Smarch'].join('\n');

/** BUG-12: our VAT number printed as "Customer VAT" was read as the issuer's VAT, flipping a bill into a sale. */
export const CUSTOMER_VAT_ON_SUPPLIER_BILL_TEXT = [
  'Supplier: ABC Fuel Ltd',
  'VAT Reg No: GB123456789',
  'Invoice No: ABC-1001',
  'Invoice Date: 2026-09-30',
  'Bill To: Blynt Petrol Station Ltd',
  'Customer VAT: GB987654321',
  'Diesel 1000.00',
  'Subtotal: £1,000.00',
  'VAT 20%: £200.00',
  'Total: £1,200.00',
].join('\n');
