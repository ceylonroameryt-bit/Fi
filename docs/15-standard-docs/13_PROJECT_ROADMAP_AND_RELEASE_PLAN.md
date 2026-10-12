# 13. Project Roadmap & Release Plan (50-Phase Strategy)

**Strategic Vision:** The Definitive UK Financial Operating Ecosystem  
**Roadmap Framework:** 50 Discrete Engineering Phases across 4 Strategic Milestones  
**Current Execution State:** Milestone 1 Complete (Phases 1–8); Milestone 2 In-Progress (Phases 9–15)  

---

## 1. Strategic Roadmap Vision (Non-Technical Overview)

Building an institutional financial operating system is a multi-stage journey. You cannot build automated AI tax filing or Open Banking live feeds until the core mathematical foundation is completely indestructible.

blynt’s 50-phase roadmap is structured into four progressive strategic milestones:
1. **Milestone 1: The Indestructible Foundation (Phases 1–8) — [COMPLETED]:** Build the core double-entry general ledger, mathematical validation engine, tenant security walls, and financial periods.
2. **Milestone 2: Commercial Workflows & Subledgers (Phases 9–15) — [CURRENT]:** Customer sales invoices, supplier bills, payment receipts, subledger statements, and manual bank reconciliation.
3. **Milestone 3: UK Statutory Tax & HMRC MTD (Phases 16–25) — [Q1 2027]:** Automated 9-box VAT returns, direct digital filing with HMRC, Companies House micro-entity filing, and year-end close.
4. **Milestone 4: Automation & AI Financial Intelligence (Phases 26–50) — [Q2 2027+]:** Live bank feeds via UK Open Banking, OCR receipt scanning, machine learning transaction categorization, and multi-currency consolidation.

![blynt Master 50-Phase Strategic Evolution Roadmap](diagrams/diagram_7_roadmap_milestones.png)

---

## 2. Comprehensive Phase Breakdown

### Milestone 1: Double-Entry Core Engine (Phases 1–8) — [COMPLETED & VERIFIED]
* **Phase 1: Project & Database Foundation:** Multi-workspace monorepo, PostgreSQL 16 schema, `btree_gist` temporal exclusions, append-only triggers, structured logger with correlation IDs.
* **Phase 2: Authentication & Sessions:** `scrypt` password hashing, constant-time verification, multi-session device tracking, and token revocation.
* **Phase 3: Multi-Organisation Management:** Strict tenant boundaries, multi-organisation switcher, company registration metadata.
* **Phase 4: Roles & Permissions (RBAC):** Five system roles (`OWNER`, `ADMINISTRATOR`, `ACCOUNTANT`, `BOOKKEEPER`, `VIEWER`).
* **Phase 5: Chart of Accounts:** Nominal ledger classes 1000–8999, 46-account UK template seed, control account protection.
* **Phase 6: Financial Years & Accounting Periods:** 12-month calendar generator, three-tier period locking (`OPEN`, `SOFT_LOCKED`, `HARD_LOCKED`).
* **Phase 7: Manual Journal Entry:** Multi-line grid, sequential numbering (`JE-YYYY-XXXXXX`), `NUMERIC(19,4)` debit/credit fields.
* **Phase 8: Journal Validation Engine:** 15 accounting rules, balance difference detection, GAAP reversal workflows.

### Milestone 2: Commercial Workflows & Subledgers (Phases 9–15) — [ACTIVE]
* **Phase 9: Contacts V2 & Subledger Foundation:** Unified customer/supplier directory, real-time derived AR/AP balances, multiple contact persons.
* **Phase 10: Sales Invoicing & Billing:** Sales invoice lifecycle, 20% UK VAT calculations, automated posting to GL.
* **Phase 11: Customer Statements & Ageing:** Chronological activity statements with running balances, 30/60/90-day AR ageing analysis.
* **Phase 12: Purchase Bills & Supplier Subledger:** Supplier invoice capture, expense allocation, AP ageing.
* **Phase 13: Customer Receipts & Supplier Payments:** Partial payment allocation, credit notes, payment matching.
* **Phase 14: Bank Accounts & Manual Reconciliation:** Bank nominal accounts, manual statement import (OFX/CSV), reconciliation matching screen.
* **Phase 15: Financial Reports V1:** Real-time Trial Balance, Profit & Loss (P&L), Balance Sheet generation.

### Milestone 3: Tax Compliance & HMRC MTD Integration (Phases 16–25) — [Q1 2027]
* **Phase 16: UK VAT Return Calculation:** Automatic compilation of Boxes 1–9 with audit drill-down.
* **Phase 17: HMRC MTD API Integration:** OAuth2 authentication with HMRC Government Gateway, digital VAT return submission.
* **Phase 18: Year-End Close Automation:** Automated closing journals, Retained Earnings rollover, locking previous financial year.
* **Phase 19: Fixed Asset Register:** Automated monthly straight-line and reducing-balance depreciation postings.
* **Phase 20–25: Statutory Accounting & Practice Tools:** Companies House micro-entity filing export, multi-client practice dashboard, accountant review notes.

### Milestone 4: Advanced Operations, AI & Ecosystem (Phases 26–50) — [Q2 2027+]
* **Phase 26–30: UK Open Banking Live Feeds:** Direct bank feed integration (Plaid / TrueLayer) for Barclays, NatWest, HSBC, Lloyds, Monzo, and Starling.
* **Phase 31–35: AI Receipt Scanning & Document Extraction:** OCR scanning of invoice photos, automatic vendor and tax extraction.
* **Phase 36–40: Machine Learning Nominal Categorization:** Predictive suggestion of nominal expense codes based on vendor history.
* **Phase 41–45: Multi-Currency & Foreign Exchange:** Currency revaluations, realized/unrealized FX gain and loss journal automation.
* **Phase 46–50: Intercompany Consolidation:** Multi-entity holding companies, elimination journals, consolidated group reporting.
