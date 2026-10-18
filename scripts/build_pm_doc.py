import os
import re
import sys
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

WORKSPACE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS_DIR = os.path.join(WORKSPACE_DIR, "docs")
DIAGRAMS_DIR = os.path.join(DOCS_DIR, "diagrams")
OUTPUT_MD = os.path.join(DOCS_DIR, "BLYNT_PRODUCT_MANAGEMENT_HANDBOOK.md")
OUTPUT_DOCX = os.path.join(DOCS_DIR, "blynt_Product_Management_Handbook.docx")
OUTPUT_PDF = os.path.join(DOCS_DIR, "blynt_Product_Management_Handbook.pdf")
LOGO_PATH = os.path.join(WORKSPACE_DIR, "blynt-logo.png")

NAVY = RGBColor(22, 45, 95)       # #162D5F
CORAL = RGBColor(255, 127, 108)   # #FF7F6C
SLATE = RGBColor(71, 85, 105)     # #475569
CHARCOAL = RGBColor(30, 41, 59)   # #1E293B

def set_cell_background(cell, color_hex):
    shading_elm = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{color_hex}"/>')
    cell._tc.get_or_add_tcPr().append(shading_elm)

def set_cell_margins(cell, top=70, bottom=70, left=100, right=100):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = OxmlElement('w:tcMar')
    for m, val in [('top', top), ('bottom', bottom), ('left', left), ('right', right)]:
        node = OxmlElement(f'w:{m}')
        node.set(qn('w:w'), str(val))
        node.set(qn('w:type'), 'dxa')
        tcMar.append(node)
    tcPr.append(tcMar)

def add_cover_page(doc):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(30)
    p.paragraph_format.space_after = Pt(10)

    if os.path.exists(LOGO_PATH):
        try:
            run = p.add_run()
            run.add_picture(LOGO_PATH, width=Inches(1.65))
        except Exception:
            pass

    p_title = doc.add_paragraph()
    p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_title.paragraph_format.space_before = Pt(25)
    p_title.paragraph_format.space_after = Pt(8)
    run_title = p_title.add_run("blynt")
    run_title.font.name = "Segoe UI"
    run_title.font.size = Pt(38)
    run_title.font.bold = True
    run_title.font.color.rgb = NAVY

    p_sub = doc.add_paragraph()
    p_sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_sub.paragraph_format.space_after = Pt(12)
    run_sub = p_sub.add_run("PRODUCT MANAGEMENT HANDBOOK & SPECIFICATION")
    run_sub.font.name = "Segoe UI"
    run_sub.font.size = Pt(16)
    run_sub.font.bold = True
    run_sub.font.color.rgb = NAVY

    p_tagline = doc.add_paragraph()
    p_tagline.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_tagline.paragraph_format.space_after = Pt(20)
    r_tagline = p_tagline.add_run("Product Vision & Strategy • Detailed User Personas & Journey Maps\nPRD Standards & Gherkin Templates • RICE Prioritization • Agile Sprint Operations\nRelease Governance & Telemetry KPI Measurement • October 2026")
    r_tagline.font.name = "Segoe UI"
    r_tagline.font.size = Pt(11)
    r_tagline.font.color.rgb = CORAL

    tbl = doc.add_table(rows=1, cols=1)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    c = tbl.cell(0, 0)
    set_cell_background(c, "EEF2F9")
    set_cell_margins(c, top=100, bottom=100, left=180, right=180)
    p_in = c.paragraphs[0]
    p_in.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_in = p_in.add_run("Authoritative Product Management Operating System\n")
    r_in.bold = True
    r_in.font.name = "Segoe UI"
    r_in.font.size = Pt(10.5)
    r_in.font.color.rgb = NAVY
    r_in2 = p_in.add_run("Standardized Framework for Product Managers, Business Analysts, Design Leads & Product Owners")
    r_in2.font.name = "Segoe UI"
    r_in2.font.size = Pt(9.5)
    r_in2.font.color.rgb = SLATE

    meta_tbl = doc.add_table(rows=4, cols=2)
    meta_tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    meta_data = [
        ("Product Entity:", "blynt Cloud Accounting Operating System"),
        ("Audience:", "Product Managers, Associate PMs, Tech Leads, Engineering Directors"),
        ("Release Cadence:", "Bi-Weekly Sprint Cycles | Monthly Minor | Quarterly Major"),
        ("Document Classification:", "Enterprise Product Operational Standard — Confidential")
    ]
    for i, (k, v) in enumerate(meta_data):
        c0 = meta_tbl.cell(i, 0)
        c1 = meta_tbl.cell(i, 1)
        c0.text = k
        c1.text = v
        c0.paragraphs[0].runs[0].font.bold = True
        c0.paragraphs[0].runs[0].font.color.rgb = NAVY
        c0.paragraphs[0].runs[0].font.size = Pt(9.5)
        c0.paragraphs[0].runs[0].font.name = "Segoe UI"
        c1.paragraphs[0].runs[0].font.color.rgb = SLATE
        c1.paragraphs[0].runs[0].font.size = Pt(9.5)
        c1.paragraphs[0].runs[0].font.name = "Segoe UI"
        set_cell_margins(c0, top=40, bottom=40, left=80, right=80)
        set_cell_margins(c1, top=40, bottom=40, left=80, right=80)

    doc.add_page_break()

PM_MARKDOWN = """# blynt Product Management Handbook & Specification

**Document Version:** 2.0  
**Status:** Approved & Baselined  
**Classification:** Enterprise Product Standard  
**Target Audience:** Product Managers, Technical Product Managers, Product Owners, Engineering Leads, UX Designers  

---

## 1. Executive Product Vision, North Star & Market Strategy

### 1.1 The Market Opportunity & Core Problem Statement
Modern businesses in the UK and European economic zones operate in a severely fragmented financial software landscape. Traditional legacy Enterprise Resource Planning (ERP) systems such as SAP, Oracle NetSuite, and Sage Intacct are prohibitively expensive, cumbersome to deploy, and suffer from decades of technical debt. Conversely, entry-level bookkeeping platforms like Xero and QuickBooks Online lack rigorous double-entry invariant enforcement at the API layer, offer limited real-time subledger synchronization, and collapse under high-volume multi-entity, multi-currency transaction demands.

**blynt** resolves this fundamental market divergence by delivering a cloud-native, real-time double-entry financial operating system. Designed from first principles, blynt guarantees zero accounting drift, sub-second financial reporting, native UK HMRC Making Tax Digital (MTD) compliance, and an open, developer-centric REST API.

```
+--------------------------------------------------------------------------------------------------+
|                                  THE BLYNT PRODUCT ADVANTAGE                                    |
+------------------------------------+----------------------------------+--------------------------+
| Dimension                          | Legacy ERPs (NetSuite / SAP)     | Entry SMB (Xero / QBO)   |
+------------------------------------+----------------------------------+--------------------------+
| Implementation Timeline            | 6 to 18 Months                   | Instant Self-Serve       |
| Invariant Integrity (Sum D = Sum C)| Batch Reconciled (Nightly)       | Weak / Drift Prone       |
| Modern Open Developer APIs         | SOAP / Rigid Legacy REST         | Rate-Limited Basic APIs  |
| Real-Time Subledger Posting        | Batched Processing Lag           | Shallow Entity Depth     |
| Total Cost of Ownership (TCO)      | High Enterprise Capex/Opex       | Low, but quickly outgrown|
| blynt Delivery Model               | Instant Deploy, Cloud-Native, Invariant-Guaranteed, Affordable   |
+------------------------------------+----------------------------------+--------------------------+
```

### 1.2 Core Product Pillars & Value Propositions
Every feature, enhancement, and initiative prioritized within the blynt product roadmap must directly advance one or more of our five foundational product pillars:

1. **Mathematical Invariant Integrity**: Zero toleration for ledger imbalance. At every layer—from frontend forms down to database row-level locking—the fundamental accounting equation $\\sum \\text{Debits} \\equiv \\sum \\text{Credits}$ is immutably enforced.
2. **Sub-Second Financial Intelligence**: Eliminating month-end close latency. Profit & Loss, Balance Sheet, and Trial Balance reports recalculate in under 500 milliseconds across millions of journal lines.
3. **Automated Regulatory & HMRC MTD Compliance**: Out-of-the-box VAT returns, statutory 6-year retention compliance, and fraud prevention headers built natively into the platform workflows.
4. **Developer-First Extensibility**: Treating our REST and Webhook APIs as first-class citizen products, empowering modern engineering teams to embed financial ledger capabilities directly into custom software.
5. **Frictionless Enterprise UX**: Clean, intuitive typography, high information density, keyboard-first navigation shortcuts, and zero unnecessary modal interruptions.

### 1.3 Product North Star Metric & OKR Cascade
The North Star Metric for the blynt product organization is:
> **Weekly Balanced Journal Lines Posted (WBJLP) with Zero Invariant Drift**

This metric reflects active customer engagement, genuine economic value flowing through the platform, and unrelenting adherence to accounting accuracy.

```
                          +------------------------------------------------------+
                          |                  NORTH STAR METRIC                   |
                          |       Weekly Balanced Journal Lines Posted (WBJLP)   |
                          |              with 0.00% Invariant Drift              |
                          +--------------------------+---------------------------+
                                                     |
         +-------------------------------------------+------------------------------------------+
         |                                           |                                          |
         v                                           v                                          v
+-----------------------------+             +-----------------------------+            +-----------------------------+
|    Objective 1: Velocity    |             |    Objective 2: Friction    |            |   Objective 3: Expansion    |
| Accelerate Month-End Close  |             | Eliminate Reconciliation    |            | Drive Multi-Entity Adoption |
| KR: Reduce close from 12    |             | Bottlenecks                 |            | KR: 40% of tenants manage   |
| days down to < 2 days.      |             | KR: >85% auto-bank match.   |            | >= 2 legal entities.        |
+-----------------------------+             +-----------------------------+            +-----------------------------+
```

---

## 2. Comprehensive User Personas & End-to-End Customer Journeys

To ensure user-centered product design and rigorous acceptance criteria, blynt defines five primary customer personas.

### 2.1 Persona 1: Elena Vance — Chief Financial Officer (CFO) / Finance Director
* **Demographics:** Age 42, 18 years in corporate finance, oversees a fast-growing scaleup (120 employees, £18M ARR).
* **Core Goals:** Real-time visibility into consolidated cash flow, runway forecasting, audit readiness, and rapid monthly board pack generation.
* **Key Pain Points:** Disjointed data across banking apps and invoicing tools; agonizing 14-day month-end close; fear of non-compliance penalties with HMRC.
* **Product Needs:** High-level dashboard widgets, instant multi-entity consolidation, drill-down to underlying journal lines, one-click PDF export for executive decks.

### 2.2 Persona 2: Marcus Reed — Financial Controller / Chief Accountant
* **Demographics:** Age 36, ACA/ACCA qualified, 12 years in professional accounting and controllership.
* **Core Goals:** Absolute trial balance balancing, rigorous period-end locking, clean accruals and prepayments, automated bank reconciliation.
* **Key Pain Points:** Manual spreadsheet reconciliations that break; junior bookkeepers posting unapproved journal entries; untracked invoice alterations.
* **Product Needs:** Granular approval workflows (Maker-Checker), period-lock dates with override controls, automated rule-based bank matching, immutable audit trails.

### 2.3 Persona 3: Sarah Jenkins — Accounts Payable (AP) & Bookkeeping Specialist
* **Demographics:** Age 29, 6 years in day-to-day transaction processing and supplier relationship management.
* **Core Goals:** High-velocity invoice entry, zero data-entry typos, supplier payment batch preparation, rapid expense categorisation.
* **Key Pain Points:** Clunky UI that requires switching between mouse and keyboard; manual OCR corrections; missing supplier VAT numbers.
* **Product Needs:** Keyboard-driven invoice creation (`Ctrl+Enter` to post), automated OCR line-item matching, bulk bill payments, clear tax rate selectors.

### 2.4 Persona 4: David Chen — Platform Engineer & API Integrator
* **Demographics:** Age 31, Lead Backend Engineer at an e-commerce platform integrating blynt for billing automation.
* **Core Goals:** Programmatic invoice generation, reliable webhook event ingestion, sandbox environment testing, automated payout reconciliation.
* **Key Pain Points:** Poorly documented APIs; lack of idempotency leading to duplicate billing; vague HTTP 500 error messages.
* **Product Needs:** OpenAPI/Swagger interactive docs, `Idempotency-Key` request support, sandbox test tenants, real-time webhook payload verification.

### 2.5 Persona 5: Rachel Adams — External HMRC Auditor & Chartered Accountant
* **Demographics:** Age 48, Senior Partner at an audit practice, conducts annual statutory financial audits.
* **Core Goals:** Independent sampling verification, verifying that posted entries cannot be silently deleted, validating VAT return calculations against HMRC guidelines.
* **Key Pain Points:** Opaque accounting databases with no change-log history; tampered invoice records; missing digital links in MTD chains.
* **Product Needs:** Read-only auditor tenant access, WORM-compliant SHA-256 tamper-evident export packs, digital link audit lineage reports.

### 2.6 End-to-End Customer Journey Map
The following table maps the standard end-to-end customer journey from initial tenant onboarding to annual audit completion:

```
+----------------------------------------------------------------------------------------------------------------------------+
|                                          BLYNT END-TO-END CUSTOMER JOURNEY MAP                                             |
+-------------------+-----------------------------+-------------------------------+------------------------------------------+
| Journey Stage     | Primary Actor               | Key Activities                | Critical Product Touchpoints / Features  |
+-------------------+-----------------------------+-------------------------------+------------------------------------------+
| 1. Onboarding     | CFO & Controller            | Company creation, Chart of    | Tenant Provisioning Wizard, COA Template |
|    & Setup        |                             | Accounts selection, VAT setup | Selector, User Role Invitation Guard     |
+-------------------+-----------------------------+-------------------------------+------------------------------------------+
| 2. Banking Feed   | Controller / Bookkeeper     | Open Banking OAuth connect,   | Bank Feed Connector, Transaction Stream, |
|    Integration    |                             | historical feed synchronization| Bank Rule Builder Engine                 |
+-------------------+-----------------------------+-------------------------------+------------------------------------------+
| 3. Daily Ops      | Bookkeeper & AP Specialist  | Sales invoice creation, bill  | Invoicing Engine, OCR Attachment Upload, |
|    (AR / AP)      |                             | capture, payment receipting   | Customer Credit Note & Ledger Sync       |
+-------------------+-----------------------------+-------------------------------+------------------------------------------+
| 4. Bank Recon     | Financial Controller        | 1-click matching, rule-based  | Reconciliation Workbench, Variance Alert,|
|    & Matching     |                             | clearing, manual adjustments  | Unmatched Transaction Basket             |
+-------------------+-----------------------------+-------------------------------+------------------------------------------+
| 5. Period Close   | CFO & Financial Controller  | Depreciation, prepayments,    | Period Close Checklist, Hard Date Lock,  |
|    & Reporting    |                             | subledger reconciliation, P&L | Real-Time Trial Balance, Board Pack PDF  |
+-------------------+-----------------------------+-------------------------------+------------------------------------------+
| 6. HMRC Filing    | CFO & External Auditor      | MTD VAT Box 1-9 generation,   | HMRC MTD Gateway, Gov-Client Header Sync,|
|    & Compliance   |                             | digital signature, submission | Immutable Cryptographic Audit Log Export |
+-------------------+-----------------------------+-------------------------------+------------------------------------------+
```

---

## 3. Product Requirements Document (PRD) Standards & Template

To maintain world-class engineering execution, every feature initiated by a Product Manager must follow the standard blynt PRD framework before entering sprint planning.

### 3.1 Standard PRD Structure
A compliant blynt PRD must contain the following eight mandatory sections:
1. **Executive Summary & Problem Statement**: Clear explanation of the customer problem, quantitative evidence (support tickets, churn risk), and strategic alignment.
2. **Success Metrics (Leading & Lagging)**: Quantitative criteria measuring whether the feature solved the targeted problem.
3. **User Personas & Use Case Scenarios**: Explicit identification of who benefits and their specific situational context.
4. **Scope Boundaries**: Explicit enumeration of what is strictly **In-Scope** versus **Out-of-Scope** for V1.
5. **Detailed Functional Specifications**: Exhaustive workflow requirements, UI mockups, business logic, and field validations.
6. **User Stories & Acceptance Criteria**: Formatted strictly in Gherkin syntax (`Given-When-Then`).
7. **Non-Functional Requirements (NFRs)**: Performance SLAs, security controls, audit logging, and data retention rules.
8. **Dependencies & Open Questions**: Cross-functional team dependencies, third-party vendor APIs, and unresolved design decisions.

### 3.2 Formal User Story Specification with Gherkin Syntax
All functional acceptance criteria must be documented using executable Gherkin syntax to ensure seamless translation into automated Playwright and Jest test suites.

#### Example PRD Feature: Automated Bank Rule Matching Engine
```gherkin
Feature: Automated Rule-Based Bank Transaction Matching
  As a Financial Controller (Marcus)
  I want the system to automatically match bank feed transactions against configured rules
  So that I can reduce manual reconciliation overhead by at least 80%.

  Scenario: Exact Match on Payee and Amount creates Draft Journal Entry
    Given an active tenant with bank account "1200 - Barclays Operating"
    And a pre-existing Bank Rule matching Payee "Amazon Web Services" to Account "7400 - Software Subscriptions"
    When a bank transaction arrives with:
      | Field       | Value                  |
      | Date        | 2026-10-12             |
      | Description | AWS EMEA SARL          |
      | Amount      | -1420.50               |
    Then the system identifies an exact rule match
    And automatically creates a Draft Journal Entry:
      | Line | Account                        | Debit   | Credit  | Tax Code |
      | 1    | 7400 - Software Subscriptions  | 1183.75 | 0.00    | Standard |
      | 2    | 2200 - Input VAT               | 236.75  | 0.00    | Standard |
      | 3    | 1200 - Barclays Operating      | 0.00    | 1420.50 | Zero     |
    And marks the bank feed line status as "Rule Matched (Pending Confirmation)"
    And logs an audit event with metadata "RULE_ENGINE_V1_APPLIED".

  Scenario: Prevent Auto-Posting when Invariant Fails
    Given a malfunctioning custom rule resulting in Debit 100.00 and Credit 90.00
    When the rule engine attempts to generate the journal entry
    Then the transaction is rejected by the Double-Entry Invariant Guard
    And the bank transaction is marked as "Exception - Invariant Error"
    And an alert is dispatched to the tenant controller without committing partial state.
```

### 3.3 Non-Functional Requirements (NFR) Baseline
All PRDs must commit to the following universal non-functional standards:
* **API Latency SLA:** p95 latency $\\le 250\\text{ms}$ for read requests; p99 latency $\\le 500\\text{ms}$ for transactional mutations.
* **Audit Lineage:** 100% of mutations must write an immutable audit log entry including `actor_user_id`, `tenant_id`, `ip_address`, and `state_diff`.
* **Browser Compatibility:** Zero rendering anomalies on modern evergreen browsers (Chrome, Edge, Safari, Firefox).
* **Zero Data Loss:** All financial writes must commit to ACID-compliant PostgreSQL storage with synchronous replication.

### 3.4 Definition of Ready (DoR) Gate Checklist
Before any user story or epic can be scheduled for sprint delivery, it must satisfy 100% of the Definition of Ready criteria:

```
[ ] 1. Problem Statement validated with quantitative or qualitative customer data.
[ ] 2. User Stories documented with complete Given-When-Then acceptance criteria.
[ ] 3. High-fidelity Figma designs approved by UX Design Lead and compliant with blynt UI guidelines.
[ ] 4. Technical Feasibility Review signed off by Engineering Tech Lead.
[ ] 5. Accounting & Compliance Review signed off by Financial SME / CPA.
[ ] 6. Analytics & Telemetry Tracking Plan specified with required event keys.
[ ] 7. Out-of-scope boundaries explicitly stated to prevent scope creep.
[ ] 8. Dependency mapping complete (third-party APIs, database migrations).
```

---

## 4. Feature Prioritization Framework & Decision Governance

### 4.1 RICE Prioritization Methodology with FinTech Multipliers
To eliminate subjective bias, the blynt product team utilizes a calibrated **RICE Scoring Framework** augmented with a **Regulatory Compliance Multiplier (RCM)**:

$$\\text{RICE Score} = \\frac{\\text{Reach} \\times \\text{Impact} \\times \\text{Confidence}}{\\text{Effort}} \\times \\text{RCM}$$

* **Reach (R):** Number of business tenants impacted per quarter (e.g., 500 tenants = 500).
* **Impact (I):** Strategic contribution to user retention, revenue, or efficiency:
  * 3 = Massive Impact (e.g., automated MTD submission)
  * 2 = High Impact (e.g., bank feed automated matching)
  * 1 = Medium Impact (e.g., custom report builder)
  * 0.5 = Low Impact (e.g., minor UI color customization)
* **Confidence (C):** Confidence in estimates based on customer research:
  * 1.0 = High (backed by data & user testing)
  * 0.8 = Medium (backed by anecdotal feedback)
  * 0.5 = Low (experimental / unvalidated)
* **Effort (E):** Person-sprints required to deliver from conception to GA (e.g., 2 sprints across 3 devs = 6).
* **Regulatory Compliance Multiplier (RCM):**
  * **2.0** = Legally mandatory for HMRC / UK compliance (Immediate statutory risk)
  * **1.5** = Core accounting integrity or security audit requirement
  * **1.0** = Standard commercial or UX feature

```
+-----------------------------------------------------------------------------------------------------------------------+
|                                      SAMPLE BLYNT RICE PRIORITIZATION MATRIX                                          |
+--------------------------------+-------+--------+------------+--------+-------+------------+--------------------------+
| Feature Initiative             | Reach | Impact | Confidence | Effort | RCM   | RICE Score | Priority Rank            |
+--------------------------------+-------+--------+------------+--------+-------+------------+--------------------------+
| HMRC MTD Direct API Filing     | 1,200 | 3.0    | 1.0        | 8      | 2.0   | 900.0      | Rank 1 (Mandatory P0)    |
| Automated Bank Rule Matcher    | 1,000 | 2.5    | 0.9        | 6      | 1.0   | 375.0      | Rank 2 (Strategic P1)    |
| Multi-Currency FX Revaluation  | 450   | 2.0    | 0.8        | 5      | 1.5   | 216.0      | Rank 3 (High-Value P1)   |
| Custom Invoice PDF Template UX | 800   | 1.0    | 0.8        | 4      | 1.0   | 160.0      | Rank 4 (Growth P2)       |
| Dark Mode Interface Theme      | 600   | 0.5    | 1.0        | 3      | 1.0   | 100.0      | Rank 5 (Backlog P3)      |
+--------------------------------+-------+--------+------------+--------+-------+------------+--------------------------+
```

### 4.2 Kano Model Classification
Features are categorized into three Kano dimensions to maintain balanced sprint allocations:
1. **Must-Be (Hygiene):** Double-entry balancing, user authentication, tenant data isolation, VAT calculations. (Absence causes extreme dissatisfaction; presence is expected).
2. **Performance (Linear):** Reporting query speed, bank feed sync latency, OCR scanning throughput. (Satisfaction scales directly with performance).
3. **Delighters (Attractive):** AI-powered anomaly detection, predictive cash flow forecasting, instant keyboard-only navigation. (Creates word-of-mouth customer advocacy).

### 4.3 Technical Debt vs. Feature Velocity Policy (The 70/20/10 Rule)
Every sprint cycle strictly divides engineering capacity as follows:
* **70% Roadmap Features:** Customer-facing capabilities and high-impact PRD stories.
* **20% Technical Debt & Architecture:** Database indexing, query refactoring, test suite hardening, dependency upgrades.
* **10% Spikes & Innovation:** Prototyping experimental capabilities, AI tooling, and architecture RFC exploration.

---

## 5. Agile Sprint Delivery & Jira/Confluence Cadence

### 5.1 Bi-Weekly Sprint Rhythm & Ceremonies
The product and engineering teams operate on synchronized two-week sprint cadences ending on alternate Wednesdays:

```
+-------------------------------------------------------------------------------------------------------------------+
|                                        BI-WEEKLY AGILE CEREMONY CALENDAR                                          |
+-----------------+-----------------------+------------------------+------------------------------------------------+
| Ceremony        | Timing                | Attendees              | Core Objective                                 |
+-----------------+-----------------------+------------------------+------------------------------------------------+
| Sprint Planning | Monday Week 1 (9:30am)| PM, Tech Lead, Team    | Commit to sprint backlog based on DoR stories  |
| Daily Standup   | Daily (9:15am - 15m)  | Engineering Squad, PM  | Sync on progress, identify & clear blockers    |
| Backlog Grooming| Thursday Week 1 (2pm) | PM, Tech Lead, Senior  | Review upcoming PRDs, estimate story points    |
| Sprint Review   | Alternate Wed (3:00pm)| All Stakeholders, PMs  | Demonstrate working software to company        |
| Retrospective   | Alternate Wed (4:15pm)| Squad Members only     | Inspect & adapt team processes & velocity      |
+-----------------+-----------------------+------------------------+------------------------------------------------+
```

### 5.2 Jira Hierarchy & Conventions
* **Initiative:** Multi-quarter strategic objective (e.g., `INIT-12: Complete HMRC Making Tax Digital Integration`).
* **Epic:** Multi-sprint feature deliverable (e.g., `EPIC-45: Bank Feed Open Banking Automated Ingestion`).
* **Story:** Independently deliverable user value item formatted with Gherkin acceptance criteria (e.g., `BLYNT-210: Automatic rule matching on payee name`).
* **Task / Tech Spike:** Architectural investigation or backend setup (e.g., `BLYNT-211: Implement Postgres RLS policy for bank feeds`).
* **Bug:** Defect ticket with mandatory reproduction steps, severity rating (P0 to P3), and regression test requirement.

### 5.3 Definition of Done (DoD) from PM & Compliance Perspectives
Before a Jira story can be transitioned to `Done`, it must fulfill the universal DoD:

```
[ ] 1. All Gherkin acceptance criteria verified and covered by automated tests.
[ ] 2. Unit test coverage exceeds 85% with zero regressions in core accounting math.
[ ] 3. Pull Request reviewed and approved by at least 2 senior engineers.
[ ] 4. UX and design fidelity verified against Figma design tokens.
[ ] 5. UAT completed and signed off by the Product Manager in the staging environment.
[ ] 6. Feature flag created and configured for controlled canary deployment.
[ ] 7. Customer documentation and internal help desk macros updated.
```

---

## 6. Release Governance, Phased Rollouts & Beta Management

To safeguard financial ledger data, blynt strictly prohibits "big bang" feature releases. All capabilities transition through a four-tier release progression.

### 6.1 The 4-Tier Release Ladder
1. **Tier 0 — Internal Alpha (Dogfooding):** Deployed to internal staging environments and tested by blynt finance team members on real corporate accounting operations.
2. **Tier 1 — Private Beta (Design Partners):** Rolled out via feature flags to a curated cohort of 5 to 10 trusted enterprise clients. Daily feedback reviews and hotfix prioritization.
3. **Tier 2 — Public Beta (Opt-In):** Available to all tenants behind an in-app "blynt Labs" feature toggle. Monitored for edge-case scalability and high transaction concurrency.
4. **Tier 3 — General Availability (GA):** Fully enabled by default for all customer accounts. Supported by comprehensive knowledge base documentation and SLA guarantees.

```
+-------------------------------------------------------------------------------------------------------------------+
|                                       BLYNT 4-TIER RELEASE PROGRESSION                                            |
+--------------------+-----------------------+-----------------------+----------------------------------------------+
| Tier               | Audience Scope        | Typical Duration      | Exit Criteria                                |
+--------------------+-----------------------+-----------------------+----------------------------------------------+
| Tier 0: Alpha      | Internal Staff (100%) | 1 to 2 Weeks          | Zero P0/P1 defects; Invariant drift: 0.00%   |
| Tier 1: Private    | 5 - 10 Design Partners| 2 to 4 Weeks          | CSAT > 90%; 0 unhandled ledger exceptions   |
| Tier 2: Public     | Opt-In Beta Cohort    | 2 Weeks               | System p95 latency < 250ms at 5x volume      |
| Tier 3: GA         | 100% of Production    | Permanent             | Standard production monitoring & on-call     |
+--------------------+-----------------------+-----------------------+----------------------------------------------+
```

### 6.2 Feature Flagging Strategy
All new backend API endpoints and frontend UI modules are wrapped in feature flags managed via centralized configuration.
* **Tenant-Level Targeting:** Flags can be activated for specific tenant IDs (e.g., `tenant_id = "550e8400-e29b-41d4-a716-446655440000"`).
* **Kill Switch Capability:** In the event of an unexpected data mismatch or critical bug, the Product Manager or Tech Lead can instantly deactivate the feature flag globally in under 5 seconds without triggering a deployment.

---

## 7. Product Telemetry, FinTech KPIs & Performance Measurement

### 7.1 Key Product Performance Metrics
The product team tracks three levels of quantitative performance indicators:

```
+-------------------------------------------------------------------------------------------------------------------+
|                                        BLYNT PRODUCT KPI PERFORMANCE FRAMEWORK                                    |
+--------------------+--------------------------------+---------------+---------------------------------------------+
| Category           | Specific Metric                | Target SLA    | Measurement Frequency                       |
+--------------------+--------------------------------+---------------+---------------------------------------------+
| Financial Health   | Invariant Drift Rate           | 0.00% Absolute| Real-time continuous monitoring             |
| Operational Speed  | Month-End Close Duration       | <= 2 Days     | Monthly cohort analysis                     |
| User Efficiency    | Bank Reconciliation Auto-Match | >= 85% Lines  | Weekly aggregate measurement                |
| Platform Adoption  | Daily Active Businesses (DAB)  | > 45% of MAU  | Daily tracking                              |
| API Performance    | Report Generation Latency      | < 500ms (p95) | Continuous Datadog / APM tracing            |
| Customer Sentiment | Net Promoter Score (NPS)       | >= +65        | Quarterly survey trigger                    |
+--------------------+--------------------------------+---------------+---------------------------------------------+
```

### 7.2 Event Tracking Taxonomy & Instrumentation Schema
All user interactions and financial lifecycle triggers must be instrumented according to our unified event schema:

```json
{
  "event_name": "journal_entry_posted",
  "timestamp": "2026-10-12T00:30:00.000Z",
  "tenant_id": "c1f7b822-491a-4c2f-b442-9988aa112233",
  "user_id": "u49a-0021",
  "user_role": "FINANCIAL_CONTROLLER",
  "properties": {
    "source_module": "BANK_RECONCILIATION",
    "total_debit_amount": 1420.50,
    "total_credit_amount": 1420.50,
    "currency": "GBP",
    "line_count": 3,
    "auto_matched_by_rule": true,
    "rule_id": "rule_aws_cloud_sub",
    "latency_ms": 114
  }
}
```

### 7.3 Continuous Post-Launch Review Loop
Every Tier 3 GA feature must undergo a formal **Post-Launch Impact Review (PLIR)** four weeks post-release. The Product Manager must present:
1. Actual vs. predicted leading and lagging success metrics.
2. Direct customer feedback transcripts and NPS delta.
3. Support ticket volume and bug distribution associated with the feature.
4. Recommendations for V2 optimization or backlog closure.
"""

def build_docx():
    print(f"Writing {OUTPUT_MD}...")
    with open(OUTPUT_MD, "w", encoding="utf-8") as f:
        f.write(PM_MARKDOWN)
    print(f"Markdown file written: {OUTPUT_MD} ({os.path.getsize(OUTPUT_MD)} bytes)")

    doc = Document()
    
    # Page Margins
    for sec in doc.sections:
        sec.top_margin = Inches(0.8)
        sec.bottom_margin = Inches(0.8)
        sec.left_margin = Inches(0.85)
        sec.right_margin = Inches(0.85)

    print("Adding cover page...")
    add_cover_page(doc)

    print("Parsing PM markdown into Word docx...")
    lines = PM_MARKDOWN.split("\n")
    i = 0
    in_code_block = False
    code_lines = []

    while i < len(lines):
        line = lines[i]

        # Code blocks
        if line.strip().startswith("```"):
            if in_code_block:
                in_code_block = False
                code_text = "\n".join(code_lines)
                code_tbl = doc.add_table(rows=1, cols=1)
                code_tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
                cell = code_tbl.cell(0, 0)
                set_cell_background(cell, "F1F5F9")
                set_cell_margins(cell, top=80, bottom=80, left=120, right=120)
                p_code = cell.paragraphs[0]
                p_code.paragraph_format.space_before = Pt(0)
                p_code.paragraph_format.space_after = Pt(0)
                r_code = p_code.add_run(code_text)
                r_code.font.name = "Consolas"
                r_code.font.size = Pt(8.5)
                r_code.font.color.rgb = CHARCOAL
                doc.add_paragraph().paragraph_format.space_after = Pt(4)
                code_lines = []
            else:
                in_code_block = True
                code_lines = []
            i += 1
            continue

        if in_code_block:
            code_lines.append(line)
            i += 1
            continue

        # Skip main header if already in cover
        if line.startswith("# ") and "blynt Product Management" in line:
            i += 1
            continue

        # Headings
        if line.startswith("## "):
            h_text = line[3:].strip()
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(16)
            p.paragraph_format.space_after = Pt(6)
            p.paragraph_format.keep_with_next = True
            r = p.add_run(h_text)
            r.font.name = "Segoe UI"
            r.font.size = Pt(15)
            r.font.bold = True
            r.font.color.rgb = NAVY

            # Insert Diagram under Section 1
            if h_text.startswith("1. Executive Product Vision"):
                diag_path = os.path.join(DIAGRAMS_DIR, "figure_pm_product_lifecycle.png")
                if os.path.exists(diag_path):
                    doc.add_paragraph().paragraph_format.space_after = Pt(4)
                    p_img = doc.add_paragraph()
                    p_img.alignment = WD_ALIGN_PARAGRAPH.CENTER
                    p_img.paragraph_format.space_after = Pt(4)
                    r_img = p_img.add_run()
                    r_img.add_picture(diag_path, width=Inches(6.4))
                    p_cap = doc.add_paragraph()
                    p_cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
                    p_cap.paragraph_format.space_after = Pt(10)
                    r_cap = p_cap.add_run("Figure PM-1: blynt Product Management & Feature Delivery Lifecycle (5 Stages)")
                    r_cap.font.name = "Segoe UI"
                    r_cap.font.size = Pt(9)
                    r_cap.font.italic = True
                    r_cap.font.color.rgb = SLATE

            i += 1
            continue

        if line.startswith("### "):
            h_text = line[4:].strip()
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(12)
            p.paragraph_format.space_after = Pt(4)
            p.paragraph_format.keep_with_next = True
            r = p.add_run(h_text)
            r.font.name = "Segoe UI"
            r.font.size = Pt(12)
            r.font.bold = True
            r.font.color.rgb = CORAL
            i += 1
            continue

        if line.startswith("#### "):
            h_text = line[5:].strip()
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(8)
            p.paragraph_format.space_after = Pt(3)
            p.paragraph_format.keep_with_next = True
            r = p.add_run(h_text)
            r.font.name = "Segoe UI"
            r.font.size = Pt(10.5)
            r.font.bold = True
            r.font.color.rgb = NAVY
            i += 1
            continue

        # Blockquotes
        if line.startswith("> "):
            bq_text = line[2:].strip()
            tbl = doc.add_table(rows=1, cols=1)
            tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
            c = tbl.cell(0, 0)
            set_cell_background(c, "F8FAFC")
            set_cell_margins(c, top=60, bottom=60, left=120, right=120)
            p_bq = c.paragraphs[0]
            p_bq.paragraph_format.space_before = Pt(0)
            p_bq.paragraph_format.space_after = Pt(0)
            r_bq = p_bq.add_run(bq_text)
            r_bq.font.name = "Segoe UI"
            r_bq.font.size = Pt(9.5)
            r_bq.font.italic = True
            r_bq.font.color.rgb = CHARCOAL
            doc.add_paragraph().paragraph_format.space_after = Pt(4)
            i += 1
            continue

        # Bullet points
        if line.strip().startswith("* ") or line.strip().startswith("- "):
            bullet_text = line.strip()[2:].strip()
            p = doc.add_paragraph(style='List Bullet')
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(2)
            
            # Simple bold parsing
            parts = re.split(r'(\*\*.*?\*\*)', bullet_text)
            for part in parts:
                if part.startswith("**") and part.endswith("**"):
                    r = p.add_run(part[2:-2])
                    r.bold = True
                    r.font.color.rgb = CHARCOAL
                else:
                    r = p.add_run(part)
                    r.font.color.rgb = CHARCOAL
                r.font.name = "Segoe UI"
                r.font.size = Pt(9.5)
            i += 1
            continue

        # Regular paragraph
        if line.strip():
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(5)
            parts = re.split(r'(\*\*.*?\*\*)', line.strip())
            for part in parts:
                if part.startswith("**") and part.endswith("**"):
                    r = p.add_run(part[2:-2])
                    r.bold = True
                    r.font.color.rgb = CHARCOAL
                else:
                    r = p.add_run(part)
                    r.font.color.rgb = CHARCOAL
                r.font.name = "Segoe UI"
                r.font.size = Pt(9.5)

        i += 1

    print(f"Saving to {OUTPUT_DOCX}...")
    doc.save(OUTPUT_DOCX)
    print("Word document generated successfully!")

if __name__ == "__main__":
    build_docx()
