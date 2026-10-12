# 01. Project Charter: blynt

**Project Identifier:** blynt (Internal Code: Ledgerline)  
**Executive Sponsor:** Chief Executive Officer & Founding Directorate  
**Lead Architect:** Principal Systems Architect & Antigravity Engineering  
**Publication Date:** October 2026  
**Document Classification:** Confidential / Strategic Engineering Asset  

---

## 1. Executive Summary (Non-Technical Overview)

### What is blynt in Plain English?
Imagine you run a growing business in the United Kingdom. Every day, money flows in from customer invoices and flows out for staff salaries, software subscriptions, inventory, and office rent. At the end of every quarter and year, Her Majesty’s Revenue and Customs (HMRC) and Companies House require you to submit exact, mathematically verifiable accounts and VAT returns.

Historically, small and medium enterprises (SMEs) have relied on software like Xero, QuickBooks, or Sage. However, these legacy platforms have evolved into expensive, bloated systems. Worse yet, many allow users to retroactively modify or delete old financial transactions. If a bookkeeper accidentally changes an invoice from six months ago, the entire company’s historical tax filings become invalid, triggering HMRC audit penalties and expensive accountant investigation fees.

**blynt is a next-generation financial operating system built on institutional-grade double-entry accounting.**
* **Like a Digital Bank Vault:** Once a financial month is closed and locked, nobody—not even the business owner or software developer—can rewrite history.
* **Zero Pennies Lost:** Computers normally use floating-point math that rounds numbers like `0.1 + 0.2` to `0.30000000000000004`. Over thousands of transactions, businesses accumulate fractional penny errors. blynt uses fixed-point math with four decimal places (`NUMERIC(19,4)`), guaranteeing that every single penny balances down to the fraction of a cent.
* **Separation of Client Data:** For accounting firms managing dozens of client businesses, blynt builds concrete walls between companies. It is physically impossible for Company A to accidentally see or touch Company B’s invoices or contacts.

![The Business Problem: Legacy Accounting Platforms vs. blynt Solution](diagrams/diagram_1_business_problem_solution.png)

---

## 2. Strategic Business Drivers & Opportunity

1. **Market Inflation & Incumbent Fatigue:** Incumbent platforms have increased monthly pricing by 15–30% year-on-year while customer service response times have degraded. Small accounting firms are actively seeking modern alternatives that provide speed and predictability.
2. **Regulatory Mandates (HMRC Making Tax Digital):** UK law mandates digital record-keeping for VAT-registered entities. blynt embeds digital audit trails directly into the database engine, making compliance automatic rather than a manual chore.
3. **The Rise of Tech-Enabled Accounting Practices:** Modern fractional CFOs and digital-first bookkeeping agencies demand fast web workstations with instant keyboard shortcuts, real-time trial balances, and zero latency.

---

## 3. Project Objectives & Success Criteria (KPIs)

| Objective | Non-Technical Description | Technical Verification Metric | Target KPI |
| :--- | :--- | :--- | :---: |
| **Mathematical Equilibrium** | Books must always balance perfectly; debits must equal credits. | `SUM(journal_lines.debit) == SUM(journal_lines.credit)` | **100.000%** |
| **Ledger Performance** | Reports like Balance Sheet and Trial Balance must generate instantly. | p95 HTTP response latency on `/reports/*` endpoints | **< 150ms** |
| **Multi-Tenant Security** | Absolute isolation between independent client companies. | Zero cross-tenant data leakage incidents | **0 Incidents** |
| **Audit Durability** | Complete non-repudiation of transactions for statutory audits. | PostgreSQL trigger prevention of `UPDATE`/`DELETE` on `audit_logs` | **100% Immutable** |
| **Unit Cost Efficiency** | Keeping infrastructure server costs low so pricing is disruptive. | Average cloud compute/database cost per active tenant | **< £0.40 / month** |

---

## 4. Scope Governance

### In-Scope Deliverables (Current Milestone: Phases 1–8 Core + Subledgers)
* Multi-workspace monorepo with NestJS 11 backend and Next.js 15 (Turbopack) web interface.
* Relational database architecture featuring PostgreSQL 16 with composite foreign keys and temporal exclusion.
* Cryptographically secure session authentication with native `crypto.scrypt` password hashing.
* Multi-organisation switching enabling accounting firms to oversee multiple business entities under a single profile.
* Role-Based Access Control (RBAC) with five granular tiers: `OWNER`, `ADMINISTRATOR`, `ACCOUNTANT`, `BOOKKEEPER`, `VIEWER`.
* UK Nominal Chart of Accounts (Codes 1000–8999) with control account locking.
* 12-month accounting period automation with three-tier locking state machine (`OPEN`, `SOFT_LOCKED`, `HARD_LOCKED`).
* Double-entry journal posting engine enforcing 15 accounting validation rules and atomic sequence numbers (`JE-YYYY-XXXXXX`).
* Accounts Receivable (AR) and Accounts Payable (AP) subledger foundation with real-time customer and supplier statement generation.

### Out-of-Scope (Deferred to Future Strategic Phases)
* Direct UK Open Banking API feeds (Phase 20+).
* Automated payroll processing (Phase 30+).
* Multi-currency foreign exchange revaluations (Phase 50).

---

## 5. Organizational Authority & Project Charter Sign-off
* **Project Executive (CEO):** Approves strategic roadmap, marketing budget, commercial launch dates, and pricing tiers.
* **Principal Architect:** Has unilateral veto authority on database schema changes, arithmetic precision, and security boundaries.
* **Product Manager:** Governs feature prioritization, user story acceptance criteria, and UX workflows.
* **Lead Accountant / Compliance Advisor:** Validates UK GAAP alignment, HMRC MTD compliance, and VAT box derivation.
