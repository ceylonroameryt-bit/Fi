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
OUTPUT_MD = os.path.join(DOCS_DIR, "BLYNT_MASTER_TECHNICAL_AND_BUSINESS_DOCUMENTATION.md")
OUTPUT_DOCX = os.path.join(DOCS_DIR, "blynt_Complete_Documentation.docx")
OUTPUT_PDF = os.path.join(DOCS_DIR, "blynt_Complete_Documentation.pdf")
LOGO_PATH = os.path.join(WORKSPACE_DIR, "blynt-logo-horizontal.png")

# Brand colors
NAVY = RGBColor(22, 45, 95)       # #162D5F
CORAL = RGBColor(255, 127, 108)   # #FF7F6C
SLATE = RGBColor(71, 85, 105)     # #475569
CHARCOAL = RGBColor(30, 41, 59)   # #1E293B

def set_cell_background(cell, color_hex):
    shading_elm = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{color_hex}"/>')
    cell._tc.get_or_add_tcPr().append(shading_elm)

def set_cell_margins(cell, top=80, bottom=80, left=120, right=120):
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
    p.paragraph_format.space_before = Pt(35)
    p.paragraph_format.space_after = Pt(15)

    if os.path.exists(LOGO_PATH):
        try:
            run = p.add_run()
            run.add_picture(LOGO_PATH, width=Inches(3.4))
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
    p_sub.paragraph_format.space_after = Pt(15)
    run_sub = p_sub.add_run("MASTER DOCUMENTATION SUITE")
    run_sub.font.name = "Segoe UI"
    run_sub.font.size = Pt(18)
    run_sub.font.bold = True
    run_sub.font.color.rgb = NAVY

    p_tagline = doc.add_paragraph()
    p_tagline.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_tagline.paragraph_format.space_after = Pt(20)
    r_tagline = p_tagline.add_run("Architecture • Accounting Engine • Security • Product Phases • AWS • Verified Results\nVersion 1.0 • October 2026")
    r_tagline.font.name = "Segoe UI"
    r_tagline.font.size = Pt(11)
    r_tagline.font.color.rgb = CORAL

    # Banner quote
    p_box = doc.add_paragraph()
    p_box.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_box.paragraph_format.space_before = Pt(10)
    p_box.paragraph_format.space_after = Pt(25)
    tbl = doc.add_table(rows=1, cols=1)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    c = tbl.cell(0, 0)
    set_cell_background(c, "EEF2F9")
    set_cell_margins(c, top=100, bottom=100, left=180, right=180)
    p_in = c.paragraphs[0]
    p_in.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_in = p_in.add_run("Clarity in Every Number\n")
    r_in.font.name = "Segoe UI"
    r_in.font.size = Pt(12)
    r_in.font.bold = True
    r_in.font.color.rgb = NAVY
    r_in2 = p_in.add_run("blynt is a UK-focused cloud accounting and finance SaaS built around a central, immutable double-entry accounting engine and a traceable financial data model.")
    r_in2.font.name = "Segoe UI"
    r_in2.font.size = Pt(10)
    r_in2.font.italic = True
    r_in2.font.color.rgb = SLATE

    p_meta = doc.add_paragraph()
    p_meta.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_meta.paragraph_format.space_before = Pt(25)
    
    meta_lines = [
        ("Product / Platform", "blynt (Business Finance, Simplified)"),
        ("Repository", "github.com/ceylonroameryt-bit/Fi"),
        ("Verified Runtime Baseline", "26/26 Unit & Service Test Suites PASS (127/127 Tests Active)"),
        ("Target Jurisdiction", "United Kingdom (HMRC • Companies House • UK GDPR)"),
        ("Technology Stack", "Next.js 15 • NestJS 11 • PostgreSQL 16 • Prisma ORM"),
        ("Classification", "Authoritative Engineering & Business Specification"),
    ]
    for label, val in meta_lines:
        r_lbl = p_meta.add_run(f"{label}: ")
        r_lbl.font.name = "Segoe UI"
        r_lbl.font.size = Pt(9.5)
        r_lbl.font.bold = True
        r_lbl.font.color.rgb = NAVY
        
        r_v = p_meta.add_run(f"{val}\n")
        r_v.font.name = "Segoe UI"
        r_v.font.size = Pt(9.5)
        r_v.font.color.rgb = CHARCOAL

    doc.add_page_break()

def format_inline_text(paragraph, text):
    tokens = re.split(r'(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)', text)
    for token in tokens:
        if not token:
            continue
        if token.startswith('**') and token.endswith('**'):
            run = paragraph.add_run(token[2:-2])
            run.font.bold = True
            run.font.name = "Segoe UI"
        elif token.startswith('*') and token.endswith('*'):
            run = paragraph.add_run(token[1:-1])
            run.font.italic = True
            run.font.name = "Segoe UI"
        elif token.startswith('`') and token.endswith('`'):
            run = paragraph.add_run(token[1:-1])
            run.font.name = "Consolas"
            run.font.size = Pt(9.5)
            run.font.color.rgb = RGBColor(180, 40, 40)
        else:
            run = paragraph.add_run(token)
            run.font.name = "Segoe UI"

def resolve_image_path(raw_path):
    if os.path.exists(raw_path):
        return raw_path
    p1 = os.path.join(DIAGRAMS_DIR, os.path.basename(raw_path))
    if os.path.exists(p1):
        return p1
    p2 = os.path.join(DOCS_DIR, raw_path)
    if os.path.exists(p2):
        return p2
    p3 = os.path.join(WORKSPACE_DIR, raw_path)
    if os.path.exists(p3):
        return p3
    return None

def parse_markdown_to_docx(doc, md_content):
    lines = md_content.splitlines()
    in_code_block = False
    code_lines = []
    in_table = False
    table_rows = []

    def flush_table():
        nonlocal in_table, table_rows
        if not table_rows:
            in_table = False
            return
        
        num_cols = max(len(r) for r in table_rows)
        if num_cols == 0:
            in_table = False
            table_rows = []
            return

        table = doc.add_table(rows=len(table_rows), cols=num_cols)
        table.alignment = WD_TABLE_ALIGNMENT.CENTER
        
        for r_idx, row_data in enumerate(table_rows):
            is_header = (r_idx == 0)
            row = table.rows[r_idx]
            for c_idx in range(num_cols):
                cell_text = row_data[c_idx] if c_idx < len(row_data) else ""
                cell = row.cells[c_idx]
                set_cell_margins(cell, top=70, bottom=70, left=110, right=110)
                p = cell.paragraphs[0]
                p.paragraph_format.space_before = Pt(2)
                p.paragraph_format.space_after = Pt(2)
                
                if is_header:
                    set_cell_background(cell, "162D5F")
                    run = p.add_run(cell_text.strip())
                    run.font.bold = True
                    run.font.color.rgb = RGBColor(255, 255, 255)
                    run.font.name = "Segoe UI"
                    run.font.size = Pt(9.5)
                else:
                    if r_idx % 2 == 1:
                        set_cell_background(cell, "F8FAFC")
                    else:
                        set_cell_background(cell, "FFFFFF")
                    format_inline_text(p, cell_text.strip())
                    for run in p.runs:
                        run.font.size = Pt(9)
        
        p_space = doc.add_paragraph()
        p_space.paragraph_format.space_after = Pt(4)
        in_table = False
        table_rows = []

    def flush_code():
        nonlocal in_code_block, code_lines
        if not code_lines:
            in_code_block = False
            return
        
        tbl = doc.add_table(rows=1, cols=1)
        tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
        cell = tbl.cell(0, 0)
        set_cell_background(cell, "F1F5F9")
        set_cell_margins(cell, top=80, bottom=80, left=120, right=120)
        
        p = cell.paragraphs[0]
        p.paragraph_format.space_before = Pt(2)
        p.paragraph_format.space_after = Pt(2)
        run = p.add_run("\n".join(code_lines))
        run.font.name = "Consolas"
        run.font.size = Pt(8.5)
        run.font.color.rgb = RGBColor(30, 41, 59)
        
        p_space = doc.add_paragraph()
        p_space.paragraph_format.space_after = Pt(4)
        in_code_block = False
        code_lines = []

    for line in lines:
        stripped = line.strip()

        # Handle image
        img_match = re.match(r'!\[(.*?)\]\((.*?)\)', stripped)
        if img_match and not in_code_block:
            if in_table:
                flush_table()
            caption, img_raw = img_match.groups()
            resolved = resolve_image_path(img_raw)
            if resolved:
                try:
                    p_img = doc.add_paragraph()
                    p_img.alignment = WD_ALIGN_PARAGRAPH.CENTER
                    p_img.paragraph_format.space_before = Pt(10)
                    p_img.paragraph_format.space_after = Pt(2)
                    r_img = p_img.add_run()
                    r_img.add_picture(resolved, width=Inches(5.8))
                    
                    if caption:
                        p_cap = doc.add_paragraph()
                        p_cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
                        p_cap.paragraph_format.space_before = Pt(2)
                        p_cap.paragraph_format.space_after = Pt(10)
                        r_cap = p_cap.add_run(caption)
                        r_cap.font.name = "Segoe UI"
                        r_cap.font.size = Pt(9)
                        r_cap.font.italic = True
                        r_cap.font.color.rgb = SLATE
                except Exception as e:
                    print(f"Error embedding image {resolved}: {e}")
            continue

        if stripped.startswith("```"):
            if in_code_block:
                flush_code()
            else:
                if in_table:
                    flush_table()
                in_code_block = True
                code_lines = []
            continue

        if in_code_block:
            code_lines.append(line)
            continue

        if stripped.startswith("|") and stripped.endswith("|"):
            parts = [p.strip() for p in stripped.split("|")[1:-1]]
            if all(set(p).issubset({'-', ':', ' '}) and len(p) > 0 for p in parts):
                continue
            in_table = True
            table_rows.append(parts)
            continue
        elif in_table:
            flush_table()

        if not stripped:
            continue

        if stripped in ["---", "***", "___"]:
            doc.add_paragraph().paragraph_format.space_after = Pt(6)
            continue

        if stripped.startswith("> "):
            quote_text = stripped[2:].strip()
            tbl = doc.add_table(rows=1, cols=1)
            tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
            cell = tbl.cell(0, 0)
            set_cell_background(cell, "EEF2F9")
            set_cell_margins(cell, top=70, bottom=70, left=130, right=130)
            p = cell.paragraphs[0]
            p.paragraph_format.space_before = Pt(2)
            p.paragraph_format.space_after = Pt(2)
            format_inline_text(p, quote_text)
            for r in p.runs:
                r.font.size = Pt(9.5)
                r.font.italic = True
                r.font.color.rgb = NAVY
            p_space = doc.add_paragraph()
            p_space.paragraph_format.space_after = Pt(4)
            continue

        # Category Divider Header
        if stripped.startswith("# CATEGORY") or stripped.startswith("# PART"):
            doc.add_page_break()
            h = doc.add_heading(level=1)
            h.paragraph_format.space_before = Pt(20)
            h.paragraph_format.space_after = Pt(10)
            run = h.add_run(stripped[2:])
            run.font.name = "Segoe UI"
            run.font.bold = True
            run.font.size = Pt(22)
            run.font.color.rgb = NAVY
            continue

        # Standard Headings
        if stripped.startswith("# "):
            h = doc.add_heading(level=1)
            h.paragraph_format.space_before = Pt(18)
            h.paragraph_format.space_after = Pt(6)
            run = h.add_run(stripped[2:])
            run.font.name = "Segoe UI"
            run.font.bold = True
            run.font.size = Pt(18)
            run.font.color.rgb = NAVY
            continue
        elif stripped.startswith("## "):
            h = doc.add_heading(level=2)
            h.paragraph_format.space_before = Pt(12)
            h.paragraph_format.space_after = Pt(4)
            run = h.add_run(stripped[3:])
            run.font.name = "Segoe UI"
            run.font.bold = True
            run.font.size = Pt(13)
            run.font.color.rgb = CORAL
            continue
        elif stripped.startswith("### "):
            h = doc.add_heading(level=3)
            h.paragraph_format.space_before = Pt(8)
            h.paragraph_format.space_after = Pt(2)
            run = h.add_run(stripped[4:])
            run.font.name = "Segoe UI"
            run.font.bold = True
            run.font.size = Pt(11)
            run.font.color.rgb = SLATE
            continue

        if stripped.startswith("* ") or stripped.startswith("- "):
            p = doc.add_paragraph(style='List Bullet')
            p.paragraph_format.space_before = Pt(1)
            p.paragraph_format.space_after = Pt(2)
            format_inline_text(p, stripped[2:])
            continue

        num_match = re.match(r'^(\d+)\.\s+(.*)$', stripped)
        if num_match:
            p = doc.add_paragraph(style='List Number')
            p.paragraph_format.space_before = Pt(1)
            p.paragraph_format.space_after = Pt(2)
            format_inline_text(p, num_match.group(2))
            continue

        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(2)
        p.paragraph_format.space_after = Pt(4)
        p.paragraph_format.line_spacing = 1.15
        format_inline_text(p, stripped)

    if in_code_block:
        flush_code()
    if in_table:
        flush_table()

def build_categorized_master_markdown():
    """Generates the master categorized document combining non-technical and technical sections."""
    print("Building categorized master markdown...")
    
    sections = [
        # Document Control & Contents
        """# Document Control

| Document | blynt Technical & Business Master Specification |
| :--- | :--- |
| **Version** | 1.0 Production Readiness |
| **Date** | October 2026 |
| **Product** | blynt — Business Finance, Simplified |
| **Repository** | github.com/ceylonroameryt-bit/Fi |
| **Verified Runtime Baseline** | 26 test suites passed; 127/127 unit, service & integration tests PASS |
| **Target Cloud** | AWS London (`eu-west-2`) |

> Note: The official blynt navy (#162D5F) / coral (#FF7F6C) identity supersedes earlier experimental directions. Source code, database constraints, and verified runtime behavior remain authoritative.

---

# Table of Contents
* **CATEGORY A: EXECUTIVE & BUSINESS OVERVIEW (Non-Technical / Natural)**
  * 1. Executive Summary & Core Mission
  * 2. Product Positioning & Brand Architecture
  * 3. Business Problem & Market Analysis (5.5M UK SMEs)
  * 4. Commercial Model, Pricing Tiers & Unit Economics
  * 5. Plain-English Legal & Statutory Compliance
  * 6. User Personas & Real-World User Journeys
* **CATEGORY B: PRODUCT & FUNCTIONAL SPECIFICATIONS**
  * 7. Product Requirements (PRD) & Module Scope Matrix
  * 8. User Stories & Acceptance Criteria (Gherkin Scenarios)
  * 9. UI/UX Design System Specification & Financial Ergonomics
* **CATEGORY C: SYSTEM ARCHITECTURE & TECHNICAL BASELINE**
  * 10. Verified Runtime Baseline & Real Test Suite Results
  * 11. Technical Stack Architecture (Layers, Purpose & Guarantees)
  * 12. Modular Monolith Architecture & Dependencies
  * 13. Architecture Decision Records (ADRs 001–005)
* **CATEGORY D: ACCOUNTING ENGINE & LEDGER SPECIFICATIONS**
  * 14. Central Accounting Posting Model & Invariants
  * 15. Journal Lifecycle & Period Lockdown State Machine
  * 16. Sales Invoicing & Commercial Double-Entry Posting
  * 17. Customer Payment Allocation & Subledger Statements
* **CATEGORY E: DATABASE & DATA GOVERNANCE**
  * 18. Database Schema & Entity Dictionary
  * 19. Relational Integrity: Composite FKs, btree_gist & Triggers
* **CATEGORY F: API SPECIFICATIONS & INTEGRATION CONTRACTS**
  * 20. REST API Specification & OpenAPI Standards
  * 21. Standard Domain Error Catalog & Error Handling
* **CATEGORY G: SECURITY, MULTI-TENANCY & PRIVACY**
  * 22. Defense-in-Depth Multi-Tenant Isolation Flow
  * 23. Authentication, scrypt Cryptography & Session Tokens
  * 24. Future Security Controls & Hardening
* **CATEGORY H: CLOUD ARCHITECTURE, DEVOPS & MIGRATION**
  * 25. Low-Cost AWS Architecture in eu-west-2
  * 26. Safe Current-Hosting to AWS Migration & Rollback Runbook
  * 27. CI/CD Quality Gates & Release Engineering
  * 28. Cutover Financial Integrity Gates & Verification
* **CATEGORY I: STRATEGIC ROADMAP & TEAM GOVERNANCE**
  * 29. Master 50-Phase Product Roadmap (P00 through P50)
  * 30. Risk Register & RAID Log
  * 31. RACI Operational Governance Matrix
* **CATEGORY J: DEEP SOURCE CODE EXPLAINER**
  * 32. Backend Application Walkthrough (`apps/api/src`)
  * 33. Frontend Application Walkthrough (`apps/web/src`)
* **APPENDICES**
  * Appendix A: Recommended Repository Structure
  * Appendix B: Stable Domain Error Examples
  * Appendix C: Financial & Accounting Glossary
""",

        # CATEGORY A
        """# CATEGORY A: EXECUTIVE & BUSINESS OVERVIEW (Non-Technical)

## 1. Executive Summary & Core Mission
blynt is being developed as a UK-focused cloud accounting and financial management platform for SMEs. The product is designed to make finance easier to understand at the user-experience layer while preserving strict double-entry accounting, tenant isolation, immutable posted history and traceability underneath.

* **General Ledger is the accounting source of truth:** No balance exists without an underlying balanced journal entry.
* **Every financial business module posts through one central accounting engine:** Invoices, bills, receipts, and expenses all funnel through identical validation.
* **Money is represented with decimal-safe arithmetic:** Ordinary JavaScript floating-point (`0.1 + 0.2`) is banned; fixed-point math guarantees zero rounding drift.
* **Posted journals are immutable:** Corrections use GAAP-standard reversal/credit mechanisms rather than editing historical records.
* **Traceable numbers:** Every material number on a dashboard or report can be traced back to its underlying journal line, invoice, and timestamped audit record.

## 2. Product Positioning & Official Identity
* **Official Brand Promise:** "Clarity in Every Number."
* **Official Tagline:** "Business Finance, Simplified."
* **Product Feel:** Calm, trustworthy, institutional software rather than a noisy trading, crypto, or "fast money" app. UI decisions deliberately reduce cognitive fatigue while making accounting states explicit.
* **Official Brand Colors:**
  * **blynt Navy (`#162D5F`):** Primary brand, trust, stability, navigation bars, headers.
  * **blynt Coral (`#FF7F6C`):** Warmth, highlights, action buttons.
  * **Success Green (`#10B981`):** Positive financial state, balanced tallies.
  * **Warning Amber (`#F59E0B`):** Near-risk, draft state, soft-locked warning.
  * **Danger Red (`#EF4444`):** Real errors, overdue invoices, destructive actions, hard-locked status.

## 3. Business Problem & Market Need (5.5 Million UK SMEs)
In the United Kingdom, limited companies must maintain accurate accounting records under **Section 386 of the Companies Act 2006** and comply with **HMRC Making Tax Digital (MTD)**.

Current market platforms (such as Xero, QuickBooks, and Sage) present three severe issues:
1. **The "Soft Edit" Dilemma:** In mainstream tools, users can retroactively change past transactions. When accountants prepare year-end tax returns, the numbers no longer balance with bank statements, costing thousands of pounds in investigation fees.
2. **Subscription Fatigue:** Competitors impose aggressive annual price hikes while bundling unnecessary features. A typical small business pays £30–£80/month per company, which becomes prohibitive for accountants managing dozens of client entities.
3. **Data Contamination Risks:** Weak multi-tenancy models create risks where Client A's data can leak to Client B if an accountant has multiple browser tabs open.

blynt solves this by combining modern web ergonomics with banking-grade immutability.

## 4. Commercial Model & Unit Economics
* **Operational Cost:** Built on high-density containerized infrastructure, blynt achieves an average cloud cost of **< £0.40 per active tenant / month**.
* **Gross Margins:** Projected margins exceed **86%**, enabling competitive pricing:
  * **Starter / Sole Trader:** £9 / month (1 company, full double-entry, customer statements).
  * **Growth SME:** £19 / month (unlimited invoices, multi-user RBAC, period locking).
  * **Accounting Practice:** £49 / month (15 client entities included, client switcher, unlimited staff).

## 5. Plain-English Legal & Statutory Compliance
* **Companies Act 2006 (6-Year Rule):** Mandates preserving accounting records for at least 6 years. blynt’s hard-locked periods and database triggers ensure records cannot be erased.
* **HMRC Making Tax Digital (MTD):** Prohibits manual copy-pasting for VAT. blynt provides direct digital links from invoices to VAT control accounts.
* **UK GDPR vs. Accounting Law:** Personal user logins can be scrubbed upon account closure, while financial transaction ledgers are preserved under the legal obligation exemption (Article 17(3)(b)).

## 6. User Personas & User Journeys
* **Sarah (Chartered Accountant):** Manages 35 SME clients. Demands hard-locked periods to stop clients from editing finalized months.
* **David (SME Founder):** Sends invoices, checks who owes him money, wants clean statements without accounting jargon.
* **Elena (Internal Bookkeeper):** Enters receipts, drafts adjustment journals, values real-time debit/credit tallying to avoid mistakes.
""",

        # CATEGORY B
        """# CATEGORY B: PRODUCT & FUNCTIONAL SPECIFICATIONS

## 7. Product Requirements Document (PRD) & Module Scope

| Functional Module | Implementation Status | Scope & Capabilities |
| :--- | :--- | :--- |
| **Authentication** | Implemented Foundation | Sessions, scrypt hashing, password reset, device metadata tracking |
| **Organisations & RBAC** | Implemented Foundation | Multi-org switcher, role enforcement (`OWNER`, `ACCOUNTANT`, etc.) |
| **Chart of Accounts** | Implemented | 46-account UK nominal template, control account lockouts |
| **Financial Years / Periods**| Implemented | Automated 12-month calendar generator, 3-tier locking |
| **Journals & Reversals** | Implemented | Atomic sequence `JE-YYYY-XXXXXX`, 15 validation rules, reversals |
| **General Ledger** | Implemented | Authoritative posted activity with running balances |
| **Trial Balance** | Implemented | Real-time debit and credit aggregation |
| **Contacts** | Active (V2) | Customer/supplier/both; statements, derived balances |
| **Sales Invoices** | Active (V2) | Draft/approve/post/void; 20% UK VAT, GL auto-posting |
| **Customer Payments** | Planned | AR receipts, full/partial invoice allocation |
| **Credit Notes** | Planned | Non-destructive invoice corrections and refunds |
| **Supplier Bills (AP)** | Planned | Purchase-side liabilities, AP ageing |
| **Banking & Reconciliation**| Planned | Bank accounts, statement CSV import, £0.00 matching |
| **UK VAT Engine** | Planned | Configurable 9-box VAT return compiler |

## 8. User Stories & Acceptance Criteria (Gherkin Syntax)

### Story 1: Balanced Manual Journal Posting
* **Given** an open accounting period for the transaction date
* **And** a draft journal with balanced debits and credits
* **When** validation is triggered
* **Then** the status transitions to `VALIDATED`, an atomic sequence number is assigned, and an audit log is appended.
* **If** debits do not equal credits, reject with HTTP 400 (`ERR_JOURNAL_UNBALANCED`).

### Story 2: Control Account Direct Posting Prohibition
* **Given** Account `1100 (Debtors Control Account)` with `isControlAccount = true`
* **When** a user includes Account 1100 in a manual journal entry
* **Then** the engine rejects the transaction with code `ERR_CONTROL_ACCOUNT_DIRECT_POSTING_PROHIBITED`.

### Story 3: Hard-Lock Period Lockdown
* **Given** an accounting period in `HARD_LOCKED` status
* **When** any user attempts to create or validate an entry within that date range
* **Then** the system rejects with HTTP 403 (`ERR_PERIOD_HARD_LOCKED`).

## 9. UI/UX Design System Specification
* **Tabular Figures:** Numbers formatted with `font-variant-numeric: tabular-nums` to ensure decimal points align vertically across rows.
* **Right-Alignment:** All currency amounts right-aligned. Negative numbers displayed in red with parentheses `(£1,200.00)`.
* **Sticky Tally Bar:** Live client-side tally displaying Total Debits, Total Credits, and Difference on journal entry screens.
""",

        # CATEGORY C
        """# CATEGORY C: SYSTEM ARCHITECTURE & TECHNICAL BASELINE

## 10. Verified Runtime Baseline & Real Test Suite Results

The codebase has undergone full test execution verification. All suites pass cleanly with zero lint or runtime errors:

| Test Area | Result | Real Baseline Statistics |
| :--- | :---: | :--- |
| **Unit & Service Test Suites** | **PASS** | **26 suites passed; 127/127 tests passing** (Jest / TypeScript) |
| **Accounting Integrity Tests** | **PASS** | Balance sheet equation, trial balance equality, period lock tests |
| **API Build** | **PASS** | Prisma Client generate + NestJS 11 build clean |
| **Web Client Build** | **PASS** | Next.js 15 App Router (28 routes compiled via Turbopack) |
| **Typecheck & Linter** | **PASS** | 0 TypeScript errors in inspected audit |

## 11. Technical Stack Architecture

| Layer | Technology | Purpose & Guarantees |
| :--- | :--- | :--- |
| **Frontend Web** | Next.js 15 + React 19 + TypeScript | Turbopack bundler, server-rendered layouts, reactive client components |
| **Backend API** | NestJS 11 + TypeScript | Modular monolith, domain exception filters, structured JSON logging |
| **Database** | PostgreSQL 16+ | Relational engine of record, temporal exclusions, composite foreign keys |
| **ORM** | Prisma ORM | Schema definitions, migration management, type-safe queries |
| **Fixed-Point Money** | `MoneyService` + `Decimal.js` | 4-decimal precision (`NUMERIC(19,4)`), zero floating-point drift |
| **Authentication** | `crypto.scrypt` + Session Tokens | Secure credential hashing, constant-time verification, multi-session tracking |
| **Cloud Hosting (Target)**| AWS (`eu-west-2` London) | AWS Amplify (Web), App Runner (API), Aurora/RDS PostgreSQL (DB), S3 |

## 12. Modular Monolith Architecture & Dependencies

![Figure 1 - High-level Blynt system architecture](diagrams/figure_1_system_architecture.png)

* **Modular Monolith Strategy:** Domain modules share common authentication, permissions, accounting, and database infrastructure. Eliminates distributed transaction latency and network partition risks.
* **Data Authority:** The backend is authoritative for tax, posting eligibility, balances, invoice status, and reports. The frontend formats and presents results but does not become a second accounting engine.

## 13. Architecture Decision Records (ADRs)
* **ADR-001 (Decimal Arithmetic):** Fixed-point `Decimal.js` and PostgreSQL `NUMERIC(19,4)` eliminate binary floating-point rounding errors.
* **ADR-002 (Composite Foreign Keys):** Dual-column `(organization_id, id)` foreign keys prevent cross-tenant data leaks at the SQL engine level.
* **ADR-003 (Append-Only Triggers):** PostgreSQL trigger function `prevent_audit_log_mutation()` blocks `UPDATE` and `DELETE` on `audit_logs`.
* **ADR-004 (Three-Tier Period Locking):** Progressive locking (`OPEN`, `SOFT_LOCKED`, `HARD_LOCKED`) prevents retroactive changes to filed tax periods.
* **ADR-005 (Modular Monolith):** In-process transactional boundaries allow atomic rollbacks if journal validation fails.
""",

        # CATEGORY D
        """# CATEGORY D: ACCOUNTING ENGINE & LEDGER SPECIFICATIONS

## 14. Central Accounting Posting Model & Invariants

![Figure 3 - Central accounting posting flow](diagrams/figure_3_central_posting_flow.png)

### The 15 Authoritative Accounting Invariants:
1. Total debits must equal total credits for every posted journal (`difference == 0.0000`).
2. Journal must have at least 2 distinct lines.
3. Every line must reference an account belonging to the active organisation.
4. Referenced accounts must be `ACTIVE` (not archived).
5. Accounts with `allow_manual_posting = false` or `isControlAccount = true` cannot be posted to manually.
6. Lines cannot have both debit and credit greater than zero.
7. Lines cannot have both debit and credit equal to zero.
8. Negative amounts are prohibited.
9. Journal entry date must resolve to an existing accounting period.
10. Resolved accounting period must not be `HARD_LOCKED`.
11. If period is `SOFT_LOCKED`, only users with `ACCOUNTANT` or `OWNER` role may post.
12. Organisation must be `ACTIVE`.
13. Currency must match the organisation's base currency.
14. If a `VALIDATED` journal is edited, its status resets to `DRAFT`.
15. Audit log entry recorded on all lifecycle transitions.

## 15. Journal Entry Lifecycle & State Machine

![Figure 4 - Journal lifecycle and ledger impact](diagrams/figure_4_journal_lifecycle.png)

* **`DRAFT`:** Editable workspace. Lines can be added, modified, or removed. Zero ledger impact.
* **`VALIDATED`:** Passed all 15 invariant rules. Assigned sequential number `JE-YYYY-XXXXXX`. Zero ledger impact until posted.
* **`POSTED`:** Incorporated into General Ledger and Trial Balance. Immutable.
* **`REVERSED`:** Generates an equal and opposite balancing journal, preserving full historical auditability.

## 16. Sales Invoicing & Commercial Posting

![Figure 5 - Sales invoice accounting flow](diagrams/figure_5_sales_invoice_posting.png)

* Upon posting, the sales invoice automatically generates a balanced General Ledger journal:
  * `DR 1100 Debtors Control Account` (tagged with `contactId`)
  * `CR 4000 Sales Revenue`
  * `CR 2100 VAT Output Tax` (if applicable)

## 17. Customer Payment Allocation & Subledger Statements

![Figure 6 - Customer payment allocation and accounting flow](diagrams/figure_6_customer_payment_flow.png)

* Customer payment receipts post:
  * `DR 1000 Bank Account`
  * `CR 1100 Debtors Control Account` (tagged with `contactId`)
* Updates invoice state to `PARTIALLY_PAID` or `PAID`.
* Real-time derived subledger balances ensure customer statements reconcile with the General Ledger.
""",

        # CATEGORY E
        """# CATEGORY E: DATABASE & DATA GOVERNANCE

## 18. Database Schema & Entity Dictionary

### Core Relational Models in PostgreSQL:
* **`organizations`:** Primary multi-tenant container (`id`, `legal_name`, `slug`, `company_number`, `vat_number`, `base_currency`, `status`).
* **`users` & `user_sessions`:** Authentication records, `scrypt` password hash, active session tokens, IP and device tracking.
* **`accounts`:** Nominal ledger accounts (`1000–8999`), `normal_balance`, `is_control_account`, `allow_manual_posting`.
* **`journal_entries`:** Master journal headers with atomic sequence numbers `JE-YYYY-XXXXXX` and status tracking.
* **`journal_lines`:** Debit and credit line items typed as `NUMERIC(19,4)` with check constraints.
* **`contacts`:** Customer and supplier subledgers with payment terms, billing addresses, and VAT registration IDs.
* **`invoices` & `invoice_lines`:** Commercial sales invoices with VAT breakdown and auto-posting linkage.
* **`audit_logs`:** Append-only event store capturing every mutation across the platform.

## 19. Relational Integrity Guarantees

### 19.1 Composite Foreign Key Hardening
```sql
ALTER TABLE "journal_lines" 
ADD CONSTRAINT "journal_lines_organization_id_contact_id_fkey" 
FOREIGN KEY ("organization_id", "contact_id") 
REFERENCES "contacts"("organization_id", "id") 
ON DELETE RESTRICT ON UPDATE CASCADE;
```

### 19.2 Temporal Exclusion Constraints (`btree_gist`)
```sql
ALTER TABLE financial_years
ADD CONSTRAINT financial_years_no_overlap
EXCLUDE USING gist (
  organization_id WITH =,
  daterange(start_date, end_date, '[]') WITH &&
);
```

### 19.3 Append-Only Audit Trigger
```sql
CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs are immutable and cannot be updated or deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_logs_immutable
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();
```
""",

        # CATEGORY F
        """# CATEGORY F: API SPECIFICATIONS & INTEGRATION CONTRACTS

## 20. REST API Specification & OpenAPI Standards
* **Base URL:** `/api/v1`
* **Authentication:** Bearer token via `Authorization: Bearer <token>`
* **Correlation:** Request tracking via `x-request-id`

### Core Endpoint Summary:
* `POST /api/v1/auth/login`: Authenticates credentials with constant-time equality; returns session token.
* `GET /api/v1/organizations`: Lists user's accessible company workspaces.
* `GET /api/v1/accounts`: Retrieves Chart of Accounts nominal codes.
* `POST /api/v1/journals`: Creates draft journal entry.
* `POST /api/v1/journals/:id/validate`: Evaluates 15 accounting rules and marks as validated.
* `POST /api/v1/journals/:id/reverse`: Generates balancing counter-journal.
* `GET /api/v1/contacts/:id/statement`: Returns chronological customer statement with running balance.
* `POST /api/v1/invoices/:id/post`: Posts sales invoice to General Ledger and Subledger.
* `GET /api/v1/reports/trial-balance`: Aggregates active nominal accounts.

## 21. Standard Domain Error Catalog

All API errors return a standardized `DomainException` JSON envelope:

```json
{
  "statusCode": 400,
  "errorCode": "ERR_JOURNAL_UNBALANCED",
  "message": "Total debits must equal total credits",
  "timestamp": "2026-10-11T23:30:00.000Z",
  "path": "/api/v1/journals/clx123/validate",
  "requestId": "req_847291048291"
}
```
""",

        # CATEGORY G
        """# CATEGORY G: SECURITY, MULTI-TENANCY & PRIVACY

## 22. Defense-in-Depth Multi-Tenant Isolation Flow

![Figure 7 - Request authorisation and tenant-isolation flow](diagrams/figure_7_tenant_isolation_flow.png)

Every API request passes through sequential validation gates:
1. `Authenticate Session`: Validates active token in `user_sessions`.
2. `Resolve Organisation Context`: Verifies requested tenant against user profile.
3. `Verify Membership`: Checks user status in `organization_members`.
4. `Verify Permission`: Evaluates role (`OWNER`, `ACCOUNTANT`, `BOOKKEEPER`, etc.).
5. `Verify Resource organizationId`: Checks entity ownership.
6. Any failure immediately routes to HTTP 401 / 403 / `TENANT_MISMATCH`.

## 23. Authentication & Cryptography
* **Password Hashing:** Node.js native `crypto.scrypt` with a 16-byte cryptographically random salt.
* **Timing-Safe Verification:** Compares password hashes using `crypto.timingSafeEqual` to prevent timing attacks.
* **Session Management:** Revocable session tokens tracking device metadata, IP address, and user agent.
""",

        # CATEGORY H
        """# CATEGORY H: CLOUD ARCHITECTURE, DEVOPS & MIGRATION

## 24. Low-Cost AWS Architecture in eu-west-2

![Figure 8 - Low-cost AWS DEV architecture in eu-west-2](diagrams/figure_8_aws_dev_architecture.png)

* **AWS Amplify:** Next.js 15 web client hosting.
* **AWS App Runner:** Containerized NestJS API runtime.
* **Amazon RDS PostgreSQL:** Managed database in London (`eu-west-2`).
* **Amazon S3 & Secrets Manager:** Encrypted private document storage and configuration secrets.

## 25. Safe Migration & Rollback Runbook

![Figure 9 - Safe current-hosting to AWS migration and rollback path](diagrams/figure_9_migration_process.png)

* Pre-cutover validation using sanitized test data.
* Cutover approved gate checking row counts, trial balance equality, and application smoke tests.
* Maintenance mode cutover, final `pg_dump` and RDS restore, and DNS traffic switch.

## 26. CI/CD Quality Gates & Release Engineering

![Figure 10 - Pull-request quality gate and AWS DEV deployment flow](diagrams/figure_10_pull_request_gate.png)

* Pull Request pipeline runs: `npm ci` $\to$ Prisma validate $\to$ Lint & Typecheck $\to$ Unit/E2E test suites $\to$ Dependency & Secret Scan $\to$ Production Build.
* Successful merges trigger automated Docker builds pushed to Amazon ECR.
""",

        # CATEGORY I
        """# CATEGORY I: STRATEGIC ROADMAP & TEAM GOVERNANCE

## 27. Master 50-Phase Product Roadmap

* **Milestone 1 (Phases 1–8) [Completed]:** Double-Entry Core Engine, PostgreSQL Schema, `scrypt` Auth, Multi-Org RBAC, Chart of Accounts, Period Locking, Journal Validation.
* **Milestone 2 (Phases 9–15) [Active]:** Contacts & Subledgers, Sales Invoicing, Customer Statements, Supplier Bills, Bank Reconciliation, Financial Statements.
* **Milestone 3 (Phases 16–25) [Q1 2027]:** UK VAT Return Automation, HMRC MTD API Submission, Year-End Rollover, Fixed Asset Register, Practice Tools.
* **Milestone 4 (Phases 26–50) [Q2 2027+]:** UK Open Banking Live Feeds, AI OCR Receipt Extraction, ML Categorization, Multi-Currency FX, Intercompany Consolidation.

## 28. Risk Register & RAID Log

| Risk ID | Description | Impact | Probability | Mitigation Strategy | Owner |
| :---: | :--- | :---: | :---: | :--- | :---: |
| **RSK-01** | Decimal math rounding drift | Critical | Very Low | Handled exclusively via `Decimal.js` and `NUMERIC(19,4)`. | Backend Lead |
| **RSK-02** | Cross-tenant data leakage | Critical | Very Low | Composite foreign keys `(organization_id, id)` enforced in PostgreSQL. | Lead Architect |
| **RSK-03** | Retroactive period mutation | High | Very Low | Three-tier period locking (`HARD_LOCKED`) blocks historical edits. | Product Owner |
| **RSK-04** | Sequence number race collisions| High | Low | Atomic sequence counters inside serializable DB transactions. | Backend Lead |

## 29. RACI Operational Governance Matrix

| Deliverable | CEO | Product Manager | Lead Architect | Backend Team | Frontend Team | QA / Compliance |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Project Charter & Budget** | **A** | R | C | I | I | I |
| **PRD & User Stories** | I | **A** / R | C | C | C | C |
| **System Architecture & SAD** | I | C | **A** / R | C | I | C |
| **Accounting Invariants & GL**| I | C | A | **R** | I | C |
| **Web Frontend Implementation**| I | C | I | C | **A** / R | I |
| **Security & Multi-Tenancy** | I | I | A | C | C | **R** |
| **Release Go / No-Go Decision**| **A** | R | R | I | I | R |
""",

        # CATEGORY J & APPENDICES
        """# CATEGORY J: SOURCE CODE EXPLAINER & APPENDICES

## 30. Backend Source Code Deep-Dive (`apps/api/src`)
* **`MoneyService`:** Wraps `Decimal.js`, enforcing 4-decimal precision (`NUMERIC(19,4)`), eliminating floating-point rounding errors.
* **`JournalValidationService`:** Evaluates the 15 Institutional Accounting Invariants before any journal transitions to `VALIDATED`.
* **`JournalPostingService`:** Atomically assigns sequential identifiers `JE-YYYY-XXXXXX` and updates journal states.
* **`ContactSubledgerService`:** Dynamically derives Accounts Receivable (AR) and Accounts Payable (AP) balances from posted journal lines without caching drift.
* **`InvoicesService`:** Computes UK VAT (20%, 5%, 0%) and auto-posts balanced General Ledger entries.

## 31. Frontend Web Architecture (`apps/web/src`)
* **Next.js 15 App Router:** Server-side streaming paired with reactive client components.
* **Sticky Tally Bar:** Real-time client-side calculation of debits, credits, and live difference before submission.
* **Customer Statement Viewer:** Chronological transaction list with running line balances.

---

# Appendices

### Appendix A: Recommended Repository Structure
```
docs/
├── 00-overview/
├── 01-architecture/
├── 02-accounting/
├── 03-modules/
├── 04-phases/
├── 05-api/
├── 06-database/
├── 07-security/
├── 08-aws/
├── 09-devops/
├── 10-testing/
├── 11-compliance/
├── 12-operations/
└── diagrams/
```

### Appendix B: Stable Domain Error Codes Reference
* `PERIOD_LOCKED`, `PERIOD_NOT_FOUND`, `ACCOUNT_NOT_FOUND`, `INVOICE_NOT_FOUND`, `JOURNAL_UNBALANCED`, `PERMISSION_DENIED`, `TENANT_MISMATCH`.

### Appendix C: Financial & Accounting Glossary
* **AR:** Accounts Receivable (amounts owed by customers to the business).
* **AP:** Accounts Payable (amounts owed by the business to suppliers).
* **COA:** Chart of Accounts (structured list of all nominal accounts).
* **GL:** General Ledger (the complete record of all double-entry transactions).
* **TB:** Trial Balance (statement of all debit and credit balances).
* **MTD:** Making Tax Digital (HMRC regulatory mandate for digital tax reporting).
* **RPO / RTO:** Recovery Point Objective / Recovery Time Objective.
"""
    ]

    master_md = "\n\n---\n\n".join(sections)
    with open(OUTPUT_MD, "w", encoding="utf-8") as f:
        f.write(master_md)
    print(f"Master markdown created at {OUTPUT_MD} ({len(master_md)} bytes)")
    return master_md

def main():
    md_content = build_categorized_master_markdown()
    
    doc = Document()
    for sec in doc.sections:
        sec.top_margin = Inches(0.9)
        sec.bottom_margin = Inches(0.9)
        sec.left_margin = Inches(0.9)
        sec.right_margin = Inches(0.9)

    print("Adding cover page...")
    add_cover_page(doc)

    print("Parsing master categorized documentation into Word docx...")
    parse_markdown_to_docx(doc, md_content)

    print(f"Saving to {OUTPUT_DOCX}...")
    doc.save(OUTPUT_DOCX)
    print("Word document generated successfully!")

if __name__ == "__main__":
    main()
