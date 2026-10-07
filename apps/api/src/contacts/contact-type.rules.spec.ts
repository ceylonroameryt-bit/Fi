import { ContactStatus, ContactType } from '@prisma/client';
import { canReceiveSalesInvoice, canReceiveSupplierBill, isCustomer, isSupplier } from './contact-type.rules';

describe('Contact Type Rules', () => {
  it('identifies customers correctly', () => {
    expect(isCustomer({ type: ContactType.CUSTOMER })).toBe(true);
    expect(isCustomer({ type: ContactType.BOTH })).toBe(true);
    expect(isCustomer({ type: ContactType.SUPPLIER })).toBe(false);
  });

  it('identifies suppliers correctly', () => {
    expect(isSupplier({ type: ContactType.SUPPLIER })).toBe(true);
    expect(isSupplier({ type: ContactType.BOTH })).toBe(true);
    expect(isSupplier({ type: ContactType.CUSTOMER })).toBe(false);
  });

  it('determines if contact can receive sales invoice', () => {
    expect(canReceiveSalesInvoice({ type: ContactType.CUSTOMER, status: ContactStatus.ACTIVE })).toBe(true);
    expect(canReceiveSalesInvoice({ type: ContactType.BOTH, status: ContactStatus.ACTIVE })).toBe(true);
    expect(canReceiveSalesInvoice({ type: ContactType.CUSTOMER, status: ContactStatus.ARCHIVED })).toBe(false);
    expect(canReceiveSalesInvoice({ type: ContactType.SUPPLIER, status: ContactStatus.ACTIVE })).toBe(false);
  });

  it('determines if contact can receive supplier bill', () => {
    expect(canReceiveSupplierBill({ type: ContactType.SUPPLIER, status: ContactStatus.ACTIVE })).toBe(true);
    expect(canReceiveSupplierBill({ type: ContactType.BOTH, status: ContactStatus.ACTIVE })).toBe(true);
    expect(canReceiveSupplierBill({ type: ContactType.SUPPLIER, status: ContactStatus.ARCHIVED })).toBe(false);
    expect(canReceiveSupplierBill({ type: ContactType.CUSTOMER, status: ContactStatus.ACTIVE })).toBe(false);
  });
});
