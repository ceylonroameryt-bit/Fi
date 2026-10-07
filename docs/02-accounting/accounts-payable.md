# Accounts Payable (AP) Subledger

## Overview

Accounts Payable represents short-term liabilities owed by an organisation to suppliers and vendors for goods or services received on credit.

## Subledger Design & Preparation

While full Supplier Bills and Supplier Payments are implemented in subsequent phases (Phase 7+), Phase 3 establishes the architectural foundation:

### 1. Control Account Requirements
- Contacts configured as `SUPPLIER` or `BOTH` may define a `payableAccountId`.
- The account must belong to the organisation, be `isActive: true`, have `accountType: LIABILITY`, and `accountSubtype: ACCOUNTS_PAYABLE`.

### 2. Posting Pattern (Future Bills)
When a supplier bill is posted:
```
DR 5000 Purchases / Direct Expenses  [contactId: null]
DR 1200 Input VAT                   [contactId: null]
   CR 2000 Accounts Payable         [contactId: supplierId]
```
The credit line to `Accounts Payable` will carry the supplier's `contactId`.

### 3. Supplier Balance Derivation
Supplier balance is defined as:
$$\text{Supplier Balance} = \sum (\text{AP Credits}) - \sum (\text{AP Debits})$$

In Phase 3, `getSupplierBalance()` and `getSupplierStatement()` operate against posted journal lines tagged with the supplier's `contactId` on AP control accounts. If no supplier journal lines exist, it safely returns zero without synthetic data.
