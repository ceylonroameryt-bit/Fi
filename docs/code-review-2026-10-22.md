# Code review – 2026-10-22

Scope: everything merged into `main` since the VAT-schemes stage, with the money-moving API code first (payments, credit notes, bank reconciliation, ageing) and a check of the web credit-note form. Branch `fix/code-review`.

Baseline before fixes: API typecheck clean, web lint clean, all suites green (428 unit, 182 e2e, 60 web). The bugs below were not caught because payments, credit notes and banking had only unit tests with a mocked database.

## Fixed

| # | Severity | Area | Problem | Fix |
|---|---|---|---|---|
| 1 | Critical | Database | `JournalSourceType` in the database lacked `PAYMENT` and `CREDIT_NOTE`: **every payment and every credit-note posting failed** on a real database. | Migration `20261022120000_sales_purchases_schema_drift`. |
| 2 | Critical | Database | The payments / credit-notes / banking tables had **no foreign keys**, including the composite `(organization_id, …)` keys that stop rows pointing at another organisation's contacts or accounts; unique keys on `journal_entry_id` and indexes were missing. | Same migration (generated from the schema diff; the database now matches `schema.prisma` exactly). |
| 3 | Critical | Credit notes | Creating any credit note failed (500): nested lines set `organizationId`, which Prisma rejects on the composite relation. | Lines take it from the relation. |
| 4 | High | Credit notes – VAT | VAT came from the client (`taxRate`/`taxAmount`, `taxAmount` defaulting to 0, so VAT was usually zero); no tax code required; journal lines carried **no VAT analysis**, so credit notes never reduced the VAT return. | VAT from the line's tax code via `calculateVat`; client VAT fields removed (400 if sent); tax code required to post (`TAX_CODE_REQUIRED`, and the posting engine now requires tax analysis on credit-note journals); journal built by `buildCreditNoteJournalLines`, the exact mirror of the invoice / bill journal including reverse charge. |
| 5 | High | Credit notes | No check that a credit note against an invoice/bill belongs to the same contact, is posted, or stays within what is left to credit; contact type and currency unchecked. | `CONTACT_MISMATCH`, `OVER_CREDIT`, `CONTACT_TYPE_MISMATCH`, `UNSUPPORTED_CURRENCY`. |
| 6 | High | Allocations | No row locks: two allocations at once could both read the same balance and over-pay a document (lost update). | `FOR UPDATE` locks on the payment / credit note and every target document (`allocation-rules.ts`); tested with two concurrent requests. |
| 7 | High | Allocations | A customer receipt could pay a bill (and a supplier payment an invoice) for a "both" contact; refunds could be allocated; amounts with fractions of a penny accepted. | Receipts → invoices, supplier payments → bills, sales credit notes → invoices, supplier credit notes → bills, refunds not allocated (`ALLOCATION_TARGET_INVALID`); amounts at most 2 dp. |
| 8 | High | Invoices / bills | A paid (allocated) invoice or bill could be voided, leaving allocations against a reversed document and the debtors/creditors ledger wrong. | Void refused while allocations exist (`DOCUMENT_HAS_ALLOCATIONS`). |
| 9 | High | Bank reconciliation | A statement line could be posted twice (quick-create didn't record its journal; unmatch then quick-create again). | Lines must be open; the journal records the line as its source; unmatching a line that created a posted journal is refused. |
| 10 | High | Bank reconciliation | Matching accepted any payment / journal line id – another organisation's, unposted, a different amount or bank account, or one already matched. | All checked (`BANK_MATCH_INVALID`, `BANK_TRANSACTION_ALREADY_RECONCILED`). |
| 11 | High | Bank reconciliation | Quick-create ignored `taxCodeId`: VAT on bank-paid expenses was never reclaimed. | VAT-inclusive split via `calculateVat`, net to the account with VAT analysis, VAT to the control account. |
| 12 | Medium | Payments | Any account (e.g. revenue) could be used as the "bank" account; fallback bank account picked arbitrarily; non-GBP payments accepted; contact type unchecked. | Bank/cash accounts only (deterministic fallback), base currency only, contact type checked. |
| 13 | Medium | Ageing | "As at" a past date used today's paid amounts and dropped documents voided after that date. | Paid = allocations dated on/before the date; documents voided later are included. |
| 14 | Medium | Money | Bank reconciliation, AI categorisation and bank rules compared money as JavaScript floats. | Decimal throughout. |
| 15 | Low | Roles | Startup permission sync swallowed errors silently. | Logged as a warning. |
| 16 | Medium | Web | The credit-note form sent its own float-calculated VAT and no tax code. | VAT-code dropdown per line; VAT shown as a preview, calculated by the server. |

Tests added: `test/sales-purchases-integrity.e2e-spec.ts` (12 tests against the real database, incl. VAT boxes, trial balance and a concurrency test), `credit-note-journal.spec.ts`, `allocation-rules.spec.ts`; existing unit tests updated for the new rules. Full suite after fixes: 435 unit, 194 e2e, 60 web.

## Not changed – for a decision

- **Owners skip every permission check** (`organization-access.guard.ts`, added in the UI redesign). Owners are granted all permissions anyway, but this also hides missing permission seeds. Recommend reverting to checking permissions for everyone.
- **Invoice/bill status never moves to PAID / PARTIALLY_PAID**; the amount due is computed instead. Fine for now; the shared document model (sales & purchases Stage 1) will derive status from allocations.
- **Ageing ignores unallocated credit notes and payments on account**, so it won't reconcile to the control accounts yet (planned for Stage 5).
- **Statement parser** produces amounts as JavaScript numbers before they are stored as decimals; safe for 2-dp amounts but worth converting to strings.
- **Local web build** fails only because the folder name `F!` contains `!` (webpack restriction); it builds from a path without `!`. Renaming the folder avoids it.
