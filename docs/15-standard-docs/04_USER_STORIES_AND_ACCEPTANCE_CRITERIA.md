# 04. User Stories & Acceptance Criteria

**Standard:** Agile Gherkin Methodology (*Given-When-Then*)  
**Coverage:** Core Accounting, Subledgers, Period Locking, Security, and Auditability  

---

## Story 1: Manual Journal Posting with Balance Equilibrium
**Non-Technical Summary:** When a user creates a journal entry to adjust accounts (for example, recording annual equipment depreciation), the software must guarantee that every pound deducted from one account is balanced by an exact pound credited to another account.

![Figure 3 - Central accounting posting flow](diagrams/figure_3_central_posting_flow.png)

* **User Story:**
  * **As an** Accountant or Bookkeeper,
  * **I want to** enter a multi-line journal entry with debit and credit amounts,
  * **So that** I can adjust account balances while ensuring the balance sheet remains in mathematical equilibrium.

* **Scenario 1.1: Successful Balanced Validation**
  * **Given** an active organisation with an `OPEN` accounting period for date `2026-10-15`
  * **And** a draft journal with:
    * Line 1: `DR 6500 (Depreciation Expense) £750.0000`
    * Line 2: `CR 1810 (Accumulated Depreciation) £750.0000`
  * **When** the user clicks "Validate Journal"
  * **Then** the validation engine calculates Total Debits (`£750.0000`) and Total Credits (`£750.0000`)
  * **And** confirms the difference is exactly `£0.0000`
  * **And** transitions the journal status from `DRAFT` to `VALIDATED`
  * **And** assigns an atomic sequence number matching `JE-2026-XXXXXX`
  * **And** records an immutable audit log entry.

* **Scenario 1.2: Rejection of Unbalanced Journal**
  * **Given** a draft journal with Total Debits of `£1,000.0000` and Total Credits of `£950.0000`
  * **When** the user attempts to validate the journal
  * **Then** the validation engine calculates a difference of `£50.0000`
  * **And** rejects the transaction with HTTP 400 Bad Request
  * **And** returns error code `ERR_JOURNAL_UNBALANCED`
  * **And** the journal status remains in `DRAFT` without modifying any account balances.

---

## Story 2: Protection of System Control Accounts
**Non-Technical Summary:** Special accounts like "Debtors Control" track what customers owe from invoices. If bookkeepers could manually type random adjustments into these accounts, the customer invoices would no longer match the total balance. blynt blocks manual entries to these protected accounts.

* **User Story:**
  * **As a** Lead Financial Controller,
  * **I want** system control accounts to reject direct manual journals,
  * **So that** the general ledger and subledger balances never diverge.

* **Scenario 2.1: Rejection of Manual Entry to Debtors Control**
  * **Given** Account `1100 (Debtors Control Account)` with flag `isControlAccount = true`
  * **When** a user includes Account `1100` as a line item in a manual journal entry
  * **And** submits the journal for validation
  * **Then** the validation engine detects the control account flag
  * **And** aborts the transaction with HTTP 400 Bad Request
  * **And** returns error code `ERR_CONTROL_ACCOUNT_DIRECT_POSTING_PROHIBITED`.

---

## Story 3: Period Lockdown Enforcement
**Non-Technical Summary:** Once year-end accounts are submitted to HMRC or Companies House, those months must be locked like a time capsule. Nobody can change anything in that period.

* **User Story:**
  * **As an** Audit Lead or Business Director,
  * **I want to** place an accounting period into a hard-locked state,
  * **So that** historical financial statements can never be retroactively changed.

* **Scenario 3.1: Complete Rejection in Hard-Locked Period**
  * **Given** Accounting Period `2026-03` has status `HARD_LOCKED`
  * **When** any user attempts to create, update, or validate a journal with entry date `2026-03-25`
  * **Then** the validation engine immediately halts the operation with HTTP 403 Forbidden
  * **And** returns error code `ERR_PERIOD_HARD_LOCKED`
  * **And** logs a security audit event documenting the attempted access.

---

## Story 4: Sales Invoice Posting to Subledger & GL
**Non-Technical Summary:** When a business sends an invoice to a customer, three things happen automatically: the company recognizes sales revenue, accounts for the 20% VAT it owes to HMRC, and records that the customer owes them the full amount.

* **User Story:**
  * **As a** Small Business Owner,
  * **I want to** approve and post a sales invoice,
  * **So that** revenue and output VAT are recognized in the ledger and the customer's balance updates automatically.

* **Scenario 4.1: Automated Double-Entry Posting of Invoices**
  * **Given** a draft sales invoice for Customer `Alpha Ltd` with:
    * Net Amount: `£2,000.00`
    * VAT Rate: `20% Standard` (`£400.00`)
    * Total Invoice Amount: `£2,400.00`
  * **When** the user clicks "Post Invoice"
  * **Then** the system automatically generates a General Ledger journal entry:
    * `DR 1100 Debtors Control`: `£2,400.00` (tagged with `contactId = Alpha Ltd`)
    * `CR 4000 Sales Revenue`: `£2,000.00`
    * `CR 2100 VAT Output Tax`: `£400.00`
  * **And** the customer's derived Accounts Receivable balance immediately increases by `£2,400.00`
  * **And** the invoice status transitions to `POSTED`.

---

## Story 5: Non-Destructive Journal Reversal
**Non-Technical Summary:** In traditional accounting, if you make a mistake on a published ledger entry, you do not use an eraser. Instead, you write an equal and opposite transaction that cancels out the error, creating a transparent audit trail.

* **User Story:**
  * **As an** Accountant,
  * **I want to** reverse an erroneous posted journal entry,
  * **So that** the mistake is corrected without deleting historical audit records.

* **Scenario 5.1: Generation of Balancing Reversal Journal**
  * **Given** a validated journal `JE-2026-000045` with:
    * Line 1: `DR 5000 (Rent Expense) £1,200.00`
    * Line 2: `CR 1000 (Bank Account) £1,200.00`
  * **When** the accountant triggers "Reverse Journal"
  * **Then** the system marks `JE-2026-000045` as `REVERSED`
  * **And** creates a new journal entry `JE-2026-000046` with swapped lines:
    * Line 1: `DR 1000 (Bank Account) £1,200.00`
    * Line 2: `CR 5000 (Rent Expense) £1,200.00`
  * **And** links `JE-2026-000046` back to `JE-2026-000045` as its parent reversal in the audit log.
