# 02. Business Requirements Document (BRD)

**Project Reference:** BRD-BLYNT-UK-2026  
**Target Sector:** UK Small & Medium Enterprises (SMEs), Bookkeepers, and Accounting Practices  
**Market Size:** 5.5 Million UK Private Sector Businesses  

---

## 1. The Business Problem & Market Need (Non-Technical Explanation)

In the United Kingdom, every limited company is legally required by the **Companies Act 2006** to keep "adequate accounting records" that disclose with reasonable accuracy at any time the financial position of the company. Furthermore, businesses registered for Value Added Tax (VAT) must comply with **HMRC Making Tax Digital (MTD)** rules.

However, business owners face severe obstacles with current software options:
1. **The "Soft Edit" Dilemma:** In mainstream apps, anyone with editing rights can alter an old invoice or journal entry from six months ago. While this feels convenient for fixing mistakes, it silently changes the past. When an accountant files year-end accounts, those old numbers suddenly no longer match the bank statements. Finding what changed costs thousands of pounds in accounting audit hours.
2. **Subscription Fatigue:** Software vendors have transitioned into aggressive monetization, charging extra for multiple users, basic invoicing, and essential reports. A small business can easily pay £40–£80 per month per company. For an accountant managing 40 client companies, this cost is prohibitive.
3. **Data Contamination:** Many platforms are single-tenant databases wrapped in multi-user interfaces. When an accountant switches between Client A and Client B in multiple browser tabs, cached sessions can cross-contaminate, creating immense GDPR liabilities.

blynt solves these challenges by combining consumer-grade web ergonomics with institutional-grade banking ledger guarantees.

![The Fundamental Double-Entry Accounting Equation and UK Nominal Classes](diagrams/diagram_2_double_entry_equation.png)

---

## 2. Commercial Pricing Strategy & Unit Economics

### 2.1 Low-Overhead Unit Economics
By utilizing an optimized NestJS modular monolith and PostgreSQL relational schema, blynt achieves extreme operational efficiency:
* **Compute / Memory Footprint:** A single multi-tenant cluster can serve over 5,000 active small business tenants with sub-second response times.
* **Server Cost Per Tenant:** Estimated at **< £0.38 / tenant / month** on managed AWS infrastructure.
* **Gross Margin:** Projected gross margins exceed **86%**, enabling aggressive, disruptive pricing in the UK market.

### 2.2 Commercial Tiers

| Tier Name | Target Customer | Monthly Pricing | Features Included |
| :--- | :--- | :---: | :--- |
| **Sole Trader / Starter** | Freelancers, contractors, micro-businesses | £9 / month | 1 Company, up to 50 invoices/month, full double-entry ledger, customer statements. |
| **Growth Business** | Active UK SMEs with staff and inventory | £19 / month | 1 Company, unlimited invoices, multi-user RBAC, period locking, full reporting. |
| **Accounting Practice** | Bookkeepers, chartered accountants, fractional CFOs | £49 / month | Up to 15 Client Companies included (+£3/mo per extra company), unlimited seats, client switcher. |

---

## 3. High-Level Business Requirements (Functional & Regulatory)

### BR-01: Multi-Company Management for Accountants
* **Business Need:** A chartered accountant should be able to log in once and toggle between 50 different client companies in a single click without logging out or risking cross-company errors.
* **Acceptance:** Instant workspace switching; complete physical isolation of company records.

### BR-02: Double-Entry Enforcement (Zero Imbalance Policy)
* **Business Need:** The Fundamental Accounting Equation ($\text{Assets} = \text{Liabilities} + \text{Equity}$) must NEVER be broken. Unbalanced entries must be blocked before they can touch the database.
* **Acceptance:** A journal entry where debits do not equal credits cannot be validated under any circumstances.

### BR-03: Three-Tier Period Locking for Year-End Filing
* **Business Need:** Protect finalized monthly and yearly books so past tax filings remain identical forever.
* **Acceptance:**
  * `OPEN`: Bookkeepers enter receipts and sales.
  * `SOFT_LOCKED`: Closed for regular staff; only senior accountants can post adjusting entries.
  * `HARD_LOCKED`: Fully locked down; immutable statutory record.

### BR-04: Subledger Synchronization (Debtors & Creditors)
* **Business Need:** Business owners need to know exactly who owes them money (Accounts Receivable) and who they owe money to (Accounts Payable) in real time without waiting for monthly reconciliation.
* **Acceptance:** Real-time customer balance calculations derived from posted invoice lines; instant PDF statement generation.

### BR-05: UK Statutory Compliance (6-Year Rule & HMRC MTD)
* **Business Need:** Comply with Section 386 and Section 388 of the UK Companies Act 2006, which mandates keeping accounting records for a minimum of 6 years from the end of the financial year.
* **Acceptance:** Tamper-proof append-only audit trail guarded by database triggers.
