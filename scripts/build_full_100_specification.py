import os
import sys
from engine_100_diagrams import (
    generate_exact_diagram,
    NumberedCanvas,
    BASE_DIR,
    DOCS_DIR,
    CASES_DIAGRAMS_DIR
)
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

NAVY = "#162D5F"
CORAL = "#FF7F6C"
TEXT_MUTED = "#64748B"
TEXT_DARK = "#1E293B"


# 100 COMPLETE CASES SPECIFICATION DATASET
CASES_DATA = [
    # --- MODULE 1: AUTHENTICATION & MULTI-TENANCY (001-010) ---
    (1, "Standard Email & Password Login", "Authentication & Sessions", "Any Registered User",
     "User exists with active status",
     ["Submit Email & Password", "Query User Record by Email", "Verify bcrypt Password Hash", "Generate Signed JWT Session", "Load Active Tenant Binding"],
     "200 OK — Dashboard Access Granted", "401 INVALID_CREDENTIALS",
     "Assert bcrypt hash comparison passes and returns JWT access token."),
    
    (2, "Multi-Tenant Workspace Context Switching", "Authentication & Sessions", "Business Owner / Multi-Org User",
     "User belongs to at least 2 distinct organizations",
     ["Select Target Workspace Slug", "Verify User Membership in Target Org", "Check Tenant Status is Active", "Generate Scoped Tenant Token", "Switch UI State & Active Nominals"],
     "200 OK — Workspace Switched", "403 TENANT_MEMBERSHIP_REQUIRED",
     "Assert user can only switch to organizations where active membership exists."),

    (3, "Session Token Expiry & Silent Refresh", "Authentication & Sessions", "Active Logged-in User",
     "Access token expired; valid refresh token in httpOnly cookie",
     ["Intercept Expired Access Token", "Validate Refresh Token Signature", "Check Refresh Token not Revoked", "Query User & Tenant Status", "Issue New 15-Minute Access Token"],
     "200 OK — Token Rotated Silently", "401 REFRESH_TOKEN_EXPIRED",
     "Assert refresh token rotates seamlessly without forcing manual re-login."),

    (4, "Cross-Tenant Injection Prevention Guard", "Multi-Tenant Security", "Malicious Actor / External User",
     "Attacker attempts to query another tenant's resourceId",
     ["API Request with Valid User JWT", "Resolve Request Tenant ID Header", "Query Target Resource in Database", "Assert resource.orgId == token.orgId", "Execute Service Operation"],
     "200 OK — Resource Accessible", "403 TENANT_MISMATCH",
     "Assert cross-tenant data requests are blocked at controller guard level."),

    (5, "Two-Factor Authentication (2FA) TOTP Verification", "Security & Access", "User with 2FA Enabled",
     "Primary credentials verified; TOTP code submitted",
     ["Submit 6-Digit TOTP Code", "Retrieve User 2FA Secret Key", "Compute Current Time-Window Hash", "Verify Code within Drift Window", "Elevate Session to FULL_ACCESS"],
     "200 OK — 2FA Verified", "401 INVALID_TOTP_CODE",
     "Assert session remains RESTRICTED until valid TOTP code is confirmed."),

    (6, "Password Reset via Time-Limited Token", "Security & Access", "User Forgot Password",
     "Valid registered email address provided",
     ["Request Password Reset for Email", "Generate Secure Expiring Token", "Send Reset Link via Mail Service", "User Submits New Strong Password", "Invalidate Token & Update Hash"],
     "200 OK — Password Updated", "400 EXPIRED_RESET_TOKEN",
     "Assert reset tokens expire after 60 minutes and cannot be reused."),

    (7, "Brute-Force Login Rate Limiting Defense", "Security & Access", "External Client IP",
     "Target endpoint receives rapid successive requests",
     ["Client Submits Login Request", "Check Redis IP Rate Counter", "Assert Attempts < 5 within 60s", "Record Failed Attempt on Error", "Allow Request to Auth Service"],
     "200 OK — Request Processed", "429 TOO_MANY_REQUESTS",
     "Assert IP is throttled for 15 minutes after 5 consecutive failed attempts."),

    (8, "Platform Super Admin Portal Gate", "Governance & Security", "Platform Support Operator",
     "Super admin portal accessed at /admin",
     ["Request /admin Super Portal Endpoint", "Verify Super Admin JWT Role", "Assert isPlatformSuperAdmin == true", "Log Access Event to Security Audit", "Render Platform Telemetry"],
     "200 OK — Super Admin Authorized", "403 SUPER_ADMIN_REQUIRED",
     "Assert regular tenant owners receive HTTP 403 when requesting /admin."),

    (9, "User Logout & Complete Session Revocation", "Security & Access", "Authenticated User",
     "Active authenticated session exists",
     ["User Clicks 'Log Out'", "Invalidate Refresh Token in DB", "Clear Client httpOnly Cookies", "Add Access Token JTI to Blacklist", "Redirect to Login Screen"],
     "200 OK — Session Revoked", "401 SESSION_TERMINATED",
     "Assert blacklisted session token cannot be reused after logout."),

    (10, "Employee Organization Invitation & Onboarding", "Tenancy & Users", "Business Owner / Admin",
     "Inviting owner has ADMIN permissions",
     ["Submit Colleague Email & Role", "Assert Email not already Member", "Generate Signed Invitation Token", "Recipient Accepts Invitation Link", "Bind User to Organization in DB"],
     "201 Created — Membership Bound", "409 USER_ALREADY_MEMBER",
     "Assert duplicate invitations to existing members are rejected."),

    # --- MODULE 2: ORGANIZATION SETUP & SETTINGS (011-018) ---
    (11, "Organization Legal Entity Creation", "Organization Setup", "New Business Owner",
     "User is authenticated; no org created yet",
     ["Submit Legal Business Name", "Validate Country (UK / GB)", "Verify Base Currency is GBP", "Create Organization Record", "Assign Submitting User as OWNER"],
     "201 Created — Workspace Ready", "400 INVALID_ORG_PAYLOAD",
     "Assert new entity is provisioned with OWNER membership automatically."),

    (12, "Unique Organization URL Slug Allocation", "Organization Setup", "Business Owner",
     "Legal business name submitted",
     ["Derive Lowercase URL Slug", "Validate Alphanumeric & Hyphens", "Query DB: Check Slug Uniqueness", "Persist Unique Slug in Org Table", "Provision Tenant URL Routing"],
     "201 Created — Slug Assigned", "409 SLUG_ALREADY_EXISTS",
     "Assert slug uniqueness across the entire multi-tenant platform."),

    (13, "HMRC UK VAT Registration Number Validation", "Statutory Configuration", "Bookkeeper / Accountant",
     "Organization registered for UK VAT",
     ["Submit 9-Digit VAT Number", "Validate 'GB' Prefix Format", "Check Modulus-97 Algorithm", "Store Validated VAT Number", "Enable VAT Tax Derivation Engine"],
     "200 OK — VAT Number Confirmed", "400 INVALID_VAT_FORMAT",
     "Assert malformed or unverified VAT numbers are rejected at entry."),

    (14, "UK Companies House Registration Number Validation", "Statutory Configuration", "Business Owner",
     "Registered UK limited company",
     ["Submit 8-Character Company No", "Validate Alphanumeric Pattern", "Query Companies House Registry API", "Verify Active Company Status", "Persist Official Registration No"],
     "200 OK — Company Number Validated", "400 INVALID_COMPANY_NUMBER",
     "Assert company registration number conforms to UK standard format."),

    (15, "Base Trading Currency Lock (GBP)", "Multi-Currency Governance", "Business Owner",
     "New organization initialized",
     ["Select Base Trading Currency (GBP)", "Verify Currency ISO-4217 Standard", "Persist Base Currency in Org Table", "Assert Ledger Transactions Empty", "Lock Base Currency Immutably"],
     "200 OK — Base Currency Locked", "422 BASE_CURRENCY_LOCKED",
     "Assert base currency cannot be modified after initial ledger entries."),

    (16, "Financial Year Calendar Setup & Partitioning", "Accounting Foundations", "Accountant / Owner",
     "Organization created; setting accounting dates",
     ["Select Fiscal Year Start (01 April)", "Calculate Fiscal Year End (31 March)", "Partition into 12 Calendar Periods", "Persist Financial Year Record", "Set Initial Period Status to OPEN"],
     "201 Created — Calendar Active", "400 INVALID_DATE_RANGE",
     "Assert financial year spans exactly 12 contiguous accounting periods."),

    (17, "Company Branding & Invoice Logo Upload", "Branding & Customization", "Business Owner / Clerk",
     "Organization workspace active",
     ["Upload Company Logo File", "Check File Type (PNG / JPEG)", "Assert File Size <= 2 Megabytes", "Upload to AWS S3 Documents Bucket", "Save Secure Logo URL in Org Table"],
     "200 OK — Logo Configured", "400 FILE_TOO_LARGE_OR_INVALID",
     "Assert non-image files or oversized uploads are rejected before upload."),

    (18, "Organization Soft Deactivation & Archive", "Tenancy Governance", "Business Owner",
     "Business ceases trading or migrates",
     ["Owner Requests Workspace Archive", "Require 2FA & Password Re-entry", "Assert All Balances Settled (£0)", "Set Organization Status to ARCHIVED", "Maintain 7-Year Read-Only Access"],
     "200 OK — Workspace Archived", "403 OWNER_ROLE_REQUIRED",
     "Assert non-owners cannot archive organizations; records preserved for audit."),

    # --- MODULE 3: CHART OF ACCOUNTS & GENERAL LEDGER (019-028) ---
    (19, "Standard Nominal Code Creation (1000-9999)", "General Ledger", "Accountant",
     "Chart of Accounts active",
     ["Submit 4-Digit Nominal Code", "Assert Code in Valid Range", "Assign Account Classification Type", "Assign Normal Balance (DR/CR)", "Persist Nominal Account in DB"],
     "201 Created — Nominal Active", "400 INVALID_CODE_FORMAT",
     "Assert nominal codes conform strictly to UK 4-digit standard ranges."),

    (20, "Duplicate Nominal Code Constraint Check", "General Ledger", "Accountant",
     "Adding new account to COA",
     ["Enter Nominal Account Code", "Query Accounts in Same Org", "Assert Code does not already Exist", "Validate Account Name Uniqueness", "Commit Account Record"],
     "201 Created — Code Unique", "409 DUPLICATE_ACCOUNT_CODE",
     "Assert duplicate codes within the same organization are rejected."),

    (21, "Accounts Receivable Control Account Protection", "Ledger Governance", "Bookkeeper / Clerk",
     "Attempting manual journal to Code 1100",
     ["User Creates Journal Line to 1100", "Ledger Engine Checks isControlAccount", "Detect AR Control Account Flag", "Assert allowManualPosting == false", "Block Manual Journal Entry"],
     "Blocked — Manual Entry Denied", "422 AR_CONTROL_PROTECTED",
     "Assert direct journals to Accounts Receivable are physically blocked."),

    (22, "Accounts Payable Control Account Protection", "Ledger Governance", "Bookkeeper / Clerk",
     "Attempting manual journal to Code 2100",
     ["User Creates Journal Line to 2100", "Ledger Engine Checks isControlAccount", "Detect AP Control Account Flag", "Assert allowManualPosting == false", "Block Manual Journal Entry"],
     "Blocked — Manual Entry Denied", "422 AP_CONTROL_PROTECTED",
     "Assert direct journals to Accounts Payable are physically blocked."),

    (23, "VAT Control Account Automated Posting Rule", "Tax Governance", "Any User",
     "Attempting manual journal to Code 2200",
     ["User Submits Line to VAT Control", "Engine Detects Tax Nominal Tag", "Assert Source is Tax Derivation Engine", "Reject Unlinked Manual Entries", "Allow Only Invoicing / Bill Sources"],
     "Validated — Tax Engine Linked", "422 VAT_CONTROL_PROTECTED",
     "Assert VAT control nominals can only be credited/debited by tax engine."),

    (24, "Retained Earnings System Account Lock", "Ledger Governance", "Accountant",
     "Attempting edit on Code 3100",
     ["User Edits Retained Earnings 3100", "Engine Checks isSystemAccount Flag", "Assert Account is System Reserved", "Reject Direct Manual Postings", "Allow Only Annual Rollover Job"],
     "Locked — System Account Protected", "422 RETAINED_EARNINGS_LOCKED",
     "Assert Retained Earnings account is reserved exclusively for year-end closing."),

    (25, "Account Normal Balance Derivation Rule", "Accounting Invariants", "Accountant",
     "Creating nominal account",
     ["Select Account Classification Type", "Derive Normal Balance by Standard", "Assets / Expenses ➔ DEBIT Normal", "Liab / Equity / Rev ➔ CREDIT Normal", "Persist Balance Invariant in Schema"],
     "200 OK — Normal Balance Assigned", "400 INVALID_NORMAL_BALANCE",
     "Assert normal balance aligns with double-entry accounting fundamentals."),

    (26, "Parent-Child Nominal Account Hierarchy", "Chart of Accounts", "Accountant",
     "Creating sub-nominal account",
     ["Specify Parent Nominal Account Code", "Query Parent within Same Org", "Assert Parent Account Exists & Active", "Assert Parent Classification Matches", "Bind Sub-Account to Parent Hierarchy"],
     "201 Created — Hierarchy Bound", "404 PARENT_NOT_FOUND",
     "Assert sub-accounts must share classification and tenant with parent."),

    (27, "Account Deactivation with Zero Balance Check", "Chart of Accounts", "Accountant",
     "Deactivating obsolete nominal code",
     ["Request Deactivation of Account", "Compute Current Running Balance", "Assert Balance == £0.0000 Exactly", "Assert No Unposted Drafts Linked", "Set Account Status to INACTIVE"],
     "200 OK — Account Deactivated", "422 ACCOUNT_BALANCE_NON_ZERO",
     "Assert accounts with active balances cannot be deactivated."),

    (28, "Account Foreign Currency Assignment Check", "Multi-Currency", "Accountant",
     "Creating foreign currency bank/subledger",
     ["Specify Foreign Currency (USD/EUR)", "Check Currency against ISO-4217 Table", "Assert Exchange Rate Service Configured", "Link Revaluation Gain/Loss Nominals", "Activate Multi-Currency Account"],
     "201 Created — Currency Assigned", "400 UNSUPPORTED_CURRENCY",
     "Assert non-standard currency codes are rejected."),

    # --- MODULE 4: DOUBLE-ENTRY JOURNAL ENGINE (029-038) ---
    (29, "Draft Journal Entry Creation & Line Staging", "Journal Lifecycle", "Accountant",
     "Chart of accounts active; user has write permission",
     ["Submit Journal Header & Line Items", "Validate Entry Date in Open Period", "Save Lines with Status DRAFT", "Calculate Current Debit/Credit Sum", "Return Journal Draft ID"],
     "201 Created — Draft Staged", "400 EMPTY_JOURNAL_PAYLOAD",
     "Assert draft journals do not alter general ledger running balances."),

    (30, "Debits Equal Credits Equilibrium Invariant", "Accounting Invariants", "Accountant",
     "Attempting to post journal entry",
     ["Submit Journal for Posting", "Sum All Debit Lines to 4 Decimals", "Sum All Credit Lines to 4 Decimals", "Assert sum(DR) - sum(CR) == 0.0000", "Commit Atomic Posting to GL"],
     "201 Created — Equilibrium Verified", "422 JOURNAL_UNBALANCED",
     "Assert unbalanced journals are physically rejected by database constraints."),

    (31, "Minimum Two Line Items Enforcement", "Accounting Invariants", "Accountant",
     "Attempting to post journal",
     ["Validate Journal Line Array", "Count Active Non-Zero Lines", "Assert line_count >= 2", "Assert at least 1 DR and 1 CR", "Authorize Posting Pipeline"],
     "200 OK — Line Count Valid", "400 MINIMUM_LINES_REQUIRED",
     "Assert single-line transactions are rejected before ledger commit."),

    (32, "Zero Amount Line Item Rejection", "Journal Validation", "Accountant",
     "Entering journal lines",
     ["Parse Line Amount Values", "Assert Line Amount > 0.00", "Reject Lines where DR==0 and CR==0", "Highlight Zero Line in Error Feedback", "Prevent Empty Entry Staging"],
     "Validated — All Lines Non-Zero", "400 ZERO_AMOUNT_REJECTED",
     "Assert lines with zero values are flagged and blocked."),

    (33, "Mutually Exclusive Line Amounts (DR vs CR)", "Journal Validation", "Accountant",
     "Entering line values",
     ["Inspect Single Journal Line", "Check Debit Amount and Credit Amount", "Assert NOT (debit > 0 AND credit > 0)", "Enforce Either Debit OR Credit Exclusivity", "Commit Line Value to Draft"],
     "Validated — Exclusivity Enforced", "400 MUTUALLY_EXCLUSIVE_LINE",
     "Assert a single line cannot specify both debit and credit amounts."),

    (34, "Arbitrary Decimal Precision Arithmetic Check", "Accounting Precision", "System Math Engine",
     "Computing tax and currency fractions",
     ["Input Fractional Values (e.g. £10.005)", "Apply Banker's Rounding (Half to Even)", "Assert Exact Decimal Representation", "Prevent IEEE 754 Floating-Point Drift", "Store Exact Decimal in PostgreSQL"],
     "200 OK — Precision Preserved", "422 PRECISION_ROUNDING_ERR",
     "Assert floating-point rounding errors never enter general ledger balances."),

    (35, "Atomic Multi-Line Ledger Commit Transaction", "Ledger Engine", "Posting Engine",
     "Validated balanced journal ready to post",
     ["Begin PostgreSQL Database Transaction", "Insert General Ledger Header Record", "Insert All Nominal Journal Lines", "Update Account Cached Balances", "Commit Transaction Atomically"],
     "201 Created — ACID Commit Complete", "500 ATOMIC_POST_FAILED",
     "Assert failure on any single line causes complete database rollback."),

    (36, "Posted Journal Historical Immutability", "Ledger Immutability", "Any User",
     "Journal has status POSTED",
     ["User Sends HTTP PUT/DELETE on Journal", "Check Journal Status == POSTED", "Assert Posted Entries are Immutable", "Block Direct Edit or Deletion", "Prompt User to Post Reversal Instead"],
     "Protected — Immutability Upheld", "403 POSTED_JOURNAL_IMMUTABLE",
     "Assert posted accounting transactions can never be modified or erased."),

    (37, "Symmetrical GAAP Journal Reversal Linking", "Journal Reversals", "Accountant",
     "Posted journal requires correction",
     ["Select Posted Journal to Reverse", "Assert Journal is not Already Reversed", "Generate Symmetrical Offset Journal", "Link Original and Reversal Journal IDs", "Atomically Post Offsetting Lines"],
     "201 Created — Reversal Linked", "409 ALREADY_REVERSED",
     "Assert reversal creates an exact mirrored transaction preserving audit trails."),

    (38, "Draft Journal Clean Discard & Garbage Collection", "Journal Lifecycle", "Accountant",
     "Draft journal no longer needed",
     ["User Clicks 'Discard Draft'", "Assert Journal Status == DRAFT", "Delete Staged Lines from DB", "Verify Zero Impact on General Ledger", "Remove Draft from Staging Queue"],
     "200 OK — Draft Discarded", "403 CANNOT_DELETE_POSTED",
     "Assert draft journals can be safely deleted without ledger distortion."),

    # --- MODULE 5: SALES INVOICING & SUBLEDGERS (039-050) ---
    (39, "Customer Contact Profile Creation & Verification", "Commercial Subledgers", "Billing Clerk",
     "Adding new client to system",
     ["Submit Customer Name & Billing Address", "Validate UK Postcode Format", "Assign Payment Terms (e.g. Net 30)", "Validate Customer Email Address", "Persist Contact Record with Type CUSTOMER"],
     "201 Created — Customer Active", "400 INVALID_CONTACT_DATA",
     "Assert customer contact records validate address and billing terms."),

    (40, "Sales Invoice Draft Generation", "Sales & Billing", "Billing Clerk",
     "Active customer exists",
     ["Select Active Customer Profile", "Generate Next Chronological Invoice No", "Set Invoice Date & Payment Due Date", "Initialize Staged Item Lines", "Save Invoice with Status DRAFT"],
     "201 Created — Invoice Draft Staged", "404 CUSTOMER_NOT_FOUND",
     "Assert invoice numbers increment monotonically with zero duplicates."),

    (41, "UK Standard 20% VAT Line Derivation", "Tax Calculation", "Billing Clerk",
     "Item subject to standard UK VAT",
     ["Enter Line Net Amount (£1,000.00)", "Select Tax Rate 'Standard VAT (20%)'", "Compute Line VAT = Net * 0.20 (£200.00)", "Compute Line Gross = Net + VAT (£1,200.00)", "Display Line Summary on Screen"],
     "200 OK — 20% VAT Derived", "400 INVALID_TAX_CALCULATION",
     "Assert VAT standard rate applies exact 20% math with decimal accuracy."),

    (42, "UK Reduced 5% VAT Line Derivation", "Tax Calculation", "Billing Clerk",
     "Qualifying domestic fuel/energy item",
     ["Enter Line Net Amount (£500.00)", "Select Tax Rate 'Reduced VAT (5%)'", "Compute Line VAT = Net * 0.05 (£25.00)", "Compute Line Gross = Net + VAT (£525.00)", "Tag Nominal Tax Classification"],
     "200 OK — 5% VAT Derived", "400 INVALID_TAX_RATE",
     "Assert 5% reduced VAT calculates accurately on qualifying items."),

    (43, "Zero-Rated (0%) VAT Classification", "Tax Calculation", "Billing Clerk",
     "Books, printed materials or food products",
     ["Enter Line Net Amount (£100.00)", "Select Tax Rate 'Zero Rated (0%)'", "Assert Line VAT == £0.00 Exactly", "Tag Line as Zero-Rated for VAT Box 6", "Include Line in Statutory Turnover"],
     "200 OK — Zero Rate Tagged", "400 ZERO_RATE_MISCLASSIFIED",
     "Assert zero-rated items report in VAT Box 6 without generating tax liability."),

    (44, "VAT Exempt Sales Classification", "Tax Calculation", "Billing Clerk",
     "Exempt financial / educational service",
     ["Enter Line Net Amount (£250.00)", "Select Tax Rate 'Exempt'", "Assert Line VAT == £0.00", "Exclude from Output VAT Liability", "Tag for Partial Exemption Tracking"],
     "200 OK — Exempt Tagged", "400 EXEMPT_MISCLASSIFIED",
     "Assert exempt sales do not generate VAT liability or input tax entitlement."),

    (45, "CIS Domestic Reverse Charge Application", "Construction Sector", "Billing Clerk",
     "UK construction subcontractor invoicing main contractor",
     ["Enable CIS Reverse Charge Checkbox", "Apply 20% Standard Reverse Charge Rate", "Customer Accounts for VAT (DR/CR Reverse)", "Seller Invoices Net Amount Only", "Print Statutory CIS Reverse Charge Notice"],
     "200 OK — CIS Reverse Charge Applied", "400 CIS_REVERSE_CHARGE_ERR",
     "Assert invoice prints statutory HMRC reverse charge wording."),

    (46, "Invoice Total Arithmetic Validation Gate", "Invoice Validation", "Posting Engine",
     "User approves invoice for issue",
     ["Compute Sum of Item Net Amounts", "Compute Sum of Line VAT Amounts", "Assert Sum(Net) + Sum(VAT) == Total", "Check Decimal Tolerances (0.0000)", "Pass Arithmetic Validation Gate"],
     "200 OK — Math Verified", "422 ARITHMETIC_TOTAL_MISMATCH",
     "Assert invoice total exactly equals sum of item net lines plus tax lines."),

    (47, "Invoice Approval & General Ledger Posting", "Invoice Posting", "Billing Clerk",
     "Invoice passes arithmetic gate",
     ["Click 'Approve & Issue Invoice'", "Debit Accounts Receivable (Control 1100)", "Credit Sales Revenue (Nominal 4000)", "Credit VAT Output (Control 2200)", "Update Invoice Status to UNPAID"],
     "201 Issued — Posted to Ledger", "400 APPROVAL_VALIDATION_ERR",
     "Assert approving an invoice synchronously creates balanced GL journal."),

    (48, "Customer Subledger Balance Synchronization", "Commercial Subledgers", "Subledger Engine",
     "Invoice posted to ledger",
     ["Retrieve Customer Subledger Account", "Add Invoice Total to Current Balance", "Update Customer Total Outstanding", "Record Aging Bucket (Current / 30 / 60)", "Commit Subledger State in DB"],
     "200 OK — Customer Balance Updated", "500 SUBLEDGER_SYNC_FAILED",
     "Assert customer subledger balance increments immediately upon posting."),

    (49, "Customer Statement Chronological Running Balance", "Customer Reporting", "Billing Clerk / Client",
     "Customer requests account statement",
     ["Query Invoices & Payments for Customer", "Sort Chronologically by Transaction Date", "Compute Running Balance after Each Entry", "Assert Final Balance Matches Ledger", "Generate Formatted Statement View"],
     "200 OK — Statement Rendered", "200 STATEMENT_GENERATED",
     "Assert statement running balance tracks debits, credits, and net owed."),

    (50, "Print-Ready A4 Invoice PDF Compilation", "Document Generation", "Billing Clerk / Client",
     "Customer requires official PDF",
     ["Assemble Invoice Data & Org Branding", "Format Headers, Items Table, Remittance", "Enforce A4 Margins & Font Embedding", "Assert Single Page Fit for Standard Bills", "Compile PDF Document File"],
     "200 OK — A4 PDF Compiled", "500 PDF_RENDER_FAILED",
     "Assert PDF generates within 2s with company numbers and VAT details."),

    # --- MODULE 6: CLIENT PORTAL & ONLINE PAYMENTS (051-058) ---
    (51, "Public Magic Token Invoice View Access", "Client Experience", "External Customer",
     "Client clicks link in email",
     ["Client Opens Public URL with Secure Token", "Validate Token Expiry & Cryptographic Hash", "Assert Invoice Exists & Belongs to Org", "Render Public Invoice Web View", "Log Client View Timestamp in Audit"],
     "200 OK — Invoice Displayed", "404 TOKEN_EXPIRED_OR_INVALID",
     "Assert client accesses view without being prompted for password."),

    (52, "Client Portal Brand Consistency Verification", "Client Experience", "External Customer",
     "Client viewing invoice online",
     ["Render Organization High-Res Logo", "Display Seller Legal Name & Address", "Display Seller VAT & Co Number", "Display Itemized Breakdown & Bank Info", "Assert 100% Mobile Responsive Layout"],
     "200 OK — Branding Confirmed", "200 BRANDING_VERIFIED",
     "Assert client view displays consistent company identity on all devices."),

    (53, "Online Credit Card Payment Initiation", "Payment Gateway", "External Customer",
     "Client ready to settle invoice",
     ["Client Clicks 'Pay Now' Button", "Initialize Stripe Payment Intent", "Pass Amount in Minor Units (Pence)", "Mount Secure Stripe Elements Card Form", "Await Client Card Submission"],
     "200 OK — Payment Modal Ready", "400 INVALID_PAYMENT_AMOUNT",
     "Assert payment intent amount matches invoice total pence exactly."),

    (54, "Payment Idempotency & Double-Click Shield", "Client-Side Security", "External Customer",
     "Client clicks pay button rapidly",
     ["Client Clicks 'Pay £1,200.00'", "Disable Button & Show Spinner Immediately", "Generate Unique UUID Idempotency Key", "Pass Idempotency Key to Payment API", "Reject Subsequent Concurrent Clicks"],
     "200 OK — Double-Click Blocked", "409 DUPLICATE_SUBMISSION_BLOCKED",
     "Assert rapid multi-clicking cannot produce duplicate card charges."),

    (55, "Declined Card Friendly Error Handling", "Payment Gateway", "External Customer",
     "Bank declines submitted card",
     ["Payment Gateway Returns Card Error", "Capture Decline Code (insufficient_funds)", "Display Friendly Non-Technical Message", "Keep Invoice Unpaid & Enable Retry", "Log Failed Attempt for Seller Notice"],
     "Handled — Friendly Error Displayed", "402 CARD_DECLINED_BY_BANK",
     "Assert clear actionable error shown without exposing technical stack trace."),

    (56, "Instant Payment Confirmation & Status Flip", "Payment Gateway", "System Webhook",
     "Stripe payment succeeds",
     ["Payment Gateway Emits payment_intent.succeeded", "Verify Webhook Cryptographic Signature", "Debit Bank Current Account (Code 1200)", "Credit Accounts Receivable (Code 1100)", "Update Invoice Status to PAID"],
     "200 OK — Invoice Settled", "500 WEBHOOK_PROCESSING_FAILED",
     "Assert invoice flips to PAID and cash is recorded in general ledger."),

    (57, "Automated Client Payment Receipt Delivery", "Client Communications", "Mail Engine",
     "Payment processed successfully",
     ["Generate Clean Payment Receipt PDF", "Include Payment Reference & Zero Balance", "Dispatch Receipt Email to Client Address", "Record Delivery in Communications Log", "Display On-Screen Download Button"],
     "200 OK — Receipt Dispatched", "200 RECEIPT_DISPATCHED",
     "Assert payment confirmation email delivers within 30 seconds of charge."),

    (58, "Self-Service Client Historical Statements", "Client Experience", "External Customer",
     "Client reviewing past trading history",
     ["Client Navigates to 'My Account' Portal", "Query All Invoices for Contact Token", "Display Paid Invoices, Dates & Receipts", "Provide 1-Click PDF Download for Each", "Show Current Outstanding Balance (£0.00)"],
     "200 OK — Statements Available", "200 CLIENT_PORTAL_SUCCESS",
     "Assert clients can retrieve past invoices without contacting finance staff."),

    # --- MODULE 7: SUPPLIER BILLS & ACCOUNTS PAYABLE (059-068) ---
    (59, "Supplier Contact Profile Setup & Classification", "Purchases & AP", "Bookkeeper",
     "Adding new supplier to vendor registry",
     ["Submit Vendor Business Name", "Validate Vendor Address & Payment Terms", "Assign Contact Classification SUPPLIER", "Record Vendor Bank Account Details", "Persist Vendor Record in DB"],
     "201 Created — Supplier Active", "400 INVALID_SUPPLIER_DATA",
     "Assert vendor record captures remittance details and terms."),

    (60, "Supplier Bill Entry with Invoice Reference", "Purchases & AP", "Bookkeeper",
     "Received invoice from supplier",
     ["Select Supplier from Directory", "Enter Supplier's Own Invoice Number", "Enter Bill Date & Payment Due Date", "Add Expense Line Items & Nominals", "Stage Bill with Status DRAFT"],
     "201 Created — Bill Staged", "400 MISSING_SUPPLIER_REF",
     "Assert supplier bills require vendor invoice reference number."),

    (61, "Duplicate Supplier Bill Number Interception", "Fraud Prevention", "Posting Engine",
     "Entering supplier bill",
     ["Query Bills for Same Supplier ID", "Check for Matching Supplier Reference", "Assert Reference is Unique for Vendor", "Reject Entry if Duplicate Found", "Alert User with Existing Bill Link"],
     "200 OK — Reference Unique", "409 DUPLICATE_SUPPLIER_BILL",
     "Assert duplicate vendor bill numbers are blocked to prevent double-payment."),

    (62, "Input VAT Recovery Classification Rule", "Tax Accounting", "Bookkeeper",
     "Entering allowable commercial purchase",
     ["Add Expense Item Line (£200.00)", "Select Tax Code 'Standard Input VAT (20%)'", "Compute Reclaimable VAT (£40.00)", "Debit VAT Input Account (Code 2210)", "Accrue Input Tax for VAT Return Box 4"],
     "200 OK — Input Tax Reclaimed", "400 INVALID_INPUT_VAT",
     "Assert valid commercial input VAT is routed to VAT Box 4 reclaim."),

    (63, "Non-Deductible Business Expense Handling", "Tax Accounting", "Bookkeeper",
     "Client entertainment or non-allowable expense",
     ["Select Category 'Business Entertainment'", "Tag Expense as Non-Deductible for Tax", "Force VAT Recovery Rate to 0%", "Route Full Gross Amount to Expense", "Exclude from VAT Box 4 Reclaim"],
     "200 OK — Tagged Non-Deductible", "400 TAX_TAG_INVALID",
     "Assert entertainment expenses do not illegally reclaim input VAT."),

    (64, "Accounts Payable General Ledger Posting", "Ledger Engine", "Bookkeeper",
     "Supplier bill approved for payment",
     ["Click 'Approve Supplier Bill'", "Debit Expense Nominals (e.g. 7000)", "Debit VAT Input Control (Code 2210)", "Credit Accounts Payable (Control 2100)", "Update Bill Status to AWAITING_PAYMENT"],
     "201 Posted — AP Accrued", "422 AP_POSTING_FAILED",
     "Assert approving supplier bill synchronously updates AP balance."),

    (65, "Supplier Outgoing Payment Allocation", "Purchases & AP", "Bookkeeper",
     "Paying supplier from company bank",
     ["Select Open Supplier Bill", "Record Outgoing Payment Amount", "Credit Bank Asset Account (Code 1200)", "Debit Accounts Payable (Code 2100)", "Reduce Bill Outstanding Balance to £0"],
     "200 OK — Bill Paid in Full", "400 OVERPAYMENT_UNSUPPORTED",
     "Assert supplier payment clears AP subledger and decrements bank account."),

    (66, "Supplier Partial Payment Allocation", "Purchases & AP", "Bookkeeper",
     "Paying installment on large bill",
     ["Submit Partial Payment (£500 of £1,000)", "Apply Payment against Bill", "Reduce Outstanding Balance to £500", "Maintain Bill Status as AWAITING_PAYMENT", "Update Supplier Statement Balance"],
     "200 OK — Partial Payment Recorded", "200 PARTIAL_PAYMENT_RECORDED",
     "Assert partial payments decrement AP while keeping bill active."),

    (67, "Supplier Credit Note Offset Application", "Purchases & AP", "Bookkeeper",
     "Supplier issues credit note for returned goods",
     ["Record Supplier Credit Note", "Debit Accounts Payable (Code 2100)", "Credit Expense / Purchase Returns", "Allocate Credit Note against Open Bill", "Reduce Net Amount Owed to Vendor"],
     "200 OK — Credit Note Applied", "400 CREDIT_EXCEEDS_BILL",
     "Assert credit notes correctly offset outstanding supplier balances."),

    (68, "Supplier Remittance Advice Generation", "Document Generation", "Bookkeeper",
     "Batch supplier payments executed",
     ["Assemble Paid Bills & Payment References", "Format Remittance Advice Document", "Generate PDF Remittance Advice", "Email Remittance to Supplier Finance", "Archive Remittance in Payment Record"],
     "200 OK — Remittance Dispatched", "200 REMITTANCE_DISPATCHED",
     "Assert supplier remittance advice details exact invoices being settled."),

    # --- MODULE 8: AI DOCUMENT INTELLIGENCE & RECEIPTS (069-076) ---
    (69, "Mobile Photo Receipt Upload & Normalization", "AI Intelligence", "Staff Member",
     "Employee submits paper expense receipt",
     ["Capture Receipt Photo via Mobile Camera", "Upload PNG/JPEG Image File", "Perform Contrast & Rotation Enhancement", "Store Raw Image in Temporary S3 Bucket", "Dispatch Job to OCR Pipeline"],
     "200 OK — Receipt Uploaded", "400 UNSUPPORTED_IMAGE_FORMAT",
     "Assert images are normalized and enhanced before text recognition."),

    (70, "Multi-Page PDF Supplier Bill Parsing", "AI Intelligence", "Bookkeeper",
     "Received multi-page digital supplier PDF",
     ["Upload Multi-Page PDF Document", "Extract Embedded Text Streams", "Rasterize Pages for OCR Fallback", "Merge Multi-Page Line Items", "Send Normalized Payload to AI Engine"],
     "200 OK — PDF Ingested", "400 CORRUPTED_PDF",
     "Assert multi-page bills extract lines across all pages without dropping items."),

    (71, "AI Vendor Identification & Confidence Scoring", "AI Intelligence", "AI Engine",
     "Raw OCR text generated",
     ["Match Text against Merchant Knowledgebase", "Identify Vendor Legal Business Name", "Calculate Extraction Confidence Score (0-1)", "Assert Confidence Score >= 0.85", "Auto-Select Matching Supplier Record"],
     "200 OK — Vendor Identified", "422 VENDOR_UNRECOGNIZED",
     "Assert vendor recognition scores below 85% trigger human review."),

    (72, "AI Date & Amount Precision Parsing", "AI Intelligence", "AI Engine",
     "OCR text analyzed",
     ["Parse Transaction Date String", "Validate Date <= Current System Date", "Extract Net Amount, VAT, and Total", "Normalize Currencies to GBP Base", "Stage Extracted Numerical Values"],
     "200 OK — Numbers Parsed", "422 DATE_PARSE_FAILED",
     "Assert future transaction dates are flagged and blocked."),

    (73, "AI Arithmetic Balancing Guardrail Rule", "AI Guardrails", "AI Safety Engine",
     "Numerical fields extracted",
     ["Compute Sum of Extracted Line Items", "Add Extracted VAT Amount", "Assert Extracted Net + VAT == Total", "Check Discrepancy Tolerance (£0.00)", "Pass AI Mathematical Integrity Check"],
     "200 OK — Math Balanced", "422 AI_MATH_MISMATCH",
     "Assert AI hallucinated totals that do not match lines are intercepted."),

    (74, "Low Confidence Human-in-the-Loop Intercept", "AI Guardrails", "AI Safety Engine",
     "Receipt blurry or handwriting detected",
     ["Evaluate AI Confidence Composite Score", "Detect Confidence < 85% on Critical Fields", "Flag Transaction for Human Review", "Present Side-by-Side Verification Screen", "Require User Confirmation before Save"],
     "Intercepted — Review Enforced", "422 HUMAN_REVIEW_ENFORCED",
     "Assert unclear receipts never post to the general ledger automatically."),

    (75, "Smart Expense Category Recommendation", "AI Intelligence", "AI Engine",
     "Vendor identified (e.g. Costa Coffee)",
     ["Query Merchant Categorization History", "Suggest Nominal Code 7400 (Travel & Meals)", "Display Suggested Category to User", "Allow 1-Click User Confirmation", "Update Machine Learning Merchant Weight"],
     "200 OK — Category Recommended", "200 CATEGORY_SUGGESTED",
     "Assert categorization recommendations learn from historical user approvals."),

    (76, "Permanent Cloud Storage Image Archiving", "Statutory Compliance", "Storage Service",
     "Expense confirmed and approved",
     ["Move Receipt Image to Permanent S3 Bucket", "Apply Object Immutability Retention Policy", "Link Image URL to General Ledger Line", "Generate Audit Verification Checksum", "Ensure HMRC 7-Year Accessibility"],
     "200 OK — Receipt Archived", "500 S3_UPLOAD_FAILED",
     "Assert expense transactions permanently link to accessible receipt images."),

    # --- MODULE 9: BANKING FEEDS & RECONCILIATION (077-084) ---
    (77, "Business Bank Account Nominal Account Binding", "Banking Setup", "Accountant",
     "Configuring corporate current account",
     ["Submit Bank Name, Sort Code & Account No", "Validate UK 6-Digit Sort Code Format", "Validate UK 8-Digit Account No Format", "Bind to GL Asset Control Account (Code 1200)", "Initialize Cleared Bank Balance at £0"],
     "201 Created — Bank Account Bound", "400 INVALID_BANK_NOMINAL",
     "Assert bank accounts bind directly to isolated general ledger nominals."),

    (78, "Bank Statement CSV Feed Parsing", "Banking Feeds", "Bookkeeper",
     "Importing statement download from bank",
     ["Upload Bank Statement CSV File", "Validate CSV Column Headers (Date, Amount, Ref)", "Parse Chronological Statement Rows", "Normalize Debit / Credit Signs", "Stage Lines in Statement Import Buffer"],
     "200 OK — Statement Parsed", "400 MALFORMED_CSV_HEADER",
     "Assert malformed CSV structures are rejected before staging."),

    (79, "Bank Statement Duplicate Line Hash Intercept", "Banking Feeds", "Banking Engine",
     "Importing overlapping bank statement",
     ["Compute SHA256(date + amount + reference)", "Query Existing Imported Bank Feeds", "Assert Hash does not already Exist", "Filter Out Already Imported Lines", "Import Only New Unique Transactions"],
     "200 OK — Duplicates Filtered", "409 DUPLICATE_BANK_FEED_LINE",
     "Assert overlapping bank statement imports never duplicate transactions."),

    (80, "Automated Rule-Based Invoice Matching", "Bank Reconciliation", "Reconciliation Engine",
     "Bank transaction imported (£1,200 deposit)",
     ["Scan Unpaid Customer Invoices", "Find Invoice with Exact Matching Amount", "Match Customer Reference in Description", "Auto-Suggest 1-Click Reconciliation", "Highlight Match in Reconciliation Screen"],
     "200 OK — Auto-Matched", "200 AUTO_MATCHED",
     "Assert exact amount and reference matches are presented for approval."),

    (81, "Manual Multi-Transaction Bank Split Reconciliation", "Bank Reconciliation", "Accountant",
     "Lump deposit pays multiple invoices",
     ["Select Single Lump Deposit (£2,500)", "Select Multiple Open Invoices (Inv 1 + Inv 2)", "Assert Sum(Invoices) == Deposit Amount", "Allocate Portions to Respective Invoices", "Clear Bank Line and Invoices Atomically"],
     "200 OK — Split Reconciled", "400 SPLIT_MISMATCH",
     "Assert multi-invoice reconciliation must match total deposit pennies."),

    (82, "Unreconciled Bank Balance vs GL Equilibrium", "Ledger Integrity", "Accountant",
     "Running monthly bank reconciliation",
     ["Compute Cleared Bank Statement Balance", "Compute GL Nominal 1200 Running Balance", "Assert Statement Balance == GL Balance", "Display £0.00 Difference Indicator", "Generate Bank Reconciliation Report"],
     "200 OK — Equilibrium Confirmed", "200 BANK_EQUILIBRIUM_OK",
     "Assert bank statement matches general ledger cash account exactly."),

    (83, "Reconciliation Clearance Locking Rule", "Audit Governance", "Accountant",
     "Transactions reconciled and cleared",
     ["Set Reconciled Status on Bank Line", "Lock Transaction against Unmatching", "Require Accountant Authority to Reopen", "Log Any Reopening to Security Audit", "Preserve Closed Bank Balance History"],
     "Locked — Reconciliation Protected", "403 CLEARED_TRANSACTION_LOCKED",
     "Assert reconciled bank lines cannot be deleted or modified casually."),

    (84, "Realised Foreign Currency Exchange Gain/Loss", "Multi-Currency", "Ledger Engine",
     "Settling USD invoice via GBP bank account",
     ["Record Foreign Currency Bank Settlement", "Compare Spot Rate with Invoice Booking Rate", "Compute Currency Variance Amount", "Debit/Credit Realised FX Gain/Loss Nominal", "Clear AR Subledger to Zero Balance"],
     "200 OK — FX Variance Posted", "200 FX_GAIN_LOSS_POSTED",
     "Assert foreign exchange variances route automatically to P&L accounts."),

    # --- MODULE 10: FINANCIAL PERIODS & YEAR-END CLOSING (085-090) ---
    (85, "Monthly Accounting Period Calendar Partitioning", "Period Governance", "Accountant",
     "Setting up annual accounting periods",
     ["Partition Financial Year into 12 Months", "Validate Date Boundaries do not Overlap", "Assign Period Numbers (Period 1 to 12)", "Set Current Active Period to OPEN", "Persist Accounting Periods Table"],
     "201 Created — Periods Partitioned", "400 PERIOD_OVERLAP",
     "Assert accounting periods cover calendar dates contiguously without gaps."),

    (86, "Interim Monthly Accounting Period Close", "Period Governance", "Accountant",
     "Month-end accounts finalized",
     ["Accountant Requests Month-End Close", "Assert Zero Unposted Drafts in Month", "Set Accounting Period Status to CLOSED", "Block Backdating of Invoices into Month", "Advance Active Period to Next Month"],
     "200 OK — Month Closed", "403 UNPOSTED_DRAFTS_IN_PERIOD",
     "Assert months with unposted drafts cannot be closed prematurely."),

    (87, "Financial Year-End Final Trial Balance Check", "Year-End Closing", "Certified Accountant",
     "Preparing annual statutory closing",
     ["Run Final Full Year Trial Balance", "Assert Sum(Debits) == Sum(Credits)", "Assert Bank Reconciliation Complete", "Assert All Suspense Accounts at £0", "Authorize Year-End Closing Sequence"],
     "200 OK — Year-End Audit Passed", "422 LEDGER_NOT_IN_BALANCE",
     "Assert year-end closing is blocked if trial balance is out of equilibrium."),

    (88, "Annual Retained Earnings Rollover Engine", "Year-End Closing", "Accounting Engine",
     "Year-end closing triggered",
     ["Aggregate All Revenue Nominals (Credit)", "Aggregate All Expense Nominals (Debit)", "Compute Net Profit / Loss for the Year", "Zero Out All Revenue and Expense Accounts", "Credit/Debit Retained Earnings (Code 3100)"],
     "200 OK — Net Profit Rolled Over", "500 ROLLOVER_FAILED",
     "Assert P&L nominals reset to zero and net income rolls to Retained Earnings."),

    (89, "Temporal Database Date-Lock Enforcement", "Statutory Immutability", "PostgreSQL Engine",
     "Attempting to post entry into closed year",
     ["User Submits Transaction with Closed Date", "PostgreSQL btree_gist Constraint Fires", "Check Effective Date against Closed Periods", "Detect Date in LOCKED / CLOSED Year", "Physically Reject Database Insert"],
     "Rejected — Period Temporally Locked", "403 PERIOD_TEMPORALLY_LOCKED",
     "Assert database-level temporal constraints block backdating into filed years."),

    (90, "Audited Emergency Period Reopening Workflow", "Period Governance", "Business Owner / CPA",
     "Audit adjustment required in closed period",
     ["Owner Requests Emergency Period Unlock", "Require Multi-Factor Authentication", "Enter Mandatory Statutory Justification", "Log Event with Timestamp & IP in Audit", "Unlock Period for Limited 24h Window"],
     "200 OK — Reopening Logged", "403 REOPEN_AUDIT_LOG_MANDATORY",
     "Assert emergency period reopening is impossible without immutable audit logging."),

    # --- MODULE 11: STATUTORY REPORTING & HMRC MTD (091-095) ---
    (91, "Trial Balance Report Equilibrium Derivation", "Financial Reporting", "Accountant",
     "Generating Trial Balance report",
     ["Query All Posted GL Nominal Lines", "Compute Sum of Debits and Credits", "Assert Sum(Debit) == Sum(Credit) Exactly", "Assert Out-of-Balance Variance is £0.00", "Render Balanced Trial Balance Table"],
     "200 OK — Trial Balance Generated", "422 TB_OUT_OF_BALANCE",
     "Assert trial balance reports display zero variance across all accounts."),

    (92, "Profit & Loss (Income Statement) Derivation", "Financial Reporting", "Business Owner / CPA",
     "Reviewing company profitability",
     ["Query Revenue Nominals (Codes 4000-4999)", "Query Cost of Sales (Codes 5000-5999)", "Calculate Gross Profit = Revenue - COS", "Query Overheads / Expenses (6000-8999)", "Calculate Net Profit / Loss before Tax"],
     "200 OK — P&L Statement Rendered", "200 PNL_GENERATED",
     "Assert P&L accurately calculates gross margin and operating profit."),

    (93, "Balance Sheet Statement Derivation & Balance", "Financial Reporting", "Accountant",
     "Generating balance sheet report",
     ["Aggregate Total Assets (Codes 1000-1999)", "Aggregate Liabilities (Codes 2000-2999)", "Aggregate Equity & Retained Earnings", "Assert Assets == Liabilities + Equity", "Render Formatted Balance Sheet"],
     "200 OK — Balance Sheet in Balance", "422 BALANCE_SHEET_UNBALANCED",
     "Assert balance sheet satisfies fundamental accounting equation."),

    (94, "Quarterly HMRC VAT Return Box 1-9 Derivation", "Tax Compliance", "Accountant",
     "Preparing quarterly VAT filing",
     ["Aggregate Output Tax on Sales (Box 1)", "Aggregate Output Tax on EC/Imports (Box 2)", "Compute Total Output Tax (Box 3 = 1 + 2)", "Aggregate Input Tax on Purchases (Box 4)", "Compute Net VAT Due (Box 5 = |3 - 4|)"],
     "200 OK — Boxes 1-9 Derived", "422 VAT_CALCULATION_INVALID",
     "Assert statutory UK VAT 9 boxes derive directly from general ledger lines."),

    (95, "HMRC Making Tax Digital (MTD) API Submission", "Statutory Compliance", "Certified Accountant",
     "Submitting finalized VAT return to HMRC",
     ["Validate Finalized VAT Box Figures", "Generate MTD Cryptographic JSON Payload", "Sign Request with HMRC OAuth Credentials", "Transmit to HMRC Production API Endpoint", "Store HMRC Submission Receipt Reference"],
     "200 OK — VAT Return Accepted by HMRC", "502 HMRC_GATEWAY_REJECTED",
     "Assert digital filing produces cryptographic HMRC confirmation receipt."),

    # --- MODULE 12: AUDIT TRAIL, RBAC & GRC (096-100) ---
    (96, "Viewer Role Write Operation Block Enforcement", "Security Governance", "Auditor / Read-Only User",
     "User with VIEWER role clicks 'Create'",
     ["Viewer Submits POST /invoices Endpoint", "Intercept at RolesGuard Level", "Inspect User Role Claim == VIEWER", "Assert VIEWER has Zero Write Permissions", "Abort Execution before DB Access"],
     "Access Denied — Read Only Enforced", "403 VIEWER_READ_ONLY",
     "Assert users with VIEWER role cannot execute mutating operations."),

    (97, "Bookkeeper Settings Modification Prohibition", "Security Governance", "Bookkeeper",
     "Bookkeeper attempts altering bank account",
     ["Bookkeeper Submits PUT /settings/bank", "Intercept at PermissionGuard Level", "Assert Operation Requires Role ADMIN/OWNER", "Deny Modification to Bookkeeper", "Log Privilege Breach Attempt in Audit"],
     "Access Denied — Admin Required", "403 BOOKKEEPER_RESTRICTED",
     "Assert operational staff cannot modify financial infrastructure settings."),

    (98, "Accountant Period Close Authority Validation", "Governance & Compliance", "Bookkeeper vs Accountant",
     "Attempting to close financial year",
     ["User Triggers Financial Year Close", "Inspect Role Claim in Active Token", "Assert Role is certified ACCOUNTANT or OWNER", "Reject Request if Role is BOOKKEEPER", "Authorize Year Close Pipeline"],
     "200 OK — Close Authorized", "403 ACCOUNTANT_ROLE_REQUIRED",
     "Assert only qualified accountants or owners can close accounting periods."),

    (99, "Audit Trail Cryptographic SHA-256 Hash Chain", "GRC Compliance", "Audit Service",
     "Any ledger event executed",
     ["Capture Mutation Event & User Identity", "Fetch Previous Audit Record SHA256 Hash", "Compute Current Hash = SHA256(prev + data)", "Append Entry to audit_logs Table", "Verify Cryptographic Chain Continuity"],
     "201 Created — Chain Verified", "500 AUDIT_CHAIN_BROKEN",
     "Assert audit log entries are cryptographically chained to prevent tampering."),

    (100, "Database Direct Deletion Prevention Trigger", "Statutory Immutability", "PostgreSQL Engine",
     "Direct SQL attack attempting to delete audit",
     ["Attacker Executes SQL: DELETE FROM audit_logs", "PostgreSQL BEFORE DELETE Trigger Fires", "Raise Exception: AUDIT_LOG_IMMUTABLE", "Rollback Database Transaction", "Preserve 100% of Historical Audit Records"],
     "Blocked — Database Trigger Protected", "500 DIRECT_SQL_MODIFICATION_BLOCKED",
     "Assert database triggers physically prevent deletion of compliance audit logs.")
]

def generate_all_100():
    print(f"Generating 100 individual case diagrams in {CASES_DIAGRAMS_DIR}...")
    diagram_paths = []
    
    for case in CASES_DATA:
        cid, title, module, actor, precond, steps, final_step, error_text, assertion = case
        filename = f"case_{cid:03d}.png"
        out_path = os.path.join(CASES_DIAGRAMS_DIR, filename)
        
        generate_exact_diagram(
            steps=steps,
            final_step=final_step,
            error_text=error_text,
            out_path=out_path,
            caption=f"Figure {cid:03d} — {title} Flow Architecture"
        )
        diagram_paths.append(out_path)
        if cid % 10 == 0:
            print(f"  Generated {cid}/100 diagrams...")
            
    print("All 100 diagrams successfully generated!")
    return diagram_paths

def build_use_cases_pdf_and_md():
    print("\n--- Compiling Blynt_100_Use_Cases_Specification ---")
    pdf_path_docs = os.path.join(DOCS_DIR, "Blynt_100_Use_Cases_Specification.pdf")
    pdf_path_root = os.path.join(BASE_DIR, "Blynt_100_Use_Cases_Specification.pdf")
    md_path = os.path.join(DOCS_DIR, "BLYNT_100_USE_CASES_SPECIFICATION.md")
    
    # 1. Write Markdown
    print("Writing Markdown file...")
    with open(md_path, "w", encoding="utf-8") as f:
        f.write("# Blynt — Complete 100 Functional Use Cases Specification\n\n")
        f.write("**Document Classification:** Master Functional Requirements & User Journey Specification  \n")
        f.write("**Target Audience:** Business Owners, Operational Stakeholders, Compliance Auditors, and QA Leads  \n")
        f.write("**System Name:** Blynt UK Cloud Accounting SaaS  \n")
        f.write("**Total Covered Use Cases:** Exactly 100 Individual Business & Client Scenarios with Individual Diagrams  \n\n")
        f.write("---\n\n")
        
        for case in CASES_DATA:
            cid, title, module, actor, precond, steps, final_step, error_text, assertion = case
            diag_file = f"diagrams/cases_100/case_{cid:03d}.png"
            
            f.write(f"## UC-{cid:03d}: {title}\n\n")
            f.write(f"* **Functional Module:** {module}\n")
            f.write(f"* **Primary Actor:** {actor}\n")
            f.write(f"* **Preconditions:** {precond}\n\n")
            f.write(f"### Visual Flowchart Architecture\n\n")
            f.write(f"![Figure {cid:03d} - {title}]({diag_file})\n\n")
            f.write("### Sequential Execution Steps\n\n")
            for i, st in enumerate(steps, 1):
                f.write(f"{i}. **{st}:** System verifies parameters and state.\n")
            f.write(f"{len(steps)+1}. **Success Endpoint ({final_step}):** Operation committed to ledger.\n\n")
            f.write(f"* **Rejection Failure Mode:** `{error_text}`\n")
            f.write(f"* **Business Invariant:** {assertion}\n\n")
            f.write("---\n\n")

    # 2. Build PDF via ReportLab
    print("Compiling PDF via ReportLab (100 Cases)...")
    doc = SimpleDocTemplate(
        pdf_path_docs, pagesize=A4,
        leftMargin=36, rightMargin=36, topMargin=44, bottomMargin=44
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('DocTitle', parent=styles['Heading1'], fontName='Helvetica-Bold', fontSize=20, leading=24, textColor=colors.HexColor(NAVY), spaceAfter=4)
    subtitle_style = ParagraphStyle('DocSub', parent=styles['Normal'], fontName='Helvetica', fontSize=9.5, leading=13, textColor=colors.HexColor(TEXT_MUTED), spaceAfter=10)
    case_title_style = ParagraphStyle('CaseTitle', parent=styles['Heading2'], fontName='Helvetica-Bold', fontSize=12, leading=15, textColor=colors.HexColor(NAVY), spaceBefore=4, spaceAfter=4)
    meta_style = ParagraphStyle('Meta', parent=styles['Normal'], fontName='Helvetica', fontSize=8, leading=11, textColor=colors.HexColor(TEXT_DARK), spaceAfter=4)
    body_style = ParagraphStyle('Body', parent=styles['Normal'], fontName='Helvetica', fontSize=7.5, leading=10.5, textColor=colors.HexColor(TEXT_DARK))

    story = []
    # Title Cover Page
    story.append(Paragraph("Blynt — Complete 100 Use Cases Specification", title_style))
    story.append(Paragraph("Exhaustive Architectural Flowcharts & Business User Journeys Across All 100 System Scenarios", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor(CORAL), spaceAfter=10))

    intro = """
    <b>Master Specification Overview:</b> This document provides an exhaustive, visual specification of all 100 functional scenarios in the Blynt cloud accounting platform.
    Every single use case contains an individual, dedicated architectural flowchart following the vertical validation pattern: descending sequentially through security, business logic, and mathematical integrity checks before committing to the general ledger, with every failure condition mapped to explicit domain error branches.
    """
    story.append(Paragraph(intro, meta_style))
    story.append(Spacer(1, 10))

    # Add each case (1 case per half page / 2 per page)
    for idx, case in enumerate(CASES_DATA):
        cid, title, module, actor, precond, steps, final_step, error_text, assertion = case
        
        if idx > 0 and idx % 2 == 0:
            story.append(PageBreak())
            
        story.append(Paragraph(f"<b>UC-{cid:03d}: {title}</b>", case_title_style))
        story.append(Paragraph(f"<b>Module:</b> {module} &nbsp;|&nbsp; <b>Actor:</b> {actor} &nbsp;|&nbsp; <b>Rejection:</b> <font color='#EF4444'><b>{error_text}</b></font>", meta_style))
        story.append(Paragraph(f"<b>Precondition:</b> {precond}", meta_style))
        
        diag_img_path = os.path.join(CASES_DIAGRAMS_DIR, f"case_{cid:03d}.png")
        story.append(RLImage(diag_img_path, width=430, height=215))
        story.append(Paragraph(f"<i>Assertion: {assertion}</i>", body_style))
        story.append(Spacer(1, 8))

    doc.build(story, canvasmaker=NumberedCanvas)
    import shutil
    shutil.copyfile(pdf_path_docs, pdf_path_root)
    print("Blynt_100_Use_Cases_Specification.pdf completed successfully.")

def build_test_cases_pdf_and_md():
    print("\n--- Compiling Blynt_100_Test_Cases_Specification ---")
    pdf_path_docs = os.path.join(DOCS_DIR, "Blynt_100_Test_Cases_Specification.pdf")
    pdf_path_root = os.path.join(BASE_DIR, "Blynt_100_Test_Cases_Specification.pdf")
    md_path = os.path.join(DOCS_DIR, "BLYNT_100_TEST_CASES_SPECIFICATION.md")
    
    # 1. Write Markdown
    print("Writing Markdown file...")
    with open(md_path, "w", encoding="utf-8") as f:
        f.write("# Blynt — Complete 100 QA Test Cases Specification\n\n")
        f.write("**Document Classification:** Master Quality Assurance Architecture & Test Case Matrix  \n")
        f.write("**Target Audience:** QA Engineers, Automation Leads, Security Auditors, and Technical Leads  \n")
        f.write("**System Name:** Blynt UK Cloud Accounting SaaS  \n")
        f.write("**Total Covered Test Cases:** Exactly 100 Individual Test Gates with Dedicated Visual Diagrams  \n\n")
        f.write("---\n\n")
        
        for case in CASES_DATA:
            cid, title, module, actor, precond, steps, final_step, error_text, assertion = case
            diag_file = f"diagrams/cases_100/case_{cid:03d}.png"
            
            f.write(f"## TC-{cid:03d}: {title}\n\n")
            f.write(f"* **Test Category:** {module}\n")
            f.write(f"* **Execution Persona:** {actor}\n")
            f.write(f"* **Test Prerequisites:** {precond}\n\n")
            f.write(f"### Visual Test Gate Flowchart\n\n")
            f.write(f"![Figure {cid:03d} - {title}]({diag_file})\n\n")
            f.write("### Sequential Test Execution & Assertion Gates\n\n")
            for i, st in enumerate(steps, 1):
                f.write(f"{i}. **{st}:** Assert test precondition and parameter integrity.\n")
            f.write(f"{len(steps)+1}. **Success Assertion ({final_step}):** Assert HTTP 200/201 and state commitment.\n\n")
            f.write(f"* **Failure Rejection Assertion:** `ASSERT {error_text}`\n")
            f.write(f"* **Pass/Fail Acceptance Standard:** {assertion}\n\n")
            f.write("---\n\n")

    # 2. Build PDF via ReportLab
    print("Compiling PDF via ReportLab (100 Test Cases)...")
    doc = SimpleDocTemplate(
        pdf_path_docs, pagesize=A4,
        leftMargin=36, rightMargin=36, topMargin=44, bottomMargin=44
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('DocTitle', parent=styles['Heading1'], fontName='Helvetica-Bold', fontSize=20, leading=24, textColor=colors.HexColor(NAVY), spaceAfter=4)
    subtitle_style = ParagraphStyle('DocSub', parent=styles['Normal'], fontName='Helvetica', fontSize=9.5, leading=13, textColor=colors.HexColor(TEXT_MUTED), spaceAfter=10)
    case_title_style = ParagraphStyle('CaseTitle', parent=styles['Heading2'], fontName='Helvetica-Bold', fontSize=12, leading=15, textColor=colors.HexColor(NAVY), spaceBefore=4, spaceAfter=4)
    meta_style = ParagraphStyle('Meta', parent=styles['Normal'], fontName='Helvetica', fontSize=8, leading=11, textColor=colors.HexColor(TEXT_DARK), spaceAfter=4)
    body_style = ParagraphStyle('Body', parent=styles['Normal'], fontName='Helvetica', fontSize=7.5, leading=10.5, textColor=colors.HexColor(TEXT_DARK))

    story = []
    story.append(Paragraph("Blynt — Complete 100 QA Test Cases Specification", title_style))
    story.append(Paragraph("Exhaustive QA Test Gate Flowcharts & Assertion Verifications Across All 100 System Scenarios", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor(CORAL), spaceAfter=10))

    intro = """
    <b>Master Quality Assurance Overview:</b> This document defines the comprehensive test gate catalog for automated, manual, and statutory verification across the Blynt platform.
    Every single test case features an individual architectural flowchart illustrating the sequential validation gates: descending through input schema validation, security token authentication, multi-tenant boundaries, and general ledger invariants, with pass (green) and fail (red) assertion targets.
    """
    story.append(Paragraph(intro, meta_style))
    story.append(Spacer(1, 10))

    for idx, case in enumerate(CASES_DATA):
        cid, title, module, actor, precond, steps, final_step, error_text, assertion = case
        
        if idx > 0 and idx % 2 == 0:
            story.append(PageBreak())
            
        story.append(Paragraph(f"<b>TC-{cid:03d}: {title}</b>", case_title_style))
        story.append(Paragraph(f"<b>Category:</b> {module} &nbsp;|&nbsp; <b>Tester Role:</b> {actor} &nbsp;|&nbsp; <b>Expected Rejection:</b> <font color='#EF4444'><b>ASSERT {error_text}</b></font>", meta_style))
        story.append(Paragraph(f"<b>Prerequisites:</b> {precond}", meta_style))
        
        diag_img_path = os.path.join(CASES_DIAGRAMS_DIR, f"case_{cid:03d}.png")
        story.append(RLImage(diag_img_path, width=430, height=215))
        story.append(Paragraph(f"<i>Acceptance Standard: {assertion}</i>", body_style))
        story.append(Spacer(1, 8))

    doc.build(story, canvasmaker=NumberedCanvas)
    import shutil
    shutil.copyfile(pdf_path_docs, pdf_path_root)
    print("Blynt_100_Test_Cases_Specification.pdf completed successfully.")

if __name__ == "__main__":
    generate_all_100()
    build_use_cases_pdf_and_md()
    build_test_cases_pdf_and_md()
    print("\nALL 100 USE CASES & 100 TEST CASES WITH 100 INDIVIDUAL DIAGRAMS SUCCESSFULLY BUILT!")
