# 15. RACI Governance Matrix & Team Authority

**Governance Framework:** RACI Operational Responsibility Model  
**Review Frequency:** Sprint Retrospective & Executive Steering Committee  

---

## 1. RACI Definitions & Rules of Governance

* **R — Responsible:** The person or role tasked with doing the actual work, writing the code, creating the document, or executing the test.
* **A — Accountable:** The **sole** individual with final decision-making power and veto authority. Exactly **one** 'A' is permitted per activity.
* **C — Consulted:** Subject matter experts who must be consulted for opinions, advice, and compliance input prior to execution.
* **I — Informed:** Stakeholders kept informed of progress, milestones, and outcomes.

---

## 2. Institutional RACI Responsibility Matrix

| Project Deliverable & Milestone | Executive Sponsor (CEO) | Product Manager (PM) | Lead Architect | Backend Engineers | Frontend Engineers | QA & Compliance Lead |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Project Charter, Budget & Pricing** | **A** | R | C | I | I | I |
| **Market Requirements (BRD & PRD)** | I | **A** / R | C | C | C | C |
| **User Stories & Acceptance Testing**| I | **A** | C | R | R | C |
| **Double-Entry Engine Architecture (SAD)**| I | C | **A** / R | C | I | C |
| **Database Schema, FKs & Triggers** | I | I | **A** | R | I | C |
| **API Endpoint Contracts & DTOs** | I | C | A | **R** | C | C |
| **Web Frontend Implementation (Next.js)**| I | C | I | C | **A** / R | I |
| **Security, STRIDE & Password Hashing** | I | I | A | C | C | **R** |
| **Accounting Rules & Period Locking**| I | C | A | **R** | I | C |
| **CI/CD Pipelines & Docker Containers** | I | I | A | C | I | **R** |
| **Statutory Compliance (HMRC / MTD)** | I | C | C | C | I | **A** / R |
| **Final Production Release Sign-Off** | **A** | R | R | I | I | R |

---

## 3. Decision Escalation Protocol

1. **Architecture & Ledger Invariants:** The **Lead Architect** has unilateral veto authority over any proposed change that touches `Decimal.js` math, double-entry balance validation, or composite foreign keys.
2. **Statutory & Accounting Compliance:** The **Compliance Lead** has unilateral veto authority over nominal account categorizations, tax calculation logic, and VAT box mappings.
3. **Budget, Commercials & Timeline:** The **Executive Sponsor (CEO)** makes final binding decisions regarding pricing tiers, infrastructure budgets, and commercial launch dates.
