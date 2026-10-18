import os
from PIL import Image, ImageDraw, ImageFont

WORKSPACE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS_DIR = os.path.join(WORKSPACE_DIR, "docs")
DIAGRAMS_DIR = os.path.join(DOCS_DIR, "diagrams")
os.makedirs(DIAGRAMS_DIR, exist_ok=True)

# Brand Colors
NAVY = (22, 45, 95)
CORAL = (255, 127, 108)
EMERALD = (16, 185, 129)
AMBER = (245, 158, 11)
PURPLE = (139, 92, 246)
SLATE = (71, 85, 105)
LIGHT_BG = (248, 250, 252)
CARD_BG = (255, 255, 255)
BORDER_COL = (226, 232, 240)
TEXT_DARK = (30, 41, 59)
TEXT_MUTED = (100, 116, 139)

FONT_PATH_BOLD = "C:/Windows/Fonts/segoeuib.ttf"
FONT_PATH_REG = "C:/Windows/Fonts/segoeui.ttf"
FONT_PATH_MONO = "C:/Windows/Fonts/consola.ttf"
if not os.path.exists(FONT_PATH_BOLD):
    FONT_PATH_BOLD = "C:/Windows/Fonts/arialbd.ttf"
    FONT_PATH_REG = "C:/Windows/Fonts/arial.ttf"
    FONT_PATH_MONO = "C:/Windows/Fonts/arial.ttf"

def get_fonts():
    return {
        "title": ImageFont.truetype(FONT_PATH_BOLD, 22),
        "h1": ImageFont.truetype(FONT_PATH_BOLD, 16),
        "h2": ImageFont.truetype(FONT_PATH_BOLD, 14),
        "body_bold": ImageFont.truetype(FONT_PATH_BOLD, 12),
        "body": ImageFont.truetype(FONT_PATH_REG, 12),
        "mono": ImageFont.truetype(FONT_PATH_MONO, 12),
        "mono_sm": ImageFont.truetype(FONT_PATH_MONO, 10),
        "small": ImageFont.truetype(FONT_PATH_REG, 10),
    }

def generate_palette_diagram():
    fonts = get_fonts()
    W, H = 1400, 750
    img = Image.new("RGB", (W, H), LIGHT_BG)
    draw = ImageDraw.Draw(img)

    # Header Banner
    draw.rectangle([0, 0, W, 60], fill=NAVY)
    draw.text((25, 16), "blynt — Official Brand Color Palette & Design Tokens", font=fonts["title"], fill=(255, 255, 255))

    swatches = [
        ("Primary Navy", NAVY, "#162D5F", "rgb(22, 45, 95)", "Brand Authority • Primary Text • Headers"),
        ("Primary Coral", CORAL, "#FF7F6C", "rgb(255, 127, 108)", "Brand Energy • Accent CTA • Primary Highlights"),
        ("Emerald Positive", EMERALD, "#10B981", "rgb(16, 185, 129)", "Debit Balance • Posted Status • Zero Drift (Balanced)"),
        ("Amber Warning", AMBER, "#F59E0B", "rgb(245, 158, 11)", "Draft Journals • Pending Approval • Unposted Items"),
        ("Purple AI", PURPLE, "#8B5CF6", "rgb(139, 92, 246)", "AI Document Intelligence • Classification Engine"),
        ("Slate Neutral", SLATE, "#475569", "rgb(71, 85, 105)", "Secondary Text • Field Labels • Table Grid Borders"),
    ]

    card_w = 410
    card_h = 280
    start_x = 45
    start_y = 90
    spacing_x = 440
    spacing_y = 310

    for idx, (name, rgb_col, hex_code, rgb_str, role) in enumerate(swatches):
        row = idx // 3
        col = idx % 3
        x = start_x + col * spacing_x
        y = start_y + row * spacing_y

        # Card container
        draw.rounded_rectangle([x, y, x + card_w, y + card_h], radius=8, fill=CARD_BG, outline=BORDER_COL, width=2)

        # Color Block (top half)
        block_h = 130
        draw.rounded_rectangle([x, y, x + card_w, y + block_h], radius=8, fill=rgb_col)
        draw.rectangle([x, y + block_h - 8, x + card_w, y + block_h], fill=rgb_col)

        # Contrast text inside color block
        text_fill = (255, 255, 255) if idx != 1 and idx != 3 else (22, 45, 95)
        draw.text((x + 16, y + 16), name, font=fonts["h1"], fill=text_fill)
        draw.text((x + 16, y + block_h - 30), hex_code, font=fonts["mono"], fill=text_fill)

        # Details section (bottom half)
        det_y = y + block_h + 16
        draw.text((x + 16, det_y), "HEX:", font=fonts["body_bold"], fill=TEXT_DARK)
        draw.text((x + 60, det_y), hex_code, font=fonts["mono"], fill=TEXT_DARK)

        draw.text((x + 160, det_y), "RGB:", font=fonts["body_bold"], fill=TEXT_DARK)
        draw.text((x + 205, det_y), rgb_str, font=fonts["mono_sm"], fill=TEXT_DARK)

        draw.line([(x + 16, det_y + 24), (x + card_w - 16, det_y + 24)], fill=BORDER_COL, width=1)

        draw.text((x + 16, det_y + 36), "Usage & Semantic Role:", font=fonts["body_bold"], fill=TEXT_MUTED)
        draw.text((x + 16, det_y + 56), role, font=fonts["body"], fill=TEXT_DARK)

    out_path = os.path.join(DIAGRAMS_DIR, "figure_ui_brand_palette.png")
    img.save(out_path)
    print("Saved palette diagram:", out_path)

def generate_component_system_diagram():
    fonts = get_fonts()
    W, H = 1400, 850
    img = Image.new("RGB", (W, H), LIGHT_BG)
    draw = ImageDraw.Draw(img)

    # Header Banner
    draw.rectangle([0, 0, W, 60], fill=NAVY)
    draw.text((25, 16), "blynt — Core UI Component System & Live Financial Controls", font=fonts["title"], fill=(255, 255, 255))

    # 1. Component Card: Sticky Live Tally Bar
    draw.rounded_rectangle([45, 90, 680, 420], radius=8, fill=CARD_BG, outline=BORDER_COL, width=2)
    draw.rectangle([45, 90, 680, 130], fill=NAVY)
    draw.text((65, 100), "1. Sticky Live Tally Bar (Journal Entry Invariant Bar)", font=fonts["h2"], fill=(255, 255, 255))

    # Balanced State Bar
    draw.rounded_rectangle([70, 150, 655, 210], radius=6, fill=(240, 253, 244), outline=EMERALD, width=2)
    draw.text((90, 162), "TOTAL DEBITS: £1,250.00", font=fonts["mono"], fill=NAVY)
    draw.text((270, 162), "TOTAL CREDITS: £1,250.00", font=fonts["mono"], fill=NAVY)
    draw.rounded_rectangle([470, 158, 635, 202], radius=4, fill=EMERALD)
    draw.text((485, 170), "DIFF: £0.00 (BALANCED)", font=fonts["body_bold"], fill=(255, 255, 255))

    # Unbalanced State Bar
    draw.rounded_rectangle([70, 230, 655, 290], radius=6, fill=(254, 242, 242), outline=CORAL, width=2)
    draw.text((90, 242), "TOTAL DEBITS: £1,250.00", font=fonts["mono"], fill=NAVY)
    draw.text((270, 242), "TOTAL CREDITS: £1,100.00", font=fonts["mono"], fill=NAVY)
    draw.rounded_rectangle([470, 238, 635, 282], radius=4, fill=(220, 38, 38))
    draw.text((480, 250), "DIFF: £150.00 (OUT OF BALANCE)", font=fonts["body_bold"], fill=(255, 255, 255))

    draw.text((70, 315), "• Mathematical Guarantee: Disables 'Post Journal' CTA while Diff != 0.00", font=fonts["body"], fill=SLATE)
    draw.text((70, 340), "• Live Recalculation: Evaluates on every keystroke via Decimal.js (zero floating drift)", font=fonts["body"], fill=SLATE)
    draw.text((70, 365), "• Responsive Anchor: Sticks to bottom viewport during multi-row journal editing", font=fonts["body"], fill=SLATE)

    # 2. Component Card: Status Badges & Accounting Tags
    draw.rounded_rectangle([720, 90, 1355, 420], radius=8, fill=CARD_BG, outline=BORDER_COL, width=2)
    draw.rectangle([720, 90, 1355, 130], fill=NAVY)
    draw.text((740, 100), "2. Status Badges & Nominal Code Tags", font=fonts["h2"], fill=(255, 255, 255))

    # Status Badges
    badges = [
        ("DRAFT", (241, 245, 249), SLATE),
        ("VALIDATED", (238, 242, 249), NAVY),
        ("POSTED", (236, 253, 245), EMERALD),
        ("REVERSED", (254, 242, 242), (220, 38, 38)),
        ("VOIDED", (255, 241, 238), CORAL),
    ]
    cur_x = 740
    for b_text, bg, fg in badges:
        draw.rounded_rectangle([cur_x, 155, cur_x + 105, 185], radius=15, fill=bg, outline=fg, width=1)
        draw.text((cur_x + 16, 162), b_text, font=fonts["body_bold"], fill=fg)
        cur_x += 120

    # Account Type Badges
    acct_types = [
        ("1000 ASSET", (236, 253, 245), EMERALD),
        ("2000 LIABILITY", (254, 242, 242), (185, 28, 28)),
        ("3000 EQUITY", (238, 242, 249), NAVY),
        ("4000 REVENUE", (240, 253, 244), (21, 128, 61)),
        ("5000/6000 EXPENSE", (255, 241, 238), CORAL),
    ]
    cur_x = 740
    for a_text, bg, fg in acct_types:
        draw.rounded_rectangle([cur_x, 220, cur_x + 115, 250], radius=4, fill=bg, outline=fg, width=1)
        draw.text((cur_x + 8, 227), a_text, font=fonts["mono_sm"], fill=fg)
        cur_x += 122

    draw.text((740, 285), "• Control Account Guard: Displays lock icon and warning tooltip on 1100 AR / 2000 AP", font=fonts["body"], fill=SLATE)
    draw.text((740, 315), "• Strict Color Coding: Prevents confusion between Debit-normal and Credit-normal accounts", font=fonts["body"], fill=SLATE)
    draw.text((740, 345), "• High Contrast: Meets WCAG AAA 7:1 contrast ratio against light backgrounds", font=fonts["body"], fill=SLATE)

    # 3. Component Card: Executive KPI Metric Cards
    draw.rounded_rectangle([45, 450, 1355, 800], radius=8, fill=CARD_BG, outline=BORDER_COL, width=2)
    draw.rectangle([45, 450, 1355, 490], fill=NAVY)
    draw.text((65, 460), "3. Executive Real-Time KPI Cards (Dashboard Level)", font=fonts["h2"], fill=(255, 255, 255))

    kpi_cards = [
        ("CASH AT BANK", "£142,850.40", "Nominal 1000 • Reconciled", EMERALD, "+12.4% MoM"),
        ("ACCOUNTS RECEIVABLE", "£38,420.00", "Nominal 1100 • 8 Invoices", NAVY, "3 Overdue"),
        ("ACCOUNTS PAYABLE", "£19,150.80", "Nominal 2000 • 5 Bills", CORAL, "Due in 14 Days"),
        ("NET PROFIT (YTD)", "£84,210.00", "Revenue - COS - OPEX", PURPLE, "28.5% Margin"),
    ]

    card_x = 70
    c_w = 295
    for title, val, sub, accent, badge in kpi_cards:
        draw.rounded_rectangle([card_x, 520, card_x + c_w, 760], radius=6, fill=LIGHT_BG, outline=BORDER_COL, width=1)
        # Top color line
        draw.rectangle([card_x, 520, card_x + c_w, 526], fill=accent)
        draw.text((card_x + 16, 540), title, font=fonts["body_bold"], fill=TEXT_MUTED)
        draw.text((card_x + 16, 575), val, font=fonts["h1"], fill=NAVY)
        draw.text((card_x + 16, 620), sub, font=fonts["small"], fill=SLATE)

        # Badge
        draw.rounded_rectangle([card_x + 16, 680, card_x + c_w - 16, 725], radius=4, fill=(255, 255, 255), outline=BORDER_COL, width=1)
        draw.text((card_x + 28, 695), badge, font=fonts["body_bold"], fill=accent)

        card_x += 320

    out_path = os.path.join(DIAGRAMS_DIR, "figure_ui_component_system.png")
    img.save(out_path)
    print("Saved component diagram:", out_path)

if __name__ == "__main__":
    generate_palette_diagram()
    generate_component_system_diagram()
