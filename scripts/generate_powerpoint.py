import os
import sys
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.enum.shapes import MSO_SHAPE

# ── Exact Brand Color Palette Sampled From Official Uploaded Logo ────────────
BRAND_CORAL = RGBColor(255, 127, 108)   # #FF7F6C (Warm Modern Coral / Salmon)
BRAND_NAVY  = RGBColor(22, 45, 95)     # #162D5F (Deep UK Banking Navy)
BG_LIGHT    = RGBColor(248, 250, 252)   # #F8FAFC (Clean Crisp Canvas)
CARD_BG     = RGBColor(255, 255, 255)   # #FFFFFF (Pure White)
CARD_BORDER = RGBColor(226, 232, 240)   # #E2E8F0 (Subtle Slate Border)
TEXT_DARK   = RGBColor(22, 45, 95)      # #162D5F (Primary Navy Heading)
TEXT_SUB    = RGBColor(51, 65, 85)      # #334155 (Charcoal Body)
TEXT_MUTED  = RGBColor(100, 116, 139)   # #64748B (Muted Meta Text)
CORAL_TINT  = RGBColor(255, 241, 238)   # #FFF1EE (Soft Coral Badge)
NAVY_TINT   = RGBColor(238, 242, 249)   # #EEF2F9 (Soft Navy Badge)
SUCCESS_GRN = RGBColor(16, 185, 129)    # #10B981

LOGO_HORIZONTAL = "blynt-logo-horizontal.png"
LOGO_MARK = "blynt-mark-transparent.png"

def create_presentation(output_path="Blynt_Master_Presentation.pptx"):
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6]

    def set_slide_background(slide):
        bg = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, Inches(13.333), Inches(7.5))
        bg.fill.solid()
        bg.fill.fore_color.rgb = BG_LIGHT
        bg.line.fill.background()

        # Top dual-color brand accent line (Coral + Navy)
        bar_coral = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, Inches(6.666), Inches(0.08))
        bar_coral.fill.solid()
        bar_coral.fill.fore_color.rgb = BRAND_CORAL
        bar_coral.line.fill.background()

        bar_navy = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(6.666), 0, Inches(6.667), Inches(0.08))
        bar_navy.fill.solid()
        bar_navy.fill.fore_color.rgb = BRAND_NAVY
        bar_navy.line.fill.background()
        return bg

    def add_header(slide, badge_text, title_text, subtitle_text, badge_color=BRAND_CORAL):
        # Logo in top right
        if os.path.exists(LOGO_HORIZONTAL):
            slide.shapes.add_picture(LOGO_HORIZONTAL, Inches(10.6), Inches(0.35), width=Inches(1.9))

        # Badge
        badge = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(0.38), Inches(2.7), Inches(0.32))
        badge.fill.solid()
        badge.fill.fore_color.rgb = CORAL_TINT if badge_color == BRAND_CORAL else NAVY_TINT
        badge.line.color.rgb = badge_color
        badge.line.width = Pt(1)
        tf = badge.text_frame
        tf.word_wrap = False
        p = tf.paragraphs[0]
        p.text = badge_text.upper()
        p.font.size = Pt(8.5)
        p.font.bold = True
        p.font.color.rgb = badge_color
        p.alignment = PP_ALIGN.CENTER

        # Title
        title_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.78), Inches(9.6), Inches(0.75))
        tf_title = title_box.text_frame
        tf_title.word_wrap = True
        p_title = tf_title.paragraphs[0]
        p_title.text = title_text
        p_title.font.size = Pt(25)
        p_title.font.bold = True
        p_title.font.color.rgb = BRAND_NAVY

        # Subtitle
        sub_box = slide.shapes.add_textbox(Inches(0.8), Inches(1.45), Inches(10.5), Inches(0.55))
        tf_sub = sub_box.text_frame
        tf_sub.word_wrap = True
        p_sub = tf_sub.paragraphs[0]
        p_sub.text = subtitle_text
        p_sub.font.size = Pt(12)
        p_sub.font.color.rgb = TEXT_MUTED

    def add_card(slide, left, top, width, height, title, body, highlight="", top_accent_color=BRAND_NAVY):
        # Card background
        card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(left), Inches(top), Inches(width), Inches(height))
        card.fill.solid()
        card.fill.fore_color.rgb = CARD_BG
        card.line.color.rgb = CARD_BORDER
        card.line.width = Pt(1)

        # Top border accent strip inside card
        strip = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(left + 0.05), Inches(top + 0.05), Inches(width - 0.1), Inches(0.06))
        strip.fill.solid()
        strip.fill.fore_color.rgb = top_accent_color
        strip.line.fill.background()

        tf = card.text_frame
        tf.word_wrap = True
        tf.margin_left = Inches(0.24)
        tf.margin_right = Inches(0.24)
        tf.margin_top = Inches(0.22)
        tf.margin_bottom = Inches(0.22)

        # Title
        p_title = tf.paragraphs[0]
        p_title.text = title
        p_title.font.size = Pt(14)
        p_title.font.bold = True
        p_title.font.color.rgb = top_accent_color
        p_title.space_after = Pt(8)

        # Body
        p_body = tf.add_paragraph()
        p_body.text = body
        p_body.font.size = Pt(10.5)
        p_body.font.color.rgb = TEXT_SUB
        p_body.space_after = Pt(8)

        # Highlight
        if highlight:
            p_hl = tf.add_paragraph()
            p_hl.text = f"▶ {highlight}"
            p_hl.font.size = Pt(9.5)
            p_hl.font.bold = True
            p_hl.font.color.rgb = top_accent_color

        return card

    def add_notes(slide, notes_text):
        notes_slide = slide.notes_slide
        text_frame = notes_slide.notes_text_frame
        text_frame.text = notes_text

    # ══════════════════════════════════════════════════════════════════════════
    # SLIDE 1: Title Slide (Official Blynt Logo & Coral/Navy Theme)
    # ══════════════════════════════════════════════════════════════════════════
    s1 = prs.slides.add_slide(blank_layout)
    set_slide_background(s1)

    # Hero Logo & Mark
    if os.path.exists(LOGO_HORIZONTAL):
        s1.shapes.add_picture(LOGO_HORIZONTAL, Inches(1.2), Inches(1.1), width=Inches(3.4))

    # Hero Headline
    t_box = s1.shapes.add_textbox(Inches(1.2), Inches(2.2), Inches(11.0), Inches(1.8))
    tf1 = t_box.text_frame
    tf1.word_wrap = True
    p1 = tf1.paragraphs[0]
    p1.text = "Business Finance, Simplified."
    p1.font.size = Pt(40)
    p1.font.bold = True
    p1.font.color.rgb = BRAND_NAVY
    p1.space_after = Pt(8)

    p1_sub = tf1.add_paragraph()
    p1_sub.text = "Institutional-Grade Cloud Accounting SaaS  •  Clarity in Every Number"
    p1_sub.font.size = Pt(19)
    p1_sub.font.bold = True
    p1_sub.font.color.rgb = BRAND_CORAL

    # 3 Summary Cards
    add_card(s1, 1.2, 4.3, 3.4, 2.3, "💼 Non-IT Executives", "Zero reconciliation friction, automated tax compliance, intuitive bookkeeping, and instant business health metrics.", "Eliminates 80% manual entry", BRAND_NAVY)
    add_card(s1, 4.9, 4.3, 3.4, 2.3, "⚙️ Technical Architects", "PostgreSQL 16 btree_gist exclusion, Decimal.js exact fixed-point arithmetic, and scrypt session isolation.", "Zero floating-point drift", BRAND_CORAL)
    add_card(s1, 8.6, 4.3, 3.4, 2.3, "🤖 AI Document Intelligence", "Autonomous receipt scanning with strict accounting direction guardrails and human review validation.", "100% Deterministic posting", BRAND_NAVY)

    add_notes(s1, "Welcome everyone. Today I'm presenting Blynt — a UK cloud accounting platform engineered to solve two fundamental problems in modern finance: mathematical inaccuracy and unsafe financial AI. Our mission is 'Clarity in Every Number.'")

    # ══════════════════════════════════════════════════════════════════════════
    # SLIDE 2: Non-IT Business Problem & Solution
    # ══════════════════════════════════════════════════════════════════════════
    s2 = prs.slides.add_slide(blank_layout)
    set_slide_background(s2)
    add_header(s2, "Executive Overview", "The Problem in Small Business Bookkeeping", "Why traditional accounting software causes audit penalties, operational friction, and founder frustration.", BRAND_NAVY)

    add_card(s2, 0.8, 2.2, 5.6, 4.6, "❌ The Current Nightmare (Legacy Tools)", 
             "• Retroactive Tampering: Users accidentally edit past invoices, corrupting last year's closed accounts and triggering tax penalties.\n\n"
             "• Price Gouging: Basic features like manual journals, multi-currency, and extra team members are locked behind £40+/mo tiers.\n\n"
             "• AI Hallucinations: Modern apps guess categories blindly, inventing fake VAT rates and flipping sales into expenses.\n\n"
             "• Jargon Overload: Complex double-entry terms confuse non-financial business founders.",
             "5.5M UK small businesses waste hours on manual fixes", BRAND_CORAL)

    add_card(s2, 6.8, 2.2, 5.6, 4.6, "✅ The Blynt Solution (Clarity & Safety)", 
             "• 3-Tier Period Lockdown: Hard-locked financial periods make past closed years mathematically unalterable.\n\n"
             "• Fair, Predictable Pricing: Complete nominal ledger, multi-user access, and reporting included by default.\n\n"
             "• Guardrailed AI: Autonomous receipt extraction that enforces accounting sanity checks before anything touches the ledger.\n\n"
             "• Subledger Simplicity: Clean invoices, bills, and contacts that post seamlessly behind the scenes.",
             "Complete peace of mind and effortless tax compliance", BRAND_NAVY)

    add_notes(s2, "For non-IT stakeholders: 5.5 million UK small businesses struggle with bookkeeping. Legacy software lets users accidentally alter last year's accounts, causing HMRC penalties, while charging exorbitant fees. Blynt solves this with an idiot-proof safety net.")

    # ══════════════════════════════════════════════════════════════════════════
    # SLIDE 3: Research Gap
    # ══════════════════════════════════════════════════════════════════════════
    s3 = prs.slides.add_slide(blank_layout)
    set_slide_background(s3)
    add_header(s3, "Academic & Technical Rigor", "Critical Industry Failures & The Blynt Research Gap", "Addressing the fundamental architectural flaws present in current fintech and SaaS tools.", BRAND_CORAL)

    add_card(s3, 0.8, 2.2, 3.6, 4.6, "1. Floating-Point Math Drift",
             "Problem:\n"
             "Standard web applications use IEEE-754 binary floats (e.g., 0.1 + 0.2 = 0.30000000000000004).\n\n"
             "Impact:\n"
             "Across thousands of transactions, rounding drift accumulates, throwing Trial Balance debits and credits out of balance.\n\n"
             "Blynt Engineering Solution:\n"
             "Fixed-point NUMERIC(19,4) arithmetic with Decimal.js and Prisma Decimal guarantees absolute mathematical parity.",
             "Zero Floating-Point Drift", BRAND_NAVY)

    add_card(s3, 4.8, 2.2, 3.6, 4.6, "2. Unchecked AI Hallucination",
             "Problem:\n"
             "LLMs and OCR tools are probabilistic. They frequently hallucinate non-existent VAT categories or invert cash flow direction.\n\n"
             "Impact:\n"
             "Wrong accounting entries post silently, resulting in inaccurate tax returns and audit liabilities.\n\n"
             "Blynt Engineering Solution:\n"
             "Deterministic 15-Rule Validation Engine & Direction Guard enforces strict ledger checks before any draft is finalized.",
             "Deterministic Ledger Guardrails", BRAND_CORAL)

    add_card(s3, 8.8, 2.2, 3.6, 4.6, "3. Mutable Audit Trails",
             "Problem:\n"
             "Most SaaS platforms store audit logs in standard relational tables that allow UPDATE and DELETE statements.\n\n"
             "Impact:\n"
             "Malicious actors or application bugs can alter or purge audit logs without detection.\n\n"
             "Blynt Engineering Solution:\n"
             "PostgreSQL append-only triggers physically reject UPDATE and DELETE queries at the database engine level.",
             "Database-Level Immutability", BRAND_NAVY)

    add_notes(s3, "Our research gap: Most accounting apps make 3 dangerous mistakes: binary float math, unchecked AI hallucinations, and soft-delete audit records. Blynt closes these gaps with fixed-point arithmetic, deterministic AI guardrails, and trigger-enforced audit logs.")

    # ══════════════════════════════════════════════════════════════════════════
    # SLIDE 4: Technical Architecture & Stack
    # ══════════════════════════════════════════════════════════════════════════
    s4 = prs.slides.add_slide(blank_layout)
    set_slide_background(s4)
    add_header(s4, "Engineering Core", "Production Technical Architecture", "Modular, multi-tenant cloud architecture engineered for high availability and regulatory compliance.", BRAND_NAVY)

    add_card(s4, 0.8, 2.2, 2.7, 4.6, "PostgreSQL 16+",
             "• btree_gist temporal exclusion prevents overlapping financial years.\n\n"
             "• Non-negative CHECK constraints.\n\n"
             "• Composite tenant foreign keys enforce zero cross-org data leakage.\n\n"
             "• Amazon RDS eu-west-2 (London) guarantees strict UK GDPR data residency.",
             "Amazon RDS PostgreSQL", BRAND_NAVY)

    add_card(s4, 3.8, 2.2, 2.7, 4.6, "NestJS 11 + TS",
             "• Modular enterprise TypeScript backend.\n\n"
             "• Custom security decorators (@CurrentOrg, @RequirePermission).\n\n"
             "• crypto.scrypt password hashing with random salt & timing-safe checks.\n\n"
             "• Structured JSON logger with correlation IDs (x-request-id).",
             "AWS App Runner", BRAND_CORAL)

    add_card(s4, 6.8, 2.2, 2.7, 4.6, "Next.js 15 Web",
             "• React 19 App Router with Turbopack.\n\n"
             "• Server-side rendering (SSR) and streaming caching.\n\n"
             "• Real-time financial arithmetic and responsive balance displays.\n\n"
             "• Multi-org switcher and role-aware navigation.",
             "Next.js + Turbopack", BRAND_NAVY)

    add_card(s4, 9.8, 2.2, 2.7, 4.6, "Security & Vault",
             "• AWS KMS AES-256 storage encryption at rest.\n\n"
             "• S3 VPC Endpoints for private document receipt transmission.\n\n"
             "• Session revocation & multi-device session management.\n\n"
             "• 127 automated integration tests passing at 100%.",
             "UK GDPR & HMRC Compliant", BRAND_CORAL)

    add_notes(s4, "For technical reviewers: We chose PostgreSQL 16 on Amazon RDS London with btree_gist temporal exclusion, NestJS 11 with scrypt hashing, and Next.js 15 App Router. All test suites pass with 127 automated tests verified.")

    # ══════════════════════════════════════════════════════════════════════════
    # SLIDE 5: Process Diagram 1 - Double-Entry Ledger Pipeline
    # ══════════════════════════════════════════════════════════════════════════
    s5 = prs.slides.add_slide(blank_layout)
    set_slide_background(s5)
    add_header(s5, "Process Flow 1", "Immutable Double-Entry Ledger Pipeline", "From draft entry to validation, atomic posting, audit logging, and financial statement generation.", BRAND_CORAL)

    add_card(s5, 0.8, 2.2, 2.6, 4.6, "Step 1: Ingestion",
             "Source transactions are generated from:\n\n"
             "• Sales Invoices\n"
             "• Purchase Bills\n"
             "• Manual Journals (JE-YYYY-XXXXXX)\n\n"
             "Status starts strictly as DRAFT.",
             "Initial State: DRAFT", BRAND_NAVY)

    add_card(s5, 3.7, 2.2, 2.7, 4.6, "Step 2: 15-Rule Validation",
             "JournalValidationService executes:\n\n"
             "1. Sum(Debits) == Sum(Credits)\n"
             "2. Minimum 2 lines\n"
             "3. Accounts active & same org\n"
             "4. Period not hard-locked\n"
             "5. Control accounts protected\n"
             "6. Non-negative values",
             "State: VALIDATED", BRAND_CORAL)

    add_card(s5, 6.7, 2.2, 2.7, 4.6, "Step 3: Atomic Posting",
             "JournalPostingService commits:\n\n"
             "• Atomic database transaction\n"
             "• Status transitions to POSTED\n"
             "• Append-only audit record created\n"
             "• Symmetrical reversal journal if corrected later (REVERSED)",
             "State: POSTED (Immutable)", BRAND_NAVY)

    add_card(s5, 9.7, 2.2, 2.8, 4.6, "Step 4: Real-Time Reports",
             "Instant reporting derived from General Ledger:\n\n"
             "• General Ledger Running Balance\n"
             "• Trial Balance (Exact Balance Equation)\n"
             "• Profit & Loss Statement\n"
             "• Balance Sheet (Assets = Liab + Equity)",
             "Equilibrium: 100% Balanced", BRAND_CORAL)

    add_notes(s5, "This is the core double-entry process. Transactions start as DRAFT, must pass 15 validation rules, post atomically to the ledger, and generate real-time reports. Postings can never be modified; only reversed with symmetrical journals.")

    # ══════════════════════════════════════════════════════════════════════════
    # SLIDE 6: Process Diagram 2 - AI Document Pipeline
    # ══════════════════════════════════════════════════════════════════════════
    s6 = prs.slides.add_slide(blank_layout)
    set_slide_background(s6)
    add_header(s6, "Process Flow 2", "AI Document Intelligence & Safety Guardrails", "Secure ingestion, multi-stage token classification, and deterministic accounting sanity checks.", BRAND_NAVY)

    add_card(s6, 0.8, 2.2, 2.6, 4.6, "1. Secure Upload",
             "• User uploads PDF or image receipt.\n\n"
             "• File encrypted and stored in AWS S3 vault.\n\n"
             "• Virus scanning and MIME type verification executed.",
             "Encrypted S3 Storage", BRAND_NAVY)

    add_card(s6, 3.7, 2.2, 2.7, 4.6, "2. Extraction Engine",
             "• Text and token extraction.\n\n"
             "• Vendor name & contact resolution.\n\n"
             "• Line-item amounts, tax breakdown, and date extraction.\n\n"
             "• Total gross and net cross-reconciliation.",
             "Field & Date Extraction", BRAND_CORAL)

    add_card(s6, 6.7, 2.2, 2.7, 4.6, "3. Direction & Safety Guard",
             "AccountingSafetyService evaluates:\n\n"
             "• Transaction Direction (Is this a purchase bill or a sales invoice?).\n\n"
             "• Verified tax code check (rejection of unconfigured rates).\n\n"
             "• Active accounting period verification.",
             "Deterministic Verification", BRAND_NAVY)

    add_card(s6, 9.7, 2.2, 2.8, 4.6, "4. Human Review & Posting",
             "Confidence Check:\n\n"
             "• If confidence >= 95% and zero errors: generates validated draft for 1-click review.\n\n"
             "• If ambiguous: routes to Human Review modal.\n\n"
             "• Zero unchecked automated posts.",
             "Human-in-the-Loop Safe", BRAND_CORAL)

    add_notes(s6, "Our AI pipeline never posts directly to the ledger. It extracts receipt data, verifies transaction direction, enforces active period rules, and requires human approval if there is any ambiguity. AI is a reader, not a decision-maker.")

    # ══════════════════════════════════════════════════════════════════════════
    # SLIDE 7: Competitor Benchmark Matrix
    # ══════════════════════════════════════════════════════════════════════════
    s7 = prs.slides.add_slide(blank_layout)
    set_slide_background(s7)
    add_header(s7, "Market Positioning", "Competitive Benchmark: Where Blynt Wins", "Evaluating Blynt against incumbent UK and global accounting software providers.", BRAND_CORAL)

    rows, cols = 6, 6
    tbl_shape = s7.shapes.add_table(rows, cols, Inches(0.8), Inches(2.2), Inches(11.7), Inches(4.6))
    tbl = tbl_shape.table
    tbl.columns[0].width = Inches(2.2)
    tbl.columns[1].width = Inches(2.0)
    tbl.columns[2].width = Inches(1.9)
    tbl.columns[3].width = Inches(1.9)
    tbl.columns[4].width = Inches(1.9)
    tbl.columns[5].width = Inches(1.8)

    headers = ["Feature Vector", "Blynt", "Xero", "QuickBooks", "FreeAgent", "Wave"]
    for c_idx, h in enumerate(headers):
        cell = tbl.cell(0, c_idx)
        cell.fill.solid()
        cell.fill.fore_color.rgb = BRAND_NAVY if c_idx == 1 else RGBColor(238, 242, 249)
        p = cell.text_frame.paragraphs[0]
        p.text = h
        p.font.bold = True
        p.font.size = Pt(11)
        p.font.color.rgb = RGBColor(255, 255, 255) if c_idx == 1 else BRAND_NAVY

    matrix = [
        ("Ledger Immutability", "Strict DB Triggers", "Soft Audits", "Allows Overwrites", "Year-End Lock", "Mutable Records"),
        ("Math Precision", "Exact Decimal.js", "App Rounding", "Standard Float", "Standard Float", "Rounding Gaps"),
        ("AI Safety Guardrails", "Direction & Tax Guards", "Hubdoc Add-on", "Basic Auto-Cat", "None", "None"),
        ("Period Locking", "3-Tier (Soft/Hard)", "Lock Dates", "Password Closing", "Year-End Lock", "No Period Locks"),
        ("Multi-User Pricing", "Included in Core", "Tier Paywalls", "User Cap Tiers", "Included", "Restricted"),
    ]

    for r_idx, row_data in enumerate(matrix, start=1):
        for c_idx, val in enumerate(row_data):
            cell = tbl.cell(r_idx, c_idx)
            cell.fill.solid()
            cell.fill.fore_color.rgb = CORAL_TINT if c_idx == 1 else (CARD_BG if r_idx % 2 == 0 else RGBColor(248, 250, 252))
            p = cell.text_frame.paragraphs[0]
            p.text = val
            p.font.size = Pt(10)
            if c_idx == 1:
                p.font.bold = True
                p.font.color.rgb = BRAND_NAVY
            else:
                p.font.color.rgb = TEXT_SUB

    add_notes(s7, "Here is our competitive benchmark. While Xero and QuickBooks dominate the legacy market, they suffer from mutable ledgers, float rounding errors, and aggressive tier paywalls. Blynt wins on mathematical immutability, built-in AI safety, and fair pricing.")

    # ══════════════════════════════════════════════════════════════════════════
    # SLIDE 8: 50-Phase Strategic Roadmap
    # ══════════════════════════════════════════════════════════════════════════
    s8 = prs.slides.add_slide(blank_layout)
    set_slide_background(s8)
    add_header(s8, "Strategic Execution", "Future Plan: 50-Phase Product Roadmap", "Structured progression from accounting foundation to full UK market commercialization.", BRAND_NAVY)

    add_card(s8, 0.8, 2.2, 2.7, 4.6, "1. Core Complete",
             "13 PHASES (26%)\n\n"
             "• Database foundation & schema\n"
             "• Scrypt auth & session tracking\n"
             "• Multi-org & 5-tier RBAC\n"
             "• Chart of accounts (1000-8999)\n"
             "• Financial periods & locking\n"
             "• 15-rule journal validation\n"
             "• General ledger & trial balance",
             "100% Tested & Verified", BRAND_NAVY)

    add_card(s8, 3.8, 2.2, 2.7, 4.6, "2. Active In-Flight",
             "19 PHASES (38%)\n\n"
             "• Sales invoices & AR tracking\n"
             "• Purchase bills & AP tracking\n"
             "• Profit & Loss and Balance Sheet\n"
             "• S3 document vault storage\n"
             "• AI document classification\n"
             "• Accounting integrity engine\n"
             "• CSV and report export engine",
             "Active Engineering", BRAND_CORAL)

    add_card(s8, 6.8, 2.2, 2.7, 4.6, "3. Q4 Horizons",
             "17 PHASES (34%)\n\n"
             "• Central VAT & Tax calculation engine\n"
             "• Bank statement import (OFX/CSV)\n"
             "• Automated bank reconciliation\n"
             "• Customer payments & receipts\n"
             "• Transaction approval workflows\n"
             "• Year-end closing wizard",
             "Scheduled Pipeline", BRAND_NAVY)

    add_card(s8, 9.8, 2.2, 2.7, 4.6, "4. Commercial Launch",
             "SCALE & COMPLIANCE\n\n"
             "• Direct HMRC Making Tax Digital (MTD)\n"
             "• Open Banking live API feeds\n"
             "• AWS production infrastructure\n"
             "• SOC2 Type II compliance audit\n"
             "• Accountant practice management",
             "Market Rollout", BRAND_CORAL)

    add_notes(s8, "Our roadmap is structured into 50 clear phases. We have completed the first 13 covering the core double-entry foundation, 19 are in active progress, and our next milestones bring automated bank reconciliation and HMRC MTD integration.")

    # ══════════════════════════════════════════════════════════════════════════
    # SLIDE 9: Conclusion & Executive Summary
    # ══════════════════════════════════════════════════════════════════════════
    s9 = prs.slides.add_slide(blank_layout)
    set_slide_background(s9)
    add_header(s9, "Executive Wrap-Up", "Blynt: Clarity in Every Number", "Summary of key takeaways for business leaders, investors, and engineering partners.", BRAND_CORAL)

    add_card(s9, 0.8, 2.2, 3.6, 3.3, "1. Institutional Rigor",
             "Double-entry ledger precision engineered to institutional standards. 15 validation rules and 7 automated integrity controls ensure trial balances stay in permanent mathematical balance.",
             "Zero Drifting Rounding Errors", BRAND_NAVY)

    add_card(s9, 4.8, 2.2, 3.6, 3.3, "2. AI Without the Risk",
             "Document intelligence that works as a reliable assistant, not a reckless auto-pilot. Enforces transaction direction safety and requires human sign-off on ambiguous records.",
             "100% Deterministic Guardrails", BRAND_CORAL)

    add_card(s9, 8.8, 2.2, 3.6, 3.3, "3. Massive UK Market",
             "Targeting 5.5 million UK SMEs with clean, modern UX, fair pricing, and cloud-native architecture that disrupts legacy fee structures.",
             "5.5M UK Small Businesses", BRAND_NAVY)

    cta = s9.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(5.7), Inches(11.7), Inches(1.2))
    cta.fill.solid()
    cta.fill.fore_color.rgb = CARD_BG
    cta.line.color.rgb = BRAND_CORAL
    cta.line.width = Pt(1.5)
    tf_cta = cta.text_frame
    tf_cta.margin_top = Inches(0.2)
    p_cta1 = tf_cta.paragraphs[0]
    p_cta1.text = "Ready for Tomorrow's Presentation & Live Demonstration"
    p_cta1.font.size = Pt(16)
    p_cta1.font.bold = True
    p_cta1.font.color.rgb = BRAND_NAVY
    p_cta1.alignment = PP_ALIGN.CENTER

    p_cta2 = tf_cta.add_paragraph()
    p_cta2.text = "127 Automated System Tests Passing (100%)  •  Zero TypeScript Errors  •  Production Architecture Aligned with UK GDPR & HMRC"
    p_cta2.font.size = Pt(11)
    p_cta2.font.color.rgb = TEXT_MUTED
    p_cta2.alignment = PP_ALIGN.CENTER

    add_notes(s9, "In summary: Blynt is mathematically unshakeable, safely AI-powered, and built for a massive UK market. All 127 automated tests pass today with 100% green status. Thank you for your time, and I am happy to open the floor to questions.")

    prs.save(output_path)
    print(f"Successfully generated PowerPoint: {output_path}")

if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "Blynt_Master_Presentation.pptx"
    create_presentation(out)
