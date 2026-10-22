import { CreditNoteKind, PaymentKind, Prisma } from '@prisma/client';
import type { Tx } from '../database/prisma.service';
import { DomainException } from '../common/errors/domain.exception';

type LockableTable = 'payments' | 'credit_notes' | 'invoices' | 'bills' | 'bank_statement_lines';

/**
 * Locks rows of one organisation (FOR UPDATE, in id order to avoid deadlocks) so balances read
 * afterwards are current and concurrent allocations can't both spend the same amount.
 */
export async function lockRows(tx: Tx, table: LockableTable, organizationId: string, ids: string[]): Promise<void> {
  const unique = [...new Set(ids)].sort();
  if (unique.length === 0) return;
  await tx.$queryRaw`SELECT id FROM ${Prisma.raw(`"${table}"`)} WHERE organization_id = ${organizationId}::uuid AND id = ANY(${unique}::uuid[]) ORDER BY id FOR UPDATE`;
}

/** What a payment may be allocated to: receipts pay invoices, supplier payments pay bills; refunds are not allocated. */
export function paymentTarget(kind: PaymentKind): 'INVOICE' | 'BILL' | null {
  if (kind === PaymentKind.CUSTOMER_RECEIPT) return 'INVOICE';
  if (kind === PaymentKind.SUPPLIER_PAYMENT) return 'BILL';
  return null;
}

/** Sales credit notes settle invoices; supplier credit notes settle bills. */
export function creditNoteTarget(kind: CreditNoteKind): 'INVOICE' | 'BILL' {
  return kind === CreditNoteKind.SALES_CREDIT_NOTE ? 'INVOICE' : 'BILL';
}

export function assertAllocationTargets(allowed: 'INVOICE' | 'BILL' | null, items: Array<{ invoiceId?: string; billId?: string }>, what: string): void {
  if (allowed === null) {
    throw new DomainException('ALLOCATION_TARGET_INVALID', `A ${what} is not allocated to invoices or bills`);
  }
  for (const item of items) {
    if (item.invoiceId && item.billId) {
      throw new DomainException('INVALID_ALLOCATION', 'Each allocation must name either an invoice or a bill, not both');
    }
    if ((allowed === 'INVOICE' && item.billId) || (allowed === 'BILL' && item.invoiceId)) {
      throw new DomainException('ALLOCATION_TARGET_INVALID', `A ${what} can only be allocated to ${allowed === 'INVOICE' ? 'sales invoices' : 'supplier bills'}`);
    }
  }
}

/** Allocation amounts are pounds and pence: positive, at most two decimal places. */
export function allocationAmount(raw: Prisma.Decimal.Value): Prisma.Decimal {
  const amount = new Prisma.Decimal(raw);
  if (amount.lessThanOrEqualTo(0)) throw new DomainException('INVALID_AMOUNT', 'Allocation amount must be greater than zero');
  if (amount.decimalPlaces() > 2) throw new DomainException('INVALID_AMOUNT', 'Allocation amount must have at most two decimal places');
  return amount;
}
