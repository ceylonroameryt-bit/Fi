# 14. Risk Register & RAID Log

**Project Ref:** RAID-BLYNT-2026  
**Management Framework:** Continuous Agile RAID Assessment (Risks, Assumptions, Issues, Dependencies)  
**Risk Scoring Formula:** $\text{Risk Score} = \text{Probability (1–5)} \times \text{Impact (1–5)}$  

---

## 1. Risk Register (Critical Vulnerabilities & Mitigations)

| Risk ID | Risk Description | Prob (1-5) | Imp (1-5) | Score (1-25) | Non-Technical Rationale & Engineering Mitigation | Owner | Status |
| :---: | :--- | :---: | :---: | :---: | :--- | :---: | :---: |
| **RSK-01** | **Floating-point mathematical rounding errors** causing general ledger imbalance in tax filings. | 1 | 5 | **5 (Low)** | *Why it matters:* A single penny discrepancy in a multi-million-pound business triggers audit flags.<br/>*Mitigation:* 100% of arithmetic handled via `Decimal.js` and `NUMERIC(19,4)`. Banned JavaScript native `number` from financial pipelines. | Backend Lead | Controlled |
| **RSK-02** | **Accidental cross-tenant data leak** where Company A views Company B's client list or invoices. | 1 | 5 | **5 (Low)** | *Why it matters:* Catastrophic GDPR violation that would destroy market credibility.<br/>*Mitigation:* Composite foreign keys `(organization_id, id)` enforced at PostgreSQL schema level. The database engine rejects foreign associations crossing tenant lines. | Lead Architect | Controlled |
| **RSK-03** | **Retroactive modifications to historical periods** invalidating filed HMRC VAT returns. | 1 | 5 | **5 (Low)** | *Why it matters:* Can result in HMRC penalties and incorrect dividend distributions.<br/>*Mitigation:* Three-tier period locking state machine (`HARD_LOCKED`) physically blocks journal creation or validation within locked dates. | Product Owner | Controlled |
| **RSK-04** | **Concurrency race condition** generating duplicate journal sequence numbers during high traffic. | 2 | 4 | **8 (Medium)**| *Why it matters:* Breaks sequential ledger auditability mandated by Companies House.<br/>*Mitigation:* Atomic sequence increments executed inside serializable PostgreSQL database transactions. | Backend Lead | Controlled |
| **RSK-05** | **Changes in HMRC MTD API specifications** during Q1 2027 release window. | 3 | 3 | **9 (Medium)**| *Why it matters:* Could delay automated VAT filing launch.<br/>*Mitigation:* Isolated adapter service decoupling core ledger from HMRC transmission protocols. | Compliance Lead | Monitoring |

---

## 2. Assumptions Log (Key Foundations)

* **ASM-01 (UK GAAP Alignment):** We assume target SME customers operate under standard UK GAAP (FRS 102 / FRS 105) reporting standards.
* **ASM-02 (Database Sovereignty):** We assume target UK clients require cloud infrastructure hosted within the UK / EEA (fulfilled by AWS `eu-west-2` London).
* **ASM-03 (Browser Compatibility):** We assume modern web client usage (Chromium, Safari, Firefox) with JavaScript enabled, supporting Next.js 15 App Router.

---

## 3. Issues Log (Resolved Technical Hurdles)

* **ISS-01 (Database Overlap Edge Cases):** Calendar calculations could accidentally generate overlapping financial periods during leap years.
  * *Resolution:* Implemented PostgreSQL `btree_gist` temporal exclusion constraint, turning calendar overlaps into hard database errors.
* **ISS-02 (Audit Trail Vulnerability):** Concern that a malicious database administrator could execute SQL `DELETE` to hide ledger errors.
  * *Resolution:* Added PostgreSQL database trigger `prevent_audit_log_mutation()` that intercepts and cancels any `UPDATE` or `DELETE` on `audit_logs`.

---

## 4. Dependencies Log (External Factors)

* **DEP-01 (PostgreSQL `btree_gist` Extension):** Requires hosting providers that permit custom PostgreSQL extensions (supported on AWS Aurora, Render, and Railway).
* **DEP-02 (HMRC Government Gateway API Access):** Production MTD filing requires registered HMRC Developer credentials and sandbox approval.
