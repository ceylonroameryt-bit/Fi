import os
import sys
from diagram_factory import generate_figure_7_style_diagram, NumberedCanvas, BASE_DIR, DOCS_DIR, DIAGRAMS_DIR
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
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

PDF_OUT_DOCS = os.path.join(DOCS_DIR, "Blynt_Complete_Use_Cases_Specification.pdf")
PDF_OUT_ROOT = os.path.join(BASE_DIR, "Blynt_Complete_Use_Cases_Specification.pdf")
MD_OUT_PATH = os.path.join(DOCS_DIR, "BLYNT_COMPLETE_USE_CASES_SPECIFICATION.md")

USE_CASES = [
    {
        "id": "UC-01",
        "title": "User Authentication & Multi-Tenant Access",
        "actor": "Any User (Owner, Accountant, Staff)",
        "objective": "Authenticate user credentials and securely resolve organization context without cross-tenant data leaks.",
        "steps": [
            "User submits login credentials",
            "Verify email & password hash",
            "Validate active user session",
            "Resolve target organisation slug",
            "Check active organisation membership",
            "Enforce tenant permission boundary"
        ],
        "final": "Access Organization Dashboard",
        "error": "401 / 403 / TENANT_NOT_FOUND",
        "diagram": "uc_01_auth_tenant_flow.png",
        "desc": "Ensures that every user strictly operates inside their authorized business entity. If an expired token, wrong password, or unassigned organization is requested, the system instantly halts access."
    },
    {
        "id": "UC-02",
        "title": "Organization Setup & Statutory Tax Configuration",
        "actor": "Business Owner / Enterprise Administrator",
        "objective": "Register a new UK entity, base currency (GBP), and statutory HMRC VAT number.",
        "steps": [
            "Submit company registration data",
            "Verify legal company name",
            "Validate unique URL workspace slug",
            "Validate UK VAT registration format",
            "Seed default UK GAAP Chart of Accounts",
            "Generate initial Financial Year 2026"
        ],
        "final": "Organization Workspace Created",
        "error": "400 / 409 / SLUG_OR_VAT_INVALID",
        "diagram": "uc_02_org_onboarding_flow.png",
        "desc": "Validates business entity identity and seeds standardized nominal ledger accounts with VAT control accounts ready for trading."
    },
    {
        "id": "UC-03",
        "title": "Chart of Accounts & Control Account Governance",
        "actor": "Certified Public Accountant",
        "objective": "Create custom nominal codes while protecting system control accounts (Bank, AR, AP, VAT).",
        "steps": [
            "Submit nominal account definition",
            "Validate unique nominal account code",
            "Validate account type classification",
            "Verify control account protection rules",
            "Enforce manual posting permissions",
            "Check active financial period status"
        ],
        "final": "Save Account into General Ledger",
        "error": "400 / 422 / CONTROL_PROTECTED",
        "diagram": "uc_03_chart_of_accounts_flow.png",
        "desc": "Prevents unauthorized users from manually posting direct journal lines into statutory accounts like Accounts Receivable or Tax Control."
    },
    {
        "id": "UC-04",
        "title": "Sales Invoice Creation & 20% VAT Calculation",
        "actor": "Business Owner or Billing Clerk",
        "objective": "Bill a customer with automatic UK standard VAT derivation and real-time subledger posting.",
        "steps": [
            "Select customer contact profile",
            "Verify customer status is active",
            "Validate invoice date within open year",
            "Calculate line totals & derive 20% VAT",
            "Verify debit AR == credit Sales + VAT",
            "Post invoice atomically to GL & Subledger"
        ],
        "final": "Issue Invoice & Send to Customer",
        "error": "400 / 422 / INVOICE_VALIDATION_ERR",
        "diagram": "uc_04_sales_invoicing_flow.png",
        "desc": "Guarantees that invoices always balance mathematically, calculate exact VAT pence, and synchronously update customer balances."
    },
    {
        "id": "UC-05",
        "title": "External Client Online Payment (Client-Side)",
        "actor": "External Customer / Payer",
        "objective": "Allow external clients to open secure invoice links and pay via card without creating an IT account.",
        "steps": [
            "Customer opens secure invoice token link",
            "Verify token is valid and unexpired",
            "Display branded invoice and £1,200 total",
            "Customer submits card details (Stripe)",
            "Lock pay button (idempotency shield)",
            "Record cash receipt into Bank Account"
        ],
        "final": "Mark Invoice PAID & Issue Receipt",
        "error": "400 / 402 / CARD_DECLINED_OR_EXPIRED",
        "diagram": "uc_05_client_payment_flow.png",
        "desc": "Enables immediate payment receipting while safeguarding payers against duplicate charges if clicking 'Pay' rapidly."
    },
    {
        "id": "UC-06",
        "title": "Supplier Bill Capture & Accounts Payable",
        "actor": "Bookkeeper / Finance Administrator",
        "objective": "Log vendor bills, check for duplicate invoice references, and accrue accounts payable.",
        "steps": [
            "Select supplier contact record",
            "Enter supplier invoice reference",
            "Check for duplicate supplier bill ref",
            "Validate expense account categories",
            "Verify input VAT recovery status",
            "Post credit to AP & debit to Expense"
        ],
        "final": "Save Bill in Accounts Payable",
        "error": "400 / 409 / DUPLICATE_SUPPLIER_BILL",
        "diagram": "uc_06_supplier_bill_flow.png",
        "desc": "Prevents the business from accidentally paying the same supplier invoice twice by checking vendor numbers and dates."
    },
    {
        "id": "UC-07",
        "title": "Smart AI Receipt Scanning & Document Extraction",
        "actor": "Staff Member / Expense Submitter",
        "objective": "Extract vendor, date, and VAT breakdown from a photo receipt using AI with zero hallucinations.",
        "steps": [
            "Upload image or PDF receipt",
            "Scan image with Document AI engine",
            "Check OCR confidence threshold > 85%",
            "Verify arithmetic: Net + VAT == Total",
            "Match or suggest expense category",
            "Present side-by-side human review"
        ],
        "final": "Post Expense & Archive Image",
        "error": "422 / LOW_CONFIDENCE_OR_UNBALANCED",
        "diagram": "uc_07_ai_receipt_flow.png",
        "desc": "Automates receipt data entry with strict guardrails: if text is blurry or totals do not add up, human review is enforced."
    },
    {
        "id": "UC-08",
        "title": "Double-Entry Manual Journal Entry Creation",
        "actor": "Senior Accountant",
        "objective": "Post end-of-month adjusting journal entries with strict debit-equals-credit equilibrium.",
        "steps": [
            "Create new manual journal draft",
            "Validate effective transaction date",
            "Check date falls in an open period",
            "Validate active nominal accounts",
            "Verify sum(Debits) == sum(Credits)",
            "Enforce minimum 2 non-zero lines"
        ],
        "final": "Post Journal Entry to General Ledger",
        "error": "400 / 422 / JOURNAL_UNBALANCED",
        "diagram": "uc_08_manual_journal_flow.png",
        "desc": "Enforces the foundational rule of accounting: the system physically refuses to save any journal where debits do not match credits."
    },
    {
        "id": "UC-09",
        "title": "Safe Invoice Voiding & GAAP Symmetric Reversal",
        "actor": "Business Owner / Certified Accountant",
        "objective": "Legally cancel an invoice with an offsetting symmetrical journal reversal without erasing history.",
        "steps": [
            "Open unpaid issued invoice record",
            "Verify invoice has not received cash",
            "Require mandatory audit cancellation reason",
            "Generate symmetrical debit/credit reversal",
            "Update customer statement balance to £0.00",
            "Permanently write event to Audit Log"
        ],
        "final": "Mark Invoice VOID & Ledger Reversed",
        "error": "400 / 409 / INVOICE_ALREADY_PAID",
        "diagram": "uc_09_invoice_voiding_flow.png",
        "desc": "Preserves a 100% compliant paper trail for statutory HMRC audits; issued invoices are never silently deleted."
    },
    {
        "id": "UC-10",
        "title": "Financial Period Closing & Locked Year Freeze",
        "actor": "Certified Public Accountant",
        "objective": "Close a financial year after tax submission to freeze all past ledger entries against tampering.",
        "steps": [
            "Run final Trial Balance & tax returns",
            "Request close on Financial Year 2024",
            "Verify zero unposted draft transactions",
            "Verify closing retained earnings balance",
            "Set period status to CLOSED / LOCKED",
            "Activate temporal btree_gist date lock"
        ],
        "final": "Financial Period Permanently Locked",
        "error": "400 / 409 / UNPOSTED_DRAFTS_EXIST",
        "diagram": "uc_10_period_closing_flow.png",
        "desc": "Once locked, any subsequent attempt by any user to post, edit, or backdate entries into that year is rejected."
    },
    {
        "id": "UC-11",
        "title": "Bank Feed Statement Import & Reconciliation",
        "actor": "Bookkeeper / Accountant",
        "objective": "Import electronic bank statement lines and reconcile against issued invoices and bills.",
        "steps": [
            "Upload bank CSV / OFX statement file",
            "Validate bank account ownership",
            "Deduplicate imported transaction IDs",
            "Match statement lines against invoices",
            "Verify bank balance matches GL Bank",
            "Generate atomic reconciliation clearance"
        ],
        "final": "Bank Account Fully Reconciled",
        "error": "400 / 409 / DUPLICATE_STATEMENT_FEED",
        "diagram": "uc_11_bank_reconciliation_flow.png",
        "desc": "Matches actual bank cash flows with accounting records and catches duplicate bank transaction downloads."
    },
    {
        "id": "UC-12",
        "title": "Role-Based Access Control & Privilege Boundary",
        "actor": "Platform Administrator / Business Owner",
        "objective": "Enforce strict least-privilege security between Owners, Accountants, Bookkeepers, and Viewers.",
        "steps": [
            "User issues API / screen action",
            "Identify user assigned role",
            "Check required operation privilege",
            "Verify Viewer has zero write permissions",
            "Verify Bookkeeper cannot edit settings",
            "Validate user action within org boundary"
        ],
        "final": "Authorize Requested Operation",
        "error": "403 / PERMISSION_DENIED",
        "diagram": "uc_12_rbac_governance_flow.png",
        "desc": "Ensures external auditors or junior staff cannot alter sensitive bank accounts, delete records, or modify billing configurations."
    },
    {
        "id": "UC-13",
        "title": "HMRC Making Tax Digital (MTD) VAT Return",
        "actor": "Certified Public Accountant",
        "objective": "Calculate quarterly VAT Boxes 1 through 9 from general ledger lines and submit to HMRC MTD.",
        "steps": [
            "Select quarterly VAT date window",
            "Aggregate sales VAT (Box 1 & Box 3)",
            "Aggregate input VAT (Box 4)",
            "Calculate Net VAT Due (Box 5)",
            "Validate Box 5 arithmetic matches ledger",
            "Submit cryptographic payload to HMRC API"
        ],
        "final": "HMRC Confirms VAT Return Accepted",
        "error": "400 / 422 / HMRC_API_REJECTED",
        "diagram": "uc_13_hmrc_mtd_vat_flow.png",
        "desc": "Generates 100% compliant UK VAT filings directly from posted invoices and receipts without spreadsheet copy-paste errors."
    },
    {
        "id": "UC-14",
        "title": "Statutory Tamper-Proof Audit Trail Logging",
        "actor": "Compliance Auditor / Tax Inspector",
        "objective": "Inspect the complete historical log of all creations, edits, reversals, and access logs.",
        "steps": [
            "Auditor opens Audit Trail viewer",
            "Authenticate auditor viewer credentials",
            "Filter events by entity and date range",
            "Verify cryptographic hash chain continuity",
            "Confirm zero missing event sequence numbers",
            "Export immutable compliance audit log"
        ],
        "final": "Display Validated Audit Record",
        "error": "403 / HASH_CHAIN_COMPROMISED",
        "diagram": "uc_14_audit_immutability_flow.png",
        "desc": "Provides statutory proof that no accounting records were altered off-the-books, satisfying UK Companies Act requirements."
    }
]

def build():
    print("Generating 14 Use Case diagrams in Figure 7 style...")
    diagram_files = []
    for uc in USE_CASES:
        p = generate_figure_7_style_diagram(
            title=uc["title"],
            steps=uc["steps"],
            final_step=uc["final"],
            error_text=uc["error"],
            filename=uc["diagram"],
            caption=f"Figure {uc['id']} — {uc['title']} Flow Architecture"
        )
        diagram_files.append(p)
        print(f"Generated: {uc['diagram']}")

    # Build Markdown
    print("Writing BLYNT_COMPLETE_USE_CASES_SPECIFICATION.md...")
    with open(MD_OUT_PATH, "w", encoding="utf-8") as f:
        f.write("# Blynt — Complete Functional Use Cases Specification\n\n")
        f.write("**Document Classification:** Enterprise Functional Requirements & User Journey Architecture  \n")
        f.write("**Target Audience:** Business Owners, Operational Leads, Product Managers, and Non-Technical Stakeholders  \n")
        f.write("**System Name:** Blynt UK Cloud Accounting SaaS  \n")
        f.write("**Total Scenarios Covered:** 14 Exhaustive Business & Client Scenarios  \n\n")
        f.write("---\n\n")
        
        for uc in USE_CASES:
            f.write(f"## {uc['id']}: {uc['title']}\n\n")
            f.write(f"* **Primary Actor:** {uc['actor']}\n")
            f.write(f"* **Business Objective:** {uc['objective']}\n\n")
            f.write(f"### Visual Flowchart Architecture\n\n")
            f.write(f"![{uc['title']}](diagrams/{uc['diagram']})\n\n")
            f.write(f"### Step-by-Step Business Progression\n\n")
            for i, step in enumerate(uc["steps"], 1):
                f.write(f"{i}. **{step}:** System validates parameters.\n")
            f.write(f"{len(uc['steps'])+1}. **Success Endpoint ({uc['final']}):** Operation approved and committed.\n\n")
            f.write(f"* **Failure Branch Rejection Code:** `{uc['error']}`\n")
            f.write(f"* **Business Context:** {uc['desc']}\n\n")
            f.write("---\n\n")

    # Build PDF
    print("Building Use Cases PDF via ReportLab...")
    doc = SimpleDocTemplate(
        PDF_OUT_DOCS,
        pagesize=A4,
        leftMargin=36,
        rightMargin=36,
        topMargin=44,
        bottomMargin=44,
    )
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'DocTitle', parent=styles['Heading1'],
        fontName='Helvetica-Bold', fontSize=22, leading=26,
        textColor=colors.HexColor("#162D5F"), spaceAfter=6,
    )
    subtitle_style = ParagraphStyle(
        'DocSub', parent=styles['Normal'],
        fontName='Helvetica', fontSize=10.5, leading=14,
        textColor=colors.HexColor("#64748B"), spaceAfter=14,
    )
    h2_style = ParagraphStyle(
        'H2Style', parent=styles['Heading2'],
        fontName='Helvetica-Bold', fontSize=13, leading=16,
        textColor=colors.HexColor("#162D5F"), spaceBefore=8, spaceAfter=4,
    )
    body_style = ParagraphStyle(
        'Body', parent=styles['Normal'],
        fontName='Helvetica', fontSize=9, leading=13,
        textColor=colors.HexColor("#1E293B"), spaceAfter=6,
    )

    story = []
    
    # Cover / Header
    story.append(Paragraph("Blynt — Complete Use Cases Specification", title_style))
    story.append(Paragraph("Exhaustive Architectural Flowcharts & Business User Journeys Across All 14 System Scenarios", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#FF7F6C"), spaceAfter=12))

    intro_text = """
    <b>Document Overview:</b> This document provides an exhaustive, visual specification of every major business and client-facing use case within the Blynt accounting platform. 
    Each scenario features a standardized architectural flowchart following the vertical validation pattern: descending sequentially through security, business logic, and mathematical integrity checks before committing to the general ledger, with every failure condition mapped to explicit domain error branches.
    """
    story.append(Paragraph(intro_text, body_style))
    story.append(Spacer(1, 10))

    for idx, uc in enumerate(USE_CASES):
        if idx > 0 and idx % 2 == 0:
            story.append(PageBreak())
        
        story.append(Paragraph(f"<b>{uc['id']}: {uc['title']}</b>", h2_style))
        story.append(Paragraph(f"<b>Primary Actor:</b> {uc['actor']} &nbsp;|&nbsp; <b>Rejection Code:</b> <font color='#EF4444'><b>{uc['error']}</b></font>", body_style))
        story.append(Paragraph(f"<b>Objective:</b> {uc['objective']}", body_style))
        
        # Diagram
        diag_path = os.path.join(DIAGRAMS_DIR, uc["diagram"])
        story.append(RLImage(diag_path, width=440, height=270))
        story.append(Paragraph(f"<i>Context: {uc['desc']}</i>", body_style))
        story.append(Spacer(1, 8))

    doc.build(story, canvasmaker=NumberedCanvas)
    
    # Copy to root
    import shutil
    shutil.copyfile(PDF_OUT_DOCS, PDF_OUT_ROOT)
    print("Use Cases PDF successfully generated.")

if __name__ == "__main__":
    build()
