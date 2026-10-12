# 03. Product Requirements Document (PRD)

**Product Name:** blynt Accounting Engine  
**Release Target:** Release 1.0 Production Core  
**Product Owner:** Lead Product Owner & Financial Operations  

---

## 1. User Personas & Non-Technical User Journeys

### Persona 1: Sarah — The Chartered Accountant (Age 42, London)
* **Profile:** Runs a boutique accounting practice with 35 SME clients.
* **Daily Workflow:** Reviews client bookkeeping entries, creates month-end depreciation journals, checks trial balances, and prepares quarterly VAT returns.
* **Core Frustrations:** "Clients constantly edit last month's invoices while I am preparing their VAT return, throwing my whole calculation out of balance. I need a software that lets me lock periods with absolute finality."
* **How blynt Serves Sarah:** Sarah uses the `SOFT_LOCKED` state during month-end close to review drafts, and switches to `HARD_LOCKED` after submitting to HMRC. Nobody can alter those figures ever again.

### Persona 2: David — The SME Founder & Director (Age 34, Manchester)
* **Profile:** Runs a creative digital agency with 8 staff.
* **Daily Workflow:** Sends client invoices, monitors unpaid client balances, checks cash in the bank, and sends receipts to his bookkeeper.
* **Core Frustrations:** "Traditional accounting software makes me feel stupid. I just want to send professional invoices, see who owes me money, and know that my accountant isn't going to yell at me at tax time."
* **How blynt Serves David:** David gets a clean, modern dashboard with live Accounts Receivable totals, professional invoice creation, and automated customer statements.

### Persona 3: Elena — The In-House Bookkeeper (Age 28, Birmingham)
* **Profile:** Records daily transactions, matches bank entries, drafts adjustment entries.
* **Daily Workflow:** Creates draft journals, categorizes expenses, matches customer payment receipts.
* **Core Frustrations:** "I'm terrified of making a mistake that breaks the company accounts or accidentally posting to a protected control account."
* **How blynt Serves Elena:** blynt's live journal tally gives Elena real-time feedback on debits and credits, while built-in rules prevent her from accidentally posting manual entries to protected control accounts like Debtors Control (`1100`).

![Figure 4 - Journal lifecycle and ledger impact](diagrams/figure_4_journal_lifecycle.png)

![Figure 5 - Sales invoice accounting flow](diagrams/figure_5_sales_invoice_posting.png)

![Figure 6 - Customer payment allocation and accounting flow](diagrams/figure_6_customer_payment_flow.png)

---

## 2. Product Functional Specifications

### 2.1 Module 1: Chart of Accounts (COA)
* **Nominal Code Architecture:** Standardized 4-digit UK numbering:
  * `1000–1999`: Assets (Bank, Accounts Receivable, Equipment)
  * `2000–2999`: Liabilities (Accounts Payable, VAT Output Tax, Loans)
  * `3000–3999`: Equity (Share Capital, Retained Earnings)
  * `4000–4999`: Revenue (Sales Revenue, Service Fees)
  * `5000–8999`: Expenses (Cost of Goods Sold, Rent, Software, Wages)
* **System Control Accounts:**
  * Accounts such as Debtors Control (`1100`) and Creditors Control (`2000`) are flagged with `isControlAccount = true`.
  * Manual journal entries directly to these accounts are blocked. They can only be updated automatically through commercial subledger transactions (invoices and bills).
* **Account Archiving:** Accounts cannot be deleted if historical transactions exist. They can only be archived, preventing new entries while preserving complete audit history.

### 2.2 Module 2: Financial Years & Period Locking
* **Automated Calendar Generation:** Creating a financial year (e.g., 1 April 2026 to 31 March 2027) automatically generates 12 sequential monthly periods without gaps or overlaps.
* **Three-Tier Locking State Machine:**
  * `OPEN`: Standard posting permitted for all authorized roles.
  * `SOFT_LOCKED`: Closed to regular bookkeepers; warning displayed; allows accountant adjustments.
  * `HARD_LOCKED`: Immutable lockdown; 100% rejection of any journal posting or validation.

### 2.3 Module 3: Journal Entry & Validation Engine
* **Drafting Workflow:** Multi-line grid with instant client-side tally of debits, credits, and differences.
* **Sequential Numbering:** Automatic generation of unique sequence numbers matching `JE-YYYY-XXXXXX` (e.g., `JE-2026-000001`) via atomic sequence counters.
* **Validation Invariants:** The engine evaluates 15 rules before marking a journal as `VALIDATED`.
* **GAAP Reversal Workflow:** If a mistake is made on a validated journal, users cannot delete it. They click "Reverse", which generates an equal and opposite balancing journal.

### 2.4 Module 4: Contacts & Subledger Management
* **Customer & Supplier Directory:** Contact records tagged as `CUSTOMER`, `SUPPLIER`, or `BOTH`.
* **Dynamic Subledger Calculations:** Accounts Receivable (AR) and Accounts Payable (AP) balances are derived directly from posted journal lines tagged with `contactId`. No cached balance columns exist, eliminating balance drift.
* **Customer Statements:** Chronologically sorted activity reports showing opening balance, invoice debits, payment credits, running balances, and closing balance.

---

## 3. Scope & Release Progression Matrix

| Feature Module | Core MVP (Phase 1–8) | Current Subledger (Phase 9–15) | Future Statutory (Phase 16–50) |
| :--- | :---: | :---: | :---: |
| Double-Entry General Ledger | ✅ Complete | ✅ Complete | ✅ Complete |
| 15-Rule Validation Engine | ✅ Complete | ✅ Complete | ✅ Complete |
| Three-Tier Period Lockdown | ✅ Complete | ✅ Complete | ✅ Complete |
| Contacts & AR/AP Subledgers | 🔄 Current | ✅ Complete | ✅ Complete |
| Sales Invoicing & 20% VAT | 🔄 Current | ✅ Complete | ✅ Complete |
| Customer Statements (PDF) | 🔄 Current | ✅ Complete | ✅ Complete |
| UK VAT Return (Boxes 1–9) | ❌ Deferred | 🔄 Next Phase | ✅ Complete |
| HMRC MTD Direct API Filing | ❌ Deferred | ❌ Deferred | ✅ Complete |
| UK Open Banking Live Feeds | ❌ Deferred | ❌ Deferred | ✅ Complete |
| AI Receipt OCR Extraction | ❌ Deferred | ❌ Deferred | ✅ Complete |
