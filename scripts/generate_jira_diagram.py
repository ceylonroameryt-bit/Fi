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

def generate_workflow_diagram():
    fonts = get_fonts()
    W, H = 1400, 800
    img = Image.new("RGB", (W, H), LIGHT_BG)
    draw = ImageDraw.Draw(img)

    # Header Banner
    draw.rectangle([0, 0, W, 60], fill=NAVY)
    draw.text((25, 16), "blynt — Jira & Confluence Project Delivery & Issue Workflow State Machine", font=fonts["title"], fill=(255, 255, 255))

    # Top Section: Confluence Foundation (Left to Right)
    draw.rounded_rectangle([45, 80, 1355, 240], radius=8, fill=CARD_BG, outline=BORDER_COL, width=2)
    draw.rectangle([45, 80, 1355, 115], fill=NAVY)
    draw.text((65, 90), "CONFLUENCE KNOWLEDGE FOUNDATION (Source of Truth & Documentation)", font=fonts["h1"], fill=(255, 255, 255))

    confluence_steps = [
        ("1. Product PRD", "Phase Requirements & Acceptance Criteria (Gherkin)", PURPLE),
        ("2. Tech RFC / ADR", "Database Schema, API Contracts & Invariant Design", NAVY),
        ("3. Jira Epic Link", "Direct 1:1 Linkage to Phase Epics (BLYNT-EPIC-XX)", CORAL),
        ("4. QA Test Strategy", "Traceability Matrix & Test Case Documentation", EMERALD),
    ]

    c_x = 70
    c_w = 295
    for title, desc, col in confluence_steps:
        draw.rounded_rectangle([c_x, 130, c_x + c_w, 225], radius=6, fill=LIGHT_BG, outline=col, width=1)
        draw.rectangle([c_x, 130, c_x + c_w, 135], fill=col)
        draw.text((c_x + 14, 145), title, font=fonts["body_bold"], fill=col)
        draw.text((c_x + 14, 175), desc, font=fonts["body"], fill=SLATE)
        c_x += 320

    # Middle Connecting Arrow
    draw.line([(700, 240), (700, 280)], fill=CORAL, width=3)
    draw.polygon([(695, 275), (705, 275), (700, 285)], fill=CORAL)
    draw.text((715, 250), "Bi-directional Sync & Epics Creation", font=fonts["small"], fill=NAVY)

    # Bottom Section: Jira Issue Lifecycle State Machine
    draw.rounded_rectangle([45, 290, 1355, 760], radius=8, fill=CARD_BG, outline=BORDER_COL, width=2)
    draw.rectangle([45, 290, 1355, 325], fill=NAVY)
    draw.text((65, 300), "JIRA AGILE DELIVERY STATE MACHINE (Standard Issue Lifecycle: Story / Task / Bug)", font=fonts["h1"], fill=(255, 255, 255))

    states = [
        ("1. BACKLOG", "Groomed, prioritized by Product Owner", SLATE, (241, 245, 249)),
        ("2. READY FOR DEV", "DoR satisfied, PRD linked, story pointed", PURPLE, (245, 243, 255)),
        ("3. IN PROGRESS", "Branch created: feature/BLYNT-XX", NAVY, (238, 242, 249)),
        ("4. CODE REVIEW", "Pull Request opened, CI running (26 suites)", AMBER, (254, 243, 199)),
        ("5. QA / TESTING", "Merged to Staging, QA test matrix verified", CORAL, (255, 241, 238)),
        ("6. DONE / RELEASED", "Deployed to Production, DoD verified", EMERALD, (236, 253, 245)),
    ]

    s_x = 65
    s_w = 195
    s_h = 130
    s_y = 350
    spacing = 215

    for idx, (s_title, s_desc, border_c, bg_c) in enumerate(states):
        draw.rounded_rectangle([s_x, s_y, s_x + s_w, s_y + s_h], radius=6, fill=bg_c, outline=border_c, width=2)
        draw.text((s_x + 12, s_y + 14), s_title, font=fonts["body_bold"], fill=border_c)
        draw.text((s_x + 12, s_y + 45), s_desc, font=fonts["small"], fill=TEXT_DARK)

        # Arrow to next state
        if idx < len(states) - 1:
            arrow_start = (s_x + s_w, s_y + s_h // 2)
            arrow_end = (s_x + spacing, s_y + s_h // 2)
            draw.line([arrow_start, arrow_end], fill=BORDER_COL, width=2)
            draw.polygon([(arrow_end[0] - 6, arrow_end[1] - 4), (arrow_end[0] - 6, arrow_end[1] + 4), arrow_end], fill=SLATE)

        s_x += spacing

    # Quality Gate Indicators (Below States)
    draw.rounded_rectangle([65, 510, 1335, 730], radius=6, fill=LIGHT_BG, outline=BORDER_COL, width=1)
    draw.text((85, 525), "AUTOMATED GATEKEEPERS & DEFINITION OF DONE (DoD) CRITERIA:", font=fonts["body_bold"], fill=NAVY)

    gates = [
        ("• Definition of Ready (DoR):", "User story has clear acceptance criteria, Gherkin scenarios, Confluence PRD link, and story point estimate (Fibonacci)."),
        ("• Development Gate:", "Branch named `feature/BLYNT-123-title`. Commits include Jira key `[BLYNT-123]`. Zero direct commits to main."),
        ("• Pull Request Gate:", "Requires 2 Senior Engineer approvals. GitHub Actions automated pipeline passes: lint, typecheck, and all 26 test suites (127 tests)."),
        ("• Definition of Done (DoD):", "Code deployed to Staging, QA verification matrix passed, documentation updated in Confluence, release notes logged."),
        ("• Incident / Hotfix Protocol:", "SEV-1/SEV-2 bugs trigger automated PagerDuty alert, immediate Slack channel `#war-room-blynt`, and post-mortem template in Confluence."),
    ]

    g_y = 555
    for lbl, desc in gates:
        draw.text((85, g_y), lbl, font=fonts["body_bold"], fill=CORAL)
        draw.text((310, g_y), desc, font=fonts["body"], fill=TEXT_DARK)
        g_y += 34

    out_path = os.path.join(DIAGRAMS_DIR, "figure_jira_confluence_workflow.png")
    img.save(out_path)
    print("Saved Jira & Confluence workflow diagram:", out_path)

if __name__ == "__main__":
    generate_workflow_diagram()
