import os
from PIL import Image, ImageDraw, ImageFont

WORKSPACE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS_DIR = os.path.join(WORKSPACE_DIR, "docs")
DIAGRAMS_DIR = os.path.join(DOCS_DIR, "diagrams")
os.makedirs(DIAGRAMS_DIR, exist_ok=True)

# Brand Colors
NAVY = (22, 45, 95)
CORAL = (255, 127, 108)
TEAL = (13, 148, 136)
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
FONT_PATH_SEMIBOLD = "C:/Windows/Fonts/segoeuisl.ttf"

def get_fonts():
    f_title = ImageFont.truetype(FONT_PATH_BOLD, 42)
    f_subtitle = ImageFont.truetype(FONT_PATH_REG, 21)
    f_card_num = ImageFont.truetype(FONT_PATH_BOLD, 17)
    f_card_title = ImageFont.truetype(FONT_PATH_BOLD, 22)
    f_card_text = ImageFont.truetype(FONT_PATH_REG, 17)
    f_foot_head = ImageFont.truetype(FONT_PATH_BOLD, 18)
    f_foot_text = ImageFont.truetype(FONT_PATH_REG, 17)
    return f_title, f_subtitle, f_card_num, f_card_title, f_card_text, f_foot_head, f_foot_text

def generate_pm_diagram():
    WIDTH, HEIGHT = 2400, 1350
    img = Image.new("RGB", (WIDTH, HEIGHT), LIGHT_BG)
    draw = ImageDraw.Draw(img)
    f_title, f_subtitle, f_card_num, f_card_title, f_card_text, f_foot_head, f_foot_text = get_fonts()

    # Title Banner
    title_text = "blynt Product Management & Feature Lifecycle"
    draw.text((WIDTH // 2, 75), title_text, fill=NAVY, font=f_title, anchor="mm")
    sub_text = "From Customer Discovery & PRD Specification to Sprint Execution, UAT & FinTech KPI Tracking"
    draw.text((WIDTH // 2, 130), sub_text, fill=TEXT_MUTED, font=f_subtitle, anchor="mm")

    stages = [
        {
            "step": "STAGE 1",
            "title": "Discovery & Strategy",
            "color": NAVY,
            "items": [
                "• User Interviews (CFO / Controller)",
                "• Regulatory Tracking (HMRC / MTD)",
                "• Market Gap & Competitor Analysis",
                "• Opportunity Solution Tree (OST)",
                "• Product Vision & OKR Alignment",
                "• Problem Statement Definition"
            ]
        },
        {
            "step": "STAGE 2",
            "title": "PRD & Backlog",
            "color": CORAL,
            "items": [
                "• Detailed PRD (Gherkin Scenarios)",
                "• RICE Prioritization Scoring",
                "• UX Wireframes & Figma Approval",
                "• Tech Architecture RFC Spikes",
                "• Definition of Ready (DoR) Gate",
                "• Stakeholder Alignment Sign-off"
            ]
        },
        {
            "step": "STAGE 3",
            "title": "Sprint Delivery",
            "color": TEAL,
            "items": [
                "• 2-Week Sprint Planning Cadence",
                "• Fibonacci Story Point Sizing",
                "• Daily Standup & Blocker Clearing",
                "• Cross-Functional Development",
                "• Automated PR CI/CD Quality Gates",
                "• Invariant Verification Suites"
            ]
        },
        {
            "step": "STAGE 4",
            "title": "UAT & Phased Release",
            "color": PURPLE,
            "items": [
                "• Internal Dogfooding (Alpha)",
                "• CPA & SME Validation Review",
                "• Feature Flag Rollout (Canary)",
                "• Beta Cohort Testing (5-10 clients)",
                "• Release Notes & Help Center",
                "• General Availability (GA) Cut"
            ]
        },
        {
            "step": "STAGE 5",
            "title": "Telemetry & Impact",
            "color": BLUE,
            "items": [
                "• Invariant Drift Rate: 0.00%",
                "• Reconcile Latency (<2s p95)",
                "• Daily Active Businesses (DAB)",
                "• Month-End Close Acceleration",
                "• Net Promoter Score (NPS > 65)",
                "• Continuous Feedback Loop"
            ]
        }
    ]

    card_width = 410
    card_height = 820
    x_start = 85
    spacing = 55
    y_card = 200

    for i, s in enumerate(stages):
        x = x_start + i * (card_width + spacing)
        
        # Shadow
        draw.rounded_rectangle([x + 6, y_card + 6, x + card_width + 6, y_card + card_height + 6], radius=16, fill=(226, 232, 240))
        # Card Body
        draw.rounded_rectangle([x, y_card, x + card_width, y_card + card_height], radius=16, fill=CARD_BG, outline=s["color"], width=3)

        # Header Pill
        pill_y1 = y_card + 20
        pill_y2 = y_card + 115
        draw.rounded_rectangle([x + 18, pill_y1, x + card_width - 18, pill_y2], radius=12, fill=s["color"])
        draw.text((x + card_width // 2, pill_y1 + 28), s["step"], fill=(248, 250, 252), font=f_card_num, anchor="mm")
        draw.text((x + card_width // 2, pill_y1 + 64), s["title"], fill=(255, 255, 255), font=f_card_title, anchor="mm")

        # Items
        text_y = y_card + 160
        for item in s["items"]:
            draw.text((x + 28, text_y), item, fill=TEXT_DARK, font=f_card_text)
            text_y += 105

        # Arrow to next stage
        if i < len(stages) - 1:
            arrow_x = x + card_width + 12
            arrow_y = y_card + card_height // 2
            draw.line([arrow_x, arrow_y, arrow_x + spacing - 24, arrow_y], fill=CORAL, width=4)
            # Arrow head
            draw.polygon([
                (arrow_x + spacing - 14, arrow_y),
                (arrow_x + spacing - 30, arrow_y - 10),
                (arrow_x + spacing - 30, arrow_y + 10)
            ], fill=CORAL)

    # Bottom Governance Box
    gov_y1 = 1080
    gov_y2 = 1260
    draw.rounded_rectangle([85, gov_y1, WIDTH - 85, gov_y2], radius=16, fill=DARK_FOOTER, outline=CORAL, width=3)
    draw.text((WIDTH // 2, gov_y1 + 45), "PRODUCT GOVERNANCE & GATES FOR BLYNT", fill=CORAL, font=f_foot_head, anchor="mm")
    draw.text((WIDTH // 2, gov_y1 + 95), "Definition of Ready (DoR) Sign-off  •  Bi-Weekly Sprint Cadence  •  FinTech Compliance Check  •  Definition of Done (DoD) Verification", fill=(248, 250, 252), font=f_foot_text, anchor="mm")
    draw.text((WIDTH // 2, gov_y1 + 135), "Zero Toleration for Accounting Drift  •  Telemetry & Product Health Review  •  Cross-Functional Release Sign-off", fill=(203, 213, 225), font=f_foot_text, anchor="mm")

    out_file = os.path.join(DIAGRAMS_DIR, "figure_pm_product_lifecycle.png")
    img.save(out_file, quality=95)
    print(f"Generated: {out_file}")

def generate_dev_diagram():
    WIDTH, HEIGHT = 2400, 1350
    img = Image.new("RGB", (WIDTH, HEIGHT), LIGHT_BG)
    draw = ImageDraw.Draw(img)
    f_title, f_subtitle, f_card_num, f_card_title, f_card_text, f_foot_head, f_foot_text = get_fonts()

    # Title Banner
    title_text = "blynt Developer Engineering & Delivery Pipeline"
    draw.text((WIDTH // 2, 75), title_text, fill=NAVY, font=f_title, anchor="mm")
    sub_text = "Local Dev Stack, Accounting Architecture, Quality Gates, and Zero-Downtime Deployment"
    draw.text((WIDTH // 2, 130), sub_text, fill=TEXT_MUTED, font=f_subtitle, anchor="mm")

    pillars = [
        {
            "num": "PILLAR 1",
            "title": "Local Dev Stack",
            "color": NAVY,
            "bullets": [
                "• Monorepo (pnpm workspaces / Turborepo)",
                "• Docker Compose Container Stack:",
                "   - PostgreSQL 16 (Multi-tenant RLS)",
                "   - Redis 7 (BullMQ & Cache tier)",
                "   - LocalStack (AWS S3 & SQS)",
                "• Fast Hot-Reload (NestJS API + Vite/Next)",
                "• Automated Seed Script with GL Data",
                "• Healthcheck Verification Endpoint"
            ]
        },
        {
            "num": "PILLAR 2",
            "title": "Architecture Standards",
            "color": TEAL,
            "bullets": [
                "• Hexagonal / Clean Architecture design",
                "• Double-Entry Invariant Protection:",
                "   Sum(Debits) == Sum(Credits) enforced",
                "• Decimal(19,4) Precision Financial Math",
                "• Prisma Migrations (Zero Drift Policy)",
                "• REST API + Idempotency-Key headers",
                "• Strict TypeScript (Zero 'any' allowed)",
                "• Standardized JSON:API error envelopes"
            ]
        },
        {
            "num": "PILLAR 3",
            "title": "Quality Gates",
            "color": CORAL,
            "bullets": [
                "• Pre-commit hooks: Husky + ESLint",
                "• Unit Tests (Jest, >85% target coverage)",
                "• Invariant mathematical proof suites",
                "• Integration Tests (Supertest with Postgres)",
                "• E2E Invoicing & Tax tests (Playwright)",
                "• Trivy Container & Dependency SCA",
                "• 2 Senior Peer Approvals Required",
                "• Branch Protection on main branch"
            ]
        },
        {
            "num": "PILLAR 4",
            "title": "CI/CD & Observability",
            "color": BLUE,
            "bullets": [
                "• GitHub Actions Matrix Build & Test",
                "• Multi-Stage Alpine Docker Build",
                "• AWS ECR Vulnerability Scanning",
                "• Rolling ECS Fargate Deployment",
                "• OpenTelemetry & Datadog APM Tracing",
                "• Structured JSON Logs (AppLogger)",
                "• Sentry Real-Time Error Triage",
                "• Zero-Downtime Expand-Contract DB"
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
            text_y += 76

        # Arrow
        if i < len(pillars) - 1:
            arrow_x = x + card_width + 12
            arrow_y = y_card + card_height // 2
            draw.line([arrow_x, arrow_y, arrow_x + spacing - 24, arrow_y], fill=CORAL, width=4)
            draw.polygon([
                (arrow_x + spacing - 14, arrow_y),
                (arrow_x + spacing - 30, arrow_y - 10),
                (arrow_x + spacing - 30, arrow_y + 10)
            ], fill=CORAL)

    # Bottom Developer SLA Bar
    gov_y1 = 1080
    gov_y2 = 1260
    draw.rounded_rectangle([85, gov_y1, WIDTH - 85, gov_y2], radius=16, fill=NAVY, outline=CORAL, width=3)
    draw.text((WIDTH // 2, gov_y1 + 45), "ENGINEERING OPERATIONAL SLAS & PROTOCOLS", fill=CORAL, font=f_foot_head, anchor="mm")
    draw.text((WIDTH // 2, gov_y1 + 95), "PR Review Turnaround < 4 Hours  •  Zero-Downtime Database Migrations  •  P0 Incident Response < 15 Min", fill=(248, 250, 252), font=f_foot_text, anchor="mm")
    draw.text((WIDTH // 2, gov_y1 + 135), "Automated Rollback on Error Spike > 1%  •  Immutable Append-Only Audit Logging  •  SOC 2 Compliance Guardrails", fill=(203, 213, 225), font=f_foot_text, anchor="mm")

    out_file = os.path.join(DIAGRAMS_DIR, "figure_developer_engineering_workflow.png")
    img.save(out_file, quality=95)
    print(f"Generated: {out_file}")

if __name__ == "__main__":
    generate_pm_diagram()
    generate_dev_diagram()
