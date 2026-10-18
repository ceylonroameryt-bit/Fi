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

MODULES = [
    {
        "id": "MOD-01",
        "name": "Authentication, Sessions & Multi-Tenant Isolation",
        "cases": [
            ("001", "Standard Email & Password Login", "Authenticate user credentials, return JWT & tenant context", "401 INVALID_CREDENTIALS"),
            ("002", "Multi-Tenant Workspace Switching", "Switch active organization slug and verify tenant membership", "403 TENANT_MEMBERSHIP_REQUIRED"),
            ("003", "Session Token Expiry & Automatic Refresh", "Issue new access token via cryptographic refresh token", "401 REFRESH_TOKEN_EXPIRED"),
            ("004", "Cross-Tenant Injection Prevention", "Reject API request attempting to query another organization's data", "403 TENANT_MISMATCH"),
            ("005", "Two-Factor Authentication (2FA) Verification", "Validate 6-digit TOTP authenticator code upon login", "401 INVALID_TOTP_CODE"),
            ("006", "Password Reset via Secure Time-Limited Token", "Generate expiring email token and update password hash", "400 EXPIRED_RESET_TOKEN"),
            ("007", "Rate Limiting & Brute-Force Defense", "Block IP after 5 consecutive failed login attempts within 60s", "429 TOO_MANY_REQUESTS"),
            ("008", "Super Admin Platform Access Guard", "Restrict platform super admin portal to verified platform admins", "403 SUPER_ADMIN_REQUIRED"),
            ("009", "User Logout & Session Revocation", "Invalidate refresh token and blacklist session jti claim", "200 LOGOUT_SUCCESS"),
            ("010", "User Invitation & Organization Join Flow", "Invite employee by email with preset role and tenant binding", "409 USER_ALREADY_MEMBER"),
        ],
        "diagram": "flow_mod_01_auth.png",
        "diag_steps": ["Submit Credentials", "Verify Hash & Token", "Resolve Tenant Slug", "Verify Membership", "Enforce Boundary"],
        "diag_final": "Authorize Dashboard Access",
        "diag_error": "401 / 403 / AUTH_DENIED"
    },
    {
        "id": "MOD-02",
        "name": "Organization Setup & Statutory Tax Configuration",
        "cases": [
            ("011", "New Organization Legal Registration", "Create tenant workspace with legal name, jurisdiction & base currency", "400 INVALID_ORG_NAME"),
            ("012", "Unique Workspace URL Slug Allocation", "Enforce globally unique lowercase alphanumeric URL identifier", "409 SLUG_ALREADY_EXISTS"),
            ("013", "HMRC UK VAT Registration Number Validation", "Validate 9-digit GB VAT format (e.g. GB123456789) via regex", "400 INVALID_VAT_FORMAT"),
            ("014", "Companies House Registration Number Entry", "Store and validate 8-character UK company registration number", "400 INVALID_COMPANY_NUMBER"),
            ("015", "Base Trading Currency Lock (GBP)", "Set organization base currency to GBP and lock against mid-year change", "422 BASE_CURRENCY_LOCKED"),
            ("016", "Financial Year Calendar Setup", "Define default financial year (e.g. 01 Apr to 31 Mar) and 12 periods", "400 INVALID_DATE_RANGE"),
            ("017", "Company Branding & Invoice Logo Upload", "Upload high-res PNG/JPEG logo with 2MB size and aspect ratio check", "400 FILE_TOO_LARGE"),
            ("018", "Organization Soft Deactivation & Archive", "Archive organization while preserving 7-year statutory ledger history", "403 OWNER_ROLE_REQUIRED"),
        ],
        "diagram": "flow_mod_02_org.png",
        "diag_steps": ["Submit Entity Data", "Check Legal Name", "Validate URL Slug", "Validate UK VAT Format", "Seed COA & Calendar"],
        "diag_final": "Organization Provisioned",
        "diag_error": "400 / 409 / REGISTRATION_ERR"
    },
    {
        "id": "MOD-03",
        "name": "Chart of Accounts & General Ledger Governance",
        "cases": [
            ("019", "Standard UK GAAP Nominal Code Creation", "Create nominal code in standard ranges (1000-9999)", "400 INVALID_CODE_FORMAT"),
            ("020", "Unique Nominal Account Code Constraint", "Prevent duplicate account codes within the same organization", "409 DUPLICATE_ACCOUNT_CODE"),
            ("021", "Accounts Receivable Control Account Protection", "Block manual direct journals to AR (Code 1100)", "422 AR_CONTROL_PROTECTED"),
            ("022", "Accounts Payable Control Account Protection", "Block manual direct journals to AP (Code 2100)", "422 AP_CONTROL_PROTECTED"),
            ("023", "VAT Control Account Protection", "Enforce tax engine derivation for VAT Output/Input nominals", "422 VAT_CONTROL_PROTECTED"),
            ("024", "Retained Earnings System Account Lock", "Protect year-end rollover account (Code 3100) from manual edits", "422 RETAINED_EARNINGS_LOCKED"),
            ("025", "Account Normal Balance Derivation", "Assign DEBIT to Assets/Expenses, CREDIT to Liabilities/Equity/Revenue", "400 INVALID_NORMAL_BALANCE"),
            ("026", "Parent-Child Nominal Account Hierarchy", "Link sub-accounts to valid parent accounts within same tenant", "404 PARENT_NOT_FOUND"),
            ("027", "Account Inactivation with Zero Balance", "Permit deactivating obsolete accounts only when balance is exactly £0", "422 ACCOUNT_BALANCE_NON_ZERO"),
            ("028", "Account Currency Matching Rule", "Ensure foreign currency accounts match valid ISO-4217 currency list", "400 UNSUPPORTED_CURRENCY"),
        ],
        "diagram": "flow_mod_03_coa.png",
        "diag_steps": ["Input Account Code", "Check 1000-9999 Range", "Verify Unique In Org", "Check Control Rules", "Validate Hierarchy"],
        "diag_final": "Account Saved to Ledger",
        "diag_error": "400 / 422 / COA_RULE_VIOLATION"
    },
    {
        "id": "MOD-04",
        "name": "Double-Entry Journal Validation & Posting Engine",
        "cases": [
            ("029", "Draft Journal Entry Creation", "Create draft journal with line descriptions, debits, and credits", "400 EMPTY_JOURNAL_PAYLOAD"),
            ("030", "Debits Equal Credits Equilibrium Invariant", "Enforce sum(Debits) == sum(Credits) to 4 decimal places", "422 JOURNAL_UNBALANCED"),
            ("031", "Minimum Two Line Items Requirement", "Reject any journal having fewer than 2 active non-zero line items", "400 MINIMUM_LINES_REQUIRED"),
            ("032", "Zero Amount Line Item Rejection", "Reject lines where both debit and credit amounts equal £0.00", "400 ZERO_AMOUNT_REJECTED"),
            ("033", "Dual Sided Line Rejection (Debit + Credit on Same Line)", "Reject line specifying both debit > 0 and credit > 0 simultaneously", "400 MUTUALLY_EXCLUSIVE_LINE"),
            ("034", "Arbitrary Precision Decimal Arithmetic Check", "Ensure fractional pennies (e.g. £0.005) round cleanly with banker's rounding", "422 PRECISION_ROUNDING_ERR"),
            ("035", "Atomic Journal Posting to General Ledger", "Execute all GL line updates within a single ACID database transaction", "500 ATOMIC_POST_FAILED"),
            ("036", "Posted Journal Immutability Guarantee", "Block HTTP PUT/PATCH/DELETE on journals having status POSTED", "403 POSTED_JOURNAL_IMMUTABLE"),
            ("037", "Symmetrical Reversal Journal Linking", "Create reversed_by linked journal offsetting all original amounts", "409 ALREADY_REVERSED"),
            ("038", "Draft Journal Discard & Cleanup", "Allow deleting DRAFT journals without impacting ledger balances", "403 CANNOT_DELETE_POSTED"),
        ],
        "diagram": "flow_mod_04_journals.png",
        "diag_steps": ["Draft Journal Data", "Validate Line Count >= 2", "Check Active Accounts", "Check Sum(DR) == Sum(CR)", "Execute Atomic Post"],
        "diag_final": "Posted to General Ledger",
        "diag_error": "400 / 422 / JOURNAL_POST_ERR"
    },
    {
        "id": "MOD-05",
        "name": "Sales Invoicing & Customer Subledger Management",
        "cases": [
            ("039", "Customer Contact Creation & Validation", "Create customer profile with billing address, terms and credit limit", "400 INVALID_CONTACT_DATA"),
            ("040", "Sales Invoice Draft Generation", "Create invoice draft linked to valid CUSTOMER contact profile", "404 CUSTOMER_NOT_FOUND"),
            ("041", "UK Standard 20% VAT Line Derivation", "Compute exact 20% VAT on standard consulting and goods items", "400 INVALID_TAX_CALCULATION"),
            ("042", "UK Reduced 5% VAT Line Derivation", "Compute 5% VAT on domestic fuel and qualifying products", "400 INVALID_TAX_RATE"),
            ("043", "Zero-Rated (0%) VAT Line Classification", "Apply 0% VAT on books, food and qualifying zero-rated goods", "400 ZERO_RATE_MISCLASSIFIED"),
            ("044", "VAT Exempt Sales Classification", "Record sales exempt from VAT without input tax recovery", "400 EXEMPT_MISCLASSIFIED"),
            ("045", "CIS Domestic Reverse Charge Application", "Apply reverse charge for UK construction subcontracting", "400 CIS_REVERSE_CHARGE_ERR"),
            ("046", "Invoice Arithmetic Validation (Net + VAT == Total)", "Assert invoice total exactly equals sum of all item net + VAT lines", "422 ARITHMETIC_TOTAL_MISMATCH"),
            ("047", "Invoice Approval & Sales Ledger Posting", "Atomically debit Accounts Receivable and credit Sales & VAT Output", "400 APPROVAL_VALIDATION_ERR"),
            ("048", "Customer Subledger Balance Synchronization", "Increase customer outstanding balance by exact invoice total amount", "500 SUBLEDGER_SYNC_FAILED"),
            ("049", "Customer Statement Chronological Running Balance", "Generate chronological customer statement with running debit/credit totals", "200 STATEMENT_GENERATED"),
            ("050", "Print-Ready A4 Invoice PDF Generation", "Compile pixel-perfect A4 PDF with logo, remittance and VAT breakdown", "500 PDF_RENDER_FAILED"),
        ],
        "diagram": "flow_mod_05_invoicing.png",
        "diag_steps": ["Select Customer", "Check Active Status", "Compute 20% VAT", "Verify Net + VAT == Total", "Post to AR & Revenue"],
        "diag_final": "Invoice Issued & Balanced",
        "diag_error": "400 / 422 / INVOICE_FAILED"
    },
    {
        "id": "MOD-06",
        "name": "External Client Portal & Online Payments",
        "cases": [
            ("051", "Public Magic Token Invoice View Access", "Allow external client to securely view invoice without user login", "404 TOKEN_EXPIRED_OR_INVALID"),
            ("052", "Client View Brand Consistency Check", "Display seller logo, legal address, VAT number, and payment terms", "200 BRANDING_VERIFIED"),
            ("053", "Online Credit Card Payment Initiation", "Render Stripe / card payment modal with exact outstanding amount", "400 INVALID_PAYMENT_AMOUNT"),
            ("054", "Payment Idempotency & Double-Click Shield", "Lock pay button on first click to guarantee zero duplicate charges", "409 DUPLICATE_SUBMISSION_BLOCKED"),
            ("055", "Declined Card Friendly Error Handling", "Show clear message when bank declines card without crashing screen", "402 CARD_DECLINED_BY_BANK"),
            ("056", "Instant Payment Confirmation & Status Flip", "Update invoice status from UNPAID to PAID upon gateway webhook", "500 WEBHOOK_PROCESSING_FAILED"),
            ("057", "Automated Client Payment Receipt Delivery", "Email PDF payment receipt to client with reference and zero balance", "200 RECEIPT_DISPATCHED"),
            ("058", "Self-Service Client Historical Statements", "Allow client to download full historical statement and past invoice PDFs", "200 CLIENT_PORTAL_SUCCESS"),
        ],
        "diagram": "flow_mod_06_portal.png",
        "diag_steps": ["Open Public Token Link", "Display Branded Bill", "Submit Card Payment", "Enforce Idempotency", "Mark Invoice PAID"],
        "diag_final": "Cash Cleared & Receipt Sent",
        "diag_error": "400 / 402 / PAYMENT_FAILED"
    },
    {
        "id": "MOD-07",
        "name": "Supplier Bills & Accounts Payable Processing",
        "cases": [
            ("059", "Supplier Profile Setup & Classification", "Create vendor profile with type SUPPLIER and payment terms", "400 INVALID_SUPPLIER_DATA"),
            ("060", "Supplier Bill Entry with Invoice Reference", "Record bill with supplier invoice number, dates, and amounts", "400 MISSING_SUPPLIER_REF"),
            ("061", "Duplicate Supplier Bill Number Interception", "Reject bill sharing identical supplier invoice number for same vendor", "409 DUPLICATE_SUPPLIER_BILL"),
            ("062", "Input VAT Recovery Classification", "Accrue recoverable input VAT on standard commercial expenses", "400 INVALID_INPUT_VAT"),
            ("063", "Non-Deductible Business Expense Handling", "Tag entertainment and non-allowable expenses with zero VAT recovery", "400 TAX_TAG_INVALID"),
            ("064", "Accounts Payable GL Posting (Credit AP, Debit Expense)", "Post approved supplier bill into General Ledger AP control account", "422 AP_POSTING_FAILED"),
            ("065", "Supplier Outgoing Payment Allocation", "Record cash payment to vendor and allocate against unpaid bills", "400 OVERPAYMENT_UNSUPPORTED"),
            ("066", "Supplier Partial Payment Allocation", "Apply partial payment, leaving remaining balance in Awaiting Payment", "200 PARTIAL_PAYMENT_RECORDED"),
            ("067", "Supplier Credit Note Offset", "Apply supplier credit note against open bill to reduce accounts payable", "400 CREDIT_EXCEEDS_BILL"),
            ("068", "Supplier Remittance Advice Generation", "Generate payment remittance advice PDF for transmission to vendor", "200 REMITTANCE_DISPATCHED"),
        ],
        "diagram": "flow_mod_07_bills.png",
        "diag_steps": ["Select Supplier", "Enter Invoice Ref", "Check Duplicate Ref", "Validate Expense Nominals", "Post Credit AP & Debit Exp"],
        "diag_final": "Bill Accrued in AP",
        "diag_error": "400 / 409 / BILL_REJECTED"
    },
    {
        "id": "MOD-08",
        "name": "AI Document Intelligence & Receipt Extraction",
        "cases": [
            ("069", "Mobile Photo Receipt Upload (PNG/JPEG)", "Accept mobile camera receipt photos with image enhancement", "400 UNSUPPORTED_IMAGE_FORMAT"),
            ("070", "Multi-Page PDF Supplier Bill Upload", "Accept electronic PDF bills and process vector text + raster pages", "400 CORRUPTED_PDF"),
            ("071", "AI Vendor Identification & Confidence Scoring", "Extract vendor business name with machine learning confidence score", "422 VENDOR_UNRECOGNIZED"),
            ("072", "AI Date & Amount Extraction", "Extract transaction date, subtotal, VAT, and gross currency amount", "422 DATE_PARSE_FAILED"),
            ("073", "AI Arithmetic Balancing Guardrail", "Assert extracted net + extracted tax == gross total before suggesting", "422 AI_MATH_MISMATCH"),
            ("074", "Low Confidence Human-in-the-Loop Intercept", "Force user confirmation if OCR confidence falls below 85% threshold", "422 HUMAN_REVIEW_ENFORCED"),
            ("075", "Smart Expense Category Recommendation", "Suggest nominal code (e.g. Travel, Office Supplies) based on merchant history", "200 CATEGORY_SUGGESTED"),
            ("076", "Permanent S3/Storage Receipt Image Archiving", "Store immutable receipt image linked permanently to GL expense transaction", "500 S3_UPLOAD_FAILED"),
        ],
        "diagram": "flow_mod_08_ai.png",
        "diag_steps": ["Upload Image / PDF", "OCR Text Extraction", "Confidence Score >= 85%", "Verify Net + VAT == Gross", "Human Review & Confirm"],
        "diag_final": "Expense Posted & Image Stored",
        "diag_error": "400 / 422 / AI_GUARD_REJECTED"
    },
    {
        "id": "MOD-09",
        "name": "Banking Feeds, CSV Imports & Reconciliation",
        "cases": [
            ("077", "Business Bank Account Nominal Linking", "Link physical bank account to GL Asset control account (Code 1200)", "400 INVALID_BANK_NOMINAL"),
            ("078", "Bank Statement CSV Feed Import", "Parse standard CSV bank feeds with Date, Amount, Payee, and Reference", "400 MALFORMED_CSV_HEADER"),
            ("079", "Bank Statement Duplicate Line Hash Intercept", "Compute SHA256 of line fields and ignore previously imported lines", "409 DUPLICATE_BANK_FEED_LINE"),
            ("080", "Automated Rule-Based Invoice Matching", "Auto-match deposit with exact customer invoice amount and reference", "200 AUTO_MATCHED"),
            ("081", "Manual Multi-Transaction Bank Reconciliation", "Allow accountant to split a lump deposit across multiple open invoices", "400 SPLIT_MISMATCH"),
            ("082", "Unreconciled Bank Balance vs GL Equilibrium", "Calculate cleared bank balance and assert equality with GL Nominal 1200", "200 BANK_EQUILIBRIUM_OK"),
            ("083", "Reconciliation Clearance Locking", "Lock reconciled bank statement lines against accidental unmatching", "403 CLEARED_TRANSACTION_LOCKED"),
            ("084", "Foreign Currency Exchange Gain/Loss Entry", "Compute realised FX gain/loss when settled bank amount differs from invoice", "200 FX_GAIN_LOSS_POSTED"),
        ],
        "diagram": "flow_mod_09_banking.png",
        "diag_steps": ["Import Bank CSV Feed", "Compute SHA256 Line Hash", "Filter Duplicate Lines", "Match Open Invoices", "Reconcile Ending Balance"],
        "diag_final": "Bank Account Cleared",
        "diag_error": "400 / 409 / BANK_FEED_ERR"
    },
    {
        "id": "MOD-10",
        "name": "Financial Periods & Year-End Closing Protection",
        "cases": [
            ("085", "Monthly Accounting Period Partitioning", "Partition financial year into 12 chronological accounting periods", "400 PERIOD_OVERLAP"),
            ("086", "Interim Monthly Accounting Period Close", "Set monthly period status to CLOSED to block operational backdating", "403 UNPOSTED_DRAFTS_IN_PERIOD"),
            ("087", "Financial Year-End Final Trial Balance Verification", "Assert zero unbalanced transactions prior to initiating annual closing", "422 LEDGER_NOT_IN_BALANCE"),
            ("088", "Annual Retained Earnings Rollover Calculation", "Transfer net profit/loss from revenue/expense accounts to Retained Earnings", "500 ROLLOVER_FAILED"),
            ("089", "Temporal Database Date-Lock Enforcement", "Enforce PostgreSQL btree_gist constraint blocking edits in closed years", "403 PERIOD_TEMPORALLY_LOCKED"),
            ("090", "Audited Emergency Period Reopening", "Permit Owner to unlock period only with mandatory reason logged to audit", "403 REOPEN_AUDIT_LOG_MANDATORY"),
        ],
        "diagram": "flow_mod_10_periods.png",
        "diag_steps": ["Select Financial Year", "Run Trial Balance", "Rollover Net Income", "Set Status to CLOSED", "Activate btree_gist Lock"],
        "diag_final": "Tax Year Permanently Locked",
        "diag_error": "400 / 403 / PERIOD_LOCK_ERR"
    },
    {
        "id": "MOD-11",
        "name": "Statutory Financial Reporting & HMRC Tax Returns",
        "cases": [
            ("091", "Trial Balance Report Equilibrium Derivation", "Aggregate all nominal lines and verify sum(Debit) == sum(Credit)", "422 TB_OUT_OF_BALANCE"),
            ("092", "Profit & Loss (Income Statement) Generation", "Calculate Revenue minus Cost of Sales minus Expenses for date window", "200 PNL_GENERATED"),
            ("093", "Balance Sheet Statement Derivation", "Calculate Assets == Liabilities + Equity at specified reporting date", "422 BALANCE_SHEET_UNBALANCED"),
            ("094", "Quarterly HMRC VAT Return Box 1-9 Derivation", "Derive standard UK VAT boxes directly from posted tax control journals", "422 VAT_CALCULATION_INVALID"),
            ("095", "Making Tax Digital (MTD) HMRC API Submission", "Submit cryptographically signed VAT return directly to HMRC sandbox/live", "502 HMRC_GATEWAY_REJECTED"),
        ],
        "diagram": "flow_mod_11_reports.png",
        "diag_steps": ["Select Reporting Window", "Aggregate Nominal Accounts", "Derive P&L & Balance Sheet", "Derive VAT Boxes 1-9", "Verify Assets == Liab + Eq"],
        "diag_final": "Statutory Report Generated",
        "diag_error": "422 / 502 / REPORT_DERIVATION_ERR"
    },
    {
        "id": "MOD-12",
        "name": "Audit Trail, RBAC Governance & GRC Compliance",
        "cases": [
            ("096", "Viewer Role Write Operation Block", "Verify user with VIEWER role receives HTTP 403 on any mutating action", "403 VIEWER_READ_ONLY"),
            ("097", "Bookkeeper Settings Modification Block", "Verify BOOKKEEPER cannot alter bank accounts or organization settings", "403 BOOKKEEPER_RESTRICTED"),
            ("098", "Accountant Period Close Authority Check", "Verify only certified ACCOUNTANT or OWNER can trigger financial period close", "403 ACCOUNTANT_ROLE_REQUIRED"),
            ("099", "Audit Trail Append-Only Cryptographic Hash Chain", "Compute SHA256(prevHash + payload) ensuring zero tampered audit events", "500 AUDIT_CHAIN_BROKEN"),
            ("100", "Database-Level Direct Deletion Prevention Trigger", "Ensure direct SQL DELETE or UPDATE on audit_logs throws database exception", "500 DIRECT_SQL_MODIFICATION_BLOCKED"),
        ],
        "diagram": "flow_mod_12_audit.png",
        "diag_steps": ["Capture User Action", "Check RBAC Permission", "Execute Event Interceptor", "Compute SHA256 Hash", "Append-Only Immutability"],
        "diag_final": "Action Logged & Authorized",
        "diag_error": "403 / 500 / GOVERNANCE_VIOLATION"
    }
]

def build_all():
    print("Generating 12 Module-level Figure 7 Flowchart Diagrams...")
    for mod in MODULES:
        p = generate_figure_7_style_diagram(
            title=mod["name"],
            steps=mod["diag_steps"],
            final_step=mod["diag_final"],
            error_text=mod["diag_error"],
            filename=mod["diagram"],
            caption=f"Figure {mod['id']} — {mod['name']} Architectural Flow"
        )
        print(f"Generated diagram: {mod['diagram']}")

    # ------------------ BUILD 100 USE CASES ------------------
    print("Writing docs/BLYNT_100_USE_CASES_SPECIFICATION.md...")
    md_uc_path = os.path.join(DOCS_DIR, "BLYNT_100_USE_CASES_SPECIFICATION.md")
    with open(md_uc_path, "w", encoding="utf-8") as f:
        f.write("# Blynt — Master 100 Functional Use Cases Specification\n\n")
        f.write("**Document Classification:** Enterprise Functional Requirements & User Journey Master Specification  \n")
        f.write("**Target Audience:** Business Owners, Non-IT Stakeholders, Product Leads, and Operational Teams  \n")
        f.write("**System Name:** Blynt UK Cloud Accounting SaaS  \n")
        f.write("**Total Covered Use Cases:** Exactly 100 Exhaustive Business & Client Scenarios across 12 Modules  \n\n")
        f.write("---\n\n")
        
        for mod in MODULES:
            f.write(f"## Module {mod['id']}: {mod['name']}\n\n")
            f.write(f"![{mod['name']}](diagrams/{mod['diagram']})\n\n")
            f.write("| Use Case ID | Scenario Name | Business Objective / Journey | Failure Mode |\n")
            f.write("| :--- | :--- | :--- | :--- |\n")
            for num, name, obj, err in mod["cases"]:
                f.write(f"| **UC-{num}** | {name} | {obj} | `{err}` |\n")
            f.write("\n---\n\n")

    # ------------------ BUILD 100 TEST CASES ------------------
    print("Writing docs/BLYNT_100_TEST_CASES_SPECIFICATION.md...")
    md_tc_path = os.path.join(DOCS_DIR, "BLYNT_100_TEST_CASES_SPECIFICATION.md")
    with open(md_tc_path, "w", encoding="utf-8") as f:
        f.write("# Blynt — Master 100 QA Test Cases Specification\n\n")
        f.write("**Document Classification:** Quality Assurance Architecture & Master Test Matrix  \n")
        f.write("**Target Audience:** QA Engineers, Compliance Auditors, Test Automation Leads, and Technical Stakeholders  \n")
        f.write("**System Name:** Blynt UK Cloud Accounting SaaS  \n")
        f.write("**Total Covered Test Cases:** Exactly 100 Exhaustive Test Assertions across 12 Modules  \n\n")
        f.write("---\n\n")
        
        for mod in MODULES:
            f.write(f"## Module {mod['id']}: {mod['name']} Test Suite\n\n")
            f.write(f"![{mod['name']}](diagrams/{mod['diagram']})\n\n")
            f.write("| Test ID | Test Target | Verification Gate & Assertion | Expected Error on Failure |\n")
            f.write("| :--- | :--- | :--- | :--- |\n")
            for num, name, obj, err in mod["cases"]:
                f.write(f"| **TC-{num}** | {name} | {obj} | `ASSERT {err}` |\n")
            f.write("\n---\n\n")

    # ------------------ BUILD 100 USE CASES PDF ------------------
    print("Compiling Blynt_100_Use_Cases_Specification.pdf via ReportLab...")
    pdf_uc_path = os.path.join(DOCS_DIR, "Blynt_100_Use_Cases_Specification.pdf")
    pdf_uc_root = os.path.join(BASE_DIR, "Blynt_100_Use_Cases_Specification.pdf")
    
    doc_uc = SimpleDocTemplate(
        pdf_uc_path, pagesize=A4,
        leftMargin=36, rightMargin=36, topMargin=44, bottomMargin=44
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('DocTitle', parent=styles['Heading1'], fontName='Helvetica-Bold', fontSize=22, leading=26, textColor=colors.HexColor("#162D5F"), spaceAfter=6)
    subtitle_style = ParagraphStyle('DocSub', parent=styles['Normal'], fontName='Helvetica', fontSize=10.5, leading=14, textColor=colors.HexColor("#64748B"), spaceAfter=14)
    h2_style = ParagraphStyle('H2Style', parent=styles['Heading2'], fontName='Helvetica-Bold', fontSize=13, leading=16, textColor=colors.HexColor("#162D5F"), spaceBefore=10, spaceAfter=6)
    body_style = ParagraphStyle('Body', parent=styles['Normal'], fontName='Helvetica', fontSize=8.5, leading=12, textColor=colors.HexColor("#1E293B"))

    story_uc = []
    story_uc.append(Paragraph("Blynt — Master 100 Use Cases Specification", title_style))
    story_uc.append(Paragraph("Exhaustive Visual Flowcharts & End-to-End User Journeys (100 Scenarios / 12 Modules)", subtitle_style))
    story_uc.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#FF7F6C"), spaceAfter=12))

    story_uc.append(Paragraph(
        "<b>Document Purpose:</b> Complete architectural breakdown of 100 user cases covering every functional permutation of the Blynt accounting platform. "
        "Each functional module is anchored by a vertical Figure 7 architectural flowchart, mapping out valid domain transitions, security guards, and error rejection paths.",
        body_style
    ))
    story_uc.append(Spacer(1, 10))

    for idx, mod in enumerate(MODULES):
        if idx > 0:
            story_uc.append(PageBreak())
        story_uc.append(Paragraph(f"<b>Module {mod['id']}: {mod['name']}</b>", h2_style))
        
        # Add diagram
        diag_path = os.path.join(DIAGRAMS_DIR, mod["diagram"])
        story_uc.append(RLImage(diag_path, width=460, height=250))
        story_uc.append(Spacer(1, 8))
        
        # Table of use cases
        t_data = [["ID", "Use Case Scenario", "Business Objective & Action", "Rejection Code"]]
        for num, name, obj, err in mod["cases"]:
            t_data.append([f"UC-{num}", name, obj, err])
            
        t = Table(t_data, colWidths=[45, 170, 220, 85])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#162D5F")),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 7.5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
        ]))
        story_uc.append(t)
        story_uc.append(Spacer(1, 10))

    doc_uc.build(story_uc, canvasmaker=NumberedCanvas)
    import shutil
    shutil.copyfile(pdf_uc_path, pdf_uc_root)
    print("Blynt_100_Use_Cases_Specification.pdf successfully generated.")

    # ------------------ BUILD 100 TEST CASES PDF ------------------
    print("Compiling Blynt_100_Test_Cases_Specification.pdf via ReportLab...")
    pdf_tc_path = os.path.join(DOCS_DIR, "Blynt_100_Test_Cases_Specification.pdf")
    pdf_tc_root = os.path.join(BASE_DIR, "Blynt_100_Test_Cases_Specification.pdf")
    
    doc_tc = SimpleDocTemplate(
        pdf_tc_path, pagesize=A4,
        leftMargin=36, rightMargin=36, topMargin=44, bottomMargin=44
    )
    story_tc = []
    story_tc.append(Paragraph("Blynt — Master 100 QA Test Cases Specification", title_style))
    story_tc.append(Paragraph("Exhaustive QA Test Gate Flowcharts & Assertion Verifications (100 Test Suites / 12 Modules)", subtitle_style))
    story_tc.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#FF7F6C"), spaceAfter=12))

    story_tc.append(Paragraph(
        "<b>Document Purpose:</b> Master Quality Assurance test catalog defining exactly 100 test cases for automated, manual, and statutory verification. "
        "Each suite pairs with an architectural flowchart showing input validation gates, ledger invariant checks, and explicit HTTP/domain error assertions.",
        body_style
    ))
    story_tc.append(Spacer(1, 10))

    for idx, mod in enumerate(MODULES):
        if idx > 0:
            story_tc.append(PageBreak())
        story_tc.append(Paragraph(f"<b>Module {mod['id']}: {mod['name']} Test Suite</b>", h2_style))
        
        # Add diagram
        diag_path = os.path.join(DIAGRAMS_DIR, mod["diagram"])
        story_tc.append(RLImage(diag_path, width=460, height=250))
        story_tc.append(Spacer(1, 8))
        
        # Table of test cases
        t_data = [["ID", "Test Target", "Verification Gate & Assertion", "Expected Failure"]]
        for num, name, obj, err in mod["cases"]:
            t_data.append([f"TC-{num}", name, obj, f"ASSERT {err}"])
            
        t = Table(t_data, colWidths=[45, 170, 215, 90])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#162D5F")),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 7.5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
        ]))
        story_tc.append(t)
        story_tc.append(Spacer(1, 10))

    doc_tc.build(story_tc, canvasmaker=NumberedCanvas)
    shutil.copyfile(pdf_tc_path, pdf_tc_root)
    print("Blynt_100_Test_Cases_Specification.pdf successfully generated.")

if __name__ == "__main__":
    build_all()
