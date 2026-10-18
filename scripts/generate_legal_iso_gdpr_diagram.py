import os
from PIL import Image, ImageDraw, ImageFont

WORKSPACE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS_DIR = os.path.join(WORKSPACE_DIR, "docs")
DIAGRAMS_DIR = os.path.join(DOCS_DIR, "diagrams")
os.makedirs(DIAGRAMS_DIR, exist_ok=True)

# Brand Colors (strict blynt palette)
NAVY = (22, 45, 95)
CORAL = (255, 127, 108)
EMERALD = (16, 185, 129)
PURPLE = (124, 58, 237)
BLUE = (37, 99, 235)
LIGHT_BG = (248, 250, 252)
CARD_BG = (255, 255, 255)
BORDER_COL = (226, 232, 240)
TEXT_DARK = (30, 41, 59)
TEXT_MUTED = (100, 116, 139)
DARK_FOOTER = (30, 41, 59)

FONT_PATH_BOLD = "C:/Windows/Fonts/segoeuib.ttf"
FONT_PATH_REG = "C:/Windows/Fonts/segoeui.ttf"

def get_fonts():
    f_title = ImageFont.truetype(FONT_PATH_BOLD, 42)
    f_subtitle = ImageFont.truetype(FONT_PATH_REG, 21)
    f_card_num = ImageFont.truetype(FONT_PATH_BOLD, 17)
    f_card_title = ImageFont.truetype(FONT_PATH_BOLD, 22)
    f_card_text = ImageFont.truetype(FONT_PATH_REG, 17)
    f_foot_head = ImageFont.truetype(FONT_PATH_BOLD, 18)
    f_foot_text = ImageFont.truetype(FONT_PATH_REG, 17)
    return f_title, f_subtitle, f_card_num, f_card_title, f_card_text, f_foot_head, f_foot_text

def generate_legal_iso_gdpr_diagram():
    WIDTH, HEIGHT = 2400, 1350
    img = Image.new("RGB", (WIDTH, HEIGHT), LIGHT_BG)
    draw = ImageDraw.Draw(img)
    f_title, f_subtitle, f_card_num, f_card_title, f_card_text, f_foot_head, f_foot_text = get_fonts()

    # Title Banner
    title_text = "blynt Legal, ISO/IEC 27001 & UK GDPR Governance Architecture"
    draw.text((WIDTH // 2, 75), title_text, fill=NAVY, font=f_title, anchor="mm")
    sub_text = "Statutory UK Financial Laws, Annex A Security Controls, Data Privacy Rights & Global Regulatory Compliance"
    draw.text((WIDTH // 2, 130), sub_text, fill=TEXT_MUTED, font=f_subtitle, anchor="mm")

    pillars = [
        {
            "num": "PILLAR 1",
            "title": "UK Financial Law",
            "color": NAVY,
            "bullets": [
                "• Companies Act 2006 (ss. 386-388):",
                "  Accurate statutory accounting records",
                "• Taxes Management Act 1970 (TMA):",
                "  Mandatory 6-Year Record Retention",
                "• VAT Act 1994 & MTD Regulations:",
                "  Digital links, uncorrupted audit trail",
                "• HMRC Fraud Prevention Headers API:",
                "  Gov-Client connection audit compliance",
                "• Anti-Money Laundering (MLR 2017):",
                "  Sanctions screening & Suspicious Activity"
            ]
        },
        {
            "num": "PILLAR 2",
            "title": "ISO/IEC 27001:2022",
            "color": PURPLE,
            "bullets": [
                "• Clause 4-10 ISMS Framework:",
                "  Continuous risk assessment & PDCA cycle",
                "• Annex A.5 Organizational Controls:",
                "  Policies, asset inventory & vendor triage",
                "• Annex A.6 People Controls:",
                "  Background checks, non-disclosure & training",
                "• Annex A.8 Technological Controls:",
                "  KMS envelope encryption, least-privilege RBAC",
                "• Statement of Applicability (SoA):",
                "  93 controls mapped & independently audited"
            ]
        },
        {
            "num": "PILLAR 3",
            "title": "UK GDPR & DPA 2018",
            "color": EMERALD,
            "bullets": [
                "• Controller vs Processor Boundary:",
                "  SaaS processing under strict DPA & SCCs",
                "• Lawful Basis (Art. 6): Legal Obligation",
                "  for statutory financial & ledger records",
                "• Right to Erasure Conflict Resolution:",
                "  TMA 6-year retention overrides deletion",
                "• Records of Processing (RoPA Art. 30):",
                "  Automated data lifecycle cataloging",
                "• DPIA (Art. 35) & 72h ICO Breach Protocol"
            ]
        },
        {
            "num": "PILLAR 4",
            "title": "GRC & Audit Lineage",
            "color": BLUE,
            "bullets": [
                "• Immutable Append-Only Ledger Logs:",
                "  SHA-256 state hashing on all postings",
                "• WORM Storage (Write Once, Read Many):",
                "  AWS S3 Object Lock compliance retention",
                "• Independent External Audit Protocol:",
                "  Annual ISO 27001 Stage 2 surveillance",
                "• Third-Party Vendor Risk (TPRM):",
                "  Sub-processor compliance & SLA reviews",
                "• Cross-Border Data Transfer Safeguards"
            ]
        }
    ]

    card_width = 515
    card_height = 820
    x_start = 85
    spacing = 55
    y_card = 200

    for i, p in enumerate(pillars):
        x = x_start + i * (card_width + spacing)
        
        # Shadow
        draw.rounded_rectangle([x + 6, y_card + 6, x + card_width + 6, y_card + card_height + 6], radius=16, fill=(226, 232, 240))
        # Card Body
        draw.rounded_rectangle([x, y_card, x + card_width, y_card + card_height], radius=16, fill=CARD_BG, outline=p["color"], width=3)

        # Header Pill
        pill_y1 = y_card + 20
        pill_y2 = y_card + 115
        draw.rounded_rectangle([x + 18, pill_y1, x + card_width - 18, pill_y2], radius=12, fill=p["color"])
        draw.text((x + card_width // 2, pill_y1 + 28), p["num"], fill=(248, 250, 252), font=f_card_num, anchor="mm")
        draw.text((x + card_width // 2, pill_y1 + 64), p["title"], fill=(255, 255, 255), font=f_card_title, anchor="mm")

        # Bullets
        text_y = y_card + 145
        for item in p["bullets"]:
            draw.text((x + 24, text_y), item, fill=TEXT_DARK, font=f_card_text)
            text_y += 66

        # Connecting Arrow
        if i < len(pillars) - 1:
            arrow_x = x + card_width + 12
            arrow_y = y_card + card_height // 2
            draw.line([arrow_x, arrow_y, arrow_x + spacing - 24, arrow_y], fill=CORAL, width=4)
            draw.polygon([
                (arrow_x + spacing - 14, arrow_y),
                (arrow_x + spacing - 30, arrow_y - 10),
                (arrow_x + spacing - 30, arrow_y + 10)
            ], fill=CORAL)

    # Bottom Governance Bar
    gov_y1 = 1080
    gov_y2 = 1260
    draw.rounded_rectangle([85, gov_y1, WIDTH - 85, gov_y2], radius=16, fill=NAVY, outline=CORAL, width=3)
    draw.text((WIDTH // 2, gov_y1 + 45), "STATUTORY COMPLIANCE & LEGAL ENFORCEMENT SHIELD", fill=CORAL, font=f_foot_head, anchor="mm")
    draw.text((WIDTH // 2, gov_y1 + 95), "6-Year Statutory Retention Exemption from GDPR Erasure  •  HMRC MTD Digital Links Invariance  •  ISO 27001:2022 Stage 2 Certified", fill=(248, 250, 252), font=f_foot_text, anchor="mm")
    draw.text((WIDTH // 2, gov_y1 + 135), "Mandatory 72-Hour ICO Data Breach Escalation  •  Zero Legal Liability for Non-Consensual Financial Ledger Deletions", fill=(203, 213, 225), font=f_foot_text, anchor="mm")

    out_file = os.path.join(DIAGRAMS_DIR, "figure_legal_iso27001_gdpr_framework.png")
    img.save(out_file, quality=95)
    print(f"Generated: {out_file}")

if __name__ == "__main__":
    generate_legal_iso_gdpr_diagram()
