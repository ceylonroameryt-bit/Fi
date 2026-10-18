import os
from PIL import Image, ImageDraw, ImageFont

WORKSPACE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS_DIR = os.path.join(WORKSPACE_DIR, "docs")
DIAGRAMS_DIR = os.path.join(DOCS_DIR, "diagrams")
os.makedirs(DIAGRAMS_DIR, exist_ok=True)

# Colors
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
        "h1": ImageFont.truetype(FONT_PATH_BOLD, 15),
        "body_bold": ImageFont.truetype(FONT_PATH_BOLD, 12),
        "body": ImageFont.truetype(FONT_PATH_REG, 11),
        "small": ImageFont.truetype(FONT_PATH_REG, 10),
        "mono": ImageFont.truetype(FONT_PATH_MONO, 11),
    }

def generate_security_diagram():
    fonts = get_fonts()
    W, H = 1400, 850
    img = Image.new("RGB", (W, H), LIGHT_BG)
    draw = ImageDraw.Draw(img)

    # Header Banner
    draw.rectangle([0, 0, W, 60], fill=NAVY)
    draw.text((25, 16), "blynt — Comprehensive Security Architecture, SOC 2 Framework & GRC Matrix", font=fonts["title"], fill=(255, 255, 255))

    # 4 Main Columns / Pillars:
    # 1. Perimeter & Network Security
    # 2. Application & Identity Security
    # 3. Data Protection & Ledger Immutability
    # 4. GRC, SOC 2 & Audit Compliance

    col_w = 310
    col_h = 740
    start_y = 80
    gap = 20

    columns = [
        ("1. PERIMETER & NETWORK", [
            ("AWS WAF & Shield", "DDoS mitigation, rate-limiting, geo-fencing, SQLi/XSS inspection filters."),
            ("TLS 1.3 Strict Ingress", "HSTS headers, modern cipher suites only (TLS 1.2/1.3), perfect forward secrecy."),
            ("Isolated AWS VPC Subnets", "Public ingress isolated; backend containers and database in private subnets with NAT."),
            ("Security Groups & NACLs", "Strict egress filtering, least privilege port access (PostgreSQL 5432 internal only)."),
            ("Non-Root Docker Pods", "Containers run with non-root UID 1001, read-only root filesystem, drop Linux caps."),
        ], NAVY),

        ("2. APP & IDENTITY SECURITY", [
            ("scrypt Password Hashing", "16-byte random salt, 64-byte key length; constant-time timingSafeEqual verification."),
            ("Stateful Session Security", "Bearer token validation, 30-day sliding expiry, multi-device tracking, remote revocation."),
            ("Fine-Grained RBAC", "5 system roles (OWNER to VIEWER); controller-level route guards (RolesGuard)."),
            ("OWASP Top 10 Hardening", "Input validation (class-validator whitelist), Helmet.js headers, CSRF & CORS policies."),
            ("Static Code Security (SAST)", "Automated Snyk, Dependabot, and npm audit checks enforced in PR quality gate."),
        ], CORAL),

        ("3. DATA & LEDGER IMMUTABILITY", [
            ("Composite FK Isolation", "Tenant boundary enforced via composite keys (organization_id, id) at relational layer."),
            ("Append-Only Trigger", "PostgreSQL trigger trg_audit_logs_immutable raises exception on UPDATE or DELETE."),
            ("AES-256 Encryption at Rest", "Amazon RDS storage encrypted via AWS KMS customer managed keys (CMK)."),
            ("Zero-Drift Invariant Gate", "JournalValidationService blocks unbalanced transactions before DB commit."),
            ("Point-In-Time-Recovery (PITR)", "Continuous WAL streaming to S3 with Object Lock in Compliance Mode (WORM)."),
        ], EMERALD),

        ("4. GRC, SOC 2 & COMPLIANCE", [
            ("SOC 2 Type II Alignment", "Controls mapped across Security, Availability, Confidentiality, and Processing Integrity."),
            ("HMRC MTD Certification", "Statutory UK VAT API authentication and tamper-evident submission audit trail."),
            ("UK GDPR / DPA 2018", "Data residency strictly in London eu-west-2; statutory 6-year audit retention rules."),
            ("Annual Penetration Testing", "Third-party CREST-certified black-box and white-box security penetration testing."),
            ("24/7 SOC & SIEM Logging", "CloudWatch Logs Insights correlation IDs (x-request-id) and automated PagerDuty triage."),
        ], PURPLE),
    ]

    for col_idx, (col_title, items, col_theme) in enumerate(columns):
        c_x = 45 + col_idx * (col_w + gap)

        # Outer card
        draw.rounded_rectangle([c_x, start_y, c_x + col_w, start_y + col_h], radius=8, fill=CARD_BG, outline=BORDER_COL, width=2)
        # Header banner
        draw.rounded_rectangle([c_x, start_y, c_x + col_w, start_y + 40], radius=8, fill=col_theme)
        draw.rectangle([c_x, start_y + 32, c_x + col_w, start_y + 40], fill=col_theme)
        draw.text((c_x + 14, start_y + 10), col_title, font=fonts["h1"], fill=(255, 255, 255))

        # Items
        item_y = start_y + 55
        for item_title, item_desc in items:
            draw.rounded_rectangle([c_x + 10, item_y, c_x + col_w - 10, item_y + 122], radius=6, fill=LIGHT_BG, outline=BORDER_COL, width=1)
            draw.text((c_x + 20, item_y + 10), item_title, font=fonts["body_bold"], fill=col_theme)
            draw.line([(c_x + 20, item_y + 28), (c_x + col_w - 20, item_y + 28)], fill=BORDER_COL, width=1)
            
            # Simple text wrap
            words = item_desc.split()
            lines = []
            curr_line = ""
            for w in words:
                test_line = curr_line + " " + w if curr_line else w
                if len(test_line) > 34:
                    lines.append(curr_line)
                    curr_line = w
                else:
                    curr_line = test_line
            if curr_line:
                lines.append(curr_line)

            t_y = item_y + 35
            for l in lines[:4]:
                draw.text((c_x + 20, t_y), l, font=fonts["body"], fill=TEXT_DARK)
                t_y += 18

            item_y += 134

    out_path = os.path.join(DIAGRAMS_DIR, "figure_security_grc_soc_architecture.png")
    img.save(out_path)
    print("Saved security GRC diagram:", out_path)

if __name__ == "__main__":
    generate_security_diagram()
