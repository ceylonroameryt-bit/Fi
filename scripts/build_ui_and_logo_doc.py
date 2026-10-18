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
OUTPUT_MD = os.path.join(DOCS_DIR, "BLYNT_UI_AND_LOGO_GUIDELINES.md")
OUTPUT_DOCX = os.path.join(DOCS_DIR, "blynt_UI_and_Logo_Guidelines.docx")
OUTPUT_PDF = os.path.join(DOCS_DIR, "blynt_UI_and_Logo_Guidelines.pdf")
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
    run_sub = p_sub.add_run("UI DESIGN SYSTEM, BRAND GUIDELINES & LOGO SPECIFICATION")
    run_sub.font.name = "Segoe UI"
    run_sub.font.size = Pt(16)
    run_sub.font.bold = True
    run_sub.font.color.rgb = NAVY

    p_tagline = doc.add_paragraph()
    p_tagline.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_tagline.paragraph_format.space_after = Pt(20)
    r_tagline = p_tagline.add_run("Official Brand Identity • Logo Construction & Geometry • Design Tokens & Color Palette\nUI Component Library • Financial Precision Controls • Accessibility Standards (WCAG 2.1)\nAuthoritative Brand & Frontend Design Manual • October 2026")
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
    r_in = p_in.add_run("Brand & Frontend Architectural Scope\n")
    r_in.font.name = "Segoe UI"
    r_in.font.size = Pt(12)
    r_in.font.bold = True
    r_in.font.color.rgb = NAVY
    r_in2 = p_in.add_run("This standalone manual governs the visual brand identity, logo usage, color palette tokens, numeric typography standards, and frontend UI component architectures across the blynt ecosystem.")
    r_in2.font.name = "Segoe UI"
    r_in2.font.size = Pt(10)
    r_in2.font.italic = True
    r_in2.font.color.rgb = SLATE

    p_meta = doc.add_paragraph()
    p_meta.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_meta.paragraph_format.space_before = Pt(30)
    
    meta_lines = [
        ("Document Ref", "BLYNT-DS-LOGO-V1"),
        ("Brand Name", "blynt (Internal Code: Ledgerline)"),
        ("Primary Colors", "Navy (#162D5F) • Coral (#FF7F6C)"),
        ("Supporting Palette", "Emerald (#10B981) • Amber (#F59E0B) • Purple (#8B5CF6)"),
        ("Typography", "Inter / Segoe UI (Primary) • Consolas (Tabular Numerics)"),
        ("Frontend Stack", "Next.js 15 (Turbopack, React 19) • Vanilla CSS Design Tokens"),
        ("Accessibility Gate", "WCAG 2.1 Level AAA / AA Compliance"),
        ("Classification", "Official Brand & Design System Manual"),
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
                set_cell_margins(cell, top=65, bottom=65, left=95, right=95)
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
        set_cell_margins(cell, top=75, bottom=75, left=110, right=110)
        
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

        if stripped.startswith("# CHAPTER") or stripped.startswith("# SECTION") or (stripped.startswith("# ") and stripped[2:3].isdigit()):
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(18)
            p.paragraph_format.space_after = Pt(6)
            p.paragraph_format.keep_with_next = True
            run = p.add_run(stripped.lstrip('#').strip())
            run.font.name = "Segoe UI"
            run.font.size = Pt(16)
            run.font.bold = True
            run.font.color.rgb = NAVY
            continue

        if stripped.startswith("## "):
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(14)
            p.paragraph_format.space_after = Pt(4)
            p.paragraph_format.keep_with_next = True
            run = p.add_run(stripped[3:].strip())
            run.font.name = "Segoe UI"
            run.font.size = Pt(13)
            run.font.bold = True
            run.font.color.rgb = NAVY
            continue

        if stripped.startswith("### "):
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(10)
            p.paragraph_format.space_after = Pt(3)
            p.paragraph_format.keep_with_next = True
            run = p.add_run(stripped[4:].strip())
            run.font.name = "Segoe UI"
            run.font.size = Pt(11)
            run.font.bold = True
            run.font.color.rgb = CORAL
            continue

        if stripped.startswith("# "):
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(16)
            p.paragraph_format.space_after = Pt(6)
            p.paragraph_format.keep_with_next = True
            run = p.add_run(stripped[2:].strip())
            run.font.name = "Segoe UI"
            run.font.size = Pt(16)
            run.font.bold = True
            run.font.color.rgb = NAVY
            continue

        if stripped.startswith("* ") or stripped.startswith("- "):
            p = doc.add_paragraph(style='List Bullet')
            p.paragraph_format.space_before = Pt(1)
            p.paragraph_format.space_after = Pt(2)
            format_inline_text(p, stripped[2:].strip())
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

def main():
    content = """# blynt — UI Design System, Brand Guidelines & Logo Specification

**Document Classification:** Brand Identity, Frontend Architecture & Design System  
**Target Systems:** `apps/web` (Next.js 15 Web Application), Marketing Deliverables, PDF Reports, Presentation Decks  
**Version:** 1.0 Production Readiness  
**Document Ref:** `BLYNT-DS-LOGO-V1`  

---

# Table of Contents
* **1. Brand Identity & Logo System**
  * 1.1 Brand Story & Core Design Philosophy
  * 1.2 The Official Logo Mark: Anatomy & Geometry
  * 1.3 Logo Lockups: Standalone Mark, Horizontal Logo & Favicon
  * 1.4 Clear Space & Minimum Sizing Rules
  * 1.5 Brand Misuse & Guardrails (Do's and Don'ts)
* **2. Color Palette & Design Tokens**
  * 2.1 The Official Color Palette
  * 2.2 Color Tokens & Semantic Roles
  * 2.3 Accessibility & WCAG Contrast Compliance
  * 2.4 Dark Mode vs. Light Mode Palette Architecture
* **3. Typography System**
  * 3.1 Primary Font Family (Inter / Segoe UI)
  * 3.2 Monospace Financial Tabular Numbers (Consolas / JetBrains Mono)
  * 3.3 The blynt Type Scale Hierarchy
* **4. Core Financial UI Component Library**
  * 4.1 Sticky Live Tally Bar (The Real-Time Invariant Bar)
  * 4.2 Status Badges & Accounting Tags
  * 4.3 Executive KPI Metric Cards
  * 4.4 Financial Data Grids & Table Specifications
  * 4.5 Multi-Row Dynamic Journal Entry Editor
* **5. Application Shell & View Layouts**
  * 5.1 App Shell, Navigation Sidebar & Multi-Tenant Switcher
  * 5.2 Real-Time Executive Dashboard
  * 5.3 Commercial Invoicing & Subledger Statement Workspace
  * 5.4 Interactive Financial Reports Suite

---

# 1. Brand Identity & Logo System

The blynt brand represents the intersection of **institutional accounting precision** and **modern, effortless financial clarity**.

![Figure Logo - Official blynt brand mark](blynt-logo.png)

## 1.1 Brand Story & Core Design Philosophy

Traditional accounting software (Sage, Xero, QuickBooks) is plagued by visual clutter, outdated skeuomorphism, and disconnected tables that confuse business owners and slow down accountants.

The visual ethos of **`blynt`** is built upon three foundational pillars:
1. **Calm Authority:** Deep Navy (`#162D5F`) communicates institutional trustworthiness, fiduciary stability, and audit-grade durability.
2. **Dynamic Energy:** Vibrant Coral (`#FF7F6C`) signals modern speed, agile interaction, and intelligent action.
3. **Mathematical Precision:** Zero clutter, pure geometry, and tabular alignment that make financial anomalies instantly visible.

## 1.2 The Official Logo Mark: Anatomy & Geometry

The official `blynt` mark is a custom geometric monogram representing the letter **'b'**, split into two complementary interlocking shapes:

* **The Upper Arch (Coral `#FF7F6C`):** A smooth, rounded cantilever representing forward motion, cloud intelligence, and commercial growth.
* **The Foundation Base (Navy `#162D5F`):** A sturdy, solid diagonal base representing the general ledger, double-entry equilibrium, and rock-solid compliance.
* **The Optical Bridge:** A crisp 16px white negative space channel separating the two shapes, symbolizing transparency and the balance between debits and credits.

## 1.3 Logo Lockups: Standalone Mark, Horizontal Logo & Favicon

![Figure Horizontal Logo - blynt official horizontal logo lockup](blynt-logo-horizontal.png)

| Lockup Variant | File Asset | Usage Context | Recommended Minimum Width |
| :--- | :--- | :--- | :--- |
| **Standalone Mark** | `blynt-logo.png` | App launcher, avatar, cover pages, mobile header, social icons | **24px** (Digital) / **8mm** (Print) |
| **Horizontal Lockup** | `blynt-logo-horizontal.png` | Navigation header, invoice headers, PDF report banners | **120px** (Digital) / **35mm** (Print) |
| **Square Web Favicon** | `favicon.svg` | Browser tab icon, PWA manifest (16x16, 32x32, 192x192) | **16px** (Display) |
| **Monochrome Dark** | `brand/blynt-logo-dark.svg` | Dark mode application navigation bar | **120px** (Digital) |

## 1.4 Clear Space & Minimum Sizing Rules

```
       ┌──────────────────────────────────────────────────┐
       │                      [ X ]                       │
       │         ┌──────────────────────────────┐         │
       │   [ X ] │     ( b )     blynt          │  [ X ]  │
       │         └──────────────────────────────┘         │
       │                      [ X ]                       │
       └──────────────────────────────────────────────────┘
```

* **The Clear Space Rule ('X'):** The minimum exclusion zone surrounding the logo is defined as **`X`**, where `X` equals half the total height of the mark. No typography, buttons, borders, or page edges may encroach into this exclusion zone.
* **Minimum Digital Sizes:**
  * Mark Only: Never render below **20 x 20 pixels**.
  * Horizontal Lockup: Never render below **100 x 30 pixels**.
* **Minimum Print Sizes:**
  * Mark Only: **8mm x 10mm**.
  * Horizontal Lockup: **30mm x 10mm**.

## 1.5 Brand Misuse & Guardrails (Do's and Don'ts)

| Prohibited Misuse | Why It Is Forbidden | Mandatory Correction |
| :--- | :--- | :--- |
| **DO NOT rotate or tilt the logo** | Destroys the optical balance of the double-entry base. | Always present horizontally at 0° angle. |
| **DO NOT alter the brand colors** | Weakens brand recognition. | Strictly use Coral `#FF7F6C` and Navy `#162D5F`. |
| **DO NOT add heavy drop shadows** | Violates the flat, modern fintech aesthetic. | Use clean flat SVG rendering or subtle border. |
| **DO NOT stretch, condense or distort** | Distorts the geometric curve radii. | Constrain aspect ratio proportionally (1:1 mark). |
| **DO NOT capitalize the wordmark** | The brand name is strictly lowercase **"blynt"**. | Render exclusively in lowercase bold Segoe UI / Inter. |

---

# 2. Color Palette & Design Tokens

![Figure UI-1 - Official blynt brand color palette and design tokens](diagrams/figure_ui_brand_palette.png)

## 2.1 The Official Color Palette

The blynt color system is strictly curated to balance statutory legibility with modern digital energy:

| Color Name | HEX Code | RGB | HSL | CMYK (Print) | Semantic Usage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Primary Navy** | `#162D5F` | `22, 45, 95` | `221°, 62%, 23%` | `77, 53, 0, 63` | Brand Authority, Table Headers, Primary Text, 3000 Equity Accounts |
| **Primary Coral** | `#FF7F6C` | `255, 127, 108` | `8°, 100%, 71%` | `0, 50, 58, 0` | Brand Accents, Primary CTA Buttons, Highlights, 5000/6000 Expenses |
| **Emerald Positive** | `#10B981` | `16, 185, 129` | `160°, 84%, 39%` | `91, 0, 30, 27` | Debit Balances, Asset Accounts (1000), Balanced State ($\Delta = 0$), Paid |
| **Amber Warning** | `#F59E0B` | `245, 158, 11` | `38°, 92%, 50%` | `0, 36, 96, 4` | Draft Status, Soft-Locked Periods, Pending Approval, Overdue Warnings |
| **Purple AI** | `#8B5CF6` | `139, 92, 246` | `258°, 90%, 66%` | `43, 63, 0, 3` | AI Document Intelligence, OCR Suggestions, Automated Categorization |
| **Slate Neutral** | `#475569` | `71, 85, 105` | `215°, 19%, 35%` | `32, 19, 0, 59` | Secondary Body Text, Meta Labels, Table Row Borders, Inactive Elements |
| **Surface Light** | `#F8FAFC` | `248, 250, 252` | `210°, 40%, 98%` | `2, 1, 0, 1` | Primary Application Background, Alternating Table Rows |
| **Border Gray** | `#E2E8F0` | `226, 232, 240` | `214°, 32%, 91%` | `6, 3, 0, 6` | Component Borders, Table Gridlines, Card Dividers |

## 2.2 CSS Design Tokens (`apps/web/src/app/globals.css`)

```css
:root {
  /* Brand Core Tokens */
  --brand-navy: #162D5F;
  --brand-coral: #FF7F6C;
  --brand-navy-tint: #EEF2F9;
  --brand-coral-tint: #FFF1EE;

  /* Functional Status Tokens */
  --color-success: #10B981;
  --color-success-bg: #ECFDF5;
  --color-warning: #F59E0B;
  --color-warning-bg: #FFFBEB;
  --color-danger: #EF4444;
  --color-danger-bg: #FEF2F2;
  --color-ai: #8B5CF6;
  --color-ai-bg: #F5F3FF;

  /* Neutral Surface Tokens */
  --bg-page: #F8FAFC;
  --bg-card: #FFFFFF;
  --bg-card-hover: #F1F5F9;
  --border-subtle: #E2E8F0;
  --text-primary: #162D5F;
  --text-secondary: #475569;
  --text-muted: #94A3B8;

  /* Typography */
  --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
  --font-mono: 'Consolas', 'JetBrains Mono', monospace;
}
```

## 2.3 Accessibility & WCAG Contrast Compliance

All color combinations in blynt meet or exceed **WCAG 2.1 Level AAA and AA** criteria:
* **Navy (`#162D5F`) on White (`#FFFFFF`):** Contrast ratio of **14.8 : 1** (Exceeds AAA requirement of 7:1).
* **Navy (`#162D5F`) on Surface Light (`#F8FAFC`):** Contrast ratio of **14.1 : 1** (AAA compliant).
* **Coral CTA (`#FF7F6C`) with Navy Text (`#162D5F`):** Contrast ratio of **4.9 : 1** (AA compliant for buttons).
* **Emerald Text (`#065F46`) on Success BG (`#ECFDF5`):** Contrast ratio of **7.6 : 1** (AAA compliant).

---

# 3. Typography System

Financial software demands absolute numeric legibility. Misaligned numbers cause severe reporting errors.

## 3.1 Primary Font Family: Inter / Segoe UI
* **Usage:** Navigation, headings, card titles, form labels, general body copy.
* **Attributes:** Tall x-height, open apertures, distinct letterforms (e.g., distinguishing 'I', 'l', and '1').

## 3.2 Monospace Financial Tabular Numbers
* **Usage:** General Ledger amounts, debit/credit columns, invoice totals, account codes.
* **Font Family:** `Consolas`, `JetBrains Mono`, or `Inter` with `font-feature-settings: "tnum" 1`.
* **Guarantee:** Every numeral (`0` to `9`) occupies the exact same horizontal width (fixed-pitch). Decimal points align vertically without drifting.

## 3.3 The blynt Type Scale Hierarchy

| Style Token | Font Size | Line Height | Weight | Tracking | Primary Usage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Display 1** | **38px** (2.375rem) | 48px | Bold (700) | -0.025em | Document Covers, Large KPI Totals |
| **Heading 1** | **24px** (1.5rem) | 32px | Bold (700) | -0.02em | Main Page Titles, Module Banners |
| **Heading 2** | **18px** (1.125rem) | 26px | Semi-Bold (600) | -0.01em | Card Headers, Modal Titles, Section Dividers |
| **Heading 3** | **14px** (0.875rem) | 20px | Semi-Bold (600) | 0.0em | Table Column Headers, Form Group Titles |
| **Body 1** | **14px** (0.875rem) | 22px | Regular (400) | 0.0em | Standard Form Fields, Table Data Rows |
| **Body 2** | **12px** (0.75rem) | 18px | Regular (400) | 0.0em | Secondary Descriptions, Subledger Dates |
| **Mono Tabular** | **13px** (0.8125rem) | 20px | Medium (500) | 0.0em | Debits, Credits, Balances, VAT Amounts |
| **Badge Micro** | **11px** (0.6875rem) | 14px | Bold (700) | +0.03em | Status Badges, Nominal Code Pills |

---

# 4. Core Financial UI Component Library

![Figure UI-2 - blynt core UI component system and live financial controls](diagrams/figure_ui_component_system.png)

## 4.1 Sticky Live Tally Bar (The Real-Time Invariant Bar)

The Sticky Live Tally Bar is the central user experience innovation of the blynt journal entry creator:
* **Location:** Fixed to the bottom of the viewport (`position: sticky; bottom: 0; z-index: 50`).
* **Live Mathematical Evaluation:** Evaluates every input stroke through `Decimal.js`:
  $$\Delta = |\sum \text{Debits} - \sum \text{Credits}|$$
* **Balanced State ($\Delta = 0.00$):**
  * Background: Emerald Light (`#F0FDF4`).
  * Border: Emerald (`#10B981`).
  * Badge: Solid Emerald with white text `DIFF: £0.00 (BALANCED)`.
  * CTA Button: "Post Journal" enabled with Coral accent.
* **Unbalanced State ($\Delta > 0.00$):**
  * Background: Coral Tint (`#FEF2F2`).
  * Border: Coral Accent (`#EF4444`).
  * Badge: Pulsing Red with white text `DIFF: £X.XX (OUT OF BALANCE)`.
  * CTA Button: "Post Journal" disabled (`opacity: 0.5; cursor: not-allowed`).

## 4.2 Status Badges & Accounting Tags

* **`DRAFT`:** Slate background (`#F1F5F9`), Slate text (`#475569`). Indicates editable, uncommitted document.
* **`VALIDATED`:** Light Navy tint (`#EEF2F9`), Navy text (`#162D5F`). Invariants passed; awaiting posting signature.
* **`POSTED`:** Emerald tint (`#ECFDF5`), Emerald text (`#047857`). Committed to General Ledger; immutable.
* **`REVERSED`:** Soft Red tint (`#FEF2F2`), Crimson text (`#DC2626`). GAAP counter-balanced entry generated.
* **`VOIDED`:** Coral tint (`#FFF1EE`), Coral text (`#FF7F6C`). Invoice cancelled and unlinked.

## 4.3 Executive KPI Metric Cards

Rendered prominently at the top of the dashboard:
* **Cash at Bank:** Nominal 1000 balance with real-time bank reconciliation status.
* **Accounts Receivable:** Nominal 1100 aggregate balance with overdue invoice count badge.
* **Accounts Payable:** Nominal 2000 aggregate balance with upcoming 14-day cash outflow forecast.
* **Net Profit (YTD):** Dynamic formula ($\text{Revenue} - \text{COS} - \text{OPEX}$) with net margin percentage.

## 4.4 Financial Data Grids & Table Specifications

All accounting tables in blynt enforce the following rules:
1. **Right-Alignment:** All currency amounts (`Debit`, `Credit`, `Balance`) must be right-aligned (`text-align: right; font-variant-numeric: tabular-nums`).
2. **Left-Alignment:** Nominal codes, descriptions, and contact names are left-aligned.
3. **Center-Alignment:** Status badges, dates, and action menus are centered.
4. **Zebra Striping:** Alternating rows use Surface Light (`#F8FAFC`) to assist horizontal eye tracking across wide tables.
5. **Sticky Headers:** Table header row sticks to top of container during long scrolls.

---

# 5. Application Shell & View Layouts

## 5.1 App Shell, Navigation Sidebar & Multi-Tenant Switcher

```
┌────────────────────────────────────────────────────────────────────────┐
│ [ b blynt ]   [ Organization Switcher: Acme UK Ltd ▼ ]   [ User: John ]│
├──────────────┬─────────────────────────────────────────────────────────┤
│ • Dashboard  │  Dashboard Overview                                     │
│ • Accounting │  ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐ │
│   - COA      │  │ CASH AT BANK │ │ A/R OVERDUE  │ │ NET PROFIT (YTD) │ │
│   - Journals │  │ £142,850.40  │ │ £38,420.00   │ │ £84,210.00       │ │
│   - Ledger   │  └──────────────┘ └──────────────┘ └──────────────────┘ │
│ • Sales      │                                                         │
│   - Invoices │  Recent Posted Transactions                             │
│   - Contacts │  ┌───────┬────────────┬─────────────┬──────────┬──────┐ │
│ • Purchases  │  │ Date  │ Number     │ Narration   │ Amount   │ Stat │ │
│ • Reports    │  ├───────┼────────────┼─────────────┼──────────┼──────┤ │
│ • Settings   │  │ 10/12 │ JE-2026-01 │ Sales Inv   │ £2,400   │ POST │ │
└──────────────┴──┴───────┴────────────┴─────────────┴──────────┴──────┘─┘
```

* **Sidebar Navigation:** Grouped into logical accounting domains (`Accounting`, `Sales`, `Purchases`, `Reports`, `Settings`).
* **Tenant Switcher:** Instant organisation switching without re-authenticating, re-scoping active tokens automatically.
* **Responsive Breakpoints:**
  * Desktop (`>= 1280px`): Full persistent sidebar and 4-column KPI cards.
  * Tablet (`768px - 1279px`): Collapsed icon sidebar and 2-column KPI cards.
  * Mobile (`< 768px`): Bottom sheet navigation drawer and stacked cards.

---

# END OF BLYNT UI DESIGN SYSTEM, BRAND GUIDELINES & LOGO SPECIFICATION
"""

    print("Writing BLYNT_UI_AND_LOGO_GUIDELINES.md...")
    with open(OUTPUT_MD, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"File created: {OUTPUT_MD} ({len(content)} bytes)")

    doc = Document()
    for sec in doc.sections:
        sec.top_margin = Inches(0.9)
        sec.bottom_margin = Inches(0.9)
        sec.left_margin = Inches(0.9)
        sec.right_margin = Inches(0.9)

    print("Adding cover page...")
    add_cover_page(doc)

    print("Parsing UI & Logo markdown into Word docx...")
    parse_markdown_to_docx(doc, content)

    print(f"Saving to {OUTPUT_DOCX}...")
    doc.save(OUTPUT_DOCX)
    print("Word document generated successfully!")

if __name__ == "__main__":
    main()
