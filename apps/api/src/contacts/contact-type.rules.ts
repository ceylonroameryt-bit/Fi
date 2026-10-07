import { ContactStatus, ContactType } from '@prisma/client';

export function isCustomer(contact: { type: ContactType }): boolean {
  return contact.type === ContactType.CUSTOMER || contact.type === ContactType.BOTH;
}

export function isSupplier(contact: { type: ContactType }): boolean {
  return contact.type === ContactType.SUPPLIER || contact.type === ContactType.BOTH;
}

export function canReceiveSalesInvoice(contact: { type: ContactType; status: ContactStatus }): boolean {
  return contact.status === ContactStatus.ACTIVE && isCustomer(contact);
}

export function canReceiveSupplierBill(contact: { type: ContactType; status: ContactStatus }): boolean {
  return contact.status === ContactStatus.ACTIVE && isSupplier(contact);
}
