import os
from PIL import Image, ImageDraw, ImageFont

WORKSPACE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS_DIR = os.path.join(WORKSPACE_DIR, "docs")
DIAGRAMS_DIR = os.path.join(DOCS_DIR, "diagrams")
os.makedirs(DIAGRAMS_DIR, exist_ok=True)

# Colors
NAVY = (22, 45, 95)
CORAL = (255, 127, 108)
SLATE = (71, 85, 105)
LIGHT_BG = (248, 250, 252)
CARD_BG = (255, 255, 255)
BORDER_COL = (203, 213, 225)
HEADER_BG = (22, 45, 95)
TEXT_DARK = (30, 41, 59)
TEXT_MUTED = (100, 116, 139)
PK_COL = (220, 38, 38)
FK_COL = (13, 148, 136)
LINE_COL = (148, 163, 184)

FONT_PATH_BOLD = "C:/Windows/Fonts/segoeuib.ttf"
FONT_PATH_REG = "C:/Windows/Fonts/segoeui.ttf"
if not os.path.exists(FONT_PATH_BOLD):
    FONT_PATH_BOLD = "C:/Windows/Fonts/arialbd.ttf"
    FONT_PATH_REG = "C:/Windows/Fonts/arial.ttf"

def get_fonts():
    return {
        "title": ImageFont.truetype(FONT_PATH_BOLD, 22),
        "header": ImageFont.truetype(FONT_PATH_BOLD, 15),
        "field_bold": ImageFont.truetype(FONT_PATH_BOLD, 12),
        "field": ImageFont.truetype(FONT_PATH_REG, 12),
        "sub": ImageFont.truetype(FONT_PATH_REG, 11),
    }

def draw_entity(draw, x, y, width, title, fields, fonts):
    # Header height
    hh = 32
    row_h = 22
    total_h = hh + len(fields) * row_h + 6
    
    # Outer box
    draw.rounded_rectangle([x, y, x + width, y + total_h], radius=6, fill=CARD_BG, outline=BORDER_COL, width=2)
    # Header banner
    draw.rounded_rectangle([x, y, x + width, y + hh], radius=6, fill=HEADER_BG)
    draw.rectangle([x, y + hh - 6, x + width, y + hh], fill=HEADER_BG)
    
    # Header text
    draw.text((x + 12, y + 7), title, font=fonts["header"], fill=(255, 255, 255))
    
    # Fields
    curr_y = y + hh + 4
    for key_type, name, ftype in fields:
        # Key badge
        if key_type == "PK":
            draw.text((x + 10, curr_y), "PK", font=fonts["field_bold"], fill=PK_COL)
        elif key_type == "FK":
            draw.text((x + 10, curr_y), "FK", font=fonts["field_bold"], fill=FK_COL)
        elif key_type == "UQ":
            draw.text((x + 10, curr_y), "UQ", font=fonts["field_bold"], fill=CORAL)
        else:
            draw.text((x + 10, curr_y), "•", font=fonts["field"], fill=TEXT_MUTED)
            
        # Field name
        draw.text((x + 36, curr_y), name, font=fonts["field_bold"] if key_type in ["PK", "FK"] else fonts["field"], fill=TEXT_DARK)
        
        # Type right aligned or offset
        draw.text((x + width - 110, curr_y), ftype, font=fonts["sub"], fill=TEXT_MUTED)
        curr_y += row_h

    return (x, y, width, total_h)

def draw_connector(draw, p1, p2, label="1 : N", fonts=None):
    x1, y1 = p1
    x2, y2 = p2
    draw.line([(x1, y1), (x2, y2)], fill=LINE_COL, width=2)
    # Small dot at start, arrow/circle at end
    draw.ellipse([x1 - 3, y1 - 3, x1 + 3, y1 + 3], fill=NAVY)
    draw.ellipse([x2 - 4, y2 - 4, x2 + 4, y2 + 4], fill=CORAL)
    if label and fonts:
        mid_x = (x1 + x2) // 2
        mid_y = (x1 + x2) // 2
        # simple label offset
        draw.text(((x1 + x2) // 2 - 15, (y1 + y2) // 2 - 10), label, font=fonts["sub"], fill=SLATE)

def generate_core_financial_er():
    fonts = get_fonts()
    W, H = 1400, 950
    img = Image.new("RGB", (W, H), LIGHT_BG)
    draw = ImageDraw.Draw(img)
    
    # Title Banner
    draw.rectangle([0, 0, W, 60], fill=NAVY)
    draw.text((25, 16), "blynt — Core Financial & Accounting Entity Relationship Diagram", font=fonts["title"], fill=(255, 255, 255))
    
    # 1. Organization
    org_fields = [
        ("PK", "id", "UUID / Text"),
        ("UQ", "legal_name", "VarChar(255)"),
        ("UQ", "slug", "VarChar(100)"),
        ("", "company_number", "VarChar(50)"),
        ("", "vat_number", "VarChar(50)"),
        ("", "base_currency", "Char(3) default GBP"),
        ("", "status", "OrganizationStatus"),
        ("", "created_at", "Timestamp"),
    ]
    b_org = draw_entity(draw, 50, 100, 320, "organizations", org_fields, fonts)
    
    # 2. Account
    acc_fields = [
        ("PK", "id", "UUID / Text"),
        ("FK", "organization_id", "UUID"),
        ("UQ", "code", "VarChar(20)"),
        ("", "name", "VarChar(255)"),
        ("", "account_type", "AccountType"),
        ("", "account_subtype", "AccountSubtype"),
        ("", "normal_balance", "BalanceType (DEBIT/CREDIT)"),
        ("", "is_control_account", "Boolean"),
        ("", "allow_manual_posting", "Boolean"),
        ("", "is_active", "Boolean"),
        ("FK", "parent_account_id", "UUID (Self-Ref Hierarchy)"),
    ]
    b_acc = draw_entity(draw, 450, 100, 350, "accounts", acc_fields, fonts)

    # 3. FinancialYear
    fy_fields = [
        ("PK", "id", "UUID / Text"),
        ("FK", "organization_id", "UUID"),
        ("", "name", "VarChar(100)"),
        ("", "start_date", "Date"),
        ("", "end_date", "Date"),
        ("", "status", "FinancialYearStatus"),
        ("", "created_at", "Timestamp"),
    ]
    b_fy = draw_entity(draw, 900, 100, 320, "financial_years", fy_fields, fonts)

    # 4. AccountingPeriod
    ap_fields = [
        ("PK", "id", "UUID / Text"),
        ("FK", "organization_id", "UUID"),
        ("FK", "financial_year_id", "UUID"),
        ("", "period_number", "Int (1..12)"),
        ("", "name", "VarChar(100)"),
        ("", "start_date", "Date"),
        ("", "end_date", "Date"),
        ("", "status", "PeriodStatus"),
        ("", "locked_at", "Timestamp?"),
    ]
    b_ap = draw_entity(draw, 900, 420, 320, "accounting_periods", ap_fields, fonts)

    # 5. JournalEntry
    je_fields = [
        ("PK", "id", "UUID / Text"),
        ("FK", "organization_id", "UUID"),
        ("UQ", "journal_number", "VarChar(50)"),
        ("", "posting_date", "Date"),
        ("", "status", "JournalStatus"),
        ("", "journal_type", "JournalType"),
        ("", "source_type", "JournalSourceType"),
        ("", "source_id", "UUID?"),
        ("", "narration", "Text?"),
        ("FK", "reversed_by_journal_id", "UUID?"),
    ]
    b_je = draw_entity(draw, 50, 480, 340, "journal_entries", je_fields, fonts)

    # 6. JournalLine
    jl_fields = [
        ("PK", "id", "UUID / Text"),
        ("FK", "organization_id", "UUID"),
        ("FK", "journal_entry_id", "UUID"),
        ("", "line_number", "Int"),
        ("FK", "account_id", "UUID"),
        ("FK", "contact_id", "UUID?"),
        ("", "debit", "Numeric(19,4) >= 0"),
        ("", "credit", "Numeric(19,4) >= 0"),
        ("", "description", "Text?"),
    ]
    b_jl = draw_entity(draw, 450, 500, 350, "journal_lines", jl_fields, fonts)

    # 7. AuditLog
    aud_fields = [
        ("PK", "id", "UUID / Text"),
        ("FK", "organization_id", "UUID"),
        ("FK", "user_id", "UUID?"),
        ("", "event_type", "VarChar(100)"),
        ("", "entity_type", "VarChar(100)"),
        ("", "entity_id", "UUID"),
        ("", "old_values", "JSONB?"),
        ("", "new_values", "JSONB?"),
        ("", "ip_address", "VarChar(45)?"),
        ("", "request_id", "UUID?"),
        ("", "created_at", "Timestamp (Immutable)"),
    ]
    b_aud = draw_entity(draw, 900, 680, 350, "audit_logs", aud_fields, fonts)

    # Draw Connecting Relationships
    # org -> accounts (1 : N)
    draw.line([(370, 200), (450, 200)], fill=LINE_COL, width=2)
    draw.text((390, 180), "1 : N", font=fonts["sub"], fill=SLATE)

    # org -> financial_years (1 : N)
    draw.line([(370, 130), (410, 130), (410, 75), (900, 75)], fill=LINE_COL, width=2)
    draw.text((600, 60), "1 : N", font=fonts["sub"], fill=SLATE)

    # financial_year -> accounting_periods (1 : N)
    draw.line([(1060, 320), (1060, 420)], fill=LINE_COL, width=2)
    draw.text((1070, 365), "1 : N", font=fonts["sub"], fill=SLATE)

    # org -> journal_entries (1 : N)
    draw.line([(210, 350), (210, 480)], fill=LINE_COL, width=2)
    draw.text((215, 410), "1 : N", font=fonts["sub"], fill=SLATE)

    # journal_entry -> journal_lines (1 : N)
    draw.line([(390, 620), (450, 620)], fill=LINE_COL, width=2)
    draw.text((400, 600), "1 : N", font=fonts["sub"], fill=SLATE)

    # account -> journal_lines (1 : N)
    draw.line([(620, 410), (620, 500)], fill=LINE_COL, width=2)
    draw.text((630, 450), "1 : N", font=fonts["sub"], fill=SLATE)

    # org -> audit_logs (1 : N)
    draw.line([(370, 240), (430, 240), (430, 780), (900, 780)], fill=LINE_COL, width=2)
    draw.text((650, 765), "1 : N", font=fonts["sub"], fill=SLATE)

    out_path = os.path.join(DIAGRAMS_DIR, "figure_er_core_financials.png")
    img.save(out_path)
    print("Saved:", out_path)

def generate_commercial_subledger_er():
    fonts = get_fonts()
    W, H = 1400, 850
    img = Image.new("RGB", (W, H), LIGHT_BG)
    draw = ImageDraw.Draw(img)
    
    # Title Banner
    draw.rectangle([0, 0, W, 60], fill=NAVY)
    draw.text((25, 16), "blynt — Commercial Subledgers & Invoicing Entity Relationship Diagram", font=fonts["title"], fill=(255, 255, 255))
    
    # 1. Organization
    org_fields = [
        ("PK", "id", "UUID / Text"),
        ("UQ", "legal_name", "VarChar(255)"),
        ("", "base_currency", "Char(3) default GBP"),
        ("", "vat_number", "VarChar(50)"),
    ]
    draw_entity(draw, 50, 100, 280, "organizations", org_fields, fonts)

    # 2. Contact
    contact_fields = [
        ("PK", "id", "UUID / Text"),
        ("FK", "organization_id", "UUID"),
        ("", "name", "VarChar(255)"),
        ("", "contact_type", "CUSTOMER | SUPPLIER | BOTH"),
        ("", "company_name", "VarChar(255)?"),
        ("", "vat_number", "VarChar(50)?"),
        ("", "currency", "Char(3) default GBP"),
        ("", "payment_terms_days", "Int default 30"),
        ("FK", "receivable_account_id", "UUID? (1100 AR Override)"),
        ("FK", "payable_account_id", "UUID? (2000 AP Override)"),
        ("", "status", "ContactStatus (ACTIVE/ARCHIVED)"),
    ]
    draw_entity(draw, 420, 100, 360, "contacts", contact_fields, fonts)

    # 3. ContactPerson
    cp_fields = [
        ("PK", "id", "UUID / Text"),
        ("FK", "organization_id", "UUID"),
        ("FK", "contact_id", "UUID"),
        ("", "first_name", "VarChar(100)"),
        ("", "last_name", "VarChar(100)"),
        ("", "email", "VarChar(255)"),
        ("", "phone", "VarChar(50)?"),
        ("", "is_primary", "Boolean"),
    ]
    draw_entity(draw, 880, 100, 320, "contact_people", cp_fields, fonts)

    # 4. Invoice
    inv_fields = [
        ("PK", "id", "UUID / Text"),
        ("FK", "organization_id", "UUID"),
        ("FK", "contact_id", "UUID"),
        ("UQ", "invoice_number", "VarChar(50)"),
        ("", "issue_date", "Date"),
        ("", "due_date", "Date"),
        ("", "status", "InvoiceStatus (DRAFT..PAID)"),
        ("", "currency", "Char(3)"),
        ("", "subtotal", "Numeric(19,4)"),
        ("", "tax_total", "Numeric(19,4)"),
        ("", "total_amount", "Numeric(19,4)"),
        ("FK", "journal_entry_id", "UUID? (GL Posting Link)"),
    ]
    draw_entity(draw, 420, 480, 360, "invoices", inv_fields, fonts)

    # 5. InvoiceLine
    il_fields = [
        ("PK", "id", "UUID / Text"),
        ("FK", "organization_id", "UUID"),
        ("FK", "invoice_id", "UUID"),
        ("", "line_number", "Int"),
        ("FK", "account_id", "UUID (Revenue Nominal)"),
        ("", "description", "Text"),
        ("", "quantity", "Numeric(19,4)"),
        ("", "unit_price", "Numeric(19,4)"),
        ("", "tax_rate", "Numeric(19,4)"),
        ("", "tax_amount", "Numeric(19,4)"),
        ("", "line_total", "Numeric(19,4)"),
    ]
    draw_entity(draw, 880, 480, 350, "invoice_lines", il_fields, fonts)

    # 6. JournalEntry
    je_fields = [
        ("PK", "id", "UUID / Text"),
        ("FK", "organization_id", "UUID"),
        ("UQ", "journal_number", "VarChar(50)"),
        ("", "posting_date", "Date"),
        ("", "source_type", "INVOICE"),
        ("", "source_id", "UUID (Points to Invoice)"),
    ]
    draw_entity(draw, 50, 520, 280, "journal_entries", je_fields, fonts)

    # Connections
    # org -> contact
    draw.line([(330, 180), (420, 180)], fill=LINE_COL, width=2)
    # contact -> contact_people
    draw.line([(780, 200), (880, 200)], fill=LINE_COL, width=2)
    draw.text((800, 180), "1 : N", font=fonts["sub"], fill=SLATE)
    # contact -> invoices
    draw.line([(600, 410), (600, 480)], fill=LINE_COL, width=2)
    draw.text((610, 440), "1 : N", font=fonts["sub"], fill=SLATE)
    # invoice -> invoice_lines
    draw.line([(780, 600), (880, 600)], fill=LINE_COL, width=2)
    draw.text((810, 580), "1 : N", font=fonts["sub"], fill=SLATE)
    # invoice -> journal_entry (1 : 1)
    draw.line([(420, 620), (330, 620)], fill=LINE_COL, width=2)
    draw.text((350, 600), "1 : 1 (GL Link)", font=fonts["sub"], fill=SLATE)

    out_path = os.path.join(DIAGRAMS_DIR, "figure_er_commercial_subledgers.png")
    img.save(out_path)
    print("Saved:", out_path)

def generate_identity_security_er():
    fonts = get_fonts()
    W, H = 1400, 850
    img = Image.new("RGB", (W, H), LIGHT_BG)
    draw = ImageDraw.Draw(img)
    
    # Title Banner
    draw.rectangle([0, 0, W, 60], fill=NAVY)
    draw.text((25, 16), "blynt — Identity, Role-Based Access Control & AI Intelligence ER Diagram", font=fonts["title"], fill=(255, 255, 255))
    
    # 1. User
    u_fields = [
        ("PK", "id", "UUID / Text"),
        ("UQ", "email", "VarChar(255)"),
        ("", "password_hash", "Text (scrypt salt:hash)"),
        ("", "first_name", "VarChar(100)"),
        ("", "last_name", "VarChar(100)"),
        ("", "status", "UserStatus (ACTIVE/SUSPENDED)"),
        ("", "email_verified", "Boolean"),
        ("", "created_at", "Timestamp"),
    ]
    draw_entity(draw, 50, 100, 320, "users", u_fields, fonts)

    # 2. Session
    s_fields = [
        ("PK", "id", "UUID / Text"),
        ("FK", "user_id", "UUID"),
        ("UQ", "token", "VarChar(255)"),
        ("", "expires_at", "Timestamp"),
        ("", "created_at", "Timestamp"),
    ]
    draw_entity(draw, 50, 420, 320, "sessions", s_fields, fonts)

    # 3. OrganizationMember
    om_fields = [
        ("PK", "id", "UUID / Text"),
        ("FK", "organization_id", "UUID"),
        ("FK", "user_id", "UUID"),
        ("FK", "role_id", "UUID?"),
        ("", "role_key", "SystemRoleKey (OWNER..VIEWER)"),
        ("", "status", "MemberStatus"),
        ("", "joined_at", "Timestamp"),
    ]
    draw_entity(draw, 460, 100, 340, "organization_members", om_fields, fonts)

    # 4. Role & RolePermission
    r_fields = [
        ("PK", "id", "UUID / Text"),
        ("FK", "organization_id", "UUID?"),
        ("UQ", "key", "VarChar(50) (OWNER..VIEWER)"),
        ("", "name", "VarChar(100)"),
        ("", "is_system_role", "Boolean"),
    ]
    draw_entity(draw, 900, 100, 340, "roles", r_fields, fonts)

    perm_fields = [
        ("PK", "id", "UUID / Text"),
        ("UQ", "action", "VarChar(100) (e.g. journals:post)"),
        ("", "resource", "VarChar(100)"),
        ("", "description", "Text?"),
    ]
    draw_entity(draw, 900, 350, 340, "permissions", perm_fields, fonts)

    # 5. AI Document & Intelligence
    ai_fields = [
        ("PK", "id", "UUID / Text"),
        ("FK", "organization_id", "UUID"),
        ("", "file_name", "VarChar(255)"),
        ("", "file_size", "Int"),
        ("", "mime_type", "VarChar(100)"),
        ("", "status", "UPLOADED | EXTRACTED | REVIEWED"),
        ("", "extracted_json", "JSONB? (OCR text, supplier)"),
        ("", "confidence_score", "Numeric(5,2)?"),
        ("", "created_at", "Timestamp"),
    ]
    draw_entity(draw, 460, 420, 360, "ai_documents", ai_fields, fonts)

    # Connections
    # user -> sessions
    draw.line([(210, 320), (210, 420)], fill=LINE_COL, width=2)
    draw.text((220, 365), "1 : N", font=fonts["sub"], fill=SLATE)
    # user -> organization_members
    draw.line([(370, 180), (460, 180)], fill=LINE_COL, width=2)
    draw.text((390, 160), "1 : N", font=fonts["sub"], fill=SLATE)
    # role -> organization_members
    draw.line([(900, 180), (800, 180)], fill=LINE_COL, width=2)
    draw.text((830, 160), "1 : N", font=fonts["sub"], fill=SLATE)
    # role -> permissions
    draw.line([(1070, 270), (1070, 350)], fill=LINE_COL, width=2)
    draw.text((1080, 305), "N : M", font=fonts["sub"], fill=SLATE)

    out_path = os.path.join(DIAGRAMS_DIR, "figure_er_identity_security.png")
    img.save(out_path)
    print("Saved:", out_path)

if __name__ == "__main__":
    generate_core_financial_er()
    generate_commercial_subledger_er()
    generate_identity_security_er()
