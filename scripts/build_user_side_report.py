import os
import sys
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Image as RLImage,
    PageBreak,
    HRFlowable,
    Table,
    TableStyle
)
from reportlab.pdfgen import canvas
from PIL import Image, ImageDraw, ImageFont

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS_DIR = os.path.join(BASE_DIR, "docs")
USER_DIAGRAMS_DIR = os.path.join(DOCS_DIR, "diagrams", "user_side")
os.makedirs(USER_DIAGRAMS_DIR, exist_ok=True)

NAVY = "#162D5F"
CORAL = "#FF7F6C"
TEXT_MUTED = "#64748B"
TEXT_DARK = "#1E293B"
BG_LIGHT = "#F8FAFC"
BORDER = "#CBD5E1"
SUCCESS_GREEN = "#10B981"
DANGER_RED = "#EF4444"
LINE_RED = "#EF4444"
WHITE = "#FFFFFF"


def get_font(size, bold=False):
    font_file = "segoeuib.ttf" if bold else "segoeui.ttf"
    font_path = os.path.join("C:/Windows/Fonts", font_file)
    if os.path.exists(font_path):
        return ImageFont.truetype(font_path, size)
    return ImageFont.load_default()

def draw_user_diagram(title, steps, final_success, error_guide, out_filename):
    """
    Renders an exact, non-technical, human-friendly flowchart:
    - User Action cards descending vertically
    - Green terminal box showing the positive business result
    - Red terminal box showing the friendly warning and how to fix it
    - Clear orthogonal red lines with 'Mistake / Issue' branch
    """
    num_steps = len(steps)
    y_step = 58
    w = 660
    h = 70 + (num_steps + 1) * y_step + 30
    
    img = Image.new("RGB", (w, h), WHITE)
    draw = ImageDraw.Draw(img)
    
    cx = 230
    box_w = 220
    box_h = 34
    
    y = 45
    step_positions = []
    
    # Title
    font_title = get_font(12, True)
    draw.text((30, 15), title, fill=NAVY, font=font_title)
    
    for i, s in enumerate(steps):
        # Draw step card
        x1, y1, x2, y2 = cx - box_w/2, y - box_h/2, cx + box_w/2, y + box_h/2
        draw.rounded_rectangle([int(x1), int(y1), int(x2), int(y2)], radius=8, fill=WHITE, outline=BORDER, width=1)
        
        font_s = get_font(9.5, False)
        bbox = font_s.getbbox(s)
        lw = bbox[2] - bbox[0]
        draw.text((int(cx - lw/2), int(y - 6)), s, fill=TEXT_DARK, font=font_s)
        
        step_positions.append((cx + box_w/2, y))
        next_y = y + y_step
        
        # Draw connector arrow
        draw.line([cx, y + box_h/2, cx, next_y - box_h/2], fill="#334155", width=2)
        draw.polygon([(cx, next_y - box_h/2), (cx - 4, next_y - box_h/2 - 6), (cx + 4, next_y - box_h/2 - 6)], fill="#334155")
        
        y = next_y
        
    # Success box (Green)
    x1, y1, x2, y2 = cx - box_w/2, y - box_h/2, cx + box_w/2, y + box_h/2
    draw.rounded_rectangle([int(x1), int(y1), int(x2), int(y2)], radius=8, fill="#ECFDF5", outline=SUCCESS_GREEN, width=2)
    font_succ = get_font(9.5, True)
    bbox = font_succ.getbbox(final_success)
    lw = bbox[2] - bbox[0]
    draw.text((int(cx - lw/2), int(y - 6)), final_success, fill="#065F46", font=font_succ)
    
    # Friendly Error box (Red)
    err_x = 490
    err_y = y
    err_w = 210
    err_h = 40
    ex1, ey1, ex2, ey2 = err_x - err_w/2, err_y - err_h/2, err_x + err_w/2, err_y + err_h/2
    draw.rounded_rectangle([int(ex1), int(ey1), int(ex2), int(ey2)], radius=8, fill="#FEF2F2", outline=DANGER_RED, width=2)
    
    font_err = get_font(8.5, False)
    lines = error_guide.split("\n")
    tot_h = len(lines) * 12
    sy = err_y - tot_h/2 + 1
    for li, line in enumerate(lines):
        bbox = font_err.getbbox(line)
        lw = bbox[2] - bbox[0]
        draw.text((int(err_x - lw/2), int(sy + li * 12)), line, fill="#991B1B", font=font_err)
        
    # Orthogonal red lines
    num_branches = len(step_positions)
    max_right = w - 30
    min_right = cx + box_w/2 + 25
    step_offset = (max_right - min_right) / max(1, num_branches - 1) if num_branches > 1 else 0
    
    for idx, (px, py) in enumerate(step_positions):
        mid_x = max_right - idx * step_offset
        target_x = err_x - err_w/2 + 15 + idx * ((err_w - 30) / max(1, num_branches - 1))
        
        draw.line([px, py, mid_x, py], fill=LINE_RED, width=1)
        draw.line([mid_x, py, mid_x, err_y - 20], fill=LINE_RED, width=1)
        draw.line([mid_x, err_y - 20, target_x, err_y - 20], fill=LINE_RED, width=1)
        draw.polygon([(target_x, err_y - 20), (target_x - 3, err_y - 26), (target_x + 3, err_y - 26)], fill=LINE_RED)
        
        if idx == 0:
            font_fail = get_font(9, True)
            draw.text((mid_x + 4, py + (err_y - py)/2), "If error", fill=LINE_RED, font=font_fail)
            
    out_path = os.path.join(USER_DIAGRAMS_DIR, out_filename)
    img.save(out_path, quality=95)
    return out_path

class UserReportCanvas(canvas.Canvas):
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
        
        if self._pageNumber > 1:
            self.drawString(36, 810, "Blynt Cloud Accounting — Non-Technical User Experience & Operations Guide")
            self.drawRightString(A4[0] - 36, 810, "User-Side Operating Manual")
            self.setStrokeColor(colors.HexColor("#162D5F"))
            self.setLineWidth(1)
            self.line(36, 804, A4[0] - 36, 804)

        self.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.setLineWidth(0.5)
        self.line(36, 32, A4[0] - 36, 32)
        
        self.drawString(36, 22, "Designed for Business Owners, Office Managers & Clients  •  Plain English Guide")
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(A4[0] - 36, 22, page_str)
        self.restoreState()

# 12 KEY USER-SIDE OPERATIONAL JOURNEYS
USER_JOURNEYS = [
    {
        "num": 1,
        "title": "Creating and Sending a Customer Invoice",
        "actor": "Business Owner / Office Administrator",
        "story": "You want to invoice a customer for work completed, ensure UK VAT (20%) is calculated accurately, and deliver a professional bill that gets paid quickly.",
        "steps": [
            "1. Click 'Sales' ➔ '+ New Invoice'",
            "2. Pick Customer (e.g. Acme UK Ltd)",
            "3. Enter Services & Price (£1,000)",
            "4. Select 'Standard 20% VAT'",
            "5. Click 'Approve & Issue Invoice'"
        ],
        "final": "Invoice Sent & Customer Balance Updated",
        "error": "Friendly Warning:\n'Please check line price or\nselect customer before issuing'",
        "diagram": "user_journey_01_invoice.png",
        "screen_experience": "You see a clean, modern form. As soon as you type £1,000 and select 20% VAT, the box at the bottom instantly displays: Subtotal £1,000.00 + VAT £200.00 = Total to Pay £1,200.00. Clicking 'Approve & Issue' immediately sends a branded email to your customer with a secure viewing link and attached PDF.",
        "behind_scenes": "Blynt checks that the customer is active, verifies your math to the exact penny, updates your company's revenue ledger, and sets the customer's balance to £1,200 without requiring spreadsheet formulas.",
        "if_mistake": "If you forget to enter a price or quantity, the empty box turns red with a helpful message: 'Please enter an item price.' The invoice remains safely on screen without erasing your typing."
    },
    {
        "num": 2,
        "title": "How Your Customer Opens and Pays Online",
        "actor": "External Client / Customer (The Payer)",
        "story": "Your customer receives your invoice email and wants to pay you immediately on their phone or computer using a credit card or Apple Pay without needing a password.",
        "steps": [
            "1. Customer taps 'View Invoice' in email",
            "2. Clean bill opens with company logo",
            "3. Customer clicks 'Pay £1,200.00'",
            "4. Enters Card details or uses Apple Pay",
            "5. Green checkmark: 'Payment Successful!'"
        ],
        "final": "Invoice Marked PAID & Receipt Emailed",
        "error": "Card Declined Tip:\n'Bank declined card. Please\ntry another card or bank wire'",
        "diagram": "user_journey_02_client_pay.png",
        "screen_experience": "Your customer taps the link on their iPhone, Android, or laptop. The invoice opens instantly displaying your logo, company details, itemized breakdown, and bank details. Tapping 'Pay Now' opens a secure card checkout. Within 2 seconds of paying, the screen shows a green checkmark and emails them a receipt.",
        "behind_scenes": "Blynt connects securely to the card network, confirms the money has cleared, immediately marks the invoice status as green 'PAID', and updates your bank balance. An anti-duplicate shield locks the button so your client is never charged twice.",
        "if_mistake": "If their bank card has insufficient funds, a friendly message appears: 'Your card was declined by your bank. Please check your card details or try another card.' The invoice remains open so they can easily re-try."
    },
    {
        "num": 3,
        "title": "Snapping and Scanning Receipts with AI",
        "actor": "Employee / Bookkeeper on the go",
        "story": "You bought lunch or petrol for a business trip and want to record the expense and keep the receipt for tax deductions without typing numbers.",
        "steps": [
            "1. Open Blynt & tap 'Upload Receipt'",
            "2. Take photo or drag in receipt PDF",
            "3. AI reads vendor, date & total in 3s",
            "4. Review side-by-side on screen",
            "5. Tap 'Save Expense' to record"
        ],
        "final": "Expense Recorded & Photo Permanently Saved",
        "error": "Blurry Receipt Warning:\n'Some text was hard to read.\nPlease confirm the total'",
        "diagram": "user_journey_03_ai_receipt.png",
        "screen_experience": "You drop a photo of a coffee or fuel receipt into the upload box. In 2 to 3 seconds, Blynt reads the receipt and shows a split-screen: the photo on the left, and the extracted Vendor ('Costa Coffee'), Date ('12 Oct 2026'), and Total ('£12.00') on the right.",
        "behind_scenes": "Blynt's smart document engine checks that Net + VAT equals the Total. It suggests the category ('Travel & Meals') based on past receipts. When you save, the photo is permanently attached so you can throw away the paper receipt safely.",
        "if_mistake": "If the receipt is wrinkled or faded, a yellow box appears asking you to confirm: 'We could not read the total with high certainty. Please check the amount before saving.' You can type the correct total in one second."
    },
    {
        "num": 4,
        "title": "Entering Supplier Bills & Avoiding Paying Twice",
        "actor": "Bookkeeper / Office Manager",
        "story": "You received an invoice from a supplier (e.g. your IT hosting provider) and want to log it for payment while ensuring you never accidentally pay the same bill twice.",
        "steps": [
            "1. Click 'Purchases' ➔ '+ New Bill'",
            "2. Select Supplier & type their Bill No",
            "3. Enter amount and pick category",
            "4. System verifies reference is unique",
            "5. Click 'Approve Bill' for payment"
        ],
        "final": "Bill Scheduled in Accounts Payable",
        "error": "Duplicate Alert:\n'A bill with this reference\nalready exists for this vendor'",
        "diagram": "user_journey_04_supplier_bill.png",
        "screen_experience": "You open the bill entry form, pick the vendor, type their invoice reference (e.g. 'INV-8891'), and enter the amount. The screen clearly displays the due date so you know exactly when cash will leave your account.",
        "behind_scenes": "Blynt checks your supplier records. If you already logged 'INV-8891' last week, the system immediately flags the duplicate, protecting you from paying the vendor twice. Once approved, the bill shows up on your payments schedule.",
        "if_mistake": "If you type an existing reference, an alert banner appears: 'Duplicate Bill: Invoice INV-8891 was already recorded on 02 Oct. Click here to view the original bill.'"
    },
    {
        "num": 5,
        "title": "Keeping the Books Balanced (The Safety Shield)",
        "actor": "Accountant / Certified Bookkeeper",
        "story": "You are recording an end-of-month adjustment and want complete peace of mind that human typing mistakes will never throw your company accounts out of balance.",
        "steps": [
            "1. Click 'Accounting' ➔ 'Manual Journals'",
            "2. Line 1: Put £500 in Debit (Bank)",
            "3. Line 2: Put £400 in Credit (leaving £100 gap)",
            "4. System detects £100 imbalance",
            "5. 'Post' button disables automatically"
        ],
        "final": "Balanced Journal Posted Successfully",
        "error": "Out of Balance Warning:\n'Debits (£500) must equal\nCredits (£400). Gap: £100'",
        "diagram": "user_journey_05_balanced_books.png",
        "screen_experience": "As you type adjusting lines into the journal table, a live indicator at the bottom compares Money In (Debits) vs Money Out (Credits). If the two sides don't match, the indicator turns red and displays: 'Out of Balance by £100.00'.",
        "behind_scenes": "Blynt acts as your financial guardian. Traditional spreadsheet bookkeeping allows accidental gaps that lead to audit penalties. Blynt's safety shield physically stops anyone from saving an entry until the math is 100% equal.",
        "if_mistake": "The 'Post to Ledger' button remains greyed out until you adjust the lines so Debits equal Credits. Once balanced, the badge turns green ('Balanced: £500.00') and the button unlocks."
    },
    {
        "num": 6,
        "title": "Connecting the Bank & 1-Click Reconciliation",
        "actor": "Business Owner / Bookkeeper",
        "story": "You want to link your business bank account, see all incoming and outgoing payments, and match them against customer invoices with a single click.",
        "steps": [
            "1. Upload Bank Statement or Feed",
            "2. View transactions in Reconciliation tab",
            "3. System finds matching invoice (£1,200)",
            "4. Green 'Match Found' card appears",
            "5. Click 'OK' to reconcile in 1 second"
        ],
        "final": "Bank Reconciled & Customer Marked Paid",
        "error": "Unmatched Transaction Tip:\n'No invoice matched. Click\nFind & Match or create rule'",
        "diagram": "user_journey_06_bank_match.png",
        "screen_experience": "Your bank transactions appear on the left side of the screen. On the right, Blynt automatically scans your unpaid invoices. When a £1,200 deposit matches an invoice for £1,200, a green card appears: 'Match: Invoice #1042 - Acme UK Ltd'. You simply click 'OK'.",
        "behind_scenes": "Blynt clears the bank transaction, updates the invoice status to PAID, and confirms that your accounting cash balance matches your real online banking balance to the penny.",
        "if_mistake": "If a customer transferred money without including their invoice reference, Blynt allows you to click 'Find & Match' to search by customer name or amount and link the payment manually in 5 seconds."
    },
    {
        "num": 7,
        "title": "Locking Past Tax Years to Protect Filed Accounts",
        "actor": "Accountant / Business Owner",
        "story": "Your accountant has filed your annual tax return with HMRC. You want to freeze past months so nobody in the company can accidentally edit or backdate receipts into closed periods.",
        "steps": [
            "1. Accountant completes year-end accounts",
            "2. Goes to 'Settings' ➔ 'Financial Years'",
            "3. Clicks 'Lock Financial Year 2024'",
            "4. System freezes all dates up to 31 Dec",
            "5. Staff tries backdating bill into 2024"
        ],
        "final": "Historical Tax Accounts Permanently Protected",
        "error": "Period Locked Notice:\n'This financial year is locked.\nCannot add entries to closed periods'",
        "diagram": "user_journey_07_lock_period.png",
        "screen_experience": "The accountant clicks 'Lock Year'. A confirmation popup warns that locking freezes the historical records. Once locked, a padlock icon appears next to 2024. If an employee later tries to date a bill in 2024, the date box displays a clear red warning.",
        "behind_scenes": "Blynt places a temporal database shield over the closed period. It stops accidental backdating that could trigger tax discrepancies or audit fines with HMRC.",
        "if_mistake": "If an official auditor adjustment is genuinely required, only the business Owner can use 'Emergency Reopen', which requires entering a formal written reason that is permanently recorded in the audit log."
    },
    {
        "num": 8,
        "title": "Cancelling Mistakes Safely (Voiding an Invoice)",
        "actor": "Business Owner / Billing Clerk",
        "story": "A customer cancelled an order after you issued an invoice. You need to cancel the invoice legally so they no longer owe money, while maintaining a proper audit paper trail.",
        "steps": [
            "1. Open unpaid invoice (e.g. £500)",
            "2. Click 'More Actions' ➔ 'Void Invoice'",
            "3. Type reason: 'Customer cancelled order'",
            "4. Click 'Confirm Void'",
            "5. Badge flips to red/grey 'VOID'"
        ],
        "final": "Customer Balance Reset to £0 & Audit Kept",
        "error": "Already Paid Alert:\n'Cannot void a paid invoice.\nPlease issue a Credit Note'",
        "diagram": "user_journey_08_void_invoice.png",
        "screen_experience": "You open the invoice, click 'Void', and type a brief explanation. The invoice status badge immediately flips to 'VOID'. The customer's account page shows their balance drops back to £0.00.",
        "behind_scenes": "Under UK tax rules, companies cannot simply 'delete' issued invoices. Blynt automatically posts a balancing reversal behind the scenes, ensuring your sales revenue and VAT liability are corrected cleanly without erasing the history.",
        "if_mistake": "If the customer has already paid money towards the invoice, Blynt prevents voiding and guides you: 'This invoice has payments recorded. Please issue a Credit Note and Refund instead.'"
    },
    {
        "num": 9,
        "title": "Inviting Team Members with Safe Role Permissions",
        "actor": "Business Owner",
        "story": "You want an external auditor or junior staff member to look at company reports without having permission to alter bank accounts, delete invoices, or change company settings.",
        "steps": [
            "1. Go to 'Settings' ➔ 'Team Members'",
            "2. Type colleague's email & pick 'Viewer'",
            "3. Colleague accepts invite and logs in",
            "4. Can read reports & invoices cleanly",
            "5. 'Edit', 'Delete' & 'Pay' buttons are hidden"
        ],
        "final": "Read-Only Access Enforced Safely",
        "error": "Access Denied Banner:\n'View-Only account. You do not\nhave permission to edit settings'",
        "diagram": "user_journey_09_team_roles.png",
        "screen_experience": "You invite your auditor as a 'Viewer'. When they log in, they see all financial statements, invoices, and bank balances. However, buttons like 'Create Invoice', 'Edit Bank', or 'Delete' do not appear on their screen.",
        "behind_scenes": "Blynt enforces strict role boundaries: Owners have full control, Accountants can reconcile and lock years, Bookkeepers can enter daily bills and invoices, and Viewers have strictly read-only access.",
        "if_mistake": "If a Viewer attempts to change a setting via a direct link, an error banner appears: 'Access Denied: Your account has view-only permissions.'"
    },
    {
        "num": 10,
        "title": "Checking Real-Time Business Profit & Loss",
        "actor": "Business Owner / Director",
        "story": "You want to see how much money your business made this quarter, your profit margins, and where your expenses went without waiting for an accountant.",
        "steps": [
            "1. Click 'Reports' ➔ 'Profit & Loss'",
            "2. Select Date Range (e.g. 'This Quarter')",
            "3. Screen calculates Turnover & Net Profit",
            "4. Click any number to see underlying receipts",
            "5. 1-Click download as clean PDF"
        ],
        "final": "Instant Financial Clarity on Company Profit",
        "error": "Date Range Tip:\n'No transactions found in this\nwindow. Please adjust dates'",
        "diagram": "user_journey_10_pnl_report.png",
        "screen_experience": "You open the Profit & Loss report. At the top, you see Total Sales. Below, your Cost of Sales and Operating Expenses are neatly grouped. At the bottom, a green number shows your Net Operating Profit. Clicking on 'Software Expenses' expands to show every software bill.",
        "behind_scenes": "Because every invoice and bill is recorded in real time, your financial reports are always 100% current. You don't have to wait for month-end reconciliations to know if you are profitable.",
        "if_mistake": "If you choose a date range where no trading occurred, Blynt displays: 'No transactions found in this date window. Please select another period.'"
    },
    {
        "num": 11,
        "title": "Filing a Quarterly VAT Return with HMRC",
        "actor": "Accountant / Business Owner",
        "story": "It is the end of the tax quarter and you need to calculate your UK VAT return, review the 9 standard boxes, and submit to HMRC under Making Tax Digital.",
        "steps": [
            "1. Go to 'Tax & VAT' ➔ 'New VAT Return'",
            "2. Select Quarter (e.g. Jan - Mar 2026)",
            "3. System derives Boxes 1 to 9 automatically",
            "4. Review Net VAT to Pay / Reclaim (Box 5)",
            "5. Click 'Submit to HMRC MTD'"
        ],
        "final": "VAT Return Submitted with HMRC Receipt",
        "error": "Submission Issue Notice:\n'HMRC connection expired. Please\nre-authenticate your gateway link'",
        "diagram": "user_journey_11_vat_return.png",
        "screen_experience": "You click 'Generate VAT Return'. The screen displays the official 9-box UK VAT summary. Box 1 shows VAT on sales, Box 4 shows VAT reclaimed on purchases, and Box 5 shows the exact net amount to pay or reclaim. You click 'Submit to HMRC'. In 5 seconds, an official HMRC confirmation receipt reference appears.",
        "behind_scenes": "Blynt connects directly to the government Making Tax Digital (MTD) gateway, sends the encrypted return, and locks the transactions in that quarter so they cannot be altered after filing.",
        "if_mistake": "If your government gateway login expired, Blynt alerts you: 'Your HMRC authorization has expired. Please click here to reconnect your Government Gateway credentials in 30 seconds.'"
    },
    {
        "num": 12,
        "title": "Passing a Tax Audit with the Tamper-Proof Audit Trail",
        "actor": "HMRC Tax Inspector / Compliance Auditor",
        "story": "A tax auditor or investor visits your office and asks to verify that no sales were deleted and all bookkeeping changes have an accountable author.",
        "steps": [
            "1. Auditor opens 'Audit Trail' tab",
            "2. Filters by date, user, or invoice number",
            "3. System shows chronological event history",
            "4. Displays exact timestamp, user name & IP",
            "5. 1-Click export to official compliance PDF"
        ],
        "final": "Complete Proof of Integrity for HMRC Audit",
        "error": "Filter Tip:\n'No records match your filter.\nClear search terms to view all'",
        "diagram": "user_journey_12_audit_trail.png",
        "screen_experience": "The auditor searches for Invoice #1004. The screen shows the complete chronological lifecycle: 'Created by John on 10 Oct at 09:15', 'Approved by Sarah on 10 Oct at 10:00', 'Voided by John on 12 Oct at 14:30 with reason: Client cancelled project'.",
        "behind_scenes": "Blynt records every action in an append-only, tamper-evident log protected by database triggers. Nobody—not even the business owner or IT staff—can delete or alter historical audit records.",
        "if_mistake": "If an auditor filters for a non-existent transaction, a clear message shows: 'No events found matching your filter criteria. Click Reset to view full history.'"
    }
]

def build_user_side_report():
    print("Generating user-side non-technical diagrams...")
    for j in USER_JOURNEYS:
        draw_user_diagram(
            title=f"User Journey {j['num']}: {j['title']}",
            steps=j["steps"],
            final_success=j["final"],
            error_guide=j["error"],
            out_filename=j["diagram"]
        )
        print(f"  Generated diagram: {j['diagram']}")

    # 1. BUILD MARKDOWN REPORT
    print("Writing docs/BLYNT_USER_SIDE_BUSINESS_REPORT.md...")
    md_path = os.path.join(DOCS_DIR, "BLYNT_USER_SIDE_BUSINESS_REPORT.md")
    with open(md_path, "w", encoding="utf-8") as f:
        f.write("# Blynt — User-Side Business Operations & Experience Report\n\n")
        f.write("**Document Classification:** Business User Operations & Client Experience Manual  \n")
        f.write("**Target Audience:** Business Owners, Office Managers, Bookkeepers, and External Clients (100% Non-Technical)  \n")
        f.write("**System Name:** Blynt UK Cloud Accounting SaaS  \n")
        f.write("**Purpose:** Explain exactly how real people use Blynt, what happens on screen, how safety guardrails prevent mistakes, and how businesses stay protected.  \n\n")
        f.write("---\n\n")

        for j in USER_JOURNEYS:
            f.write(f"## Journey {j['num']}: {j['title']}\n\n")
            f.write(f"* **Who Uses This:** {j['actor']}\n")
            f.write(f"* **What You Are Trying to Do:** {j['story']}\n\n")
            f.write(f"### Visual Flowchart\n\n")
            f.write(f"![{j['title']}](diagrams/user_side/{j['diagram']})\n\n")
            f.write(f"### What You See & Do on Screen\n{j['screen_experience']}\n\n")
            f.write(f"### How Blynt Protects Your Business Behind the Scenes\n{j['behind_scenes']}\n\n")
            f.write(f"### What Happens If You Make a Mistake\n{j['if_mistake']}\n\n")
            f.write("---\n\n")

    # 2. BUILD EXECUTIVE PDF REPORT
    print("Compiling Blynt_User_Side_Business_Report.pdf via ReportLab...")
    pdf_docs_path = os.path.join(DOCS_DIR, "Blynt_User_Side_Business_Report.pdf")
    pdf_root_path = os.path.join(BASE_DIR, "Blynt_User_Side_Business_Report.pdf")

    doc = SimpleDocTemplate(
        pdf_docs_path, pagesize=A4,
        leftMargin=36, rightMargin=36, topMargin=44, bottomMargin=44
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('DocTitle', parent=styles['Heading1'], fontName='Helvetica-Bold', fontSize=22, leading=26, textColor=colors.HexColor(NAVY), spaceAfter=4)
    subtitle_style = ParagraphStyle('DocSub', parent=styles['Normal'], fontName='Helvetica', fontSize=10, leading=14, textColor=colors.HexColor(TEXT_MUTED), spaceAfter=12)
    h2_style = ParagraphStyle('H2Style', parent=styles['Heading2'], fontName='Helvetica-Bold', fontSize=13, leading=16, textColor=colors.HexColor(NAVY), spaceBefore=6, spaceAfter=4)
    meta_style = ParagraphStyle('Meta', parent=styles['Normal'], fontName='Helvetica', fontSize=8.5, leading=12, textColor=colors.HexColor(TEXT_DARK), spaceAfter=4)
    body_style = ParagraphStyle('Body', parent=styles['Normal'], fontName='Helvetica', fontSize=8, leading=11.5, textColor=colors.HexColor(TEXT_DARK))

    story = []
    # Title Cover
    story.append(Paragraph("Blynt — User-Side Business Operations Report", title_style))
    story.append(Paragraph("Complete Non-Technical Walkthrough: What Users See, What They Do, and How the System Protects Your Business", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor(CORAL), spaceAfter=10))

    intro = """
    <b>Executive Overview:</b> This report is written <b>100% from the user's perspective</b> for business owners, office managers, clients, and operational staff. 
    It eliminates technical engineering jargon and explains in clear, plain English how everyday financial tasks work on screen, how customers pay online, and how Blynt's built-in safety shields automatically prevent costly bookkeeping errors and tax penalties.
    """
    story.append(Paragraph(intro, meta_style))
    story.append(Spacer(1, 10))

    for idx, j in enumerate(USER_JOURNEYS):
        if idx > 0:
            story.append(PageBreak())
            
        story.append(Paragraph(f"<b>Journey {j['num']}: {j['title']}</b>", h2_style))
        story.append(Paragraph(f"<b>Primary Actor:</b> {j['actor']} &nbsp;|&nbsp; <b>Goal:</b> {j['story']}", meta_style))
        story.append(Spacer(1, 4))
        
        # Diagram
        diag_path = os.path.join(USER_DIAGRAMS_DIR, j["diagram"])
        story.append(RLImage(diag_path, width=460, height=210))
        story.append(Spacer(1, 6))
        
        # User details table
        t_data = [
            [Paragraph("<b>What You See & Do on Screen</b>", meta_style), Paragraph(j["screen_experience"], body_style)],
            [Paragraph("<b>How Blynt Protects You Behind the Scenes</b>", meta_style), Paragraph(j["behind_scenes"], body_style)],
            [Paragraph("<b>What Happens If You Make a Mistake</b>", meta_style), Paragraph(f"<font color='#991B1B'>{j['if_mistake']}</font>", body_style)]
        ]
        t = Table(t_data, colWidths=[150, 370])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor("#EEF2F9")),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor(BORDER)),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('LEFTPADDING', (0, 0), (-1, -1), 6),
            ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ]))
        story.append(t)
        story.append(Spacer(1, 8))

    doc.build(story, canvasmaker=UserReportCanvas)
    
    # Copy to root
    import shutil
    shutil.copyfile(pdf_docs_path, pdf_root_path)
    print("User-Side Business Report PDF successfully generated!")
    print(f"- {pdf_root_path}")
    print(f"- {md_path}")

if __name__ == "__main__":
    build_user_side_report()
