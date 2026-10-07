# Accounting & Subledger Test Suite

## Overview

The accounting test suite covers double-entry bookkeeping guarantees, subledger synchronization, journal reversal invariants, and multi-tenant security constraints.

## Automated Verification Suites

### 1. Unit Tests (`apps/api/src/**/*.spec.ts`)
- `contact-type.rules.spec.ts`: Verifies contact classification rules (`isCustomer`, `isSupplier`, `canReceiveSalesInvoice`, `canReceiveSupplierBill`).
- `contact-account-validation.service.spec.ts`: Confirms rejection of non-existent accounts, cross-tenant accounts, inactive accounts, revenue accounts assigned as AR, and expense accounts assigned as AP.
- `contact-subledger.service.spec.ts`: Verifies dynamic derivation of customer and supplier balances from journal lines, calculation of opening balance, chronological statement running balances, and zero-balance handling.

### 2. End-to-End Tests (`apps/api/test/**/*.e2e-spec.ts`)
- `contacts-v2-subledger.e2e-spec.ts`:
  - Contact CRUD across `CUSTOMER`, `SUPPLIER`, and `BOTH` types.
  - Rejection of invalid AR control accounts.
  - Server-side pagination, sorting, and search filtering.
  - KPI summary aggregation endpoint (`GET /contacts/summary`).
  - Contact person creation, update, and primary person exclusivity.
  - Duplicate contact heuristics (email, VAT, company number, company+postcode).
  - Invoice customer validation (blocking archived contacts, supplier-only contacts, cross-tenant contacts).
  - Sales invoice posting with subledger tagging: confirms DR Accounts Receivable line carries `contactId`, while Revenue and VAT lines do not.
  - Balance calculation: confirms balance changes to exact invoice total upon posting.
  - Statement generation: confirms opening balance, debit line, running balance, and closing balance.
  - Invoice voiding & balance reversal: posting a void reversal offsets the AR line and returns the customer balance to £0.00.
  - Database-level tenant integrity: verifies PostgreSQL foreign key rejection when attempting cross-tenant journal line contact linking.
  - Historical access: verifies archived contact transactions and statements remain accessible while blocking new invoices.

### 3. Running Test Suites
```bash
# Unit tests
npm run test:unit

# End-to-End tests
npm run test:e2e

# Type check
npm run typecheck

# Lint check
npm run lint

# Production build
npm run build
```
