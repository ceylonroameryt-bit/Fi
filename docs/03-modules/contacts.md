# Contacts Module (V2 & Subledger)

## Overview

The Contacts module in Blynt manages all external parties with whom an organisation conducts business: Customers, Suppliers, or both. Rather than acting as a static CRM or simple address book, Contacts serves as the authoritative boundary for Accounts Receivable (AR) and Accounts Payable (AP) subledger accounting.

## Contact Types & State Management

- **Types**: `CUSTOMER`, `SUPPLIER`, `BOTH`
- **Statuses**: `ACTIVE`, `ARCHIVED`

### Business Transaction Rules
- **Sales Invoices**: May only reference contacts with status `ACTIVE` and type `CUSTOMER` or `BOTH`.
- **Supplier Bills** (Future AP Phase): May only reference contacts with status `ACTIVE` and type `SUPPLIER` or `BOTH`.
- **Archived Contacts**:
  - Existing transactions and historical journal entries remain fully intact and visible.
  - Historical statements, invoices, and activity logs remain accessible.
  - Strictly blocked from being assigned to new transactions or updated draft invoices.
  - Can be restored to `ACTIVE` status by authorized users.

## Data Schema & Fields

### Core Business Fields
- `name`: Primary contact or legal trading name.
- `companyName`: Registered legal company entity name.
- `companyNumber`: UK Companies House registration number.
- `vatNumber`: VAT registration identifier.
- `taxNumber`: Generic international tax identifier (preserves international flexibility).
- `email`, `phone`, `website`, `notes`.
- `currency`: Base organisation currency (or null if single-currency).
- `paymentTermsDays`: Net credit term days (e.g., 30 days).
- `creditLimit`: Maximum allowable credit limit (`Decimal`).

### Addresses
- **Billing / Primary Address**: `addressLine1`, `addressLine2`, `city`, `state`, `postcode`, `country`.
- **Shipping Address**: `shippingAddressLine1`, `shippingAddressLine2`, `shippingCity`, `shippingState`, `shippingPostcode`, `shippingCountry`.

### Multi-Person Model (`ContactPerson`)
A contact can have multiple associated people:
- Fields: `firstName`, `lastName`, `jobTitle`, `email`, `phone`, `mobile`.
- Flags: `isPrimary`, `isBillingContact`, `isActive`.
- Multi-tenancy: Tied composite-safe to `(organization_id, contact_id)`.
- Exactly one primary person exists per contact; setting a new primary person de-elevates the former primary person.

## Accounting Integration & Control Accounts

Each contact can be configured with default subledger control accounts:
- `receivableAccountId`: Must reference an active account in the current organisation with `accountType: ASSET` and `accountSubtype: ACCOUNTS_RECEIVABLE`.
- `payableAccountId`: Must reference an active account in the current organisation with `accountType: LIABILITY` and `accountSubtype: ACCOUNTS_PAYABLE`.
- Validation is strictly enforced upon contact creation and update via `ContactAccountValidationService`.
