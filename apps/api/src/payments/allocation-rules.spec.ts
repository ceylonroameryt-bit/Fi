import { CreditNoteKind, PaymentKind } from '@prisma/client';
import { allocationAmount, assertAllocationTargets, creditNoteTarget, paymentTarget } from './allocation-rules';

describe('allocation rules', () => {
  it('receipts pay invoices, supplier payments pay bills, refunds are not allocated', () => {
    expect(paymentTarget(PaymentKind.CUSTOMER_RECEIPT)).toBe('INVOICE');
    expect(paymentTarget(PaymentKind.SUPPLIER_PAYMENT)).toBe('BILL');
    expect(paymentTarget(PaymentKind.CUSTOMER_REFUND)).toBeNull();
    expect(paymentTarget(PaymentKind.SUPPLIER_REFUND)).toBeNull();
    expect(creditNoteTarget(CreditNoteKind.SALES_CREDIT_NOTE)).toBe('INVOICE');
    expect(creditNoteTarget(CreditNoteKind.SUPPLIER_CREDIT_NOTE)).toBe('BILL');
  });

  it('refuses the wrong side, both targets at once, and refunds', () => {
    expect(() => assertAllocationTargets('INVOICE', [{ billId: 'b' }], 'customer receipt')).toThrow(/only be allocated to sales invoices/);
    expect(() => assertAllocationTargets('BILL', [{ invoiceId: 'i' }], 'supplier payment')).toThrow(/only be allocated to supplier bills/);
    expect(() => assertAllocationTargets('INVOICE', [{ invoiceId: 'i', billId: 'b' }], 'x')).toThrow(/not both/);
    expect(() => assertAllocationTargets(null, [{ invoiceId: 'i' }], 'customer refund')).toThrow(/not allocated/);
    expect(() => assertAllocationTargets('INVOICE', [{ invoiceId: 'i' }], 'customer receipt')).not.toThrow();
  });

  it('amounts are positive pounds and pence', () => {
    expect(allocationAmount(12.34).toFixed(2)).toBe('12.34');
    expect(allocationAmount('0.1').toFixed(2)).toBe('0.10');
    expect(() => allocationAmount(0)).toThrow(/greater than zero/);
    expect(() => allocationAmount(-5)).toThrow(/greater than zero/);
    expect(() => allocationAmount('10.005')).toThrow(/two decimal places/);
  });
});
