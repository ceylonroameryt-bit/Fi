import { TransactionDirectionService } from './transaction-direction.service';
import { AiDirection, Contact, ContactType } from '@prisma/client';
import { RawExtractionResult } from '../providers/llm-provider.interface';

describe('TransactionDirectionService (5-Tier Priority Hierarchy)', () => {
  let service: TransactionDirectionService;

  const blyntStation = {
    name: 'Blynt Petrol Station',
    legalName: 'Blynt Petrol Station Ltd',
    taxNumber: 'GB987654321',
    registrationNumber: '12345678',
  };

  beforeEach(() => {
    service = new TransactionDirectionService();
  });

  describe('Petrol Station Scenario A: Buying Fuel', () => {
    it('Priority 1: resolves PURCHASE when ABC Fuel Ltd issues to Blynt Petrol Station', () => {
      const extraction: RawExtractionResult = {
        invoiceNumber: 'INV-10482',
        issuer: { name: 'ABC Fuel Ltd', vatNumber: 'GB123456789' },
        recipient: { name: 'Blynt Petrol Station', vatNumber: 'GB987654321' },
        lines: [
          {
            description: '10,000 litres Diesel',
            quantity: '10000',
            unitPrice: '1.20',
            net: '12000',
            vat: '2400',
            total: '14400',
          },
        ],
        subtotal: '12000',
        vatTotal: '2400',
        total: '14400',
      };

      const result = service.resolveDirection(extraction, blyntStation, null);

      expect(result.direction).toBe(AiDirection.PURCHASE);
      expect(result.priorityApplied).toBe(1);
      expect(result.confidence).toBeGreaterThanOrEqual(0.95);
      expect(result.reasoning).toContain('Blynt Petrol Station');
    });
  });

  describe('Petrol Station Scenario B: Selling Fuel', () => {
    it('Priority 1: resolves SALE when Blynt Petrol Station issues to XYZ Transport Ltd', () => {
      const extraction: RawExtractionResult = {
        invoiceNumber: 'INV-00291',
        issuer: { name: 'Blynt Petrol Station', vatNumber: 'GB987654321' },
        recipient: { name: 'XYZ Transport Ltd', vatNumber: 'GB555666777' },
        lines: [
          {
            description: '2,000 litres Diesel',
            quantity: '2000',
            unitPrice: '1.20',
            net: '2400',
            vat: '480',
            total: '2880',
          },
        ],
        subtotal: '2400',
        vatTotal: '480',
        total: '2880',
      };

      const result = service.resolveDirection(extraction, blyntStation, null);

      expect(result.direction).toBe(AiDirection.SALE);
      expect(result.priorityApplied).toBe(1);
      expect(result.confidence).toBeGreaterThanOrEqual(0.95);
      expect(result.reasoning).toContain('Blynt Petrol Station');
    });
  });

  describe('Priority 2: VAT / Business Identifiers', () => {
    it('resolves PURCHASE when recipient VAT matches organisation VAT', () => {
      const extraction: RawExtractionResult = {
        invoiceNumber: 'INV-777',
        issuer: { name: 'Unknown Trading Company', vatNumber: 'GB111111111' },
        recipient: { name: 'Trading Branch 4', vatNumber: 'GB987654321' },
        lines: [],
      };

      const result = service.resolveDirection(extraction, blyntStation, null);

      expect(result.direction).toBe(AiDirection.PURCHASE);
      expect(result.priorityApplied).toBe(2);
      expect(result.reasoning).toContain('VAT');
    });

    it('resolves SALE when issuer VAT matches organisation VAT', () => {
      const extraction: RawExtractionResult = {
        invoiceNumber: 'INV-888',
        issuer: { name: 'Trading Station #1', vatNumber: 'GB987654321' },
        recipient: { name: 'Fleet Delivery Co', vatNumber: 'GB222222222' },
        lines: [],
      };

      const result = service.resolveDirection(extraction, blyntStation, null);

      expect(result.direction).toBe(AiDirection.SALE);
      expect(result.priorityApplied).toBe(2);
      expect(result.reasoning).toContain('VAT');
    });
  });

  describe('Priority 3: Blynt Master Data (Known Contact Type)', () => {
    it('resolves PURCHASE when matched contact is configured as SUPPLIER', () => {
      const extraction: RawExtractionResult = {
        invoiceNumber: 'INV-999',
        lines: [],
      };

      const mockSupplier = {
        id: 'contact-sup-1',
        type: ContactType.SUPPLIER,
        name: 'Oil Refineries UK',
      } as Contact;

      const result = service.resolveDirection(extraction, { name: 'Unknown Name Holding' }, mockSupplier);

      expect(result.direction).toBe(AiDirection.PURCHASE);
      expect(result.priorityApplied).toBe(3);
      expect(result.reasoning).toContain('Master Data');
    });

    it('resolves SALE when matched contact is configured as CUSTOMER', () => {
      const extraction: RawExtractionResult = {
        invoiceNumber: 'INV-1000',
        lines: [],
      };

      const mockCustomer = {
        id: 'contact-cust-1',
        type: ContactType.CUSTOMER,
        name: 'Metro Coaches Ltd',
      } as Contact;

      const result = service.resolveDirection(extraction, { name: 'Unknown Name Holding' }, mockCustomer);

      expect(result.direction).toBe(AiDirection.SALE);
      expect(result.priorityApplied).toBe(3);
      expect(result.reasoning).toContain('Master Data');
    });
  });

  describe('Priority 4 & 5: Document Language and LLM Fallback', () => {
    it('Priority 4: resolves PURCHASE when text contains "bill to" organisation name', () => {
      const extraction: RawExtractionResult = {
        invoiceNumber: 'INV-1001',
        rawText: 'INVOICE\nSUPPLIER: Shell\nBILL TO: Blynt Petrol Station\nTOTAL: 500',
        lines: [],
      };

      const result = service.resolveDirection(extraction, { name: 'Blynt Petrol Station' }, null);

      expect(result.direction).toBe(AiDirection.PURCHASE);
    });

    it('Priority 5: uses LLM interpretation fallback when no deterministic rule matches', () => {
      const extraction: RawExtractionResult = {
        invoiceNumber: 'DOC-99',
        rawText: 'Some unlabelled voucher document',
        lines: [],
      };

      const result = service.resolveDirection(extraction, { name: 'Unrelated Org Name' }, null, 'PURCHASE');

      expect(result.direction).toBe(AiDirection.PURCHASE);
      expect(result.priorityApplied).toBe(5);
      expect(result.confidence).toBe(0.75);
    });
  });
});
