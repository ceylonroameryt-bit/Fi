import os
from PIL import Image, ImageDraw, ImageFont

DIAGRAMS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "docs", "diagrams")
os.makedirs(DIAGRAMS_DIR, exist_ok=True)

# Brand Palette
CORAL = "#FF7F6C"
NAVY = "#162D5F"
BG_LIGHT = "#F8FAFC"
WHITE = "#FFFFFF"
BORDER = "#CBD5E1"
TEXT_DARK = "#162D5F"
TEXT_SUB = "#334155"
TEXT_MUTED = "#64748B"
SUCCESS_GREEN = "#10B981"
DANGER_RED = "#EF4444"
WARNING_AMBER = "#F59E0B"
BLUE_ACCENT = "#2563EB"
CARD_SHADOW = "#E2E8F0"

def get_font(size, bold=False):
    font_file = "segoeuib.ttf" if bold else "segoeui.ttf"
    font_path = os.path.join("C:/Windows/Fonts", font_file)
    if os.path.exists(font_path):
        return ImageFont.truetype(font_path, size)
    return ImageFont.load_default()

def draw_rounded_rect(draw, coords, fill, outline=None, width=1, radius=12):
    x1, y1, x2, y2 = coords
    draw.rounded_rectangle([x1, y1, x2, y2], radius=radius, fill=fill, outline=outline, width=width)

def draw_arrow(draw, start, end, color=NAVY, width=2, arrow_size=8):
    x1, y1 = start
    x2, y2 = end
    draw.line([x1, y1, x2, y2], fill=color, width=width)
    # Simple arrowhead pointing horizontally or vertically
    if x1 == x2: # vertical
        sign = 1 if y2 > y1 else -1
        draw.polygon([(x2, y2), (x2 - arrow_size, y2 - sign * arrow_size), (x2 + arrow_size, y2 - sign * arrow_size)], fill=color)
    elif y1 == y2: # horizontal
        sign = 1 if x2 > x1 else -1
        draw.polygon([(x2, y2), (x2 - sign * arrow_size, y2 - arrow_size), (x2 - sign * arrow_size, y2 + arrow_size)], fill=color)

def generate_diagram_1():
    """Diagram 1: Legacy Accounting vs blynt Solution (Business Problem)"""
    w, h = 1200, 560
    img = Image.new("RGB", (w, h), BG_LIGHT)
    draw = ImageDraw.Draw(img)

    # Header
    draw.text((60, 40), "THE BUSINESS LANDSCAPE: LEGACY PROBLEMS VS. BLYNT INNOVATION", fill=NAVY, font=get_font(22, True))
    draw.text((60, 75), "Why traditional accounting platforms fail UK SMEs and how blynt transforms ledger integrity", fill=TEXT_MUTED, font=get_font(14))

    # Left Column: Legacy Problems
    draw_rounded_rect(draw, (60, 120, 560, 500), fill=WHITE, outline=BORDER, width=2, radius=14)
    # Coral Header for Legacy
    draw_rounded_rect(draw, (60, 120, 560, 180), fill="#FFF1EE", outline=CORAL, width=2, radius=14)
    draw.text((80, 138), "❌ Legacy Accounting Platforms (Xero / QuickBooks / Sage)", fill=DANGER_RED, font=get_font(16, True))

    legacy_points = [
        ("Brittle Double-Entry", "Allows editing past transactions, breaking audit trails and risking HMRC fines."),
        ("Subscription Bloat", "Aggressive annual price increases while bundling unused enterprise features."),
        ("Weak Multi-Tenancy", "Single WHERE-clause query filtering risks cross-client data leaks for accounting firms."),
        ("Floating-Point Drift", "Binary float math causes subtle rounding pennies in tax filings over time."),
        ("Clunky Period Locking", "Soft warnings that bookkeepers can ignore, leading to retroactive book alterations.")
    ]
    y = 200
    for title, desc in legacy_points:
        draw.text((85, y), f"• {title}:", fill=TEXT_DARK, font=get_font(14, True))
        draw.text((100, y + 22), desc, fill=TEXT_SUB, font=get_font(12))
        y += 58

    # Right Column: blynt Solution
    draw_rounded_rect(draw, (640, 120, 1140, 500), fill=WHITE, outline=BORDER, width=2, radius=14)
    # Green Header for blynt
    draw_rounded_rect(draw, (640, 120, 1140, 180), fill="#ECFDF5", outline=SUCCESS_GREEN, width=2, radius=14)
    draw.text((660, 138), "✔ The blynt Institutional Accounting Engine", fill=SUCCESS_GREEN, font=get_font(16, True))

    blynt_points = [
        ("Immutable Ledger & Triggers", "Append-only database triggers block UPDATE/DELETE on audit trails completely."),
        ("Zero-Drift Decimal.js Math", "Fixed-point 4-decimal precision (NUMERIC(19,4)) guarantees zero mathematical drift."),
        ("PostgreSQL Composite Keys", "(organization_id, id) composite foreign keys physically forbid cross-tenant leaks."),
        ("Three-Tier Period Lockdown", "OPEN -> SOFT_LOCKED -> HARD_LOCKED states provide total statutory audit security."),
        ("Real-Time Derived Subledgers", "Customer AR & Supplier AP balances calculated dynamically without stale balance caches.")
    ]
    y = 200
    for title, desc in blynt_points:
        draw.text((665, y), f"• {title}:", fill=NAVY, font=get_font(14, True))
        draw.text((680, y + 22), desc, fill=TEXT_SUB, font=get_font(12))
        y += 58

    path = os.path.join(DIAGRAMS_DIR, "diagram_1_business_problem_solution.png")
    img.save(path)
    return path

def generate_diagram_2():
    """Diagram 2: Double-Entry Equation & Nominal Ledger Categories"""
    w, h = 1200, 560
    img = Image.new("RGB", (w, h), BG_LIGHT)
    draw = ImageDraw.Draw(img)

    # Header
    draw.text((60, 40), "THE DOUBLE-ENTRY ACCOUNTING EQUATION & UK NOMINAL CODES", fill=NAVY, font=get_font(22, True))
    draw.text((60, 75), "Mathematical balance enforced across all nominal classes (Assets = Liabilities + Equity + Net Profit)", fill=TEXT_MUTED, font=get_font(14))

    # Master Equation Card
    draw_rounded_rect(draw, (60, 115, 1140, 205), fill=NAVY, radius=12)
    draw.text((90, 132), "THE FUNDAMENTAL ACCOUNTING EQUATION:", fill=CORAL, font=get_font(13, True))
    draw.text((90, 158), "ASSETS  =  LIABILITIES  +  EQUITY  +  ( REVENUE  -  EXPENSES )", fill=WHITE, font=get_font(24, True))

    # 5 Nominal Categories
    categories = [
        ("ASSETS (1000s)", "Debit Normal Balance", "Bank, Cash, Debtors Control (AR), Fixed Assets, Inventory", BLUE_ACCENT),
        ("LIABILITIES (2000s)", "Credit Normal Balance", "Creditors Control (AP), VAT Output/Input, Bank Loans", "#7C3AED"),
        ("EQUITY (3000s)", "Credit Normal Balance", "Share Capital, Retained Earnings, Owner Investment", "#D97706"),
        ("REVENUE (4000s)", "Credit Normal Balance", "Sales Revenue, Service Fees, Other Trading Income", SUCCESS_GREEN),
        ("EXPENSES (5000-8999)", "Debit Normal Balance", "Cost of Sales, Wages, Rent, Software, Depreciation", DANGER_RED),
    ]

    card_width = 200
    gap = 15
    start_x = 60
    y_top = 230
    y_bottom = 500

    for idx, (cat_name, norm_bal, examples, col) in enumerate(categories):
        x1 = start_x + idx * (card_width + gap)
        x2 = x1 + card_width
        draw_rounded_rect(draw, (x1, y_top, x2, y_bottom), fill=WHITE, outline=BORDER, width=2, radius=12)
        
        # Color top banner
        draw_rounded_rect(draw, (x1, y_top, x2, y_top + 45), fill=col, radius=12)
        draw.rectangle([x1, y_top + 30, x2, y_top + 45], fill=col)
        draw.text((x1 + 10, y_top + 12), cat_name, fill=WHITE, font=get_font(13, True))

        draw.text((x1 + 12, y_top + 55), "Normal Balance:", fill=TEXT_MUTED, font=get_font(11))
        draw.text((x1 + 12, y_top + 72), norm_bal, fill=NAVY, font=get_font(12, True))
        
        draw.line([x1 + 12, y_top + 100, x2 - 12, y_top + 100], fill=BORDER, width=1)
        
        draw.text((x1 + 12, y_top + 115), "Typical Accounts:", fill=TEXT_MUTED, font=get_font(11))
        # Word wrap examples
        words = examples.split(", ")
        ey = y_top + 135
        for w_item in words:
            draw.text((x1 + 12, ey), f"• {w_item}", fill=TEXT_SUB, font=get_font(10.5))
            ey += 24

        # Invariant note at bottom
        draw.text((x1 + 12, y_bottom - 35), "DR Increases | CR Decreases" if "Debit" in norm_bal else "CR Increases | DR Decreases", fill=TEXT_MUTED, font=get_font(9.5, True))

    path = os.path.join(DIAGRAMS_DIR, "diagram_2_double_entry_equation.png")
    img.save(path)
    return path

def generate_diagram_3():
    """Diagram 3: C4 Container System Architecture"""
    w, h = 1200, 620
    img = Image.new("RGB", (w, h), BG_LIGHT)
    draw = ImageDraw.Draw(img)

    # Header
    draw.text((60, 35), "SYSTEM ARCHITECTURE: C4 CONTAINER & COMPONENT PIPELINE", fill=NAVY, font=get_font(22, True))
    draw.text((60, 68), "Multi-tenant request journey through Next.js 15, NestJS 11 Gateway, and PostgreSQL 16 engine guarantees", fill=TEXT_MUTED, font=get_font(14))

    # 1. Web Client Card
    draw_rounded_rect(draw, (60, 110, 320, 560), fill=WHITE, outline=BORDER, width=2, radius=14)
    draw_rounded_rect(draw, (60, 110, 320, 165), fill=NAVY, radius=14)
    draw.rectangle([60, 145, 320, 165], fill=NAVY)
    draw.text((80, 125), "🌐 CLIENT LAYER (Next.js 15)", fill=WHITE, font=get_font(14, True))

    client_items = [
        ("Turbopack Bundler", "Lightning-fast HMR and optimized server component compilation."),
        ("React 19 App Router", "Server-side streaming with client-side reactive state."),
        ("Live Journal Tally", "Real-time debits, credits, and difference tally before API submission."),
        ("Tenant Context", "Active organisation switching & JWT token management in session."),
        ("Subledger Statements", "Interactive date filtering & running balance calculation.")
    ]
    y = 185
    for title, desc in client_items:
        draw.text((80, y), f"• {title}", fill=NAVY, font=get_font(13, True))
        draw.text((92, y + 20), desc, fill=TEXT_SUB, font=get_font(11))
        y += 72

    # Arrow 1
    draw_arrow(draw, (320, 330), (400, 330), color=CORAL, width=3, arrow_size=10)
    draw.text((328, 305), "HTTPS / REST", fill=CORAL, font=get_font(11, True))
    draw.text((330, 340), "Bearer Token", fill=TEXT_MUTED, font=get_font(10))

    # 2. NestJS Backend Core Card
    draw_rounded_rect(draw, (400, 110, 780, 560), fill=WHITE, outline=BORDER, width=2, radius=14)
    draw_rounded_rect(draw, (400, 110, 780, 165), fill=BLUE_ACCENT, radius=14)
    draw.rectangle([400, 145, 780, 165], fill=BLUE_ACCENT)
    draw.text((420, 125), "⚙️ BACKEND CORE (NestJS 11 Monolith)", fill=WHITE, font=get_font(14, True))

    backend_modules = [
        ("AllExceptionsFilter & Logger", "Catches all errors; formats into standardized DomainException with x-request-id."),
        ("AuthModule & PasswordService", "scrypt random-salted password hashing + constant-time timingSafeEqual verification."),
        ("AccountingEngineModule", "MoneyService (Decimal.js) + JournalValidationService (15 strict invariant rules)."),
        ("JournalPostingService", "Atomic sequence counter (JE-YYYY-XXXXXX) & balance-reversal workflows."),
        ("Contacts & Subledger Service", "Real-time derived AR/AP balances; customer statements with running lines.")
    ]
    y = 185
    for title, desc in backend_modules:
        draw.text((420, y), f"• {title}", fill=BLUE_ACCENT, font=get_font(13, True))
        draw.text((432, y + 20), desc, fill=TEXT_SUB, font=get_font(11))
        y += 72

    # Arrow 2
    draw_arrow(draw, (780, 330), (860, 330), color=CORAL, width=3, arrow_size=10)
    draw.text((790, 305), "Prisma ORM", fill=CORAL, font=get_font(11, True))
    draw.text((792, 340), "Connection Pool", fill=TEXT_MUTED, font=get_font(10))

    # 3. Database Layer Card
    draw_rounded_rect(draw, (860, 110, 1140, 560), fill=WHITE, outline=BORDER, width=2, radius=14)
    draw_rounded_rect(draw, (860, 110, 1140, 165), fill=NAVY, radius=14)
    draw.rectangle([860, 145, 1140, 165], fill=NAVY)
    draw.text((880, 125), "🗄️ DATABASE (PostgreSQL 16)", fill=WHITE, font=get_font(14, True))

    db_items = [
        ("Composite Foreign Keys", "Parent-child links use (organization_id, id). DB physically rejects tenant mixing."),
        ("Fixed-Point Columns", "NUMERIC(19,4) storage ensures zero penny drift across millions of journal lines."),
        ("Append-Only Audit Triggers", "PostgreSQL triggers abort any UPDATE or DELETE on audit_logs permanently."),
        ("btree_gist Temporal Rules", "Exclusion constraints block overlapping financial year dates per organisation."),
        ("Atomic Constraints", "CHECK constraints guarantee debits >= 0 and credits >= 0 at the SQL level.")
    ]
    y = 185
    for title, desc in db_items:
        draw.text((880, y), f"• {title}", fill=NAVY, font=get_font(13, True))
        draw.text((892, y + 20), desc, fill=TEXT_SUB, font=get_font(11))
        y += 72

    path = os.path.join(DIAGRAMS_DIR, "diagram_3_c4_system_architecture.png")
    img.save(path)
    return path

def generate_diagram_4():
    """Diagram 4: Journal Lifecycle & Three-Tier Period Lockdown State Machine"""
    w, h = 1200, 540
    img = Image.new("RGB", (w, h), BG_LIGHT)
    draw = ImageDraw.Draw(img)

    # Header
    draw.text((60, 35), "JOURNAL ENTRY LIFECYCLE & THREE-TIER PERIOD LOCKDOWN", fill=NAVY, font=get_font(22, True))
    draw.text((60, 68), "Authoritative state transitions from draft creation to statutory audit lockdown", fill=TEXT_MUTED, font=get_font(14))

    # Top Half: Journal Status States
    draw.text((60, 110), "1. JOURNAL ENTRY STATE MACHINE:", fill=NAVY, font=get_font(15, True))

    states = [
        ("DRAFT", "Initial editable state\nLines can be added/modified\nNot included in Trial Balance", WARNING_AMBER, (80, 145, 300, 260)),
        ("VALIDATED", "Passed all 15 invariant rules\nAtomic JE-YYYY-XXXXXX assigned\nResets to DRAFT if modified", BLUE_ACCENT, (390, 145, 610, 260)),
        ("POSTED / ACTIVE", "Recognized in General Ledger\nUpdates trial balance & subledgers\nCannot be deleted", SUCCESS_GREEN, (700, 145, 920, 260)),
        ("REVERSED", "Balancing counter-entry created\nOriginal entry preserved\nFull audit linkage", DANGER_RED, (980, 145, 1140, 260))
    ]

    for name, desc, col, coords in states:
        draw_rounded_rect(draw, coords, fill=WHITE, outline=col, width=2, radius=12)
        # Title bar
        draw_rounded_rect(draw, (coords[0], coords[1], coords[2], coords[1] + 35), fill=col, radius=12)
        draw.rectangle([coords[0], coords[1] + 20, coords[2], coords[1] + 35], fill=col)
        draw.text((coords[0] + 15, coords[1] + 8), name, fill=WHITE, font=get_font(13, True))
        
        y_text = coords[1] + 45
        for line in desc.split("\n"):
            draw.text((coords[0] + 12, y_text), f"• {line}", fill=TEXT_SUB, font=get_font(10.5))
            y_text += 22

    # Horizontal transition arrows
    draw_arrow(draw, (300, 200), (390, 200), color=NAVY, width=2)
    draw_arrow(draw, (610, 200), (700, 200), color=NAVY, width=2)
    draw_arrow(draw, (920, 200), (980, 200), color=NAVY, width=2)

    # Bottom Half: Period Locking States
    draw.text((60, 295), "2. THREE-TIER ACCOUNTING PERIOD LOCKDOWN STATES:", fill=NAVY, font=get_font(15, True))

    periods = [
        ("TIER 1: OPEN", "Unrestricted Operational Posting", "• Standard day-to-day bookkeeping\n• Bookkeepers can post and validate journals\n• Sales invoices & bills post freely", SUCCESS_GREEN, (80, 335, 400, 485)),
        ("TIER 2: SOFT_LOCKED", "Closed For Month-End Review", "• Warning banner displayed to users\n• Bookkeeper direct posting is blocked\n• Only ACCOUNTANT / OWNER roles can post adjustments", WARNING_AMBER, (445, 335, 765, 485)),
        ("TIER 3: HARD_LOCKED", "Immutable Statutory Lockdown", "• Accounting period has been filed (HMRC/Tax)\n• 100% REJECTION of any journal posting\n• No role can override without explicit unlocking audit", DANGER_RED, (810, 335, 1140, 485))
    ]

    for title, sub, desc, col, coords in periods:
        draw_rounded_rect(draw, coords, fill=WHITE, outline=col, width=2, radius=12)
        draw_rounded_rect(draw, (coords[0], coords[1], coords[2], coords[1] + 35), fill=col, radius=12)
        draw.rectangle([coords[0], coords[1] + 20, coords[2], coords[1] + 35], fill=col)
        draw.text((coords[0] + 15, coords[1] + 8), title, fill=WHITE, font=get_font(13, True))
        
        draw.text((coords[0] + 12, coords[1] + 45), sub, fill=NAVY, font=get_font(11, True))
        y_text = coords[1] + 70
        for line in desc.split("\n"):
            draw.text((coords[0] + 12, y_text), line, fill=TEXT_SUB, font=get_font(10.5))
            y_text += 22

    path = os.path.join(DIAGRAMS_DIR, "diagram_4_journal_lifecycle_state_machine.png")
    img.save(path)
    return path

def generate_diagram_5():
    """Diagram 5: Subledger Invoicing & Customer Statement Flow"""
    w, h = 1200, 520
    img = Image.new("RGB", (w, h), BG_LIGHT)
    draw = ImageDraw.Draw(img)

    # Header
    draw.text((60, 35), "SUBLEDGER & SALES INVOICING PIPELINE", fill=NAVY, font=get_font(22, True))
    draw.text((60, 68), "How transactions flow from sales invoices into the General Ledger and dynamic customer statements", fill=TEXT_MUTED, font=get_font(14))

    steps = [
        ("1. SALES INVOICE", "DRAFT -> APPROVED\nCalculates 20% UK VAT\nTotal: £1,200.00\n(£1,000 net + £200 VAT)", CORAL, (60, 130, 260, 450)),
        ("2. POSTING ENGINE", "Triggered by user\nCreates atomic journal\nValidates open period\nChecks UK nominals", NAVY, (330, 130, 530, 450)),
        ("3. DOUBLE-ENTRY GL", "DR 1100 Debtors £1,200\n(Tagged with contactId)\nCR 4000 Sales £1,000\nCR 2100 VAT Tax £200", BLUE_ACCENT, (600, 130, 840, 450)),
        ("4. DYNAMIC SUBLEDGER", "Customer AR Balance:\nSUM(Debits - Credits)\n= £1,200.00 Outstanding\nReal-time Statement", SUCCESS_GREEN, (910, 130, 1140, 450))
    ]

    for title, desc, col, coords in steps:
        draw_rounded_rect(draw, coords, fill=WHITE, outline=col, width=2, radius=14)
        draw_rounded_rect(draw, (coords[0], coords[1], coords[2], coords[1] + 45), fill=col, radius=14)
        draw.rectangle([coords[0], coords[1] + 25, coords[2], coords[1] + 45], fill=col)
        draw.text((coords[0] + 15, coords[1] + 12), title, fill=WHITE, font=get_font(13, True))

        y_text = coords[1] + 65
        for line in desc.split("\n"):
            draw.text((coords[0] + 15, y_text), line, fill=TEXT_SUB, font=get_font(12))
            y_text += 32

    # Connecting arrows
    draw_arrow(draw, (260, 280), (330, 280), color=CORAL, width=3, arrow_size=10)
    draw_arrow(draw, (530, 280), (600, 280), color=CORAL, width=3, arrow_size=10)
    draw_arrow(draw, (840, 280), (910, 280), color=CORAL, width=3, arrow_size=10)

    # Bottom summary banner
    draw_rounded_rect(draw, (60, 465, 1140, 500), fill="#EEF2F9", radius=8)
    draw.text((80, 474), "KEY GUARANTEE: No stale cached balance column exists. The customer balance is always mathematically derived from posted journal lines.", fill=NAVY, font=get_font(11, True))

    path = os.path.join(DIAGRAMS_DIR, "diagram_5_subledger_invoicing_flow.png")
    img.save(path)
    return path

def generate_diagram_6():
    """Diagram 6: Defense-in-Depth Multi-Tenant Security Model"""
    w, h = 1200, 540
    img = Image.new("RGB", (w, h), BG_LIGHT)
    draw = ImageDraw.Draw(img)

    # Header
    draw.text((60, 35), "DEFENSE-IN-DEPTH MULTI-TENANT ISOLATION MODEL", fill=NAVY, font=get_font(22, True))
    draw.text((60, 68), "Three impenetrable layers protecting client data from cross-tenant access and unauthorized modification", fill=TEXT_MUTED, font=get_font(14))

    layers = [
        ("LAYER 1: APPLICATION GUARDS", "NestJS Route & Context Scoping", [
            "• AuthGuard verifies 256-bit session token.",
            "• Extracts active organisation context from workspace switcher.",
            "• RolesGuard verifies member role (OWNER, ACCOUNTANT, etc.).",
            "• All Prisma queries automatically scoped with where: { organizationId }."
        ], BLUE_ACCENT, (60, 120, 400, 480)),
        ("LAYER 2: COMPOSITE DATABASE FKS", "PostgreSQL Relational Boundary", [
            "• Child tables reference parents via composite pairs: (organization_id, id).",
            "• journal_lines strictly references contacts(organization_id, id).",
            "• If application layer ever errs, PostgreSQL physically blocks query.",
            "• Returns Foreign Key Violation 23503, preventing cross-tenant links."
        ], NAVY, (430, 120, 770, 480)),
        ("LAYER 3: IMMUTABLE AUDIT TRIGGERS", "Statutory Compliance & Non-Repudiation", [
            "• audit_logs records every create, edit, delete, and validation event.",
            "• Database trigger function prevent_audit_log_mutation() interceptor.",
            "• Aborts any SQL UPDATE or DELETE command permanently at engine level.",
            "• Ensures 6+ year HMRC audit trail compliance (Companies Act 2006)."
        ], SUCCESS_GREEN, (800, 120, 1140, 480))
    ]

    for title, subtitle, points, col, coords in layers:
        draw_rounded_rect(draw, coords, fill=WHITE, outline=col, width=2, radius=14)
        draw_rounded_rect(draw, (coords[0], coords[1], coords[2], coords[1] + 45), fill=col, radius=14)
        draw.rectangle([coords[0], coords[1] + 25, coords[2], coords[1] + 45], fill=col)
        draw.text((coords[0] + 15, coords[1] + 12), title, fill=WHITE, font=get_font(12, True))

        draw.text((coords[0] + 15, coords[1] + 60), subtitle, fill=NAVY, font=get_font(12, True))
        draw.line([coords[0] + 15, coords[1] + 85, coords[2] - 15, coords[1] + 85], fill=BORDER, width=1)
        
        y_text = coords[1] + 105
        for pt in points:
            draw.text((coords[0] + 15, y_text), pt, fill=TEXT_SUB, font=get_font(11))
            y_text += 48

    path = os.path.join(DIAGRAMS_DIR, "diagram_6_multitenant_security_model.png")
    img.save(path)
    return path

def generate_diagram_7():
    """Diagram 7: 50-Phase Product Strategic Roadmap"""
    w, h = 1200, 520
    img = Image.new("RGB", (w, h), BG_LIGHT)
    draw = ImageDraw.Draw(img)

    # Header
    draw.text((60, 35), "BLYNT MASTER 50-PHASE STRATEGIC EVOLUTION", fill=NAVY, font=get_font(22, True))
    draw.text((60, 68), "From mathematical double-entry core to full-spectrum UK financial operating ecosystem", fill=TEXT_MUTED, font=get_font(14))

    milestones = [
        ("MILESTONE 1 (Phases 1-8)", "COMPLETED", [
            "• Multi-workspace Monorepo",
            "• PostgreSQL Schema & Invariants",
            "• scrypt Auth & Session Tokens",
            "• Multi-Organisation & RBAC",
            "• UK Chart of Accounts (1000-8999)",
            "• 12-Month Period Locking Engine",
            "• Journal Validation (15 Rules)"
        ], SUCCESS_GREEN, (60, 120, 310, 470)),
        ("MILESTONE 2 (Phases 9-15)", "CURRENT IN-PROGRESS", [
            "• Contacts & AR/AP Subledger",
            "• Sales Invoicing & 20% UK VAT",
            "• Customer Ledger Statements",
            "• Supplier Bills & Expenses",
            "• Payment Allocations",
            "• Manual Bank Reconciliation"
        ], CORAL, (340, 120, 590, 470)),
        ("MILESTONE 3 (Phases 16-25)", "Q1 2027 TARGET", [
            "• Automated UK VAT Return (Boxes 1-9)",
            "• HMRC MTD OAuth2 Direct API",
            "• Companies House Micro-Entity Filing",
            "• Year-End Rollover & Retained Earnings",
            "• Advanced P&L & Balance Sheet Reporting"
        ], BLUE_ACCENT, (620, 120, 870, 470)),
        ("MILESTONE 4 (Phases 26-50)", "Q2 2027+ FUTURE", [
            "• UK Open Banking Live Feeds",
            "• AI OCR Receipt Scanning",
            "• Automated Machine Learning Categorization",
            "• Multi-Currency FX Revaluation",
            "• Group Consolidation & Multi-Entity"
        ], NAVY, (900, 120, 1140, 470))
    ]

    for title, badge, points, col, coords in milestones:
        draw_rounded_rect(draw, coords, fill=WHITE, outline=col, width=2, radius=14)
        draw_rounded_rect(draw, (coords[0], coords[1], coords[2], coords[1] + 45), fill=col, radius=14)
        draw.rectangle([coords[0], coords[1] + 25, coords[2], coords[1] + 45], fill=col)
        draw.text((coords[0] + 12, coords[1] + 12), title, fill=WHITE, font=get_font(12, True))

        # Badge
        draw_rounded_rect(draw, (coords[0] + 12, coords[1] + 55, coords[2] - 12, coords[1] + 80), fill="#F1F5F9", radius=6)
        draw.text((coords[0] + 20, coords[1] + 60), f"STATUS: {badge}", fill=col, font=get_font(10.5, True))

        y_text = coords[1] + 98
        for pt in points:
            draw.text((coords[0] + 12, y_text), pt, fill=TEXT_SUB, font=get_font(10.5))
            y_text += 28

    path = os.path.join(DIAGRAMS_DIR, "diagram_7_roadmap_milestones.png")
    img.save(path)
    return path

def main():
    print("Generating diagrams...")
    print("Diagram 1:", generate_diagram_1())
    print("Diagram 2:", generate_diagram_2())
    print("Diagram 3:", generate_diagram_3())
    print("Diagram 4:", generate_diagram_4())
    print("Diagram 5:", generate_diagram_5())
    print("Diagram 6:", generate_diagram_6())
    print("Diagram 7:", generate_diagram_7())
    print("All diagrams generated successfully!")

if __name__ == "__main__":
    main()
