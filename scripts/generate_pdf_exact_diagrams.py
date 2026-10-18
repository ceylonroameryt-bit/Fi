import os
from PIL import Image, ImageDraw, ImageFont

DIAGRAMS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "docs", "diagrams")
os.makedirs(DIAGRAMS_DIR, exist_ok=True)

# Color constants matching the exact user PDF style
BG_WHITE = "#FFFFFF"
CARD_BG = "#FFFFFF"
BORDER_DEFAULT = "#94A3B8"
BORDER_CORAL = "#F87171"
BORDER_GREEN = "#10B981"
BORDER_RED = "#EF4444"
BORDER_AMBER = "#F59E0B"
BORDER_BLUE = "#60A5FA"

FILL_WHITE = "#FFFFFF"
FILL_RED_TINT = "#FEF2F2"
FILL_GREEN_TINT = "#ECFDF5"
FILL_AMBER_TINT = "#FFFBEB"
FILL_BLUE_TINT = "#EFF6FF"
FILL_CORAL_TINT = "#FFF1EE"

TEXT_DARK = "#1E293B"
TEXT_MUTED = "#64748B"
TEXT_RED = "#DC2626"
TEXT_GREEN = "#059669"
TEXT_AMBER = "#D97706"
TEXT_BLUE = "#2563EB"

LINE_DEFAULT = "#334155"
LINE_RED = "#EF4444"
LINE_GREEN = "#10B981"
LINE_MUTED = "#94A3B8"

def get_font(size, bold=False):
    font_file = "segoeuib.ttf" if bold else "segoeui.ttf"
    font_path = os.path.join("C:/Windows/Fonts", font_file)
    if os.path.exists(font_path):
        return ImageFont.truetype(font_path, size)
    return ImageFont.load_default()

def draw_box(draw, x, y, w, h, text, fill=FILL_WHITE, border=BORDER_DEFAULT, border_w=1, text_color=TEXT_DARK, radius=8, bold=False, font_size=11):
    x1, y1, x2, y2 = x - w/2, y - h/2, x + w/2, y + h/2
    draw.rounded_rectangle([int(x1), int(y1), int(x2), int(y2)], radius=int(radius), fill=fill, outline=border, width=int(border_w))
    
    font = get_font(font_size, bold)
    lines = text.split("\n")
    
    line_height = font_size + 4
    total_text_h = len(lines) * line_height
    start_y = y - total_text_h / 2 + 2
    
    for i, line in enumerate(lines):
        bbox = font.getbbox(line)
        lw = bbox[2] - bbox[0]
        lx = x - lw / 2
        ly = start_y + i * line_height
        draw.text((int(lx), int(ly)), line, fill=text_color, font=font)
    
    return (x1, y1, x2, y2)

def draw_diamond(draw, x, y, w, h, text, fill=FILL_WHITE, border=BORDER_AMBER, border_w=1, text_color=TEXT_DARK, font_size=11):
    points = [
        (int(x), int(y - h/2)),
        (int(x + w/2), int(y)),
        (int(x), int(y + h/2)),
        (int(x - w/2), int(y))
    ]
    draw.polygon(points, fill=fill, outline=border, width=int(border_w))
    font = get_font(font_size, False)
    lines = text.split("\n")
    line_height = font_size + 4
    total_h = len(lines) * line_height
    start_y = y - total_h / 2 + 2
    for i, line in enumerate(lines):
        bbox = font.getbbox(line)
        lw = bbox[2] - bbox[0]
        draw.text((int(x - lw/2), int(start_y + i * line_height)), line, fill=text_color, font=font)

def draw_arrow(draw, p1, p2, color=LINE_DEFAULT, width=1.5, arrow_len=7, arrow_w=4, dashed=False):
    x1, y1 = p1
    x2, y2 = p2
    
    if dashed:
        # Simple dashed line
        import math
        dist = math.hypot(x2 - x1, y2 - y1)
        if dist > 0:
            steps = int(dist / 8)
            dx = (x2 - x1) / dist
            dy = (y2 - y1) / dist
            for s in range(0, steps, 2):
                sx = x1 + s * 8 * dx
                sy = y1 + s * 8 * dy
                ex = x1 + min((s + 1) * 8, dist) * dx
                ey = y1 + min((s + 1) * 8, dist) * dy
                draw.line([sx, sy, ex, ey], fill=color, width=int(width))
    else:
        draw.line([x1, y1, x2, y2], fill=color, width=int(width))
        
    # Draw arrow head at p2
    import math
    angle = math.atan2(y2 - y1, x2 - x1)
    # Arrow points
    ax1 = x2 - arrow_len * math.cos(angle - math.pi / 6)
    ay1 = y2 - arrow_len * math.sin(angle - math.pi / 6)
    ax2 = x2 - arrow_len * math.cos(angle + math.pi / 6)
    ay2 = y2 - arrow_len * math.sin(angle + math.pi / 6)
    draw.polygon([(x2, y2), (ax1, ay1), (ax2, ay2)], fill=color)

def draw_curved_arrow_to(draw, start, mid_x, end, color=LINE_RED, width=1.5, arrow_len=7):
    # Orthogonal routed line with arrow
    x1, y1 = start
    x2, y2 = end
    draw.line([x1, y1, mid_x, y1], fill=color, width=int(width))
    draw.line([mid_x, y1, mid_x, y2], fill=color, width=int(width))
    draw.line([mid_x, y2, x2, y2], fill=color, width=int(width))
    # Arrow at x2, y2 pointing right
    draw.polygon([(x2, y2), (x2 - arrow_len, y2 - 4), (x2 - arrow_len, y2 + 4)], fill=color)

def add_caption(draw, text, img_w, y):
    font = get_font(9.5, False)
    bbox = font.getbbox(text)
    tw = bbox[2] - bbox[0]
    draw.text(((img_w - tw)/2, y), text, fill=TEXT_MUTED, font=font)

# ── Figure 1: High-level blynt System Architecture ─────────────────────────────
def gen_figure_1():
    w, h = 900, 320
    img = Image.new("RGB", (w, h), BG_WHITE)
    draw = ImageDraw.Draw(img)

    # Nodes
    draw_box(draw, 110, 110, 140, 42, "User / Browser", font_size=11)
    draw_box(draw, 320, 110, 160, 48, "Next.js 15 / React 19\nblynt Web App", font_size=10.5)
    draw_box(draw, 520, 110, 120, 42, "NestJS 11 API", font_size=11)
    
    # Sub branches from API
    draw_box(draw, 720, 70, 190, 46, "Business Modules\nSales | Purchases | Banking", font_size=10)
    draw_box(draw, 720, 160, 160, 42, "S3 Documents\n(target)", font_size=10)
    draw_box(draw, 720, 230, 140, 42, "CloudWatch\n(target)", font_size=10)
    
    # Central Accounting & DB
    draw_box(draw, 720, 70, 190, 46, "Business Modules\nSales | Purchases | Banking", font_size=10)
    
    # Extended right
    img2 = Image.new("RGB", (1050, 320), BG_WHITE)
    draw2 = ImageDraw.Draw(img2)
    
    draw_box(draw2, 100, 110, 130, 42, "User / Browser", font_size=11)
    draw_box(draw2, 280, 110, 150, 46, "Next.js 15 / React 19\nblynt Web App", font_size=10.5)
    draw_box(draw2, 470, 110, 130, 42, "NestJS 11 API", font_size=11)
    
    # Arrows horizontal
    draw_arrow(draw2, (165, 110), (205, 110))
    draw_arrow(draw2, (355, 110), (405, 110))
    
    # Right branches
    draw_box(draw2, 690, 60, 190, 44, "Business Modules\nSales | Purchases | Banking", font_size=10)
    draw_box(draw2, 940, 60, 160, 44, "Central Accounting Engine", fill=FILL_CORAL_TINT, border=BORDER_CORAL, text_color=TEXT_DARK, font_size=10.5)
    
    draw_box(draw2, 940, 140, 140, 42, "PostgreSQL\nPrisma ORM", font_size=10.5)
    draw_box(draw2, 690, 150, 160, 40, "S3 Documents\n(target)", font_size=10)
    draw_box(draw2, 690, 220, 140, 40, "CloudWatch\n(target)", font_size=10)
    
    # Connectors
    draw_arrow(draw2, (535, 95), (595, 65))
    draw_arrow(draw2, (535, 120), (610, 150))
    draw_arrow(draw2, (535, 130), (620, 220))
    
    draw_arrow(draw2, (785, 60), (860, 60))
    draw_arrow(draw2, (940, 82), (940, 119))
    
    add_caption(draw2, "Figure 1 - High-level blynt system architecture", 1050, 280)
    
    p = os.path.join(DIAGRAMS_DIR, "figure_1_system_architecture.png")
    img2.save(p)
    return p

# ── Figure 3: Central Accounting Posting Flow ──────────────────────────────────
def gen_figure_3():
    w, h = 650, 660
    img = Image.new("RGB", (w, h), BG_WHITE)
    draw = ImageDraw.Draw(img)

    cx = w / 2

    draw_box(draw, cx, 50, 300, 46, "Business Event\nInvoice / Payment / Bill / Expense", font_size=11)
    draw_arrow(draw, (cx, 73), (cx, 112))
    
    draw_box(draw, cx, 130, 170, 36, "Accounting Event", font_size=11)
    draw_arrow(draw, (cx, 148), (cx, 192))
    
    draw_box(draw, cx, 215, 230, 46, "JournalPostingService\nCentral Posting Engine", fill=FILL_WHITE, border=BORDER_CORAL, border_w=1.5, text_color=TEXT_DARK, font_size=11)
    draw_arrow(draw, (cx, 238), (cx, 287))
    
    draw_box(draw, cx, 305, 340, 38, "Validation\nperiod • permissions • accounts • balanced", font_size=10.5)
    
    # Valid vs Invalid split
    draw_arrow(draw, (cx - 40, 324), (cx - 90, 388), color=LINE_DEFAULT)
    draw.text((cx - 105, 348), "valid", fill=LINE_DEFAULT, font=get_font(10))
    
    draw_arrow(draw, (cx + 40, 324), (cx + 120, 388), color=LINE_RED)
    draw.text((cx + 80, 348), "invalid", fill=LINE_RED, font=get_font(10))
    
    # Left: Valid path
    draw_box(draw, cx - 110, 405, 140, 36, "POSTED Journal", font_size=11)
    draw_arrow(draw, (cx - 110, 423), (cx - 110, 467))
    
    draw_box(draw, cx - 110, 485, 150, 38, "Journal Lines\nDebit = Credit", font_size=10.5)
    draw_arrow(draw, (cx - 110, 504), (cx - 110, 548))
    
    draw_box(draw, cx - 110, 565, 140, 36, "General Ledger", font_size=11)
    draw_arrow(draw, (cx - 110, 583), (cx - 110, 615))
    
    # Bottom full summary
    draw_box(draw, cx, 630, 460, 34, "Trial Balance • P&L • Balance Sheet • Cash Flow", font_size=10.5)
    
    # Right: Invalid path
    draw_box(draw, cx + 140, 405, 200, 36, "Reject / return stable error", fill=FILL_WHITE, border=BORDER_RED, border_w=1.5, text_color=TEXT_DARK, font_size=11)

    p = os.path.join(DIAGRAMS_DIR, "figure_3_central_posting_flow.png")
    img.save(p)
    return p

# ── Figure 4: Journal Lifecycle and Ledger Impact ──────────────────────────────
def gen_figure_4():
    w, h = 900, 160
    img = Image.new("RGB", (w, h), BG_WHITE)
    draw = ImageDraw.Draw(img)

    y = 60
    draw_box(draw, 110, y, 140, 44, "DRAFT\nNo ledger impact", font_size=10.5)
    draw_box(draw, 340, y, 150, 44, "VALIDATED\nNo ledger impact", font_size=10.5)
    draw_box(draw, 560, y, 140, 44, "POSTED\nLedger impact", border=BORDER_GREEN, font_size=10.5)
    draw_box(draw, 780, y, 160, 44, "REVERSED\nOpposite posted journal", border=BORDER_AMBER, font_size=10)

    # Arrows
    draw_arrow(draw, (180, y - 6), (265, y - 6))
    draw.text((205, y - 22), "validate", fill=TEXT_MUTED, font=get_font(9.5))
    
    # Dotted arrow back
    draw_arrow(draw, (265, y + 10), (180, y + 10), color=LINE_MUTED, dashed=True)
    draw.text((200, y + 14), "edit/reset", fill=TEXT_MUTED, font=get_font(9.5))

    draw_arrow(draw, (415, y), (490, y))
    draw.text((440, y - 16), "post", fill=TEXT_MUTED, font=get_font(9.5))

    draw_arrow(draw, (630, y), (700, y))
    draw.text((650, y - 16), "reverse", fill=TEXT_MUTED, font=get_font(9.5))

    add_caption(draw, "Figure 4 - Journal lifecycle and ledger impact", w, 125)
    
    p = os.path.join(DIAGRAMS_DIR, "figure_4_journal_lifecycle.png")
    img.save(p)
    return p

# ── Figure 5: Sales Invoice Accounting Flow ────────────────────────────────────
def gen_figure_5():
    w, h = 900, 360
    img = Image.new("RGB", (w, h), BG_WHITE)
    draw = ImageDraw.Draw(img)

    cx = w / 2

    draw_box(draw, cx, 40, 170, 36, "Create Sales Invoice", font_size=10.5)
    draw_arrow(draw, (cx, 58), (cx, 92))
    
    draw_box(draw, cx, 110, 110, 34, "DRAFT", font_size=11)
    draw_arrow(draw, (cx, 127), (cx, 162))
    
    draw_box(draw, cx, 180, 140, 36, "Post Invoice", font_size=10.5)
    draw_arrow(draw, (cx, 198), (cx, 232))
    
    draw_box(draw, cx, 250, 190, 38, "Central Posting Engine", border=BORDER_CORAL, border_w=1.5, font_size=11)
    
    # 4 Output boxes
    y_out = 310
    draw_box(draw, 150, y_out, 180, 38, "DR Accounts Receivable", font_size=10.5)
    draw_box(draw, 370, y_out, 150, 38, "CR Revenue", font_size=10.5)
    draw_box(draw, 580, y_out, 170, 38, "CR Output VAT\n(if applicable)", font_size=10)
    draw_box(draw, 780, y_out, 140, 38, "Invoice = POSTED", font_size=10.5)

    # Connecting arrows from central engine
    draw_arrow(draw, (cx - 70, 269), (180, 291))
    draw_arrow(draw, (cx - 30, 269), (360, 291))
    draw_arrow(draw, (cx + 30, 269), (560, 291))
    draw_arrow(draw, (cx + 70, 269), (740, 291))

    p = os.path.join(DIAGRAMS_DIR, "figure_5_sales_invoice_posting.png")
    img.save(p)
    return p

# ── Figure 6: Customer Payment Allocation Flow ─────────────────────────────────
def gen_figure_6():
    w, h = 900, 250
    img = Image.new("RGB", (w, h), BG_WHITE)
    draw = ImageDraw.Draw(img)

    draw_box(draw, 450, 35, 160, 36, "Customer Payment", font_size=11)
    
    # Left: Allocation -> Invoices
    draw_box(draw, 310, 105, 160, 36, "Payment Allocation", font_size=10.5)
    draw_box(draw, 590, 105, 180, 36, "Central Posting Engine", border=BORDER_CORAL, border_w=1.5, font_size=10.5)
    
    draw_arrow(draw, (410, 53), (350, 87))
    draw_arrow(draw, (490, 53), (550, 87))
    
    # Left leaf
    draw_box(draw, 140, 180, 100, 36, "Invoice(s)", font_size=10.5)
    draw_box(draw, 350, 180, 230, 42, "Update authoritative invoice state\nPARTIALLY_PAID / PAID", border=BORDER_GREEN, border_w=1.5, font_size=9.5)
    
    draw_arrow(draw, (260, 123), (170, 162))
    draw_arrow(draw, (310, 123), (320, 159))
    draw_arrow(draw, (190, 180), (235, 180))
    
    # Right leaf: DR Bank, CR AR
    draw_box(draw, 570, 180, 100, 36, "DR Bank", font_size=10.5)
    draw_box(draw, 750, 180, 180, 36, "CR Accounts Receivable", font_size=10.5)
    
    draw_arrow(draw, (570, 123), (570, 162))
    draw_arrow(draw, (630, 123), (700, 162))
    
    add_caption(draw, "Figure 6 - Customer payment allocation and accounting flow", w, 230)
    
    p = os.path.join(DIAGRAMS_DIR, "figure_6_customer_payment_flow.png")
    img.save(p)
    return p

# ── Figure 7: Request Authorisation and Tenant Isolation Flow ─────────────────
def gen_figure_7():
    w, h = 650, 560
    img = Image.new("RGB", (w, h), BG_WHITE)
    draw = ImageDraw.Draw(img)

    cx = 260
    y_step = 65
    
    steps = [
        "API Request",
        "Authenticate Session",
        "Resolve Organisation Context",
        "Verify Membership",
        "Verify Permission",
        "Verify Resource organizationId",
        "Execute Domain Service"
    ]
    
    # Draw vertical steps
    y = 40
    for i, s in enumerate(steps):
        is_last = (i == len(steps) - 1)
        border = BORDER_GREEN if is_last else BORDER_DEFAULT
        bw = 1.5 if is_last else 1
        tc = TEXT_DARK
        
        draw_box(draw, cx, y, 220, 36, s, border=border, border_w=bw, text_color=tc, font_size=10.5)
        
        if not is_last:
            draw_arrow(draw, (cx, y + 18), (cx, y + y_step - 18))
        
        y += y_step

    # Red error box on bottom right
    err_x, err_y = 500, 430
    draw_box(draw, err_x, err_y, 200, 38, "401 / 403 / TENANT_MISMATCH", border=BORDER_RED, border_w=1.5, text_color=TEXT_DARK, font_size=10.5)

    # Curved red arrows for failure paths
    draw_curved_arrow_to(draw, (cx + 110, 105), 570, (err_x + 100, err_y - 19), color=LINE_RED)
    draw.text((575, 270), "fail", fill=LINE_RED, font=get_font(9.5))
    
    draw_curved_arrow_to(draw, (cx + 110, 170), 500, (err_x + 50, err_y - 19), color=LINE_RED)
    draw_curved_arrow_to(draw, (cx + 110, 235), 450, (err_x, err_y - 19), color=LINE_RED)
    draw_curved_arrow_to(draw, (cx + 110, 300), 420, (err_x - 30, err_y - 19), color=LINE_RED)
    draw_curved_arrow_to(draw, (cx + 110, 365), 400, (err_x - 60, err_y - 19), color=LINE_RED)

    add_caption(draw, "Figure 7 - Request authorisation and tenant-isolation flow", w, 520)
    
    p = os.path.join(DIAGRAMS_DIR, "figure_7_tenant_isolation_flow.png")
    img.save(p)
    return p

# ── Figure 8: Low-cost AWS DEV architecture in eu-west-2 ───────────────────────
def gen_figure_8():
    w, h = 850, 300
    img = Image.new("RGB", (w, h), BG_WHITE)
    draw = ImageDraw.Draw(img)

    # Left: Users & GitHub
    draw_box(draw, 100, 70, 90, 36, "Users", font_size=11)
    draw_box(draw, 100, 190, 90, 36, "GitHub", font_size=11)
    
    draw_box(draw, 260, 70, 150, 42, "AWS Amplify\nNext.js", font_size=10.5)
    draw_box(draw, 260, 190, 150, 42, "GitHub Actions\nOIDC", font_size=10.5)
    
    draw_arrow(draw, (145, 70), (185, 70))
    draw_arrow(draw, (145, 190), (185, 190))

    draw_box(draw, 440, 190, 130, 36, "Amazon ECR", font_size=10.5)
    draw_arrow(draw, (335, 190), (375, 190))

    # Center: App Runner NestJS API
    draw_box(draw, 520, 100, 170, 44, "AWS App Runner\nNestJS API", font_size=10.5)
    draw_arrow(draw, (335, 75), (435, 95))
    draw_arrow(draw, (440, 172), (480, 122))

    # Right services
    draw_box(draw, 740, 40, 140, 34, "RDS PostgreSQL", font_size=10.5)
    draw_box(draw, 740, 90, 160, 34, "S3 Private Documents", font_size=10.5)
    draw_box(draw, 740, 140, 160, 34, "Secrets Manager / SSM", font_size=10.5)
    draw_box(draw, 740, 190, 120, 34, "CloudWatch", font_size=10.5)

    draw_arrow(draw, (605, 90), (670, 50))
    draw_arrow(draw, (605, 95), (660, 90))
    draw_arrow(draw, (605, 105), (660, 135))
    draw_arrow(draw, (605, 115), (680, 175))

    add_caption(draw, "Figure 8 - Low-cost AWS DEV architecture in eu-west-2", w, 260)
    
    p = os.path.join(DIAGRAMS_DIR, "figure_8_aws_dev_architecture.png")
    img.save(p)
    return p

# ── Figure 9: Safe Migration and Rollback Path ─────────────────────────────────
def gen_figure_9():
    w, h = 650, 720
    img = Image.new("RGB", (w, h), BG_WHITE)
    draw = ImageDraw.Draw(img)

    cx = w / 2

    draw_box(draw, cx, 40, 240, 40, "Current Hosting\n(Vercel/Render + PostgreSQL)", font_size=10.5)
    
    draw_box(draw, cx - 140, 110, 170, 36, "pg_dump / encrypted backup", font_size=9.5)
    draw_box(draw, cx + 100, 110, 230, 36, "Keep old environment read-only for rollback", font_size=9.5)
    
    draw_arrow(draw, (cx - 50, 60), (cx - 100, 92))
    draw_arrow(draw, (cx + 50, 60), (cx + 80, 92))

    draw_box(draw, cx - 80, 175, 220, 36, "AWS DEV restore / sanitized data", font_size=10)
    draw_arrow(draw, (cx - 140, 128), (cx - 100, 157))

    draw_box(draw, cx, 235, 230, 36, "Row counts + accounting integrity", font_size=10)
    draw_arrow(draw, (cx - 80, 193), (cx - 20, 217))

    draw_box(draw, cx, 295, 200, 36, "Amplify + App Runner testing", font_size=10)
    draw_arrow(draw, (cx, 253), (cx, 277))

    # Diamond decision
    draw_diamond(draw, cx, 365, 200, 50, "Cutover approved?", font_size=10.5)
    draw_arrow(draw, (cx, 313), (cx, 340))

    # No loop back (dashed)
    draw_arrow(draw, (cx + 100, 365), (cx + 250, 365), color=LINE_MUTED, dashed=True)
    draw_arrow(draw, (cx + 250, 365), (cx + 250, 60), color=LINE_MUTED, dashed=True)
    draw_arrow(draw, (cx + 250, 60), (cx + 120, 60), color=LINE_MUTED, dashed=True)
    draw.text((cx + 180, 345), "no", fill=TEXT_MUTED, font=get_font(10))

    # Yes path
    draw.text((cx + 10, 400), "yes", fill=TEXT_DARK, font=get_font(10))
    draw_arrow(draw, (cx, 390), (cx, 430))

    draw_box(draw, cx, 450, 190, 36, "Maintenance / read-only", font_size=10.5)
    draw_arrow(draw, (cx, 468), (cx, 502))

    draw_box(draw, cx, 520, 200, 36, "Final backup + RDS restore", font_size=10.5)
    draw_arrow(draw, (cx, 538), (cx, 572))

    draw_box(draw, cx, 590, 180, 36, "Final financial validation", font_size=10.5)
    draw_arrow(draw, (cx, 608), (cx, 642))

    draw_box(draw, cx, 660, 140, 36, "Switch traffic", font_size=11)

    p = os.path.join(DIAGRAMS_DIR, "figure_9_migration_process.png")
    img.save(p)
    return p

# ── Figure 10: Pull-request Quality Gate and Deployment Flow ───────────────────
def gen_figure_10():
    w, h = 600, 720
    img = Image.new("RGB", (w, h), BG_WHITE)
    draw = ImageDraw.Draw(img)

    cx = w / 2
    steps = [
        ("Pull Request", 120, 36),
        ("npm ci", 110, 34),
        ("Prisma generate / validate / migrations", 250, 36),
        ("Lint + Typecheck", 140, 34),
        ("Unit + Integration + E2E", 180, 34),
        ("Dependency + Secret Scan", 190, 34),
        ("Production Build", 150, 34),
    ]

    y = 40
    for name, bw, bh in steps:
        draw_box(draw, cx, y, bw, bh, name, font_size=10.5)
        draw_arrow(draw, (cx, y + bh/2), (cx, y + 55 - bh/2))
        y += 55

    # Diamond decision
    y_diamond = y + 10
    draw_diamond(draw, cx, y_diamond, 190, 48, "All checks pass?", font_size=10.5)
    
    # Left: Yes -> Merge -> Build
    draw_arrow(draw, (cx - 40, y_diamond + 18), (cx - 70, y_diamond + 70))
    draw.text((cx - 80, y_diamond + 35), "yes", fill=TEXT_DARK, font=get_font(10))
    draw_box(draw, cx - 70, y_diamond + 90, 80, 34, "Merge", font_size=10.5)
    
    draw_arrow(draw, (cx - 70, y_diamond + 107), (cx - 70, y_diamond + 140))
    draw_box(draw, cx - 70, y_diamond + 160, 270, 38, "Build immutable image -> ECR -> AWS DEV", border=BORDER_GREEN, border_w=1.5, font_size=9.5)

    # Right: No -> Block merge
    draw_arrow(draw, (cx + 40, y_diamond + 18), (cx + 70, y_diamond + 70), color=LINE_RED)
    draw.text((cx + 65, y_diamond + 35), "no", fill=LINE_RED, font=get_font(10))
    draw_box(draw, cx + 70, y_diamond + 90, 120, 34, "Block merge", border=BORDER_RED, border_w=1.5, text_color=TEXT_DARK, font_size=10.5)

    p = os.path.join(DIAGRAMS_DIR, "figure_10_pull_request_gate.png")
    img.save(p)
    return p

def main():
    print("Generating exact PDF style diagrams...")
    print("Fig 1:", gen_figure_1())
    print("Fig 3:", gen_figure_3())
    print("Fig 4:", gen_figure_4())
    print("Fig 5:", gen_figure_5())
    print("Fig 6:", gen_figure_6())
    print("Fig 7:", gen_figure_7())
    print("Fig 8:", gen_figure_8())
    print("Fig 9:", gen_figure_9())
    print("Fig 10:", gen_figure_10())
    print("All exact diagrams generated successfully!")

if __name__ == "__main__":
    main()
