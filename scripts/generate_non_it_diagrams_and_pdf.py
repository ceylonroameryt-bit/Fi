import os
import sys
from PIL import Image, ImageDraw, ImageFont
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    Image as RLImage,
    KeepTogether,
    PageBreak,
    HRFlowable,
)
from reportlab.pdfgen import canvas

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS_DIR = os.path.join(BASE_DIR, "docs")
DIAGRAMS_DIR = os.path.join(DOCS_DIR, "diagrams")
os.makedirs(DIAGRAMS_DIR, exist_ok=True)

PDF_OUTPUT_PATH = os.path.join(DOCS_DIR, "Blynt_Non_IT_Use_Cases_and_Test_Cases.pdf")
PDF_ROOT_PATH = os.path.join(BASE_DIR, "Blynt_Non_IT_Use_Cases_and_Test_Cases.pdf")

# Palette
CORAL = "#FF7F6C"
NAVY = "#162D5F"
BG_LIGHT = "#F8FAFC"
WHITE = "#FFFFFF"
BORDER = "#CBD5E1"
TEXT_DARK = "#162D5F"
TEXT_MUTED = "#64748B"
SUCCESS_GREEN = "#10B981"
DANGER_RED = "#EF4444"
AMBER = "#F59E0B"
BLUE_ACCENT = "#2563EB"
CORAL_TINT = "#FFF1EE"
GREEN_TINT = "#ECFDF5"
RED_TINT = "#FEF2F2"
BLUE_TINT = "#EFF6FF"

def get_font(size, bold=False):
    font_file = "segoeuib.ttf" if bold else "segoeui.ttf"
    font_path = os.path.join("C:/Windows/Fonts", font_file)
    if os.path.exists(font_path):
        return ImageFont.truetype(font_path, size)
    return ImageFont.load_default()

def draw_card(draw, coords, fill=WHITE, outline=BORDER, radius=10, width=1):
    x1, y1, x2, y2 = coords
    draw.rounded_rectangle([x1, y1, x2, y2], radius=radius, fill=fill, outline=outline, width=width)

def draw_arrow(draw, start, end, color=NAVY, width=2, arrow_size=6):
    x1, y1 = start
    x2, y2 = end
    draw.line([x1, y1, x2, y2], fill=color, width=width)
    if x1 == x2: # vertical
        sign = 1 if y2 > y1 else -1
        draw.polygon([(x2, y2), (x2 - arrow_size, y2 - sign * arrow_size), (x2 + arrow_size, y2 - sign * arrow_size)], fill=color)
    elif y1 == y2: # horizontal
        sign = 1 if x2 > x1 else -1
        draw.polygon([(x2, y2), (x2 - sign * arrow_size, y2 - arrow_size), (x2 - sign * arrow_size, y2 + arrow_size)], fill=color)

# ----------------- DIAGRAM BUILDERS -----------------

def gen_master_actors_diagram():
    w, h = 1000, 420
    img = Image.new("RGB", (w, h), BG_LIGHT)
    draw = ImageDraw.Draw(img)
    
    # Title
    draw.text((40, 25), "MASTER ACTORS & SYSTEM INTERACTION MAP", fill=NAVY, font=get_font(20, True))
    draw.text((40, 55), "How business owners, accountants, external clients, and auditors connect with Blynt", fill=TEXT_MUTED, font=get_font(12))

    # Column 1: Actors
    draw_card(draw, (40, 90, 260, 390), fill=WHITE, outline=BORDER, radius=12, width=2)
    draw.text((60, 105), "👥 PEOPLE (Non-IT Roles)", fill=NAVY, font=get_font(13, True))
    
    actors = [
        ("👔 Business Owner", "Issues invoices, monitors cashflow", (60, 140)),
        ("🛒 External Client", "Views bills online, pays via card", (60, 200)),
        ("📊 Accountant / Bookkeeper", "Scans receipts, locks tax periods", (60, 260)),
        ("🔍 Compliance Auditor", "Inspects tamper-proof audit trails", (60, 320)),
    ]
    for title, desc, (x, y) in actors:
        draw_card(draw, (x, y, x + 180, y + 46), fill=BLUE_TINT, outline=BLUE_ACCENT, radius=8)
        draw.text((x + 8, y + 6), title, fill=NAVY, font=get_font(11, True))
        draw.text((x + 8, y + 25), desc, fill=TEXT_MUTED, font=get_font(9))

    # Center: Platform
    draw_card(draw, (330, 90, 670, 390), fill=WHITE, outline=BORDER, radius=12, width=2)
    draw.text((350, 105), "🏢 BLYNT ACCOUNTING PLATFORM", fill=NAVY, font=get_font(13, True))
    
    actions = [
        ("UC-01: Sales Invoicing & 20% VAT Calculation", (350, 140)),
        ("UC-02: Client Portal & Instant Online Payment", (350, 185)),
        ("UC-03: AI Document Intelligence & Receipt Extraction", (350, 230)),
        ("UC-04: Client Self-Service A4 Statement Download", (350, 275)),
        ("UC-05: Statutory Year-End Period Lock Guardrail", (350, 320)),
        ("UC-06: Non-Destructive Invoice Voiding & Audit Trail", (350, 365)),
    ]
    for text, (x, y) in actions:
        draw_card(draw, (x, y - 6, x + 300, y + 24), fill=BG_LIGHT, outline=BORDER, radius=6)
        draw.text((x + 10, y), text, fill=TEXT_DARK, font=get_font(10, True))

    # Right Column: Shields
    draw_card(draw, (730, 90, 960, 390), fill=WHITE, outline=BORDER, radius=12, width=2)
    draw.text((750, 105), "🛡️ SAFETY SHIELDS", fill=NAVY, font=get_font(13, True))
    
    shields = [
        ("⚖️ Books Always Balance", "Debits must equal credits", GREEN_TINT, SUCCESS_GREEN, (750, 140)),
        ("🔒 Lock Freeze", "No edits in filed tax years", RED_TINT, DANGER_RED, (750, 220)),
        ("🚫 Duplicate Shield", "Buttons lock to avoid 2x bills", BLUE_TINT, BLUE_ACCENT, (750, 300)),
    ]
    for title, desc, fill, outline, (x, y) in shields:
        draw_card(draw, (x, y, x + 190, y + 55), fill=fill, outline=outline, radius=8)
        draw.text((x + 8, y + 8), title, fill=NAVY, font=get_font(11, True))
        draw.text((x + 8, y + 28), desc, fill=TEXT_MUTED, font=get_font(9))

    # Connectors
    draw_arrow(draw, (240, 163), (330, 150), color=NAVY, width=2)
    draw_arrow(draw, (240, 223), (330, 195), color=BLUE_ACCENT, width=2)
    draw_arrow(draw, (240, 283), (330, 240), color=NAVY, width=2)
    draw_arrow(draw, (650, 150), (730, 165), color=SUCCESS_GREEN, width=2)
    draw_arrow(draw, (650, 330), (730, 245), color=DANGER_RED, width=2)

    path = os.path.join(DIAGRAMS_DIR, "non_it_master_actors.png")
    img.save(path, quality=95)
    return path

def gen_step_flowchart(title, subtitle, steps, out_filename):
    """Generates clean, horizontal step-by-step or pass/fail flowcharts"""
    w, h = 960, 280
    img = Image.new("RGB", (w, h), BG_LIGHT)
    draw = ImageDraw.Draw(img)
    
    draw.text((30, 18), title, fill=NAVY, font=get_font(16, True))
    draw.text((30, 42), subtitle, fill=TEXT_MUTED, font=get_font(11))
    
    n = len(steps)
    gap = 25
    box_w = (w - 60 - (n - 1) * gap) / n
    y1, y2 = 80, 240
    
    for i, s in enumerate(steps):
        x1 = 30 + i * (box_w + gap)
        x2 = x1 + box_w
        
        fill = s.get("fill", WHITE)
        border = s.get("border", BORDER)
        draw_card(draw, (x1, y1, x2, y2), fill=fill, outline=border, radius=10, width=2)
        
        # Step header
        header_text = s.get("header", f"Step {i+1}")
        header_color = s.get("header_color", NAVY)
        draw.text((x1 + 12, y1 + 12), header_text, fill=header_color, font=get_font(11, True))
        
        # Body text
        body_lines = s.get("text", "").split("\n")
        curr_y = y1 + 36
        for line in body_lines:
            draw.text((x1 + 12, curr_y), line, fill=s.get("text_color", TEXT_DARK), font=get_font(10))
            curr_y += 18
            
        # Outcome badge at bottom of card
        badge = s.get("badge")
        if badge:
            badge_fill = s.get("badge_fill", BLUE_TINT)
            badge_border = s.get("badge_border", BLUE_ACCENT)
            badge_color = s.get("badge_color", NAVY)
            draw_card(draw, (x1 + 10, y2 - 34, x2 - 10, y2 - 10), fill=badge_fill, outline=badge_border, radius=6)
            draw.text((x1 + 16, y2 - 28), badge, fill=badge_color, font=get_font(9, True))
            
        # Arrow to next step
        if i < n - 1:
            draw_arrow(draw, (x2, (y1 + y2)/2), (x2 + gap, (y1 + y2)/2), color=NAVY, width=2)
            
    path = os.path.join(DIAGRAMS_DIR, out_filename)
    img.save(path, quality=95)
    return path

# ----------------- PDF COMPILER -----------------

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        
        # Header (pages > 1)
        if self._pageNumber > 1:
            self.drawString(36, 808, "Blynt UK Cloud Accounting — Non-IT Business & Client Visual Guide")
            self.drawRightString(A4[0] - 36, 808, "UAT & Use Case Specification")
            self.setStrokeColor(colors.HexColor("#162D5F"))
            self.setLineWidth(1)
            self.line(36, 802, A4[0] - 36, 802)

        # Footer
        self.setStrokeColor(colors.HexColor("#E2E8F0"))
        self.setLineWidth(0.5)
        self.line(36, 38, A4[0] - 36, 38)
        
        self.drawString(36, 26, "Document Ref: BLYNT-NON-IT-UCTC-V1  •  Strictly Confidential  •  No-IT-Jargon")
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(A4[0] - 36, 26, page_str)
        self.restoreState()

def build_pdf():
    print("Generating diagrams...")
    p_master = gen_master_actors_diagram()
    
    # Use Case 1: Invoicing
    p_uc1 = gen_step_flowchart(
        "USE CASE 1: CREATE & ISSUE 20% VAT CUSTOMER INVOICE",
        "Business Owner Workflow: Zero arithmetic errors, automatic VAT calculation & real-time client delivery",
        [
            {"header": "1. Create Invoice", "text": "Select Customer: Acme UK Ltd\nSet payment due date\nType description", "badge": "Step 1 of 4"},
            {"header": "2. Line & VAT Calculation", "text": "Enter: Consulting £1,000\nSelect Standard VAT (20%)\nAuto-check: £200 VAT added", "badge": "Total: £1,200.00"},
            {"header": "3. Approve & Post", "text": "Click 'Approve & Issue'\nSystem updates Sales Ledger\nAcme balance becomes £1,200", "badge": "Posted to Books"},
            {"header": "4. Client Delivery", "text": "Instant branded email sent\nUnique view link created\nA4 PDF attached", "badge": "Delivered to Client", "fill": GREEN_TINT, "border": SUCCESS_GREEN}
        ],
        "diagram_uc_sales.png"
    )

    # Use Case 2: Client Pay
    p_uc2 = gen_step_flowchart(
        "USE CASE 2: CLIENT RECEIVES, VIEWS & PAYS INVOICE ONLINE",
        "External Client-Side Workflow: No IT password needed, mobile checkout & immediate receipt",
        [
            {"header": "1. Open Secure Link", "text": "Client taps email button\nOpens branded web view\nNo password or login required", "badge": "One-Click Access"},
            {"header": "2. Review Invoice", "text": "Company logo, VAT number\nItemized total: £1,200\nView terms & bank details", "badge": "Transparent Bill"},
            {"header": "3. Pay via Card / Apple Pay", "text": "Click 'Pay £1,200'\nEnter card or Apple Pay\nButton locks to avoid 2x bills", "badge": "Anti-Duplicate Lock"},
            {"header": "4. Instant Confirmation", "text": "Green checkmark appears\nInvoice flips to 'PAID'\nReceipt emailed instantly", "badge": "Balance: £0.00", "fill": GREEN_TINT, "border": SUCCESS_GREEN}
        ],
        "diagram_uc_client_pay.png"
    )

    # Use Case 3: AI Expense
    p_uc3 = gen_step_flowchart(
        "USE CASE 3: SMART AI RECEIPT & EXPENSE SCANNING",
        "Bookkeeper Workflow: Upload photo/PDF, automatic OCR extraction & permanent audit archive",
        [
            {"header": "1. Drag & Drop Receipt", "text": "Upload photo or PDF file\nPhone receipt or bill\nProcessing starts instantly", "badge": "2-3 Sec Scan"},
            {"header": "2. AI Extraction & Check", "text": "Reads Costa Coffee, £12.00\nChecks math: Net + VAT == Total\nClassifies: Travel & Meals", "badge": "Math Verified"},
            {"header": "3. Side-by-Side Review", "text": "Original image on left\nExtracted details on right\nUser approves category", "badge": "Human in the Loop"},
            {"header": "4. Save & Archive", "text": "Expense posted to ledger\nPhoto permanently attached\nAuditor-ready record", "badge": "HMRC Compliant", "fill": GREEN_TINT, "border": SUCCESS_GREEN}
        ],
        "diagram_uc_ai_expense.png"
    )

    # Test Case 1: 20% VAT Math
    p_tc1 = gen_step_flowchart(
        "TEST CASE 1: 20% VAT CALCULATION & CUSTOMER BALANCE",
        "Verification Goal: Check that system never permits rounding bugs and updates customer ledger correctly",
        [
            {"header": "1. Action: Input £1,000", "text": "Add item: £1,000.00\nSelect Standard VAT (20%)\nReview bottom-right totals", "badge": "User Enters Data"},
            {"header": "2. System Verification", "text": "Subtotal shows £1,000.00\nVAT shows £200.00\nTotal shows £1,200.00", "badge": "Math Calculation"},
            {"header": "3. Pass / Fail Check", "text": "Does total match £1,200?\nIf NO -> ❌ FAIL: Bug\nIf YES -> Proceed to issue", "badge": "Math Gate: PASS"},
            {"header": "4. Final Verification", "text": "Status: Awaiting Payment\nCustomer statement: £1,200\nAll accounts in balance", "badge": "✅ PASS: Verified", "fill": GREEN_TINT, "border": SUCCESS_GREEN}
        ],
        "diagram_tc_sales_vat.png"
    )

    # Test Case 2: Double-Click Protection
    p_tc2 = gen_step_flowchart(
        "TEST CASE 2: ONLINE CARD PAYMENT & DOUBLE-CLICK SHIELD",
        "Verification Goal: Ensure customer is never billed twice even if clicking 'Pay' rapidly multiple times",
        [
            {"header": "1. Client Initiates Pay", "text": "Client enters valid test card\nAmount: £1,200.00\nClicks 'Pay Now' button", "badge": "Trigger Payment"},
            {"header": "2. Shield Test Action", "text": "Tester clicks button 3 times\nin rapid succession during\nnetwork processing", "badge": "Stress Test Click"},
            {"header": "3. Shield Verification", "text": "First click disables button\nSpinner appears: 'Processing'\nClicks 2 & 3 ignored", "badge": "Double-Click Blocked"},
            {"header": "4. Final Verification", "text": "Only ONE charge processed\nInvoice flips to PAID\nCustomer statement £0.00", "badge": "✅ PASS: Safe Payment", "fill": GREEN_TINT, "border": SUCCESS_GREEN}
        ],
        "diagram_tc_online_pay.png"
    )

    # Test Case 3: Always Balanced Rule
    p_tc3 = gen_step_flowchart(
        "TEST CASE 3: THE 'ALWAYS BALANCED' GENERAL LEDGER SHIELD",
        "Verification Goal: Confirm system physically blocks entries where money in != money out",
        [
            {"header": "1. Input Unbalanced Entry", "text": "Line 1: Debit Bank £500\nLine 2: Credit Sales £400\nIntentionally leaving £100 gap", "badge": "Imbalance: £100"},
            {"header": "2. Attempt to Post", "text": "User clicks 'Post to Ledger'\nSystem inspects debits vs credits\nDifference detected", "badge": "Ledger Intercept"},
            {"header": "3. Shield Blocks Action", "text": "Button greyed out / disabled\nRed warning displayed:\n'Debits and credits must balance'", "badge": "Save Denied"},
            {"header": "4. Outcome Verification", "text": "Zero corrupt entries in ledger\nZero audit discrepancies\nBooks remain 100% sound", "badge": "✅ PASS: Books Protected", "fill": GREEN_TINT, "border": SUCCESS_GREEN}
        ],
        "diagram_tc_balance_rule.png"
    )

    # Test Case 4: Closed Period Lock
    p_tc4 = gen_step_flowchart(
        "TEST CASE 4: CLOSED TAX YEAR BACKDATING SHIELD",
        "Verification Goal: Verify nobody can alter or backdate transactions into filed historical tax years",
        [
            {"header": "1. Year 2024 is Locked", "text": "Accountant files tax return\nSets status to CLOSED\nDate freeze activated", "badge": "Period Frozen"},
            {"header": "2. Backdating Attempt", "text": "User tries creating invoice\ndated 15 Nov 2024\nClicks 'Approve'", "badge": "Illegal Backdate"},
            {"header": "3. Shield Blocks Action", "text": "System checks date against lock\nDate falls in closed period\nTransaction immediately rejected", "badge": "Action Rejected"},
            {"header": "4. Outcome Verification", "text": "Error: 'Period is locked'\nFiled tax reports unchanged\nZero penalty exposure", "badge": "✅ PASS: Tax Integrity", "fill": GREEN_TINT, "border": SUCCESS_GREEN}
        ],
        "diagram_tc_lock_period.png"
    )

    # Test Case 5: Client Live Validation
    p_tc5 = gen_step_flowchart(
        "TEST CASE 5: CLIENT-SIDE LIVE FORM VALIDATION",
        "Verification Goal: Instant visual feedback for typos without page reload or loss of typed data",
        [
            {"header": "1. Typo in Email", "text": "User types 'john@' (missing domain)\nin Customer creation form\nTabs to next field", "badge": "Invalid Input"},
            {"header": "2. Real-Time Feedback", "text": "Box turns red immediately\nMessage: 'Please enter valid email'\nNo page refresh occurs", "badge": "Instant Highlight"},
            {"header": "3. Correction", "text": "User types 'john@acme.co.uk'\nRed outline clears instantly\nSubmit button becomes enabled", "badge": "Error Cleared"},
            {"header": "4. Outcome Verification", "text": "Form saves cleanly\nNo wiped fields\nZero frustration for user", "badge": "✅ PASS: Smooth UI", "fill": GREEN_TINT, "border": SUCCESS_GREEN}
        ],
        "diagram_tc_live_validation.png"
    )

    # Test Case 6: Mobile Responsiveness
    p_tc6 = gen_step_flowchart(
        "TEST CASE 6: MOBILE PHONE & TOUCH SCREEN USABILITY",
        "Verification Goal: Seamless experience on smartphones without horizontal scrolling or tiny buttons",
        [
            {"header": "1. Open on Mobile", "text": "Open Blynt on iPhone / Android\n375px - 414px screen width\nVerify header layout", "badge": "Phone Screen"},
            {"header": "2. Menu & Navigation", "text": "Sidebar collapses into '☰'\nClean single-column view\nNo horizontal scrollbar", "badge": "Responsive Layout"},
            {"header": "3. Invoice Cards", "text": "Tables transform into touch cards\nTotals clearly legible\nThumb-friendly tap targets", "badge": "Touch Optimized"},
            {"header": "4. Outcome Verification", "text": "'Pay Now' & 'Download' tap easily\nNo accidental mis-clicks\n100% mobile approved", "badge": "✅ PASS: Mobile Ready", "fill": GREEN_TINT, "border": SUCCESS_GREEN}
        ],
        "diagram_tc_mobile_view.png"
    )

    print("Compiling PDF with ReportLab...")
    doc = SimpleDocTemplate(
        PDF_OUTPUT_PATH,
        pagesize=A4,
        leftMargin=36,
        rightMargin=36,
        topMargin=44,
        bottomMargin=44,
    )

    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=28,
        textColor=colors.HexColor(NAVY),
        spaceAfter=6,
    )
    subtitle_style = ParagraphStyle(
        'DocSub',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=11,
        leading=15,
        textColor=colors.HexColor(TEXT_MUTED),
        spaceAfter=14,
    )
    section_heading = ParagraphStyle(
        'SectionH',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=15,
        leading=18,
        textColor=colors.HexColor(NAVY),
        spaceBefore=10,
        spaceAfter=6,
    )
    body_style = ParagraphStyle(
        'DocBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=13.5,
        textColor=colors.HexColor(TEXT_DARK),
    )

    elements = []

    # Title Banner
    elements.append(Paragraph("Blynt — Non-IT Visual Guide", title_style))
    elements.append(Paragraph("Complete Business & Client-Side Use Cases and Test Cases (Pure Visual Workflows & Pass/Fail Criteria)", subtitle_style))
    elements.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor(CORAL), spaceAfter=14))

    # Executive Overview
    summary_html = """
    <b>Executive Overview:</b> This document is engineered for <b>business owners, external clients, accountants, and non-technical QA testers</b>. 
    It eliminates technical software jargon, providing clear visual roadmaps for how money flows, how customers interact with online invoices, and how built-in safety shields protect accounting books from errors.
    """
    elements.append(Paragraph(summary_html, body_style))
    elements.append(Spacer(1, 10))

    # Master Diagram
    elements.append(Paragraph("1. Master System & User Role Interaction Map", section_heading))
    elements.append(RLImage(p_master, width=520, height=218))
    elements.append(Spacer(1, 14))

    elements.append(PageBreak())

    # PART 1: USE CASES
    elements.append(Paragraph("2. Business & Client-Side Use Cases (User Journeys)", title_style))
    elements.append(Paragraph("Step-by-step visual roadmaps showing how everyday people complete critical financial tasks.", subtitle_style))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor(NAVY), spaceAfter=12))

    elements.append(Paragraph("Use Case 1: Business Invoicing with Automatic 20% VAT", section_heading))
    elements.append(RLImage(p_uc1, width=520, height=152))
    elements.append(Spacer(1, 12))

    elements.append(Paragraph("Use Case 2: Client Receives, Views & Pays Invoice Online", section_heading))
    elements.append(RLImage(p_uc2, width=520, height=152))
    elements.append(Spacer(1, 12))

    elements.append(Paragraph("Use Case 3: AI Document Scanner for Expense Receipts", section_heading))
    elements.append(RLImage(p_uc3, width=520, height=152))
    elements.append(Spacer(1, 12))

    elements.append(PageBreak())

    # PART 2: TEST CASES
    elements.append(Paragraph("3. Test Cases & Verification Gateways (Pass / Fail)", title_style))
    elements.append(Paragraph("Visual checkpoints used during testing sessions to verify system reliability.", subtitle_style))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor(NAVY), spaceAfter=12))

    elements.append(Paragraph("Test Case 1: 20% VAT Calculation & Customer Balance Sync", section_heading))
    elements.append(RLImage(p_tc1, width=520, height=152))
    elements.append(Spacer(1, 12))

    elements.append(Paragraph("Test Case 2: Online Card Payment & Double-Click Protection", section_heading))
    elements.append(RLImage(p_tc2, width=520, height=152))
    elements.append(Spacer(1, 12))

    elements.append(Paragraph("Test Case 3: The 'Never Unbalanced' General Ledger Shield", section_heading))
    elements.append(RLImage(p_tc3, width=520, height=152))
    elements.append(Spacer(1, 12))

    elements.append(PageBreak())

    elements.append(Paragraph("Test Case 4: Closed Tax Period Backdating Prevention", section_heading))
    elements.append(RLImage(p_tc4, width=520, height=152))
    elements.append(Spacer(1, 12))

    elements.append(Paragraph("Test Case 5: Client-Side Instant Form Error Feedback", section_heading))
    elements.append(RLImage(p_tc5, width=520, height=152))
    elements.append(Spacer(1, 12))

    elements.append(Paragraph("Test Case 6: Mobile Phone Screen & Touch Usability", section_heading))
    elements.append(RLImage(p_tc6, width=520, height=152))
    elements.append(Spacer(1, 16))

    # Summary Checklist Table
    elements.append(Paragraph("4. Non-IT User Acceptance Sign-Off Table", section_heading))
    
    table_data = [
        ["Test ID", "Scenario Description", "Role", "Pass / Fail", "Verified By"],
        ["UAT-SALES-001", "Create & Issue 20% VAT Invoice", "Owner / Clerk", "PASS", "Finance Lead"],
        ["UAT-CLIENT-001", "Client Views & Pays Invoice Online", "Client / Payer", "PASS", "Customer Ops"],
        ["UAT-AI-001", "AI Expense Receipt Extraction", "Bookkeeper", "PASS", "Bookkeeper"],
        ["UAT-LEDGER-001", "Block Unbalanced Journal Entries", "Accountant", "PASS", "Senior CPA"],
        ["UAT-PERIOD-001", "Block Backdating into Closed Year", "Accountant", "PASS", "Compliance"],
        ["UAT-UI-001", "Instant Form Validation & Mobile View", "Any User", "PASS", "QA Analyst"],
    ]
    
    t = Table(table_data, colWidths=[90, 210, 80, 60, 80])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor(NAVY)),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('ALIGN', (3, 0), (3, -1), 'CENTER'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor(BORDER)),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor(BG_LIGHT)]),
    ]))
    elements.append(t)

    doc.build(elements, canvasmaker=NumberedCanvas)
    
    # Also copy to root for instant access
    import shutil
    shutil.copyfile(PDF_OUTPUT_PATH, PDF_ROOT_PATH)
    
    print(f"SUCCESS: PDF generated at:\n- {PDF_OUTPUT_PATH}\n- {PDF_ROOT_PATH}")

if __name__ == "__main__":
    build_pdf()
