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

PDF_OUT_DOCS = os.path.join(DOCS_DIR, "Blynt_Complete_Test_Cases_Specification.pdf")
PDF_OUT_ROOT = os.path.join(BASE_DIR, "Blynt_Complete_Test_Cases_Specification.pdf")
MD_OUT_PATH = os.path.join(DOCS_DIR, "BLYNT_COMPLETE_TEST_CASES_SPECIFICATION.md")

TEST_CASES = [
    {
        "id": "TC-SEC-001",
        "title": "Multi-Tenant Request Guard & Session Boundary Test",
        "category": "Security & Multi-Tenancy",
        "gate": "Intercept unauthenticated or cross-tenant API requests",
        "steps": [
            "Initiate HTTP Request with Bearer Token",
            "Guard 1: Assert Session Token is not expired",
            "Guard 2: Assert Organisation Context header exists",
            "Guard 3: Assert User is active member of Tenant",
            "Guard 4: Assert User has required endpoint permission",
            "Guard 5: Assert Target resource belongs to Tenant"
        ],
        "final": "ASSERT 200 OK — Execute Domain Service",
        "error": "ASSERT 401 / 403 / TENANT_MISMATCH",
        "diagram": "tc_01_tenant_isolation_test.png",
        "assertion": "Requests with forged tokens or mismatched organization IDs must be rejected immediately before invoking business logic."
    },
    {
        "id": "TC-ORG-001",
        "title": "Organization Creation & Unique Slug / VAT Validation",
        "category": "Tenancy & Setup",
        "gate": "Validate business entity registration parameters",
        "steps": [
            "POST /organizations payload with legal name & slug",
            "Gate 1: Assert legal_name length between 2 and 100",
            "Gate 2: Assert slug contains only lowercase alphanumeric & hyphen",
            "Gate 3: Query DB: Assert slug is globally unique",
            "Gate 4: Regex check: Assert UK VAT number format (GB999999999)",
            "Gate 5: Assert currency is supported ISO-4217 code"
        ],
        "final": "ASSERT 201 Created — Return Organization Object",
        "error": "ASSERT 400 / 409 / SLUG_OR_VAT_INVALID",
        "diagram": "tc_02_org_creation_test.png",
        "assertion": "Duplicate company slugs or invalid HMRC VAT formats must be rejected with HTTP 409 and 400."
    },
    {
        "id": "TC-COA-001",
        "title": "Chart of Accounts Control Immutability & Hierarchy Rules",
        "category": "General Ledger Governance",
        "gate": "Protect control accounts from manual tampering",
        "steps": [
            "POST /accounts payload defining nominal account",
            "Gate 1: Assert account code conforms to classification (1000-9999)",
            "Gate 2: Assert account code is unique within organization",
            "Gate 3: Assert parent account exists in same organization",
            "Gate 4: If isControlAccount == true, assert allowManualPosting == false",
            "Gate 5: Assert active status is true"
        ],
        "final": "ASSERT 201 Created — Nominal Account Persisted",
        "error": "ASSERT 400 / 422 / CONTROL_ACCOUNT_PROTECTED",
        "diagram": "tc_03_coa_control_test.png",
        "assertion": "Control accounts cannot have manual posting enabled; duplicate codes within the same tenant must be rejected."
    },
    {
        "id": "TC-INV-001",
        "title": "Sales Invoice 20% VAT Calculation & Subledger Sync",
        "category": "Sales & Invoicing",
        "gate": "Verify arithmetic precision and synchronous posting",
        "steps": [
            "POST /invoices payload with line items and VAT rate",
            "Gate 1: Assert customerId exists and is of type CUSTOMER",
            "Gate 2: Assert invoice date falls in an OPEN financial year",
            "Gate 3: Compute Line Net, 20% VAT, and Line Total in decimal",
            "Gate 4: Assert sum(line totals) == invoice.totalAmount",
            "Gate 5: Verify DR Accounts Receivable == CR Revenue + CR VAT"
        ],
        "final": "ASSERT 201 Issued — Subledger & GL Synchronized",
        "error": "ASSERT 400 / 422 / INVOICE_VALIDATION_FAILED",
        "diagram": "tc_04_sales_invoice_test.png",
        "assertion": "Total amount must equal exact sum of lines plus 20% VAT; customer balance must increase by totalAmount immediately."
    },
    {
        "id": "TC-PAY-001",
        "title": "Payment Gateway Idempotency & Double-Click Shield",
        "category": "Client-Side & Payments",
        "gate": "Prevent duplicate charges on rapid successive clicks",
        "steps": [
            "Client clicks 'Pay Now' button on invoice link",
            "Gate 1: Client UI locks button and displays loading spinner",
            "Gate 2: Generate unique client idempotency token",
            "Gate 3: Verify invoice status is UNPAID and amount > 0",
            "Gate 4: Submit charge to Stripe / Payment Gateway",
            "Gate 5: Atomically record cash receipt & clear customer balance"
        ],
        "final": "ASSERT 200 OK — Invoice Marked PAID",
        "error": "ASSERT 400 / 402 / CARD_DECLINED_OR_DUPLICATE",
        "diagram": "tc_05_client_payment_test.png",
        "assertion": "Successive clicks within 5 seconds must produce zero duplicate charges; invoice status must transition atomically to PAID."
    },
    {
        "id": "TC-PUR-001",
        "title": "Supplier Bill Duplicate Interception & AP Posting",
        "category": "Purchases & Accounts Payable",
        "gate": "Block duplicate supplier reference bills",
        "steps": [
            "POST /bills payload from supplier receipt",
            "Gate 1: Assert supplierId exists and is of type SUPPLIER",
            "Gate 2: Assert supplierInvoiceNumber is non-empty string",
            "Gate 3: Query DB: Check for existing bill with same supplier & ref",
            "Gate 4: Validate expense line account exists and is EXPENSE type",
            "Gate 5: Verify DR Expense + DR Input VAT == CR Accounts Payable"
        ],
        "final": "ASSERT 201 Created — Bill Posted to Accounts Payable",
        "error": "ASSERT 409 / DUPLICATE_BILL_REFERENCE",
        "diagram": "tc_06_supplier_bill_test.png",
        "assertion": "Attempting to enter a supplier bill with an existing reference for that supplier must fail with HTTP 409."
    },
    {
        "id": "TC-AI-001",
        "title": "AI Document OCR Confidence & Arithmetic Guardrails",
        "category": "AI Intelligence & Safety",
        "gate": "Block hallucinated OCR extractions",
        "steps": [
            "POST /expenses/ai-extract with uploaded receipt image",
            "Gate 1: OCR engine parses text, vendor, date, and numbers",
            "Gate 2: Assert vendor confidence score >= 0.85",
            "Gate 3: Assert parsed date is valid format and <= today",
            "Gate 4: Assert parsed net + parsed tax == parsed gross total",
            "Gate 5: Present side-by-side human review confirmation"
        ],
        "final": "ASSERT 200 OK — Validated Receipt Extraction",
        "error": "ASSERT 422 / AI_LOW_CONFIDENCE_REJECTED",
        "diagram": "tc_07_ai_receipt_test.png",
        "assertion": "If confidence is below 85% or line math does not equal total, automatic posting is blocked; human review is required."
    },
    {
        "id": "TC-JRN-001",
        "title": "Journal Balance Equilibrium Invariant (Debits == Credits)",
        "category": "General Ledger Engine",
        "gate": "Enforce double-entry accounting equilibrium",
        "steps": [
            "POST /journals payload with line array",
            "Gate 1: Assert lines.length >= 2",
            "Gate 2: Assert each line has amount > 0 and type DEBIT or CREDIT",
            "Gate 3: Sum all DEBIT amounts with arbitrary decimal precision",
            "Gate 4: Sum all CREDIT amounts with arbitrary decimal precision",
            "Gate 5: Assert sum(Debits) - sum(Credits) == 0.0000"
        ],
        "final": "ASSERT 201 Created — Journal Posted to General Ledger",
        "error": "ASSERT 422 / UNBALANCED_JOURNAL_ENTRY",
        "diagram": "tc_08_journal_balance_test.png",
        "assertion": "Any journal entry with a non-zero difference between debits and credits must be rejected with HTTP 422."
    },
    {
        "id": "TC-REV-001",
        "title": "Invoice Voiding Reversal Invariant & Customer Zeroing",
        "category": "GAAP Reversals & Audit",
        "gate": "Verify symmetric non-destructive cancellation",
        "steps": [
            "POST /invoices/:id/void with cancellation reason",
            "Gate 1: Query Invoice: Assert status == AWAITING_PAYMENT",
            "Gate 2: Assert amountPaid == 0.00",
            "Gate 3: Assert void reason length >= 5 characters",
            "Gate 4: Generate symmetric offsetting reversal journal entry",
            "Gate 5: Assert customer subledger balance decrements by invoice total"
        ],
        "final": "ASSERT 200 OK — Invoice Voided & Balance Offset",
        "error": "ASSERT 400 / 409 / CANNOT_VOID_PAID_INVOICE",
        "diagram": "tc_09_invoice_void_test.png",
        "assertion": "Voiding must create a mirrored reversal journal, customer balance must return to pre-invoice state, and original invoice is preserved."
    },
    {
        "id": "TC-PER-001",
        "title": "Closed Financial Period Temporal Backdating Intercept",
        "category": "Period Governance",
        "gate": "Block transactions backdated into closed tax years",
        "steps": [
            "Submit any transactional entry (Invoice, Bill, Journal)",
            "Gate 1: Extract effective transaction entry_date",
            "Gate 2: Query financial_years table for date range",
            "Gate 3: Assert matching financial year exists",
            "Gate 4: Assert financial year status == OPEN",
            "Gate 5: Assert matching monthly accounting period status == OPEN"
        ],
        "final": "ASSERT 201 Allowed — Transaction Posted",
        "error": "ASSERT 403 / FINANCIAL_PERIOD_LOCKED",
        "diagram": "tc_10_period_lock_test.png",
        "assertion": "Attempting to post any entry with an entry_date inside a closed or locked financial year must fail with HTTP 403 PERIOD_LOCKED."
    },
    {
        "id": "TC-BNK-001",
        "title": "Bank Feed Statement Deduplication & Reconciliation",
        "category": "Banking & Reconciliation",
        "gate": "Prevent duplicate bank feeds and ensure balance matching",
        "steps": [
            "POST /bank-accounts/:id/statements with CSV feed",
            "Gate 1: Assert bank account exists and belongs to tenant",
            "Gate 2: For each line, compute SHA256(date + amount + reference)",
            "Gate 3: Assert line hash has not been previously imported",
            "Gate 4: Match statement line against open customer invoices",
            "Gate 5: Verify ending bank feed balance matches calculated balance"
        ],
        "final": "ASSERT 200 OK — Statement Reconciled",
        "error": "ASSERT 409 / DUPLICATE_TRANSACTION_FEED",
        "diagram": "tc_11_bank_reconciliation_test.png",
        "assertion": "Duplicate imported statement lines must be ignored or rejected; clearing an invoice must update both bank and AR subledgers."
    },
    {
        "id": "TC-RBAC-001",
        "title": "Role Privilege Boundary Enforcement (Viewer vs Admin)",
        "category": "Access Control Security",
        "gate": "Verify write operation prohibition for Viewer role",
        "steps": [
            "User with role VIEWER attempts POST /invoices",
            "Gate 1: Authenticate session and extract role claim",
            "Gate 2: Intercept request at RolesGuard level",
            "Gate 3: Inspect @Roles metadata on target controller",
            "Gate 4: Assert VIEWER is not in allowed write roles",
            "Gate 5: Abort request before executing database transaction"
        ],
        "final": "ASSERT 403 Forbidden — Access Denied to Viewer",
        "error": "ASSERT 403 / INSUFFICIENT_PERMISSIONS",
        "diagram": "tc_12_rbac_security_test.png",
        "assertion": "Users with the VIEWER role must receive HTTP 403 when attempting any POST, PUT, PATCH, or DELETE operation."
    },
    {
        "id": "TC-VAT-001",
        "title": "Quarterly VAT Return Derivation & HMRC MTD Validation",
        "category": "Statutory Compliance",
        "gate": "Assert 9-box VAT mathematical equality",
        "steps": [
            "POST /vat-returns/generate with quarter start and end dates",
            "Gate 1: Query all posted journal lines tagged with VAT nominals",
            "Gate 2: Compute Box 1 (VAT due on sales) and Box 2 (VAT acquisitions)",
            "Gate 3: Compute Box 3 = Box 1 + Box 2",
            "Gate 4: Compute Box 4 (VAT reclaimed on purchases)",
            "Gate 5: Assert Box 5 == abs(Box 3 - Box 4)"
        ],
        "final": "ASSERT 200 OK — VAT Return Ready for HMRC Submission",
        "error": "ASSERT 422 / VAT_MATHEMATICAL_DISCREPANCY",
        "diagram": "tc_13_vat_mtd_test.png",
        "assertion": "Box 5 must equal exactly Box 3 minus Box 4; no unposted or draft transactions may be included in the statutory calculation."
    },
    {
        "id": "TC-AUD-001",
        "title": "Audit Trail Append-Only Immutability & Hash Verification",
        "category": "Statutory Audit & GRC",
        "gate": "Verify cryptographic tamper-proofing of audit records",
        "steps": [
            "Perform state change (Create, Edit, Void, Post)",
            "Gate 1: Audit interceptor captures event payload and userId",
            "Gate 2: Read previous audit log entry SHA256 hash",
            "Gate 3: Compute current entry hash = SHA256(prevHash + payload)",
            "Gate 4: Persist entry into append-only audit_logs table",
            "Gate 5: Assert audit log entry cannot be updated or deleted"
        ],
        "final": "ASSERT 201 Created — Tamper-Proof Audit Record Written",
        "error": "ASSERT 500 / AUDIT_IMMUTABILITY_VIOLATION",
        "diagram": "tc_14_audit_immutability_test.png",
        "assertion": "Direct SQL UPDATE or DELETE on audit_logs must be rejected by PostgreSQL triggers; hash chain continuity must verify 100% intact."
    }
]

def build():
    print("Generating 14 Test Case diagrams in Figure 7 style...")
    diagram_files = []
    for tc in TEST_CASES:
        p = generate_figure_7_style_diagram(
            title=tc["title"],
            steps=tc["steps"],
            final_step=tc["final"],
            error_text=tc["error"],
            filename=tc["diagram"],
            caption=f"Figure {tc['id']} — {tc['title']} QA Test Gate Architecture"
        )
        diagram_files.append(p)
        print(f"Generated: {tc['diagram']}")

    # Build Markdown
    print("Writing BLYNT_COMPLETE_TEST_CASES_SPECIFICATION.md...")
    with open(MD_OUT_PATH, "w", encoding="utf-8") as f:
        f.write("# Blynt — Complete QA Test Cases Specification\n\n")
        f.write("**Document Classification:** Quality Assurance Architecture & Validation Matrix  \n")
        f.write("**Target Audience:** QA Engineers, Compliance Auditors, Test Automation Leads, and Technical Stakeholders  \n")
        f.write("**System Name:** Blynt UK Cloud Accounting SaaS  \n")
        f.write("**Total Test Suites Covered:** 14 Exhaustive Functional & Security Test Suites  \n\n")
        f.write("---\n\n")
        
        for tc in TEST_CASES:
            f.write(f"## {tc['id']}: {tc['title']}\n\n")
            f.write(f"* **Category:** {tc['category']}\n")
            f.write(f"* **Primary Validation Gate:** {tc['gate']}\n\n")
            f.write(f"### Visual Test Gate Architecture\n\n")
            f.write(f"![{tc['title']}](diagrams/{tc['diagram']})\n\n")
            f.write(f"### Sequential Execution & Assertion Steps\n\n")
            for i, step in enumerate(tc["steps"], 1):
                f.write(f"{i}. **{step}:** Verification gate enforced.\n")
            f.write(f"{len(tc['steps'])+1}. **Success Assertion ({tc['final']}):** All conditions verified; state committed.\n\n")
            f.write(f"* **Failure Rejection Assertion:** `{tc['error']}`\n")
            f.write(f"* **Pass/Fail Standard:** {tc['assertion']}\n\n")
            f.write("---\n\n")

    # Build PDF
    print("Building Test Cases PDF via ReportLab...")
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
    story.append(Paragraph("Blynt — Complete Test Cases Specification", title_style))
    story.append(Paragraph("Exhaustive QA Test Gate Flowcharts & Assertion Verifications Across All 14 System Scenarios", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#FF7F6C"), spaceAfter=12))

    intro_text = """
    <b>Document Overview:</b> This document defines the formal testing architecture for the Blynt accounting platform. 
    Every test suite is presented using a standardized architectural flowchart following the vertical validation gate pattern: passing sequentially through input schema parsing, multi-tenant boundaries, double-entry mathematical balancing, and temporal exclusion constraints, terminating in either green success assertions (HTTP 200/201) or explicit red failure branches (HTTP 400/401/403/409/422).
    """
    story.append(Paragraph(intro_text, body_style))
    story.append(Spacer(1, 10))

    for idx, tc in enumerate(TEST_CASES):
        if idx > 0 and idx % 2 == 0:
            story.append(PageBreak())
        
        story.append(Paragraph(f"<b>{tc['id']}: {tc['title']}</b>", h2_style))
        story.append(Paragraph(f"<b>Category:</b> {tc['category']} &nbsp;|&nbsp; <b>Expected Rejection:</b> <font color='#EF4444'><b>{tc['error']}</b></font>", body_style))
        story.append(Paragraph(f"<b>Verification Gate:</b> {tc['gate']}", body_style))
        
        # Diagram
        diag_path = os.path.join(DIAGRAMS_DIR, tc["diagram"])
        story.append(RLImage(diag_path, width=440, height=270))
        story.append(Paragraph(f"<i>Assertion Rule: {tc['assertion']}</i>", body_style))
        story.append(Spacer(1, 8))

    doc.build(story, canvasmaker=NumberedCanvas)
    
    # Copy to root
    import shutil
    shutil.copyfile(PDF_OUT_DOCS, PDF_OUT_ROOT)
    print("Test Cases PDF successfully generated.")

if __name__ == "__main__":
    build()
