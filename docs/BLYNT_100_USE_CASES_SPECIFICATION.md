# Blynt — Complete 100 Use Cases Specification: How the System Works

**Document Classification:** Master Functional Architecture & End-to-End User Journeys  
**Target Audience:** Business Owners, Operational Stakeholders, Compliance Auditors, and Non-IT Staff  
**System Name:** Blynt UK Cloud Accounting SaaS  
**Scope:** 100 Exhaustive Business Scenarios with Step-by-Step System Explanations & Dedicated Flowcharts  

---

## UC-001: Standard Email & Password Login

* **Functional Module:** Authentication & Identity
* **Primary Actor:** Any Registered User
* **Business Goal:** Log into the system securely and load the user's workspace.

### Visual Flowchart Architecture

![Figure 001 - Standard Email & Password Login](diagrams/cases_100/case_001.png)

### How the System Works Step-by-Step

1. **User enters registered email and password on the Blynt web login screen.**
2. **The browser sends an encrypted POST request over HTTPS to the NestJS /auth/login endpoint.**
3. **Blynt queries PostgreSQL for the user's record and extracts the salted bcrypt password hash.**
4. **The password engine compares the input against the stored hash using constant-time evaluation.**
5. **Upon a match, the system signs a JWT access token (15-min expiry) and sets an httpOnly refresh cookie.**

### Success Outcome
The user lands on their active organization dashboard with their role and permissions loaded.

### Safety Guardrails & Failure Handling
If the password does not match, a friendly 'Invalid email or password' message appears and a failed attempt is logged.

* **Domain Rejection Code:** `401 INVALID_CREDENTIALS`

---

## UC-002: Multi-Tenant Workspace Context Switching

* **Functional Module:** Multi-Tenancy
* **Primary Actor:** Business Owner / Multi-Org Director
* **Business Goal:** Switch between multiple businesses without logging out.

### Visual Flowchart Architecture

![Figure 002 - Multi-Tenant Workspace Context Switching](diagrams/cases_100/case_002.png)

### How the System Works Step-by-Step

1. **User clicks the organization selector dropdown in the top navigation bar.**
2. **The UI displays all companies where the user holds an active membership.**
3. **User selects another company (e.g., 'Acme Retail Ltd').**
4. **The backend verifies that the user's ID has an active membership record in the target company.**
5. **Blynt issues a new scoped tenant token, swaps the active database tenant context, and refreshes the view.**

### Success Outcome
The workspace switches completely to Acme Retail Ltd; no data from the previous company remains on screen.

### Safety Guardrails & Failure Handling
If a user attempts to tamper with the URL to view an unauthorized company, access is blocked immediately.

* **Domain Rejection Code:** `403 TENANT_MEMBERSHIP_REQUIRED`

---

## UC-003: Session Token Expiry & Silent Refresh

* **Functional Module:** Session Management
* **Primary Actor:** Active User Working in System
* **Business Goal:** Keep the user logged in seamlessly while maintaining high security.

### Visual Flowchart Architecture

![Figure 003 - Session Token Expiry & Silent Refresh](diagrams/cases_100/case_003.png)

### How the System Works Step-by-Step

1. **The short-lived 15-minute access token expires while the user is working.**
2. **On the next API request, the browser receives a token expiration signal.**
3. **The frontend automatically issues a silent refresh request using the secure httpOnly cookie.**
4. **The auth service verifies the refresh token's cryptographic signature and checks that it has not been revoked.**
5. **A new 15-minute access token is generated and the user's work continues with zero interruption.**

### Success Outcome
The user never gets kicked out mid-task as long as they remain active.

### Safety Guardrails & Failure Handling
If the refresh token itself has expired (e.g., after 7 days of inactivity), the user is gracefully redirected to the login screen.

* **Domain Rejection Code:** `401 REFRESH_TOKEN_EXPIRED`

---

## UC-004: Cross-Tenant Injection Prevention Guard

* **Functional Module:** Multi-Tenant Security
* **Primary Actor:** Platform Security Interceptor
* **Business Goal:** Prevent any tenant from accidentally or maliciously accessing another tenant's financial data.

### Visual Flowchart Architecture

![Figure 004 - Cross-Tenant Injection Prevention Guard](diagrams/cases_100/case_004.png)

### How the System Works Step-by-Step

1. **A user sends a request to view or edit an invoice, passing an invoice ID.**
2. **Before executing any query, Blynt's TenantGuard extracts the organization ID from the verified user token.**
3. **The database query enforces a strict WHERE filter: 'WHERE id = :invoiceId AND organization_id = :tokenOrgId'.**
4. **If the invoice belongs to a different company, the query returns zero rows.**
5. **The system intercepts the attempt, logs a potential security incident, and halts execution.**

### Success Outcome
Users can only ever see and touch transactions belonging to their own organization.

### Safety Guardrails & Failure Handling
An attempt to view another business's data is rejected with a strict security access denial.

* **Domain Rejection Code:** `403 TENANT_MISMATCH`

---

## UC-005: Two-Factor Authentication (2FA) TOTP Verification

* **Functional Module:** Account Security
* **Primary Actor:** Security-Conscious User
* **Business Goal:** Protect sensitive company finances with an extra mobile authentication step.

### Visual Flowchart Architecture

![Figure 005 - Two-Factor Authentication (2FA) TOTP Verification](diagrams/cases_100/case_005.png)

### How the System Works Step-by-Step

1. **User enters their correct email and password.**
2. **The system detects that Two-Factor Authentication is enabled on the account.**
3. **The screen prompts the user to enter the 6-digit code from their mobile authenticator app (Google/Microsoft).**
4. **The backend calculates the expected HMAC-SHA1 code for the current 30-second time window.**
5. **If the codes match, the session is elevated to fully authenticated status and the dashboard opens.**

### Success Outcome
Account is protected against stolen passwords; only the person holding the physical phone can log in.

### Safety Guardrails & Failure Handling
Entering the wrong 6-digit code or letting it expire blocks entry with a clear 'Invalid authentication code' message.

* **Domain Rejection Code:** `401 INVALID_TOTP_CODE`

---

## UC-006: Password Reset via Time-Limited Token

* **Functional Module:** Account Recovery
* **Primary Actor:** User Locked Out of Account
* **Business Goal:** Regain access to the account without administrator intervention.

### Visual Flowchart Architecture

![Figure 006 - Password Reset via Time-Limited Token](diagrams/cases_100/case_006.png)

### How the System Works Step-by-Step

1. **User clicks 'Forgot Password' and enters their registered email address.**
2. **Blynt generates a cryptographically random, one-time token that expires in exactly 60 minutes.**
3. **An automated email is sent to the user containing a secure password reset link.**
4. **User clicks the link and types a new, strong password matching security policies.**
5. **Blynt updates the salted hash in the database and immediately invalidates the reset token.**

### Success Outcome
User logs in with their new password; old passwords no longer work.

### Safety Guardrails & Failure Handling
Clicking an expired or already-used reset link displays 'This reset link has expired. Please request a new one.'

* **Domain Rejection Code:** `400 EXPIRED_RESET_TOKEN`

---

## UC-007: Brute-Force Login Rate Limiting Defense

* **Functional Module:** Cybersecurity
* **Primary Actor:** Automated Security Shield
* **Business Goal:** Prevent automated bot attacks from guessing user passwords.

### Visual Flowchart Architecture

![Figure 007 - Brute-Force Login Rate Limiting Defense](diagrams/cases_100/case_007.png)

### How the System Works Step-by-Step

1. **A malicious bot or unauthorized user rapidly submits incorrect login attempts.**
2. **Blynt's rate-limiting middleware tracks the number of failed attempts per IP address in Redis memory.**
3. **On the 5th consecutive failed attempt within 60 seconds, the rate-limiter triggers an automatic lock.**
4. **Further login requests from that IP address are temporarily blocked for 15 minutes.**
5. **The real account owner is unaffected on other devices, and a security alert is recorded in the platform log.**

### Success Outcome
The system prevents automated password dictionary attacks without crashing the server.

### Safety Guardrails & Failure Handling
The screen shows: 'Too many failed login attempts. Please wait 15 minutes before trying again.'

* **Domain Rejection Code:** `429 TOO_MANY_REQUESTS`

---

## UC-008: Platform Super Admin Portal Gate

* **Functional Module:** System Governance
* **Primary Actor:** Blynt Support & DevOps Team
* **Business Goal:** Manage platform health and tenant subscriptions safely.

### Visual Flowchart Architecture

![Figure 008 - Platform Super Admin Portal Gate](diagrams/cases_100/case_008.png)

### How the System Works Step-by-Step

1. **A user attempts to navigate to the restricted '/admin' route.**
2. **The SuperAdminGuard intercepts the incoming request before loading any administrative components.**
3. **The guard verifies that the user's role in the database is explicitly set to 'PLATFORM_SUPER_ADMIN'.**
4. **If confirmed, the platform administrative dashboard displays tenant counts, database health, and queue metrics.**
5. **All actions performed inside the portal are logged to a dedicated immutable super-admin audit trail.**

### Success Outcome
Platform operators can manage tenant subscriptions and system health safely.

### Safety Guardrails & Failure Handling
Regular business owners and staff attempting to access '/admin' are blocked with an immediate 403 Forbidden.

* **Domain Rejection Code:** `403 SUPER_ADMIN_REQUIRED`

---

## UC-009: User Logout & Complete Session Revocation

* **Functional Module:** Account Security
* **Primary Actor:** User Leaving Computer
* **Business Goal:** Ensure that logging out immediately terminates all access on shared devices.

### Visual Flowchart Architecture

![Figure 009 - User Logout & Complete Session Revocation](diagrams/cases_100/case_009.png)

### How the System Works Step-by-Step

1. **User clicks 'Sign Out' in the user menu.**
2. **The web app sends a logout request to the server and wipes all access tokens from browser memory.**
3. **The backend immediately marks the refresh token as revoked in PostgreSQL.**
4. **The unique session identifier (JTI) is placed on a token blacklist to reject any residual requests.**
5. **The browser clears all auth cookies and redirects the user to the public homepage.**

### Success Outcome
The session is terminated; pressing the browser's 'Back' button cannot view private financial records.

### Safety Guardrails & Failure Handling
Attempting to use an old token returns an unauthorized response.

* **Domain Rejection Code:** `200 LOGOUT_SUCCESS`

---

## UC-010: Employee Organization Invitation & Onboarding

* **Functional Module:** Team Management
* **Primary Actor:** Business Owner / Office Admin
* **Business Goal:** Invite a new team member to collaborate with a specific role.

### Visual Flowchart Architecture

![Figure 010 - Employee Organization Invitation & Onboarding](diagrams/cases_100/case_010.png)

### How the System Works Step-by-Step

1. **Owner enters the colleague's work email and selects their role (e.g., 'Bookkeeper').**
2. **The system checks that the user is not already a member of this organization.**
3. **A unique invitation token is generated and emailed to the invited employee.**
4. **The employee clicks the link, enters their name and creates a password (or logs into an existing Blynt account).**
5. **The system creates the membership record in the organization with the exact role designated by the owner.**

### Success Outcome
The employee joins the organization and can immediately begin bookkeeping tasks appropriate to their role.

### Safety Guardrails & Failure Handling
Attempting to invite an existing member shows 'This user is already a member of your organization.'

* **Domain Rejection Code:** `409 USER_ALREADY_MEMBER`

---

## UC-011: Organization Legal Entity Creation

* **Functional Module:** Company Setup
* **Primary Actor:** New Business Owner
* **Business Goal:** Register a new legal business entity ready for UK trading.

### Visual Flowchart Architecture

![Figure 011 - Organization Legal Entity Creation](diagrams/cases_100/case_011.png)

### How the System Works Step-by-Step

1. **Owner completes the onboarding wizard with their legal company name (e.g., 'North Star Logistics Ltd').**
2. **The system verifies that the company name is between 2 and 100 characters long.**
3. **Blynt sets the country jurisdiction to United Kingdom and configures the base trading currency to GBP (£).**
4. **The database creates the organization record and assigns the creator as the primary 'OWNER'.**
5. **Blynt automatically seeds standard UK Chart of Accounts nominal codes (Bank, Sales, Expenses, VAT).**

### Success Outcome
A fully configured accounting workspace is provisioned in under 2 seconds.

### Safety Guardrails & Failure Handling
Leaving the company name blank displays a red warning: 'Please enter your legal company name.'

* **Domain Rejection Code:** `400 INVALID_ORG_PAYLOAD`

---

## UC-012: Unique Workspace URL Slug Allocation

* **Functional Module:** Company Setup
* **Primary Actor:** Business Owner
* **Business Goal:** Create a clean, human-readable web address for the company workspace.

### Visual Flowchart Architecture

![Figure 012 - Unique Workspace URL Slug Allocation](diagrams/cases_100/case_012.png)

### How the System Works Step-by-Step

1. **As the owner types their business name, Blynt automatically generates a URL slug (e.g., 'north-star-logistics').**
2. **The frontend checks that the slug only contains lowercase letters, numbers, and hyphens.**
3. **The backend queries the database to ensure no other company on the platform shares this slug.**
4. **If unique, the slug is reserved and assigned to the organization.**
5. **All future company URLs will cleanly use this slug (e.g., 'app.blynt.co.uk/north-star-logistics/invoices').**

### Success Outcome
The company has a clean, professional web workspace link.

### Safety Guardrails & Failure Handling
If the slug is already taken by another business, Blynt suggests adding numbers (e.g., 'north-star-logistics-1').

* **Domain Rejection Code:** `409 SLUG_ALREADY_EXISTS`

---

## UC-013: HMRC UK VAT Registration Number Validation

* **Functional Module:** Tax Configuration
* **Primary Actor:** Accountant / Business Owner
* **Business Goal:** Configure UK VAT so invoices and returns comply with HMRC rules.

### Visual Flowchart Architecture

![Figure 013 - HMRC UK VAT Registration Number Validation](diagrams/cases_100/case_013.png)

### How the System Works Step-by-Step

1. **User navigates to Settings -> Tax & VAT and enters their UK VAT registration number.**
2. **The system strips spaces and validates the UK format: exactly 9 digits prefixed with 'GB' (or 9 digits).**
3. **Blynt runs the official HMRC Modulus-97 mathematical checksum algorithm on the digits.**
4. **If the checksum passes, the VAT number is stored and displayed on all outbound customer invoices.**
5. **The platform activates standard UK VAT rates: 20% Standard, 5% Reduced, and 0% Zero-Rated.**

### Success Outcome
Invoices automatically print the valid UK VAT number, ensuring full tax deductibility for corporate clients.

### Safety Guardrails & Failure Handling
Typing a fake or mistyped number displays: 'Invalid UK VAT registration number format.'

* **Domain Rejection Code:** `400 INVALID_VAT_FORMAT`

---

## UC-014: UK Companies House Registration Validation

* **Functional Module:** Statutory Configuration
* **Primary Actor:** Business Owner
* **Business Goal:** Display the official UK company registration number on legal documents.

### Visual Flowchart Architecture

![Figure 014 - UK Companies House Registration Validation](diagrams/cases_100/case_014.png)

### How the System Works Step-by-Step

1. **User enters their 8-character Companies House number (e.g., '12345678' or 'SC123456').**
2. **The system validates the alphanumeric format against official Companies House standards.**
3. **The validated number is permanently stored in the company's legal profile.**
4. **The number is automatically included in the footer of all generated PDF invoices and statements.**
5. **This fulfills the legal disclosure requirements of the UK Companies Act 2006.**

### Success Outcome
All customer invoices and credit notes legally comply with UK company disclosure laws.

### Safety Guardrails & Failure Handling
Entering invalid characters shows: 'Please enter a valid 8-character UK company registration number.'

* **Domain Rejection Code:** `400 INVALID_COMPANY_NUMBER`

---

## UC-015: Base Trading Currency Lock (GBP)

* **Functional Module:** Accounting Rules
* **Primary Actor:** Certified Accountant
* **Business Goal:** Lock the company's primary ledger currency to prevent financial corruption.

### Visual Flowchart Architecture

![Figure 015 - Base Trading Currency Lock (GBP)](diagrams/cases_100/case_015.png)

### How the System Works Step-by-Step

1. **During setup, the company confirms British Pounds (GBP - £) as its base trading currency.**
2. **Blynt sets this currency across all General Ledger asset, liability, and equity control accounts.**
3. **Once the first financial transaction is posted to the ledger, Blynt permanently locks the base currency.**
4. **Any future attempt to change the base currency in settings is blocked.**
5. **Multi-currency transactions (USD/EUR) are fully supported, but always revalued into GBP.**

### Success Outcome
Financial records remain stable and compliant with UK GAAP without exchange rate distortions.

### Safety Guardrails & Failure Handling
Attempting to alter the base currency mid-year displays: 'Base currency cannot be changed after trading commences.'

* **Domain Rejection Code:** `422 BASE_CURRENCY_LOCKED`

---

## UC-016: Financial Year Calendar Setup & Partitioning

* **Functional Module:** Accounting Foundations
* **Primary Actor:** Accountant / Business Owner
* **Business Goal:** Establish the 12-month fiscal calendar for tax reporting.

### Visual Flowchart Architecture

![Figure 016 - Financial Year Calendar Setup & Partitioning](diagrams/cases_100/case_016.png)

### How the System Works Step-by-Step

1. **User selects their annual accounting year start date (typically 01 April for UK SME tax year).**
2. **Blynt calculates the corresponding year end date (31 March of the following year).**
3. **The system automatically partitions the year into 12 chronological monthly accounting periods.**
4. **The current period is set to 'OPEN', allowing live bookkeeping entries.**
5. **The fiscal calendar is linked to the financial reporting engine for accurate profit-and-loss statements.**

### Success Outcome
Accounting periods are cleanly structured for monthly management accounts and year-end tax returns.

### Safety Guardrails & Failure Handling
Selecting overlapping dates displays: 'Accounting periods must be contiguous and non-overlapping.'

* **Domain Rejection Code:** `400 INVALID_DATE_RANGE`

---

## UC-017: Company Branding & Invoice Logo Upload

* **Functional Module:** Branding & Customization
* **Primary Actor:** Business Owner / Office Staff
* **Business Goal:** Add professional branding to invoices and customer receipts.

### Visual Flowchart Architecture

![Figure 017 - Company Branding & Invoice Logo Upload](diagrams/cases_100/case_017.png)

### How the System Works Step-by-Step

1. **User uploads their company logo in Settings -> Branding.**
2. **The browser inspects the file type, confirming it is an approved PNG, JPEG, or SVG image.**
3. **The system verifies that the image size does not exceed 2 Megabytes.**
4. **The image is uploaded securely to Blynt's cloud documents storage.**
5. **Blynt generates an optimized thumbnail for on-screen display and a high-resolution version for PDF printing.**

### Success Outcome
All invoices, credit notes, and customer emails display the company's logo with crisp resolution.

### Safety Guardrails & Failure Handling
Uploading a file larger than 2MB or uploading an unsupported document shows: 'Please upload an image under 2MB.'

* **Domain Rejection Code:** `400 FILE_TOO_LARGE_OR_INVALID`

---

## UC-018: Organization Soft Deactivation & Archive

* **Functional Module:** Tenancy Governance
* **Primary Actor:** Company Owner Only
* **Business Goal:** Safely close a business workspace while keeping historical records for tax audits.

### Visual Flowchart Architecture

![Figure 018 - Organization Soft Deactivation & Archive](diagrams/cases_100/case_018.png)

### How the System Works Step-by-Step

1. **The owner requests to archive an organization that has ceased trading.**
2. **The system requires password confirmation and 2FA authentication to prevent accidental closure.**
3. **Blynt checks that all invoices and bills are settled and cash balances reconciled.**
4. **The workspace status transitions to 'ARCHIVED'—active billing ceases immediately.**
5. **All historical ledgers, invoices, and audit logs remain accessible in read-only mode for 7 years (HMRC rule).**

### Success Outcome
The business is closed cleanly, billing stops, and tax audit compliance is fully preserved.

### Safety Guardrails & Failure Handling
Non-owner staff attempting to archive receive an immediate 'Only the organization owner can archive a workspace.'

* **Domain Rejection Code:** `403 OWNER_ROLE_REQUIRED`

---

## UC-019: Standard Nominal Code Creation (1000-9999)

* **Functional Module:** General Ledger
* **Primary Actor:** Accountant / Bookkeeper
* **Business Goal:** Add a custom account code for specific business expense tracking.

### Visual Flowchart Architecture

![Figure 019 - Standard Nominal Code Creation (1000-9999)](diagrams/cases_100/case_019.png)

### How the System Works Step-by-Step

1. **User goes to Accounting -> Chart of Accounts and clicks '+ New Account'.**
2. **Enters a 4-digit code (e.g., '7550'), name ('Software Subscriptions'), and type ('Expense').**
3. **Blynt validates that the code falls within the standard UK GAAP expense range (7000–8999).**
4. **The system automatically assigns the normal balance as 'DEBIT'.**
5. **The new nominal account appears immediately in dropdowns across invoices and bills.**

### Success Outcome
Bookkeepers can categorize business spending into tailored categories matching their operational needs.

### Safety Guardrails & Failure Handling
Typing a code outside allowed ranges displays: 'Account code must be a 4-digit number between 1000 and 9999.'

* **Domain Rejection Code:** `400 INVALID_CODE_FORMAT`

---

## UC-020: Duplicate Nominal Code Constraint Check

* **Functional Module:** General Ledger
* **Primary Actor:** Accountant
* **Business Goal:** Prevent confusion caused by multiple accounts sharing the same number.

### Visual Flowchart Architecture

![Figure 020 - Duplicate Nominal Code Constraint Check](diagrams/cases_100/case_020.png)

### How the System Works Step-by-Step

1. **User attempts to create an account using code '1200'.**
2. **Blynt queries the organization's existing chart of accounts.**
3. **The system detects that code '1200' is already assigned to 'Bank Current Account'.**
4. **The save operation is rejected before touching the database.**
5. **A clear warning highlights the code field, prompting the user to pick an unused number.**

### Success Outcome
The General Ledger maintains a strictly unique, clean nominal numbering structure.

### Safety Guardrails & Failure Handling
The screen shows: 'Account code 1200 is already in use by Bank Current Account. Please choose another code.'

* **Domain Rejection Code:** `409 DUPLICATE_ACCOUNT_CODE`

---

## UC-021: Accounts Receivable Control Account Protection

* **Functional Module:** Financial Safety
* **Primary Actor:** Any Staff Member
* **Business Goal:** Prevent manual journal entries from throwing customer balances out of sync.

### Visual Flowchart Architecture

![Figure 021 - Accounts Receivable Control Account Protection](diagrams/cases_100/case_021.png)

### How the System Works Step-by-Step

1. **A user creates a manual journal entry and attempts to select Code 1100 (Accounts Receivable).**
2. **Blynt's journal engine checks the 'isControlAccount' flag on Code 1100.**
3. **The system identifies that 1100 is reserved exclusively for the Sales Invoicing engine.**
4. **Manual postings are blocked; the account appears disabled in the manual journal dropdown.**
5. **The user is guided to issue a customer credit note or adjustment invoice instead.**

### Success Outcome
Customer statements and the general ledger remain 100% synchronized with zero manual discrepancies.

### Safety Guardrails & Failure Handling
Attempting to force a manual entry displays: 'Accounts Receivable is a protected control account. Please use Invoicing.'

* **Domain Rejection Code:** `422 AR_CONTROL_PROTECTED`

---

## UC-022: Accounts Payable Control Account Protection

* **Functional Module:** Financial Safety
* **Primary Actor:** Any Staff Member
* **Business Goal:** Prevent manual journal entries from corrupting supplier balances.

### Visual Flowchart Architecture

![Figure 022 - Accounts Payable Control Account Protection](diagrams/cases_100/case_022.png)

### How the System Works Step-by-Step

1. **A user creates a manual journal entry and attempts to select Code 2100 (Accounts Payable).**
2. **Blynt's journal engine checks the 'isControlAccount' flag on Code 2100.**
3. **The system identifies that 2100 is reserved exclusively for the Supplier Bills engine.**
4. **Manual journal posting is refused.**
5. **The user is guided to record a supplier credit note instead.**

### Success Outcome
Supplier balances in Accounts Payable always perfectly mirror actual supplier bills and payments.

### Safety Guardrails & Failure Handling
The screen displays: 'Accounts Payable is a protected control account. Please record a supplier bill or credit note.'

* **Domain Rejection Code:** `422 AP_CONTROL_PROTECTED`

---

## UC-023: VAT Control Account Automated Posting Rule

* **Functional Module:** Tax Compliance
* **Primary Actor:** Any Staff Member
* **Business Goal:** Ensure VAT liability is only created by verified sales and purchases.

### Visual Flowchart Architecture

![Figure 023 - VAT Control Account Automated Posting Rule](diagrams/cases_100/case_023.png)

### How the System Works Step-by-Step

1. **A user attempts to post a manual journal directly to Code 2200 (VAT Output Tax).**
2. **The ledger engine verifies whether the transaction originates from the statutory tax calculation engine.**
3. **Direct unlinked manual adjustments to tax liability are blocked.**
4. **This prevents accidental distortion of figures intended for quarterly HMRC VAT returns.**
5. **Adjustments must be made through approved VAT scheme adjustment workflows.**

### Success Outcome
The VAT Return boxes 1 to 9 always reconcile directly to verifiable invoice lines.

### Safety Guardrails & Failure Handling
The screen displays: 'VAT control accounts can only be updated through verified invoicing or tax workflows.'

* **Domain Rejection Code:** `422 VAT_CONTROL_PROTECTED`

---

## UC-024: Retained Earnings System Account Lock

* **Functional Module:** Financial Integrity
* **Primary Actor:** Any Staff Member
* **Business Goal:** Prevent users from tampering with historical accumulated profits.

### Visual Flowchart Architecture

![Figure 024 - Retained Earnings System Account Lock](diagrams/cases_100/case_024.png)

### How the System Works Step-by-Step

1. **A user navigates to the Chart of Accounts and attempts to edit Code 3100 (Retained Earnings).**
2. **The system checks the 'isSystemAccount' flag.**
3. **The account is locked against direct edits, renaming, or manual debit/credit journal entries.**
4. **Code 3100 is reserved exclusively for the automated Year-End profit/loss rollover calculation.**
5. **All balance changes must be generated organically by closing financial years.**

### Success Outcome
Historical business profits are protected from accidental tampering or erasure.

### Safety Guardrails & Failure Handling
The screen displays: 'Retained Earnings is a system-reserved account and cannot be manually modified.'

* **Domain Rejection Code:** `422 RETAINED_EARNINGS_LOCKED`

---

## UC-025: Account Normal Balance Derivation Rule

* **Functional Module:** Accounting Fundamentals
* **Primary Actor:** Certified Accountant
* **Business Goal:** Enforce standard double-entry bookkeeping rules for account classification.

### Visual Flowchart Architecture

![Figure 025 - Account Normal Balance Derivation Rule](diagrams/cases_100/case_025.png)

### How the System Works Step-by-Step

1. **User creates a new nominal account and selects its classification (e.g., 'Current Asset').**
2. **The system applies fundamental accounting logic: Assets & Expenses default to a NORMAL DEBIT balance.**
3. **Liabilities, Equity, and Revenue default to a NORMAL CREDIT balance.**
4. **Financial reports use this rule to display positive numbers cleanly rather than confusing minus signs.**
5. **The classification invariant is permanently stored with the account.**

### Success Outcome
Financial reports read intuitively for business owners while maintaining strict accounting rigor.

### Safety Guardrails & Failure Handling
Selecting an invalid classification combination displays a helpful correction tip.

* **Domain Rejection Code:** `400 INVALID_NORMAL_BALANCE`

---

## UC-026: Parent-Child Nominal Account Hierarchy

* **Functional Module:** Chart of Accounts
* **Primary Actor:** Accountant
* **Business Goal:** Group detailed sub-accounts under main summary headings on reports.

### Visual Flowchart Architecture

![Figure 026 - Parent-Child Nominal Account Hierarchy](diagrams/cases_100/case_026.png)

### How the System Works Step-by-Step

1. **User creates a detailed sub-account (e.g., '7110 - Staff Travel - Rail').**
2. **User selects the parent account ('7100 - Travel & Subsistence').**
3. **Blynt verifies that the parent account exists and shares the exact same classification ('Expense').**
4. **The sub-account is nested under the parent in the Chart of Accounts view.**
5. **Financial reports allow expanding or collapsing the parent account for clean summary presentations.**

### Success Outcome
Management reports can be viewed at high-level summary or drill-down detail.

### Safety Guardrails & Failure Handling
Attempting to link an Expense account under an Asset parent displays: 'Sub-account classification must match parent.'

* **Domain Rejection Code:** `404 PARENT_NOT_FOUND`

---

## UC-027: Account Deactivation with Zero Balance Check

* **Functional Module:** Ledger Cleanliness
* **Primary Actor:** Accountant
* **Business Goal:** Retire unused nominal accounts without hiding active company money.

### Visual Flowchart Architecture

![Figure 027 - Account Deactivation with Zero Balance Check](diagrams/cases_100/case_027.png)

### How the System Works Step-by-Step

1. **User selects an old nominal account and clicks 'Deactivate Account'.**
2. **Blynt calculates the current running balance of the account across all past journal lines.**
3. **If the balance is exactly £0.00, the account is marked 'INACTIVE'.**
4. **Inactive accounts disappear from daily invoice and bill dropdowns to keep menus clean.**
5. **Historical reports still show the account's past figures for tax audits.**

### Success Outcome
The daily bookkeeping interface remains clean and clutter-free.

### Safety Guardrails & Failure Handling
If the account has an active balance of £150.00, deactivation is blocked: 'Cannot deactivate account with a non-zero balance.'

* **Domain Rejection Code:** `422 ACCOUNT_BALANCE_NON_ZERO`

---

## UC-028: Account Foreign Currency Assignment Check

* **Functional Module:** Multi-Currency
* **Primary Actor:** Accountant
* **Business Goal:** Track foreign currency bank accounts or supplier balances accurately.

### Visual Flowchart Architecture

![Figure 028 - Account Foreign Currency Assignment Check](diagrams/cases_100/case_028.png)

### How the System Works Step-by-Step

1. **User creates a new bank account designated in US Dollars (USD).**
2. **Blynt validates 'USD' against official ISO-4217 international currency standards.**
3. **The system links the account to the daily exchange rate service.**
4. **Nominals for Realised and Unrealised FX Gain/Loss are automatically linked for revaluations.**
5. **The account is ready to receive foreign currency wires and track revaluations back to GBP.**

### Success Outcome
Businesses can trade internationally with automatic exchange rate tracking.

### Safety Guardrails & Failure Handling
Entering an unsupported currency code shows: 'Please select a valid international currency code.'

* **Domain Rejection Code:** `400 UNSUPPORTED_CURRENCY`

---

## UC-029: Draft Journal Entry Creation & Line Staging

* **Functional Module:** Journal Lifecycle
* **Primary Actor:** Accountant
* **Business Goal:** Prepare complex adjusting entries and review before committing to the books.

### Visual Flowchart Architecture

![Figure 029 - Draft Journal Entry Creation & Line Staging](diagrams/cases_100/case_029.png)

### How the System Works Step-by-Step

1. **Accountant opens Accounting -> Manual Journals and clicks '+ New Journal'.**
2. **Enters a reference note (e.g., 'Month-end depreciation adjustment') and sets the date.**
3. **Adds debit and credit lines across multiple asset and expense nominal codes.**
4. **Clicks 'Save as Draft'.**
5. **The journal is saved in staging mode with status 'DRAFT'—it does NOT alter general ledger balances yet.**

### Success Outcome
Accountants can prepare complex year-end entries in advance and review them before posting.

### Safety Guardrails & Failure Handling
Submitting an empty journal displays: 'Please add at least two line items before saving.'

* **Domain Rejection Code:** `400 EMPTY_JOURNAL_PAYLOAD`

---

## UC-030: Debits Equal Credits Equilibrium Invariant

* **Functional Module:** Accounting Invariants
* **Primary Actor:** System Posting Engine
* **Business Goal:** The fundamental rule of accounting: books can never be out of balance.

### Visual Flowchart Architecture

![Figure 030 - Debits Equal Credits Equilibrium Invariant](diagrams/cases_100/case_030.png)

### How the System Works Step-by-Step

1. **Accountant reviews a journal entry and clicks 'Post to General Ledger'.**
2. **The posting engine sums all Debit lines to 4 decimal places.**
3. **The posting engine sums all Credit lines to 4 decimal places.**
4. **Blynt asserts that total Debits minus total Credits equals exactly 0.0000.**
5. **If balanced, the transaction is committed atomically to the permanent ledger.**

### Success Outcome
The General Ledger remains 100% in balance; corrupt or one-sided accounting entries are physically impossible.

### Safety Guardrails & Failure Handling
If debits are £500 and credits are £400, posting is refused: 'Total debits (£500) must equal total credits (£400).'

* **Domain Rejection Code:** `422 JOURNAL_UNBALANCED`

---

## UC-031: Minimum Two Line Items Enforcement

* **Functional Module:** Accounting Invariants
* **Primary Actor:** System Posting Engine
* **Business Goal:** Ensure every financial entry has both a source and a destination.

### Visual Flowchart Architecture

![Figure 031 - Minimum Two Line Items Enforcement](diagrams/cases_100/case_031.png)

### How the System Works Step-by-Step

1. **A user attempts to save a journal entry containing only one line (£200 to Bank).**
2. **The validation engine counts the active line items.**
3. **The system detects that line count is less than 2.**
4. **Posting is blocked immediately.**
5. **A helper prompt appears: 'A double-entry transaction requires at least one Debit and one Credit line.'**

### Success Outcome
Every financial transaction records both where money came from and where it went.

### Safety Guardrails & Failure Handling
The screen highlights: 'Journal entry must contain at least two line items.'

* **Domain Rejection Code:** `400 MINIMUM_LINES_REQUIRED`

---

## UC-032: Zero Amount Line Item Rejection

* **Functional Module:** Journal Validation
* **Primary Actor:** System Posting Engine
* **Business Goal:** Prevent cluttering the database with empty £0.00 lines.

### Visual Flowchart Architecture

![Figure 032 - Zero Amount Line Item Rejection](diagrams/cases_100/case_032.png)

### How the System Works Step-by-Step

1. **A user adds a journal line but leaves the debit and credit amount fields as £0.00.**
2. **Upon clicking Save or Post, the validation engine checks each line's monetary value.**
3. **The system detects the line has zero monetary value.**
4. **The empty line is highlighted in red, or automatically pruned from the payload.**
5. **Only lines with real financial value are sent to the database.**

### Success Outcome
The General Ledger database remains clean and free of junk entries.

### Safety Guardrails & Failure Handling
The screen shows: 'Line item amounts must be greater than zero.'

* **Domain Rejection Code:** `400 ZERO_AMOUNT_REJECTED`

---

## UC-033: Mutually Exclusive Line Amounts (DR vs CR)

* **Functional Module:** Journal Validation
* **Primary Actor:** System Posting Engine
* **Business Goal:** Prevent confusing lines that try to be both money in and money out.

### Visual Flowchart Architecture

![Figure 033 - Mutually Exclusive Line Amounts (DR vs CR)](diagrams/cases_100/case_033.png)

### How the System Works Step-by-Step

1. **A user types £100 in the Debit column and £50 in the Credit column on the SAME line.**
2. **The validation engine inspects each line independently.**
3. **The system asserts that a line cannot have values in both Debit and Credit columns simultaneously.**
4. **The conflicting field is cleared, and an inline warning appears.**
5. **The user must place opposing values on separate lines.**

### Success Outcome
Accounting lines remain crystal clear for statutory tax inspection.

### Safety Guardrails & Failure Handling
The screen displays: 'A journal line cannot contain both a debit and credit amount. Please use separate lines.'

* **Domain Rejection Code:** `400 MUTUALLY_EXCLUSIVE_LINE`

---

## UC-034: Arbitrary Decimal Precision Arithmetic Check

* **Functional Module:** Financial Precision
* **Primary Actor:** Blynt Math Engine
* **Business Goal:** Eliminate fractional rounding errors that cause pennies to disappear.

### Visual Flowchart Architecture

![Figure 034 - Arbitrary Decimal Precision Arithmetic Check](diagrams/cases_100/case_034.png)

### How the System Works Step-by-Step

1. **The system computes tax, discounts, or exchange rates that produce fractional pence (e.g., £12.455).**
2. **Instead of standard JavaScript floating-point math (which causes rounding bugs), Blynt uses arbitrary-precision decimals.**
3. **The engine applies standard UK Banker's Rounding (Round Half to Even).**
4. **Numbers are stored in PostgreSQL using the exact NUMERIC(15,4) data type.**
5. **Every single penny is accounted for across thousands of transactions.**

### Success Outcome
Ledgers balance to the exact penny with zero mathematical drift or rounding leaks.

### Safety Guardrails & Failure Handling
Calculations that fail rounding validation are caught and re-balanced before saving.

* **Domain Rejection Code:** `422 PRECISION_ROUNDING_ERR`

---

## UC-035: Atomic Multi-Line Ledger Commit Transaction

* **Functional Module:** Database Integrity
* **Primary Actor:** PostgreSQL Engine
* **Business Goal:** Ensure multi-line transactions succeed together or fail together completely.

### Visual Flowchart Architecture

![Figure 035 - Atomic Multi-Line Ledger Commit Transaction](diagrams/cases_100/case_035.png)

### How the System Works Step-by-Step

1. **A balanced 10-line journal entry is submitted for posting.**
2. **Blynt opens a single atomic PostgreSQL database transaction (BEGIN TRANSACTION).**
3. **Lines 1 through 10 are written to the General Ledger table in sequence.**
4. **If a database error occurs on line 9 (e.g., network timeout), the transaction triggers an instant ROLLBACK.**
5. **Lines 1 through 8 are completely erased from the database as if they never happened.**

### Success Outcome
The database never contains half-saved, broken, or corrupt accounting entries.

### Safety Guardrails & Failure Handling
The user sees a clean error notification, and their draft remains intact for resubmission.

* **Domain Rejection Code:** `500 ATOMIC_POST_FAILED`

---

## UC-036: Posted Journal Historical Immutability

* **Functional Module:** Statutory Compliance
* **Primary Actor:** Any User
* **Business Goal:** Prevent illegal back-room alteration of posted company accounts.

### Visual Flowchart Architecture

![Figure 036 - Posted Journal Historical Immutability](diagrams/cases_100/case_036.png)

### How the System Works Step-by-Step

1. **A user opens a journal entry that was posted last month and looks for an 'Edit' or 'Delete' button.**
2. **The system detects that the journal status is 'POSTED'.**
3. **All input fields are rendered read-only, and Edit/Delete buttons are completely absent.**
4. **Any direct API request to update the row is blocked by database constraints.**
5. **The user is guided to click 'Reverse Journal' to post an official correcting entry.**

### Success Outcome
Blynt complies 100% with UK HMRC and Companies Act rules against rewriting accounting history.

### Safety Guardrails & Failure Handling
Attempting to force an edit displays: 'Posted accounting transactions are immutable and cannot be edited.'

* **Domain Rejection Code:** `403 POSTED_JOURNAL_IMMUTABLE`

---

## UC-037: Symmetrical GAAP Journal Reversal Linking

* **Functional Module:** Error Correction
* **Primary Actor:** Certified Accountant
* **Business Goal:** Correct a posted mistake with a clean, linked paper trail.

### Visual Flowchart Architecture

![Figure 037 - Symmetrical GAAP Journal Reversal Linking](diagrams/cases_100/case_037.png)

### How the System Works Step-by-Step

1. **Accountant opens a mistaken posted journal and clicks 'Reverse Journal'.**
2. **The system asks for an audit reason (e.g., 'Accidental duplicate entry').**
3. **Blynt automatically generates an exact symmetrical copy: original Debits become Credits, Credits become Debits.**
4. **The new reversal journal is linked directly to the original transaction ID in the database.**
5. **Both entries post to the ledger, perfectly canceling out the financial impact to £0.00.**

### Success Outcome
Mistakes are corrected cleanly with zero audit risk; tax inspectors can trace the full story.

### Safety Guardrails & Failure Handling
Attempting to reverse an entry that was already reversed displays: 'This transaction has already been reversed.'

* **Domain Rejection Code:** `409 ALREADY_REVERSED`

---

## UC-038: Draft Journal Clean Discard & Garbage Collection

* **Functional Module:** Journal Lifecycle
* **Primary Actor:** Accountant
* **Business Goal:** Clean up unfinished drafts without leaving orphan records.

### Visual Flowchart Architecture

![Figure 038 - Draft Journal Clean Discard & Garbage Collection](diagrams/cases_100/case_038.png)

### How the System Works Step-by-Step

1. **Accountant opens an unposted draft journal that is no longer needed.**
2. **Clicks 'Discard Draft'.**
3. **The system confirms the journal has status 'DRAFT' and was never committed to the General Ledger.**
4. **The staged draft lines are removed cleanly from the database.**
5. **Ledger balances and account summaries remain completely untouched.**

### Success Outcome
Unwanted draft worksheets are cleared without cluttering the accounting workspace.

### Safety Guardrails & Failure Handling
Attempting to delete a posted entry is strictly blocked.

* **Domain Rejection Code:** `403 CANNOT_DELETE_POSTED`

---

## UC-039: Customer Contact Profile Creation & Verification

* **Functional Module:** Commercial Subledgers
* **Primary Actor:** Billing Clerk / Sales Team
* **Business Goal:** Add a client to the directory with complete billing and credit details.

### Visual Flowchart Architecture

![Figure 039 - Customer Contact Profile Creation & Verification](diagrams/cases_100/case_039.png)

### How the System Works Step-by-Step

1. **User opens Contacts -> Customers and clicks '+ New Customer'.**
2. **Enters legal business name, contact person, email address, and UK billing address with postcode.**
3. **Selects default payment terms (e.g., 'Net 30 Days') and sets an optional credit limit.**
4. **The system validates email syntax and ensures the contact is categorized as 'CUSTOMER'.**
5. **The customer profile is saved and immediately available for invoicing.**

### Success Outcome
Sales invoices can be generated quickly with pre-filled billing terms and addresses.

### Safety Guardrails & Failure Handling
Submitting an invalid email displays: 'Please enter a valid email address.'

* **Domain Rejection Code:** `400 INVALID_CONTACT_DATA`

---

## UC-040: Sales Invoice Draft Generation

* **Functional Module:** Sales Invoicing
* **Primary Actor:** Billing Clerk
* **Business Goal:** Start a new invoice for services delivered.

### Visual Flowchart Architecture

![Figure 040 - Sales Invoice Draft Generation](diagrams/cases_100/case_040.png)

### How the System Works Step-by-Step

1. **User clicks Sales -> Invoices -> '+ New Invoice'.**
2. **Selects the customer from the searchable dropdown.**
3. **Blynt automatically assigns the next sequential invoice number (e.g., 'INV-1042').**
4. **Sets the invoice issue date and auto-calculates the due date based on the customer's payment terms.**
5. **The invoice is saved as a 'DRAFT', ready for line items.**

### Success Outcome
Invoice numbers remain strictly sequential with zero missing numbers or duplicates.

### Safety Guardrails & Failure Handling
Selecting an archived customer displays: 'Cannot invoice an archived customer. Please reactivate first.'

* **Domain Rejection Code:** `404 CUSTOMER_NOT_FOUND`

---

## UC-041: UK Standard 20% VAT Line Derivation

* **Functional Module:** Tax Derivation
* **Primary Actor:** Billing Clerk
* **Business Goal:** Calculate standard UK VAT on goods and professional services.

### Visual Flowchart Architecture

![Figure 041 - UK Standard 20% VAT Line Derivation](diagrams/cases_100/case_041.png)

### How the System Works Step-by-Step

1. **User adds an item line: 'Consulting Services', Quantity 1, Unit Price £1,000.00.**
2. **Selects tax rate 'Standard VAT (20%)'.**
3. **Blynt multiplies £1,000.00 by 0.20 to derive exact VAT of £200.00.**
4. **The line total computes as £1,200.00 gross.**
5. **The VAT amount is automatically routed to Output Tax nominal Code 2200 for VAT returns.**

### Success Outcome
VAT is calculated with mathematical precision, preventing costly HMRC tax return errors.

### Safety Guardrails & Failure Handling
Manually overriding tax with invalid math triggers an instant correction prompt.

* **Domain Rejection Code:** `400 INVALID_TAX_CALCULATION`

---

## UC-042: UK Reduced 5% VAT Line Derivation

* **Functional Module:** Tax Derivation
* **Primary Actor:** Billing Clerk
* **Business Goal:** Apply qualifying reduced VAT on energy or domestic products.

### Visual Flowchart Architecture

![Figure 042 - UK Reduced 5% VAT Line Derivation](diagrams/cases_100/case_042.png)

### How the System Works Step-by-Step

1. **User adds a line for qualifying goods (e.g., energy-saving materials), Net Price £500.00.**
2. **Selects tax rate 'Reduced VAT (5%)'.**
3. **The system applies 5% math: Net £500.00 + VAT £25.00 = Total £525.00.**
4. **The line is tagged with the statutory 5% tax code.**
5. **The tax amount is tracked separately for Box 1 output reporting.**

### Success Outcome
Specialist VAT rates are applied accurately without manual spreadsheet calculations.

### Safety Guardrails & Failure Handling
Selecting an incompatible tax rate displays a clarification tip.

* **Domain Rejection Code:** `400 INVALID_TAX_RATE`

---

## UC-043: Zero-Rated (0%) VAT Classification

* **Functional Module:** Tax Derivation
* **Primary Actor:** Billing Clerk
* **Business Goal:** Invoice items that legally carry zero tax (books, children's clothing, food).

### Visual Flowchart Architecture

![Figure 043 - Zero-Rated (0%) VAT Classification](diagrams/cases_100/case_043.png)

### How the System Works Step-by-Step

1. **User adds an item line for qualifying zero-rated products, Net Price £150.00.**
2. **Selects tax rate 'Zero-Rated (0%)'.**
3. **The system sets VAT to exactly £0.00, keeping Total at £150.00.**
4. **The net amount is tagged to report in VAT Return Box 6 (Total Sales excluding VAT).**
5. **No output tax liability is created.**

### Success Outcome
Zero-rated sales report properly on statutory returns without inflating tax owed.

### Safety Guardrails & Failure Handling
Misclassifying exempt sales as zero-rated is flagged by the validation engine.

* **Domain Rejection Code:** `400 ZERO_RATE_MISCLASSIFIED`

---

## UC-044: VAT Exempt Sales Classification

* **Functional Module:** Tax Derivation
* **Primary Actor:** Billing Clerk
* **Business Goal:** Invoice statutory exempt services (financial services, training).

### Visual Flowchart Architecture

![Figure 044 - VAT Exempt Sales Classification](diagrams/cases_100/case_044.png)

### How the System Works Step-by-Step

1. **User adds a line for exempt educational or financial services, Net Price £300.00.**
2. **Selects tax rate 'Exempt'.**
3. **The system applies £0.00 VAT.**
4. **The transaction is tagged as Exempt for partial exemption calculations.**
5. **The invoice prints the appropriate legal exemption note.**

### Success Outcome
Exempt income is isolated cleanly from taxable turnover for tax accounting.

### Safety Guardrails & Failure Handling
Selecting exempt on standard taxable goods prompts an accountant warning.

* **Domain Rejection Code:** `400 EXEMPT_MISCLASSIFIED`

---

## UC-045: CIS Domestic Reverse Charge Application

* **Functional Module:** Construction Sector
* **Primary Actor:** Construction Contractor
* **Business Goal:** Comply with UK construction industry reverse charge VAT rules.

### Visual Flowchart Architecture

![Figure 045 - CIS Domestic Reverse Charge Application](diagrams/cases_100/case_045.png)

### How the System Works Step-by-Step

1. **User checks the 'Apply CIS Domestic Reverse Charge' box on a construction invoice.**
2. **The standard 20% VAT rate is selected, but the VAT amount is NOT added to the invoice total payable.**
3. **The invoice states: 'Reverse charge applies. Customer must account for the VAT to HMRC.'**
4. **The customer pays only the net amount (£1,000.00).**
5. **The seller's VAT Return records the sale in Box 6 with zero liability in Box 1.**

### Success Outcome
Construction businesses comply automatically with complex HMRC reverse charge laws.

### Safety Guardrails & Failure Handling
Failing to provide the customer's verified VAT number blocks the reverse charge.

* **Domain Rejection Code:** `400 CIS_REVERSE_CHARGE_ERR`

---

## UC-046: Invoice Total Arithmetic Validation Gate

* **Functional Module:** Invoice Validation
* **Primary Actor:** System Posting Engine
* **Business Goal:** Guarantee that invoice totals match line items down to the exact penny.

### Visual Flowchart Architecture

![Figure 046 - Invoice Total Arithmetic Validation Gate](diagrams/cases_100/case_046.png)

### How the System Works Step-by-Step

1. **User clicks 'Approve & Issue' on an invoice.**
2. **The posting engine sums all line net amounts.**
3. **The engine sums all line VAT amounts.**
4. **The engine adds the two sums and compares against the invoice totalAmount.**
5. **If the values match down to 0.0000 decimal tolerance, the invoice passes the gate.**

### Success Outcome
Invoices with arithmetic errors or rounding discrepancies can never be issued to customers.

### Safety Guardrails & Failure Handling
If a manual edit caused a 1p mismatch, the system halts: 'Line totals do not match invoice grand total.'

* **Domain Rejection Code:** `422 ARITHMETIC_TOTAL_MISMATCH`

---

## UC-047: Invoice Approval & General Ledger Posting

* **Functional Module:** Ledger Engine
* **Primary Actor:** Billing Clerk / Business Owner
* **Business Goal:** Lock the invoice and record the revenue in the official books.

### Visual Flowchart Architecture

![Figure 047 - Invoice Approval & General Ledger Posting](diagrams/cases_100/case_047.png)

### How the System Works Step-by-Step

1. **User approves a validated invoice for £1,200.00 (£1,000 net + £200 VAT).**
2. **Blynt atomically generates the balanced General Ledger journal:**
3. **  - DEBIT Code 1100 (Accounts Receivable) £1,200.00**
4. **  - CREDIT Code 4000 (Sales Revenue) £1,000.00**
5. **  - CREDIT Code 2200 (VAT Output Tax) £200.00**
6. **The invoice status transitions from 'DRAFT' to 'AWAITING_PAYMENT'.**

### Success Outcome
Revenue and tax liability are recorded in real-time, immediately updating the company Profit & Loss.

### Safety Guardrails & Failure Handling
Attempting to approve an invoice with missing customer details displays an inline error.

* **Domain Rejection Code:** `400 APPROVAL_VALIDATION_ERR`

---

## UC-048: Customer Subledger Balance Synchronization

* **Functional Module:** Commercial Subledgers
* **Primary Actor:** Subledger Engine
* **Business Goal:** Update what the customer owes the moment an invoice is approved.

### Visual Flowchart Architecture

![Figure 048 - Customer Subledger Balance Synchronization](diagrams/cases_100/case_048.png)

### How the System Works Step-by-Step

1. **The moment Invoice #1042 for £1,200.00 is approved, the customer subledger engine fires.**
2. **Blynt retrieves the customer's account (e.g., 'Acme UK Ltd').**
3. **The customer's current balance increases by exactly £1,200.00.**
4. **The invoice is placed in the 'Current (0-30 Days)' aging bucket.**
5. **The updated balance is instantly visible on the customer's overview card.**

### Success Outcome
Finance teams can see exactly who owes money in real time without running end-of-day batch jobs.

### Safety Guardrails & Failure Handling
If a database lock occurs, the entire transaction rolls back to prevent balance divergence.

* **Domain Rejection Code:** `500 SUBLEDGER_SYNC_FAILED`

---

## UC-049: Customer Statement Chronological Running Balance

* **Functional Module:** Customer Reporting
* **Primary Actor:** Credit Controller / Customer
* **Business Goal:** Provide clients with a crystal-clear statement showing every bill and payment.

### Visual Flowchart Architecture

![Figure 049 - Customer Statement Chronological Running Balance](diagrams/cases_100/case_049.png)

### How the System Works Step-by-Step

1. **User clicks 'Generate Statement' on a customer profile for a given date range.**
2. **Blynt queries all invoices, credit notes, and payments for that customer in date order.**
3. **The system computes a running balance after every single transaction line.**
4. **The final closing balance matches the customer's current ledger balance to the penny.**
5. **The statement can be downloaded as an A4 PDF or sent directly via email.**

### Success Outcome
Customers receive a transparent account summary, speeding up payment collection.

### Safety Guardrails & Failure Handling
Statements reflect all cleared receipts and credit notes in exact chronological order.

* **Domain Rejection Code:** `200 STATEMENT_GENERATED`

---

## UC-050: Print-Ready A4 Invoice PDF Compilation

* **Functional Module:** Document Generation
* **Primary Actor:** Billing Clerk / Customer
* **Business Goal:** Generate a pixel-perfect, branded PDF ready to email or print.

### Visual Flowchart Architecture

![Figure 050 - Print-Ready A4 Invoice PDF Compilation](diagrams/cases_100/case_050.png)

### How the System Works Step-by-Step

1. **User clicks 'Download PDF' on an invoice.**
2. **Blynt's PDF engine pulls the company logo, legal address, VAT number, and payment remittance details.**
3. **Formats line items into a crisp, readable table with clear tax breakdowns.**
4. **Enforces standard A4 dimensions with proper margins so single-page invoices fit on one sheet.**
5. **Compiles the PDF and downloads it to the user's computer in under 2 seconds.**

### Success Outcome
Clients receive clean, executive-level PDF bills formatted for corporate accounting departments.

### Safety Guardrails & Failure Handling
If an asset is temporarily missing, the engine gracefully falls back to clean text styling.

* **Domain Rejection Code:** `500 PDF_RENDER_FAILED`

---

## UC-051: Public Magic Token Invoice View Access

* **Functional Module:** Client Experience
* **Primary Actor:** External Customer
* **Business Goal:** Allow clients to view their bill in a web browser without creating an IT account.

### Visual Flowchart Architecture

![Figure 051 - Public Magic Token Invoice View Access](diagrams/cases_100/case_051.png)

### How the System Works Step-by-Step

1. **When an invoice is issued, Blynt generates an expiring cryptographic access token.**
2. **The email to the client includes a link: 'https://app.blynt.co.uk/portal/invoices/{token}'.**
3. **The customer clicks the link in their email on their phone or laptop.**
4. **Blynt validates the token's signature and confirms it has not expired.**
5. **The branded invoice renders cleanly in the client's browser with an active 'Pay Now' button.**

### Success Outcome
Clients view their bill with zero friction; no logins, passwords, or IT barriers.

### Safety Guardrails & Failure Handling
Clicking an invalid or expired link shows: 'This invoice link has expired. Please contact the vendor for a fresh link.'

* **Domain Rejection Code:** `404 TOKEN_EXPIRED_OR_INVALID`

---

## UC-052: Client Portal Brand Consistency Verification

* **Functional Module:** Client Experience
* **Primary Actor:** External Customer
* **Business Goal:** Give payers confidence they are dealing with the real vendor.

### Visual Flowchart Architecture

![Figure 052 - Client Portal Brand Consistency Verification](diagrams/cases_100/case_052.png)

### How the System Works Step-by-Step

1. **The client opens the online invoice page.**
2. **The web page displays the vendor's high-resolution company logo, legal registered address, and phone number.**
3. **Company registration number and VAT number are clearly visible at the top.**
4. **Bank remittance details (Sort Code, Account Number, Reference) are clearly printed.**
5. **The layout adapts automatically to phone, tablet, or desktop screens.**

### Success Outcome
Customers trust the payment portal, eliminating phishing concerns and speeding up settlement.

### Safety Guardrails & Failure Handling
Missing branding defaults cleanly to verified company legal text.

* **Domain Rejection Code:** `200 BRANDING_VERIFIED`

---

## UC-053: Online Credit Card Payment Initiation

* **Functional Module:** Payment Gateway
* **Primary Actor:** External Customer
* **Business Goal:** Enable instant card checkout directly on the invoice screen.

### Visual Flowchart Architecture

![Figure 053 - Online Credit Card Payment Initiation](diagrams/cases_100/case_053.png)

### How the System Works Step-by-Step

1. **Customer clicks the prominent 'Pay £1,200.00' button on their online invoice.**
2. **Blynt initializes a secure Stripe Payment Intent for exactly £1,200.00 (120,000 minor units).**
3. **A secure Stripe Elements card input modal opens over the invoice.**
4. **Customer enters their card number, expiry date, CVC, and billing postcode.**
5. **Customer clicks 'Authorize Payment'.**

### Success Outcome
Customers can settle invoices in 30 seconds using Visa, Mastercard, or American Express.

### Safety Guardrails & Failure Handling
Entering an invalid card number displays immediate red inline validation from the card network.

* **Domain Rejection Code:** `400 INVALID_PAYMENT_AMOUNT`

---

## UC-054: Payment Idempotency & Double-Click Shield

* **Functional Module:** Client-Side Safety
* **Primary Actor:** External Customer with Slow Internet
* **Business Goal:** Guarantee that a customer is never billed twice even if clicking rapidly.

### Visual Flowchart Architecture

![Figure 054 - Payment Idempotency & Double-Click Shield](diagrams/cases_100/case_054.png)

### How the System Works Step-by-Step

1. **A customer with a slow internet connection clicks the 'Pay' button 3 times in quick succession.**
2. **On the very first click, Blynt disables the button, turns it grey, and displays a spinner: 'Processing...'.**
3. **The browser generates a unique UUID idempotency key attached to the charge request.**
4. **The payment gateway recognizes the idempotency key and executes only ONE transaction.**
5. **Subsequent rapid clicks are discarded with zero financial impact.**

### Success Outcome
The customer is charged exactly once; duplicate billing complaints are completely eliminated.

### Safety Guardrails & Failure Handling
The system safely blocks duplicate submissions with an idempotency lock.

* **Domain Rejection Code:** `409 DUPLICATE_SUBMISSION_BLOCKED`

---

## UC-055: Declined Card Friendly Error Handling

* **Functional Module:** Payment Gateway
* **Primary Actor:** External Customer
* **Business Goal:** Handle card payment failures gracefully without losing the customer.

### Visual Flowchart Architecture

![Figure 055 - Declined Card Friendly Error Handling](diagrams/cases_100/case_055.png)

### How the System Works Step-by-Step

1. **Customer submits a card that has expired or has insufficient funds.**
2. **The card network returns a decline code (e.g., 'card_declined' or 'insufficient_funds').**
3. **Blynt translates the technical decline into friendly advice: 'Your bank declined this card. Please try another card.'**
4. **The modal resets, allowing the customer to type another card number immediately.**
5. **The invoice remains open and unpaid; no corrupt records enter the system.**

### Success Outcome
Customers understand what went wrong and can resolve it on the spot with another card.

### Safety Guardrails & Failure Handling
The screen shows clear non-technical guidance without exposing internal error codes.

* **Domain Rejection Code:** `402 CARD_DECLINED_BY_BANK`

---

## UC-056: Instant Payment Confirmation & Status Flip

* **Functional Module:** Ledger Automation
* **Primary Actor:** Automated Webhook Engine
* **Business Goal:** Automatically settle the invoice the second the money is approved.

### Visual Flowchart Architecture

![Figure 056 - Instant Payment Confirmation & Status Flip](diagrams/cases_100/case_056.png)

### How the System Works Step-by-Step

1. **The card gateway approves the charge and emits a 'payment_intent.succeeded' webhook.**
2. **Blynt validates the cryptographic webhook signature to ensure it came from the real payment provider.**
3. **The system automatically posts the cash receipt: DEBIT Bank (1200) £1,200.00, CREDIT AR (1100) £1,200.00.**
4. **The invoice status flips from 'AWAITING_PAYMENT' to green 'PAID'.**
5. **The customer's screen updates in real-time with a green checkmark: 'Payment Successful!'**

### Success Outcome
The invoice is marked paid and cash is recorded with zero manual human bookkeeping required.

### Safety Guardrails & Failure Handling
If the webhook payload is corrupted, it is rejected and queued for automated retry.

* **Domain Rejection Code:** `500 WEBHOOK_PROCESSING_FAILED`

---

## UC-057: Automated Client Payment Receipt Delivery

* **Functional Module:** Client Communications
* **Primary Actor:** Automated Email Engine
* **Business Goal:** Provide clients with an instant tax-deductible payment receipt.

### Visual Flowchart Architecture

![Figure 057 - Automated Client Payment Receipt Delivery](diagrams/cases_100/case_057.png)

### How the System Works Step-by-Step

1. **Immediately following payment confirmation, Blynt generates an official Payment Receipt PDF.**
2. **The receipt details the transaction reference, payment method (e.g., Visa ending in 4242), and £0.00 balance.**
3. **The system emails the receipt PDF to the customer's billing email address within 10 seconds.**
4. **A copy of the receipt is permanently archived in the invoice's activity history.**
5. **The customer can also click 'Download Receipt' directly on their browser screen.**

### Success Outcome
Clients have immediate proof of payment for their own accounting files.

### Safety Guardrails & Failure Handling
Receipt delivery is verified and logged in the system communication log.

* **Domain Rejection Code:** `200 RECEIPT_DISPATCHED`

---

## UC-058: Self-Service Client Historical Statements

* **Functional Module:** Customer Self-Service
* **Primary Actor:** Corporate Client Finance Team
* **Business Goal:** Allow clients to download past invoices without calling customer support.

### Visual Flowchart Architecture

![Figure 058 - Self-Service Client Historical Statements](diagrams/cases_100/case_058.png)

### How the System Works Step-by-Step

1. **A corporate client accesses their account history via the link on any previous invoice.**
2. **Blynt displays a clean table of all historical invoices issued to that company.**
3. **Client can see which invoices are paid, payment dates, and any current outstanding amount.**
4. **One-click 'Download PDF' buttons allow downloading any past invoice or receipt.**
5. **Client can download a complete annual trading statement for their year-end audit.**

### Success Outcome
Reduces customer service billing queries by over 70%.

### Safety Guardrails & Failure Handling
Clients have 24/7 self-service access to their complete financial paperwork.

* **Domain Rejection Code:** `200 CLIENT_PORTAL_SUCCESS`

---

## UC-059: Supplier Contact Profile Setup & Classification

* **Functional Module:** Purchases & AP
* **Primary Actor:** Bookkeeper
* **Business Goal:** Set up a new supplier in the vendor registry with banking and payment terms.

### Visual Flowchart Architecture

![Figure 059 - Supplier Contact Profile Setup & Classification](diagrams/cases_100/case_059.png)

### How the System Works Step-by-Step

1. **Bookkeeper clicks Contacts -> Suppliers -> '+ New Supplier'.**
2. **Enters supplier legal business name, address, email, and payment terms (e.g., 'Due in 30 Days').**
3. **Enters the supplier's bank account details (Sort Code and Account Number) for outgoing payments.**
4. **The system categorizes the contact as 'SUPPLIER' and validates bank number formats.**
5. **The supplier profile is saved and immediately available for bill entry.**

### Success Outcome
Supplier payment details are stored safely for accurate electronic bill payments.

### Safety Guardrails & Failure Handling
Submitting missing vendor names shows: 'Please enter the supplier's legal name.'

* **Domain Rejection Code:** `400 INVALID_SUPPLIER_DATA`

---

## UC-060: Supplier Bill Entry with Invoice Reference

* **Functional Module:** Purchases & AP
* **Primary Actor:** Bookkeeper
* **Business Goal:** Record an incoming vendor bill against the correct expense categories.

### Visual Flowchart Architecture

![Figure 060 - Supplier Bill Entry with Invoice Reference](diagrams/cases_100/case_060.png)

### How the System Works Step-by-Step

1. **Bookkeeper opens Purchases -> Bills -> '+ New Bill'.**
2. **Selects the supplier and types the supplier's own printed invoice number (e.g., 'INV-8891').**
3. **Enters the bill date and payment due date.**
4. **Adds item lines, assigning nominal codes (e.g., '7100 - Travel' or '7200 - Office Supplies').**
5. **The bill is saved in 'DRAFT' status ready for review.**

### Success Outcome
Bills capture the exact vendor invoice reference required for payment reconciliation.

### Safety Guardrails & Failure Handling
Leaving the supplier invoice reference blank displays: 'Please enter the supplier's invoice number.'

* **Domain Rejection Code:** `400 MISSING_SUPPLIER_REF`

---

## UC-061: Duplicate Supplier Bill Number Interception

* **Functional Module:** Fraud & Error Prevention
* **Primary Actor:** System Posting Engine
* **Business Goal:** Prevent paying the same supplier invoice twice.

### Visual Flowchart Architecture

![Figure 061 - Duplicate Supplier Bill Number Interception](diagrams/cases_100/case_061.png)

### How the System Works Step-by-Step

1. **A bookkeeper accidentally attempts to enter a bill with supplier invoice number 'INV-8891' a second time.**
2. **Blynt queries all existing bills for that specific supplier.**
3. **The system detects an existing bill already has reference 'INV-8891'.**
4. **The save operation is blocked immediately.**
5. **The screen displays a warning with a clickable link to view the existing bill.**

### Success Outcome
Businesses are protected from accidental double-payments to suppliers.

### Safety Guardrails & Failure Handling
The screen alerts: 'A bill with reference INV-8891 already exists for this supplier.'

* **Domain Rejection Code:** `409 DUPLICATE_SUPPLIER_BILL`

---

## UC-062: Input VAT Recovery Classification Rule

* **Functional Module:** Tax Accounting
* **Primary Actor:** Bookkeeper
* **Business Goal:** Reclaim allowable VAT on business purchases on the quarterly VAT return.

### Visual Flowchart Architecture

![Figure 062 - Input VAT Recovery Classification Rule](diagrams/cases_100/case_062.png)

### How the System Works Step-by-Step

1. **Bookkeeper enters a qualifying business expense bill: Net £500.00 + 20% VAT £100.00 = Total £600.00.**
2. **Selects tax rate 'Standard Input VAT (20%)'.**
3. **Blynt routes the £100.00 tax to Input Tax nominal Code 2210.**
4. **The £100.00 is tagged to report in VAT Return Box 4 (VAT Reclaimed on Purchases).**
5. **When the VAT return is filed, this £100.00 reduces the net tax owed to HMRC.**

### Success Outcome
The business reclaims all legitimate input VAT, maximizing cash flow.

### Safety Guardrails & Failure Handling
Incorrect tax calculations are flagged for review before posting.

* **Domain Rejection Code:** `400 INVALID_INPUT_VAT`

---

## UC-063: Non-Deductible Business Expense Handling

* **Functional Module:** Tax Accounting
* **Primary Actor:** Bookkeeper / Accountant
* **Business Goal:** Correctly categorize client entertainment so VAT is not illegally reclaimed.

### Visual Flowchart Architecture

![Figure 063 - Non-Deductible Business Expense Handling](diagrams/cases_100/case_063.png)

### How the System Works Step-by-Step

1. **Bookkeeper records a bill for a client dinner (£120.00).**
2. **Selects nominal Code 7500 ('Business Entertainment').**
3. **Blynt recognizes that under UK HMRC tax law, client entertainment is NOT tax-deductible for VAT.**
4. **The system forces the VAT recovery rate to 0% (£0.00 tax reclaim).**
5. **The full £120.00 gross amount is debited to the expense nominal.**

### Success Outcome
The business is protected from HMRC tax penalties during compliance audits.

### Safety Guardrails & Failure Handling
Attempting to claim input VAT on client entertainment triggers an automatic tax correction prompt.

* **Domain Rejection Code:** `400 TAX_TAG_INVALID`

---

## UC-064: Accounts Payable General Ledger Posting

* **Functional Module:** Ledger Engine
* **Primary Actor:** Bookkeeper / Finance Manager
* **Business Goal:** Approve a supplier bill and record the money owed in company accounts.

### Visual Flowchart Architecture

![Figure 064 - Accounts Payable General Ledger Posting](diagrams/cases_100/case_064.png)

### How the System Works Step-by-Step

1. **User approves a £600.00 supplier bill (£500 net + £100 VAT).**
2. **Blynt atomically posts the General Ledger journal:**
3. **  - DEBIT Code 7200 (Office Supplies Expense) £500.00**
4. **  - DEBIT Code 2210 (VAT Input Tax) £100.00**
5. **  - CREDIT Code 2100 (Accounts Payable) £600.00**
6. **The bill status updates to 'AWAITING_PAYMENT'.**

### Success Outcome
Company liabilities and expenses are recorded accurately in real time.

### Safety Guardrails & Failure Handling
Posting is blocked if expense nominal codes are inactive or missing.

* **Domain Rejection Code:** `422 AP_POSTING_FAILED`

---

## UC-065: Supplier Outgoing Payment Allocation

* **Functional Module:** Purchases & AP
* **Primary Actor:** Bookkeeper
* **Business Goal:** Record paying a supplier from the company bank account.

### Visual Flowchart Architecture

![Figure 065 - Supplier Outgoing Payment Allocation](diagrams/cases_100/case_065.png)

### How the System Works Step-by-Step

1. **User opens the approved bill and clicks 'Record Payment'.**
2. **Enters payment date, amount (£600.00), and selects Bank Account (Code 1200).**
3. **Blynt posts: DEBIT Accounts Payable (2100) £600.00, CREDIT Bank (1200) £600.00.**
4. **The bill status flips to 'PAID'.**
5. **The supplier's outstanding balance drops to £0.00.**

### Success Outcome
Bank cash and Accounts Payable balances stay perfectly synchronized.

### Safety Guardrails & Failure Handling
Attempting to pay more than the bill total displays: 'Payment amount cannot exceed outstanding bill balance.'

* **Domain Rejection Code:** `400 OVERPAYMENT_UNSUPPORTED`

---

## UC-066: Supplier Partial Payment Allocation

* **Functional Module:** Purchases & AP
* **Primary Actor:** Bookkeeper
* **Business Goal:** Pay an installment on a supplier bill and track the remaining balance.

### Visual Flowchart Architecture

![Figure 066 - Supplier Partial Payment Allocation](diagrams/cases_100/case_066.png)

### How the System Works Step-by-Step

1. **User records a partial payment of £200.00 against a £600.00 bill.**
2. **Blynt allocates the £200.00 to the bill.**
3. **The bill status remains 'AWAITING_PAYMENT', displaying 'Amount Due: £400.00'.**
4. **The General Ledger debits Accounts Payable by £200.00.**
5. **The supplier's statement shows the initial bill, the payment, and the remaining £400.00 owed.**

### Success Outcome
Installment payments are tracked cleanly without losing sight of outstanding debt.

### Safety Guardrails & Failure Handling
The partial payment is confirmed and updated immediately.

* **Domain Rejection Code:** `200 PARTIAL_PAYMENT_RECORDED`

---

## UC-067: Supplier Credit Note Offset Application

* **Functional Module:** Purchases & AP
* **Primary Actor:** Bookkeeper
* **Business Goal:** Apply a refund or credit from a supplier against an unpaid bill.

### Visual Flowchart Architecture

![Figure 067 - Supplier Credit Note Offset Application](diagrams/cases_100/case_067.png)

### How the System Works Step-by-Step

1. **A supplier issues a £100.00 credit note for returned goods.**
2. **Bookkeeper records the credit note in Purchases -> Credit Notes.**
3. **Clicks 'Apply to Open Bill' and selects the £400.00 outstanding bill.**
4. **Blynt debits Accounts Payable by £100.00, reducing the bill amount due to £300.00.**
5. **Both documents update synchronously.**

### Success Outcome
Credit notes reduce amounts owed without needing physical cash refunds.

### Safety Guardrails & Failure Handling
Attempting to apply a credit note larger than the bill displays: 'Credit note exceeds bill amount.'

* **Domain Rejection Code:** `400 CREDIT_EXCEEDS_BILL`

---

## UC-068: Supplier Remittance Advice Generation

* **Functional Module:** Document Generation
* **Primary Actor:** Bookkeeper
* **Business Goal:** Send the supplier clear documentation of which bills were paid.

### Visual Flowchart Architecture

![Figure 068 - Supplier Remittance Advice Generation](diagrams/cases_100/case_068.png)

### How the System Works Step-by-Step

1. **User executes a batch payment to a supplier settling multiple bills.**
2. **User clicks 'Generate Remittance Advice'.**
3. **Blynt compiles a professional A4 PDF listing each invoice reference, original amount, and amount paid.**
4. **The remittance advice includes the payment date and bank transfer reference.**
5. **The PDF can be emailed directly to the supplier's finance department in one click.**

### Success Outcome
Suppliers can allocate payments quickly, preventing mistaken chase calls.

### Safety Guardrails & Failure Handling
The remittance advice is created and archived in the payment record.

* **Domain Rejection Code:** `200 REMITTANCE_DISPATCHED`

---

## UC-069: Mobile Photo Receipt Upload & Normalization

* **Functional Module:** AI Intelligence
* **Primary Actor:** Employee / Director on the road
* **Business Goal:** Capture paper receipts using a smartphone camera.

### Visual Flowchart Architecture

![Figure 069 - Mobile Photo Receipt Upload & Normalization](diagrams/cases_100/case_069.png)

### How the System Works Step-by-Step

1. **User takes a photo of a restaurant receipt on their phone and uploads it to Blynt Expenses.**
2. **Blynt inspects the file, ensuring it is a valid JPEG or PNG.**
3. **An automated image pre-processor corrects rotation, enhances contrast, and flattens shadows.**
4. **The normalized image is stored temporarily in secure cloud storage.**
5. **The document is queued for OCR text recognition.**

### Success Outcome
Paper receipts are captured in seconds before they get lost or faded.

### Safety Guardrails & Failure Handling
Uploading a corrupted file shows: 'Could not process image. Please upload a clear photo.'

* **Domain Rejection Code:** `400 UNSUPPORTED_IMAGE_FORMAT`

---

## UC-070: Multi-Page PDF Supplier Bill Parsing

* **Functional Module:** AI Intelligence
* **Primary Actor:** Bookkeeper
* **Business Goal:** Process multi-page digital invoices received via email.

### Visual Flowchart Architecture

![Figure 070 - Multi-Page PDF Supplier Bill Parsing](diagrams/cases_100/case_070.png)

### How the System Works Step-by-Step

1. **User drags a 3-page supplier PDF into the Blynt upload box.**
2. **The document parser extracts embedded digital text streams.**
3. **If text is scanned, OCR fallback processes the high-resolution pages.**
4. **The system combines line items across all 3 pages into a single digital bill payload.**
5. **The extracted data is presented for user review.**

### Success Outcome
Long, complex supplier bills are digitized in seconds without manual typing.

### Safety Guardrails & Failure Handling
Password-protected or corrupted PDFs display: 'This PDF is encrypted. Please provide an unlocked file.'

* **Domain Rejection Code:** `400 CORRUPTED_PDF`

---

## UC-071: AI Vendor Identification & Confidence Scoring

* **Functional Module:** AI Intelligence
* **Primary Actor:** Blynt AI Engine
* **Business Goal:** Identify the merchant name accurately using machine learning.

### Visual Flowchart Architecture

![Figure 071 - AI Vendor Identification & Confidence Scoring](diagrams/cases_100/case_071.png)

### How the System Works Step-by-Step

1. **Document AI scans the top of the receipt for merchant branding (e.g., 'Pret A Manger').**
2. **Matches the text against a global merchant directory.**
3. **Calculates an extraction confidence score between 0.00 and 1.00.**
4. **If confidence is >= 0.85, Blynt automatically matches or creates the supplier record.**
5. **If confidence is low, the field is highlighted in yellow for human confirmation.**

### Success Outcome
Merchant names are filled in automatically with high accuracy.

### Safety Guardrails & Failure Handling
Unrecognizable merchant text prompts the user to type the name manually.

* **Domain Rejection Code:** `422 VENDOR_UNRECOGNIZED`

---

## UC-072: AI Date & Amount Precision Parsing

* **Functional Module:** AI Intelligence
* **Primary Actor:** Blynt AI Engine
* **Business Goal:** Extract dates and monetary totals from scanned documents.

### Visual Flowchart Architecture

![Figure 072 - AI Date & Amount Precision Parsing](diagrams/cases_100/case_072.png)

### How the System Works Step-by-Step

1. **The AI engine identifies numerical strings representing currency amounts and dates.**
2. **Extracts Transaction Date, Net Amount, VAT Amount, and Total Amount.**
3. **Validates that the extracted date is valid and is not in the future.**
4. **Converts foreign currency symbols (£, $, €) into standardized monetary values.**
5. **Pre-fills the expense form fields on screen.**

### Success Outcome
Typing numbers manually is eliminated, cutting expense processing time by 80%.

### Safety Guardrails & Failure Handling
Dates that cannot be parsed clearly prompt the user to pick a date from the calendar.

* **Domain Rejection Code:** `422 DATE_PARSE_FAILED`

---

## UC-073: AI Arithmetic Balancing Guardrail Rule

* **Functional Module:** AI Safety
* **Primary Actor:** Blynt Safety Engine
* **Business Goal:** Stop AI hallucinations: ensure extracted line items add up to the total.

### Visual Flowchart Architecture

![Figure 073 - AI Arithmetic Balancing Guardrail Rule](diagrams/cases_100/case_073.png)

### How the System Works Step-by-Step

1. **The AI engine finishes extracting Net, VAT, and Total amounts.**
2. **Before showing suggestions, Blynt's safety guardrail executes: 'Assert Net + VAT == Total'.**
3. **If the extracted items do not add up to the total (e.g., OCR misread a 3 as an 8), the AI flag triggers.**
4. **The system refuses to auto-fill hallucinated numbers.**
5. **The side-by-side verification screen highlights the discrepancy in red for human correction.**

### Success Outcome
AI mistakes are caught before they ever reach company books.

### Safety Guardrails & Failure Handling
Discrepancies are highlighted: 'Extracted amounts do not match receipt total. Please verify.'

* **Domain Rejection Code:** `422 AI_MATH_MISMATCH`

---

## UC-074: Low Confidence Human-in-the-Loop Intercept

* **Functional Module:** AI Safety
* **Primary Actor:** Blynt Safety Engine
* **Business Goal:** Enforce human review whenever receipt text is blurry or ambiguous.

### Visual Flowchart Architecture

![Figure 074 - Low Confidence Human-in-the-Loop Intercept](diagrams/cases_100/case_074.png)

### How the System Works Step-by-Step

1. **A user uploads a crumpled, faded receipt.**
2. **The AI composite confidence score falls to 68% (below the strict 85% safety threshold).**
3. **Blynt intercepts automated posting.**
4. **The screen displays the receipt image on the left and input fields on the right.**
5. **The user must review and click 'Confirm & Save' before the expense is committed.**

### Success Outcome
Blynt combines AI speed with human oversight: zero unchecked entries reach the ledger.

### Safety Guardrails & Failure Handling
Unclear receipts are held safely in the review queue until approved.

* **Domain Rejection Code:** `422 HUMAN_REVIEW_ENFORCED`

---

## UC-075: Smart Expense Category Recommendation

* **Functional Module:** Machine Learning
* **Primary Actor:** Blynt AI Engine
* **Business Goal:** Automatically categorize expenses based on past company habits.

### Visual Flowchart Architecture

![Figure 075 - Smart Expense Category Recommendation](diagrams/cases_100/case_075.png)

### How the System Works Step-by-Step

1. **The AI recognizes merchant 'Shell Petrol Station'.**
2. **The recommendation engine checks past company categorizations for this merchant.**
3. **Identifies that Shell was categorized as '7300 - Motor Expenses' 100% of the time.**
4. **Pre-selects Code 7300 in the dropdown with a green sparkle icon: 'Recommended'.**
5. **User can accept with one click or choose another category.**

### Success Outcome
Bookkeeping categorization becomes instant and consistent across all staff.

### Safety Guardrails & Failure Handling
User can override the recommendation at any time.

* **Domain Rejection Code:** `200 CATEGORY_SUGGESTED`

---

## UC-076: Permanent Cloud Storage Image Archiving

* **Functional Module:** Statutory Compliance
* **Primary Actor:** Storage Service
* **Business Goal:** Attach receipt photos permanently to accounting records for tax audits.

### Visual Flowchart Architecture

![Figure 076 - Permanent Cloud Storage Image Archiving](diagrams/cases_100/case_076.png)

### How the System Works Step-by-Step

1. **When an expense is saved, the receipt photo is moved to encrypted, permanent cloud storage.**
2. **An immutable storage URL is saved directly inside the General Ledger transaction record.**
3. **A SHA-256 cryptographic checksum of the image is computed and stored.**
4. **If a tax auditor inspects the expense 5 years later, clicking 'View Receipt' opens the original photo.**
5. **The file cannot be overwritten or deleted.**

### Success Outcome
Businesses meet HMRC 7-year digital receipt storage requirements with zero paper folders.

### Safety Guardrails & Failure Handling
Storage upload failure aborts the save to prevent receipts from being lost.

* **Domain Rejection Code:** `500 S3_UPLOAD_FAILED`

---

## UC-077: Business Bank Account Nominal Account Binding

* **Functional Module:** Banking Setup
* **Primary Actor:** Accountant
* **Business Goal:** Connect a business bank account directly to the general ledger.

### Visual Flowchart Architecture

![Figure 077 - Business Bank Account Nominal Account Binding](diagrams/cases_100/case_077.png)

### How the System Works Step-by-Step

1. **User opens Banking -> Bank Accounts -> '+ Add Bank Account'.**
2. **Enters bank name (e.g., 'Barclays Current Account'), Sort Code (20-04-01), and Account Number.**
3. **Blynt binds the physical bank account to General Ledger Code 1200 (Bank Asset Account).**
4. **The system initializes the cleared bank balance at £0.00.**
5. **The account is ready to receive electronic statements and track cash balances.**

### Success Outcome
Bank cash movements are tracked inside the General Ledger with double-entry integrity.

### Safety Guardrails & Failure Handling
Entering an invalid sort code format shows: 'Please enter a valid 6-digit UK sort code.'

* **Domain Rejection Code:** `400 INVALID_BANK_NOMINAL`

---

## UC-078: Bank Statement CSV Feed Parsing

* **Functional Module:** Banking Feeds
* **Primary Actor:** Bookkeeper
* **Business Goal:** Import downloaded bank statements without manual line typing.

### Visual Flowchart Architecture

![Figure 078 - Bank Statement CSV Feed Parsing](diagrams/cases_100/case_078.png)

### How the System Works Step-by-Step

1. **User downloads a monthly CSV statement from their online bank and uploads it to Blynt.**
2. **Blynt's statement parser inspects column headers (Date, Description, Amount, Balance).**
3. **Normalizes money formats, handling debit/credit columns or positive/negative amounts.**
4. **Stages all transactions into the bank reconciliation staging buffer.**
5. **Displays the transactions in the bank feed inbox ready for matching.**

### Success Outcome
Hundreds of bank transactions are imported in seconds without typing errors.

### Safety Guardrails & Failure Handling
Uploading a corrupted CSV file shows: 'Could not read CSV headers. Please verify file format.'

* **Domain Rejection Code:** `400 MALFORMED_CSV_HEADER`

---

## UC-079: Bank Statement Duplicate Line Hash Intercept

* **Functional Module:** Banking Feeds
* **Primary Actor:** Banking Safety Engine
* **Business Goal:** Prevent importing the same bank transaction twice when statements overlap.

### Visual Flowchart Architecture

![Figure 079 - Bank Statement Duplicate Line Hash Intercept](diagrams/cases_100/case_079.png)

### How the System Works Step-by-Step

1. **User uploads a statement covering the 1st to the 31st, having previously uploaded the 1st to the 15th.**
2. **For every line, Blynt computes a unique fingerprint: SHA-256(Date + Amount + Description).**
3. **Queries the database for existing fingerprints on this bank account.**
4. **The system detects that lines from the 1st to the 15th were already imported.**
5. **Duplicates are silently filtered out; only the brand-new lines from the 16th to 31st are imported.**

### Success Outcome
Bank balances never double-count transactions due to overlapping statement imports.

### Safety Guardrails & Failure Handling
The system confirms: '32 new transactions imported. 28 overlapping lines were safely skipped.'

* **Domain Rejection Code:** `409 DUPLICATE_BANK_FEED_LINE`

---

## UC-080: Automated Rule-Based Invoice Matching

* **Functional Module:** Bank Reconciliation
* **Primary Actor:** Reconciliation Engine
* **Business Goal:** Automatically match customer payments with unpaid invoices.

### Visual Flowchart Architecture

![Figure 080 - Automated Rule-Based Invoice Matching](diagrams/cases_100/case_080.png)

### How the System Works Step-by-Step

1. **A bank transaction shows a £1,200.00 deposit with description 'Acme UK Ltd INV-1042'.**
2. **Blynt's matching engine scans open customer invoices.**
3. **Finds Invoice #1042 for Acme UK Ltd with exact amount £1,200.00.**
4. **The screen presents a green 'Match Found' card: 'Match deposit to Invoice #1042?'.**
5. **User clicks 'OK' to reconcile in one second.**

### Success Outcome
Bank reconciliation time is cut by 90% through automated matching.

### Safety Guardrails & Failure Handling
Matches are presented clearly for human confirmation before clearing.

* **Domain Rejection Code:** `200 AUTO_MATCHED`

---

## UC-081: Manual Multi-Transaction Bank Split Reconciliation

* **Functional Module:** Bank Reconciliation
* **Primary Actor:** Accountant
* **Business Goal:** Split a single lump-sum deposit across multiple customer invoices.

### Visual Flowchart Architecture

![Figure 081 - Manual Multi-Transaction Bank Split Reconciliation](diagrams/cases_100/case_081.png)

### How the System Works Step-by-Step

1. **A customer pays £2,500.00 in a single bank transfer to settle two invoices (Inv A £1,500 and Inv B £1,000).**
2. **Accountant selects the £2,500.00 bank statement line and clicks 'Find & Match'.**
3. **Selects Invoice A and Invoice B from the open invoices list.**
4. **Blynt verifies: 'Invoice A (£1,500) + Invoice B (£1,000) == Deposit (£2,500)'.**
5. **Clicks 'Reconcile'—both invoices flip to PAID and the bank line is cleared.**

### Success Outcome
Lump-sum customer payments are reconciled accurately across multiple accounts.

### Safety Guardrails & Failure Handling
If the selected invoices do not equal the deposit, reconciliation is blocked until balanced.

* **Domain Rejection Code:** `400 SPLIT_MISMATCH`

---

## UC-082: Unreconciled Bank Balance vs GL Equilibrium

* **Functional Module:** Ledger Integrity
* **Primary Actor:** Accountant
* **Business Goal:** Verify that company accounting books match actual bank cash exactly.

### Visual Flowchart Architecture

![Figure 082 - Unreconciled Bank Balance vs GL Equilibrium](diagrams/cases_100/case_082.png)

### How the System Works Step-by-Step

1. **Accountant opens the Bank Reconciliation Summary report at month end.**
2. **Blynt calculates: Actual Statement Ending Balance vs Cleared General Ledger Balance (Code 1200).**
3. **Displays outstanding uncleared cheques or deposits in transit.**
4. **Asserts that the adjusted bank balance matches the ledger balance down to the penny.**
5. **Displays a green badge: 'Difference: £0.00 — Fully Reconciled'.**

### Success Outcome
Business owners have 100% confidence that their financial reports reflect real money in the bank.

### Safety Guardrails & Failure Handling
Any discrepancy is highlighted in red, allowing bookkeepers to trace missing lines immediately.

* **Domain Rejection Code:** `200 BANK_EQUILIBRIUM_OK`

---

## UC-083: Reconciliation Clearance Locking Rule

* **Functional Module:** Audit Safety
* **Primary Actor:** Accountant
* **Business Goal:** Lock reconciled bank transactions to protect past accounting periods.

### Visual Flowchart Architecture

![Figure 083 - Reconciliation Clearance Locking Rule](diagrams/cases_100/case_083.png)

### How the System Works Step-by-Step

1. **Once a bank statement line is reconciled, Blynt sets its status to 'RECONCILED'.**
2. **The transaction is locked against accidental deletion or unmatching.**
3. **If a user needs to unmatch a cleared transaction, the system requires accountant confirmation.**
4. **The unmatching event and reason are permanently logged in the audit trail.**
5. **Past reconciled bank statements remain permanently stable.**

### Success Outcome
Reconciled months cannot be accidentally broken by daily operational staff.

### Safety Guardrails & Failure Handling
Attempting to casually delete cleared lines displays: 'This transaction is reconciled and locked.'

* **Domain Rejection Code:** `403 CLEARED_TRANSACTION_LOCKED`

---

## UC-084: Realised Foreign Currency Exchange Gain/Loss

* **Functional Module:** Multi-Currency
* **Primary Actor:** Ledger Engine
* **Business Goal:** Automatically calculate currency profit/loss when foreign invoices are paid.

### Visual Flowchart Architecture

![Figure 084 - Realised Foreign Currency Exchange Gain/Loss](diagrams/cases_100/case_084.png)

### How the System Works Step-by-Step

1. **A US client is billed $1,000.00 when the exchange rate is 1.25 (booked at £800.00 GBP).**
2. **When the client pays, the exchange rate has moved to 1.20 (the bank receives £833.33 GBP).**
3. **Blynt clears the $1,000.00 Accounts Receivable balance (£800.00).**
4. **Records cash received in Bank: £833.33.**
5. **Automatically posts the £33.33 difference to Nominal Code 4900 ('Realised FX Gain').**

### Success Outcome
Currency gains and losses are accounted for automatically under UK GAAP.

### Safety Guardrails & Failure Handling
Exchange variances reconcile seamlessly to the Profit & Loss statement.

* **Domain Rejection Code:** `200 FX_GAIN_LOSS_POSTED`

---

## UC-085: Monthly Accounting Period Calendar Partitioning

* **Functional Module:** Period Governance
* **Primary Actor:** Certified Accountant
* **Business Goal:** Establish the 12 calendar partitions for monthly management accounts.

### Visual Flowchart Architecture

![Figure 085 - Monthly Accounting Period Calendar Partitioning](diagrams/cases_100/case_085.png)

### How the System Works Step-by-Step

1. **At the start of the financial year, Blynt partitions the fiscal calendar into 12 monthly periods.**
2. **Period 1 (April), Period 2 (May) ... Period 12 (March).**
3. **The system verifies that start and end dates cover every day of the year with zero gaps.**
4. **Period 1 is set to 'OPEN', and future periods are staged.**
5. **Transactions are automatically tagged with their matching accounting period upon entry.**

### Success Outcome
Management accounts can be compared month-by-month for financial performance analysis.

### Safety Guardrails & Failure Handling
Overlapping dates are blocked by database integrity constraints.

* **Domain Rejection Code:** `400 PERIOD_OVERLAP`

---

## UC-086: Interim Monthly Accounting Period Close

* **Functional Module:** Period Governance
* **Primary Actor:** Certified Accountant
* **Business Goal:** Lock a completed month so employees cannot alter finalized numbers.

### Visual Flowchart Architecture

![Figure 086 - Interim Monthly Accounting Period Close](diagrams/cases_100/case_086.png)

### How the System Works Step-by-Step

1. **At the end of April, the accountant finishes all bank reconciliations and adjustments.**
2. **Accountant navigates to Settings -> Financial Periods and clicks 'Close Period 1 (April)'.**
3. **Blynt verifies that there are zero unposted draft journals or invoices dated in April.**
4. **The period status updates to 'CLOSED'.**
5. **Any future attempt to backdate an invoice into April is blocked.**

### Success Outcome
Monthly numbers reported to directors or investors remain permanently stable.

### Safety Guardrails & Failure Handling
Attempting to close a month with unposted drafts displays: 'Please post or discard all April drafts first.'

* **Domain Rejection Code:** `403 UNPOSTED_DRAFTS_IN_PERIOD`

---

## UC-087: Financial Year-End Final Trial Balance Check

* **Functional Module:** Year-End Closing
* **Primary Actor:** Certified Accountant
* **Business Goal:** Verify complete ledger equilibrium before initiating the annual tax close.

### Visual Flowchart Architecture

![Figure 087 - Financial Year-End Final Trial Balance Check](diagrams/cases_100/case_087.png)

### How the System Works Step-by-Step

1. **Accountant prepares to close Financial Year 2024.**
2. **Blynt executes a comprehensive pre-close integrity audit:**
3. **  1. Asserts sum(Debits) == sum(Credits) across all accounts.**
4. **  2. Asserts all bank accounts are 100% reconciled to the fiscal year end date.**
5. **  3. Asserts suspense and clearing accounts hold a balance of exactly £0.00.**
6. **If all checks pass, the system authorizes the year-end close sequence.**

### Success Outcome
Year-end closing can only occur when the accounts are in perfect, audited balance.

### Safety Guardrails & Failure Handling
If the trial balance is out of equilibrium, the close is blocked with a diagnostic report.

* **Domain Rejection Code:** `422 LEDGER_NOT_IN_BALANCE`

---

## UC-088: Annual Retained Earnings Rollover Engine

* **Functional Module:** Year-End Closing
* **Primary Actor:** Accounting Engine
* **Business Goal:** Transfer annual profit to equity and reset revenue/expenses for the new year.

### Visual Flowchart Architecture

![Figure 088 - Annual Retained Earnings Rollover Engine](diagrams/cases_100/case_088.png)

### How the System Works Step-by-Step

1. **Accountant initiates the annual year-end close.**
2. **Blynt sums all Revenue nominals (Credit) and all Expense nominals (Debit).**
3. **Calculates the net profit for the year (e.g., £54,200.00).**
4. **Generates an automated Year-End Closing Journal that resets all Revenue & Expense nominals to £0.00.**
5. **Credits the £54,200.00 profit into Equity Code 3100 (Retained Earnings).**

### Success Outcome
The new financial year starts with clean £0.00 P&L accounts, and cumulative profit is preserved in Equity.

### Safety Guardrails & Failure Handling
Any failure during rollover rolls back the transaction safely.

* **Domain Rejection Code:** `500 ROLLOVER_FAILED`

---

## UC-089: Temporal Database Date-Lock Enforcement

* **Functional Module:** Statutory Immutability
* **Primary Actor:** PostgreSQL Engine
* **Business Goal:** Enforce physical database locks preventing backdating into closed tax years.

### Visual Flowchart Architecture

![Figure 089 - Temporal Database Date-Lock Enforcement](diagrams/cases_100/case_089.png)

### How the System Works Step-by-Step

1. **A user attempts to create a supplier bill dated 15 November 2023 (inside a CLOSED financial year).**
2. **The transaction is sent to PostgreSQL.**
3. **A database-level temporal constraint (btree_gist) evaluates the transaction date against closed periods.**
4. **The database rejects the INSERT operation with an integrity exception.**
5. **The user sees an immediate warning on screen: 'Cannot backdate transactions into a locked financial year.'**

### Success Outcome
Tax accounts filed with HMRC cannot be tampered with by any user or software bug.

### Safety Guardrails & Failure Handling
The database physically rejects unauthorized historical modifications.

* **Domain Rejection Code:** `403 PERIOD_TEMPORALLY_LOCKED`

---

## UC-090: Audited Emergency Period Reopening Workflow

* **Functional Module:** Period Governance
* **Primary Actor:** Company Owner Only
* **Business Goal:** Handle rare statutory audit adjustments in closed years with full accountability.

### Visual Flowchart Architecture

![Figure 090 - Audited Emergency Period Reopening Workflow](diagrams/cases_100/case_090.png)

### How the System Works Step-by-Step

1. **A statutory tax auditor requires an adjusting entry in a closed financial year.**
2. **The company OWNER navigates to Settings -> Financial Years and requests 'Emergency Unlock'.**
3. **Blynt requires two-factor authentication and a mandatory written justification reason.**
4. **The system logs the exact timestamp, user ID, IP address, and justification into the immutable audit trail.**
5. **The period unlocks for a temporary 24-hour window, after which it automatically re-locks.**

### Success Outcome
Legitimate auditor adjustments can be made without compromising corporate governance.

### Safety Guardrails & Failure Handling
Attempting to reopen without a written justification is blocked: 'Justification reason is required.'

* **Domain Rejection Code:** `403 REOPEN_AUDIT_LOG_MANDATORY`

---

## UC-091: Trial Balance Report Equilibrium Derivation

* **Functional Module:** Financial Reporting
* **Primary Actor:** Accountant / Auditor
* **Business Goal:** Generate the master trial balance proving ledger balance across all nominals.

### Visual Flowchart Architecture

![Figure 091 - Trial Balance Report Equilibrium Derivation](diagrams/cases_100/case_091.png)

### How the System Works Step-by-Step

1. **User opens Reports -> Trial Balance and selects a date range.**
2. **Blynt aggregates all debit and credit journal lines across every nominal account.**
3. **Computes the net balance for each account according to its normal balance type.**
4. **Sums all Debit balances and all Credit balances.**
5. **Asserts that Total Debits equals Total Credits down to the exact penny (£0.00 variance).**

### Success Outcome
Accountants have an instant, reliable snapshot of the entire general ledger for tax filings.

### Safety Guardrails & Failure Handling
Any discrepancy triggers an internal diagnostic flag for audit investigation.

* **Domain Rejection Code:** `422 TB_OUT_OF_BALANCE`

---

## UC-092: Profit & Loss (Income Statement) Derivation

* **Functional Module:** Financial Reporting
* **Primary Actor:** Business Owner / CPA
* **Business Goal:** Track sales turnover, gross margins, overhead expenses, and net profit.

### Visual Flowchart Architecture

![Figure 092 - Profit & Loss (Income Statement) Derivation](diagrams/cases_100/case_092.png)

### How the System Works Step-by-Step

1. **User opens Reports -> Profit & Loss for the current quarter.**
2. **Blynt pulls all Revenue nominals (Codes 4000-4999) to compute Operating Turnover.**
3. **Subtracts Cost of Sales (Codes 5000-5999) to compute Gross Profit Margin.**
4. **Subtracts Operating Expenses (Codes 6000-8999) to compute Net Operating Profit.**
5. **Displays the report on screen with 1-click export to PDF or Excel.**

### Success Outcome
Business leaders can see exact profitability and expense trends in real time.

### Safety Guardrails & Failure Handling
All figures can be clicked to drill down into the underlying invoices and receipts.

* **Domain Rejection Code:** `200 PNL_GENERATED`

---

## UC-093: Balance Sheet Statement Derivation & Balance

* **Functional Module:** Financial Reporting
* **Primary Actor:** Accountant / Lender
* **Business Goal:** Verify the company's financial standing: Assets = Liabilities + Equity.

### Visual Flowchart Architecture

![Figure 093 - Balance Sheet Statement Derivation & Balance](diagrams/cases_100/case_093.png)

### How the System Works Step-by-Step

1. **User opens Reports -> Balance Sheet at the close of the month.**
2. **Blynt aggregates Current and Fixed Assets (Codes 1000-1999).**
3. **Aggregates Current and Long-Term Liabilities (Codes 2000-2999).**
4. **Aggregates Capital, Retained Earnings, and current year Net Profit.**
5. **Asserts the golden balance equation: Total Assets == Total Liabilities + Total Equity.**

### Success Outcome
Provides banks, lenders, and directors with an audited statement of business net worth.

### Safety Guardrails & Failure Handling
An out-of-balance condition is mathematically prevented by double-entry invariants.

* **Domain Rejection Code:** `422 BALANCE_SHEET_UNBALANCED`

---

## UC-094: Quarterly HMRC VAT Return Box 1-9 Derivation

* **Functional Module:** Tax Compliance
* **Primary Actor:** Certified Accountant
* **Business Goal:** Derive standard UK VAT Return figures directly from ledger lines.

### Visual Flowchart Architecture

![Figure 094 - Quarterly HMRC VAT Return Box 1-9 Derivation](diagrams/cases_100/case_094.png)

### How the System Works Step-by-Step

1. **Accountant selects the VAT quarter (e.g., 01 Jan to 31 Mar).**
2. **Blynt aggregates all tax-tagged transactions posted in that period:**
3. **  - Box 1: VAT due on sales and other outputs**
4. **  - Box 3: Total VAT due (Box 1 + Box 2)**
5. **  - Box 4: VAT reclaimed on purchases and inputs**
6. **  - Box 5: Net VAT to pay to HMRC or reclaim (Box 3 minus Box 4)**
7. **  - Box 6 & 7: Total value of sales and purchases excluding VAT.**
8. **Validates that all box arithmetic reconciles perfectly to General Ledger tax control nominals.**

### Success Outcome
Quarterly VAT returns are prepared in seconds with zero manual copy-paste errors.

### Safety Guardrails & Failure Handling
Any mathematical discrepancy halts the return: 'VAT calculation error detected.'

* **Domain Rejection Code:** `422 VAT_CALCULATION_INVALID`

---

## UC-095: Making Tax Digital (MTD) HMRC API Submission

* **Functional Module:** Statutory Compliance
* **Primary Actor:** Certified Accountant
* **Business Goal:** Submit VAT returns directly to HMRC over the government MTD API.

### Visual Flowchart Architecture

![Figure 095 - Making Tax Digital (MTD) HMRC API Submission](diagrams/cases_100/case_095.png)

### How the System Works Step-by-Step

1. **Accountant reviews the finalized 9-box VAT figures and clicks 'Submit to HMRC MTD'.**
2. **Blynt validates the active HMRC OAuth2 cryptographic connection.**
3. **Constructs the official HMRC MTD JSON payload conforming to HMRC API specifications.**
4. **Transmits the payload securely over TLS to HMRC's government gateway.**
5. **HMRC validates the submission and returns an official cryptographic submission receipt reference.**

### Success Outcome
The business complies 100% with UK Making Tax Digital legal filing mandates.

### Safety Guardrails & Failure Handling
If HMRC rejects a figure (e.g., invalid period key), Blynt displays the exact government gateway message.

* **Domain Rejection Code:** `502 HMRC_GATEWAY_REJECTED`

---

## UC-096: Viewer Role Write Operation Block Enforcement

* **Functional Module:** Access Control
* **Primary Actor:** External Auditor / Viewer
* **Business Goal:** Allow auditors to inspect books without any risk of changing data.

### Visual Flowchart Architecture

![Figure 096 - Viewer Role Write Operation Block Enforcement](diagrams/cases_100/case_096.png)

### How the System Works Step-by-Step

1. **A user with the assigned role 'VIEWER' logs into the system.**
2. **The UI hides all 'Create', 'Edit', 'Delete', and 'Post' action buttons.**
3. **If the viewer attempts to send an HTTP POST request to create an invoice, the RolesGuard intercepts it.**
4. **The guard checks the user's role claim against endpoint metadata.**
5. **The request is rejected immediately with HTTP 403 Forbidden before reaching the database.**

### Success Outcome
Auditors and read-only directors can inspect accounts with complete safety.

### Safety Guardrails & Failure Handling
The screen alerts: 'Your account has View-Only permissions. You cannot perform this action.'

* **Domain Rejection Code:** `403 VIEWER_READ_ONLY`

---

## UC-097: Bookkeeper Settings Modification Prohibition

* **Functional Module:** Access Control
* **Primary Actor:** Bookkeeper
* **Business Goal:** Prevent operational staff from altering company bank accounts or tax settings.

### Visual Flowchart Architecture

![Figure 097 - Bookkeeper Settings Modification Prohibition](diagrams/cases_100/case_097.png)

### How the System Works Step-by-Step

1. **A user with role 'BOOKKEEPER' attempts to change the company bank account details in Settings.**
2. **Blynt's PermissionGuard intercepts the request.**
3. **The guard asserts that modifying banking infrastructure requires role 'ADMIN' or 'OWNER'.**
4. **The modification is rejected.**
5. **The unauthorized attempt is recorded in the security audit log.**

### Success Outcome
Internal controls protect against unauthorized redirection of company funds.

### Safety Guardrails & Failure Handling
The screen shows: 'Administrator permissions required to update banking settings.'

* **Domain Rejection Code:** `403 BOOKKEEPER_RESTRICTED`

---

## UC-098: Accountant Period Close Authority Validation

* **Functional Module:** Governance & Compliance
* **Primary Actor:** Bookkeeper vs Accountant
* **Business Goal:** Ensure only qualified financial personnel can lock company accounts.

### Visual Flowchart Architecture

![Figure 098 - Accountant Period Close Authority Validation](diagrams/cases_100/case_098.png)

### How the System Works Step-by-Step

1. **A junior bookkeeper clicks 'Lock Financial Year'.**
2. **Blynt checks the user's role in the organization token.**
3. **The system detects that the user is a 'BOOKKEEPER', not an 'ACCOUNTANT' or 'OWNER'.**
4. **The action is blocked.**
5. **A notification explains that only certified accountants or business owners can close financial years.**

### Success Outcome
High-impact statutory decisions are restricted to qualified decision-makers.

### Safety Guardrails & Failure Handling
The screen displays: 'Only an Accountant or Owner can close financial periods.'

* **Domain Rejection Code:** `403 ACCOUNTANT_ROLE_REQUIRED`

---

## UC-099: Audit Trail Cryptographic SHA-256 Hash Chain

* **Functional Module:** GRC Compliance
* **Primary Actor:** Audit Service
* **Business Goal:** Prove to tax inspectors that audit logs have never been altered.

### Visual Flowchart Architecture

![Figure 099 - Audit Trail Cryptographic SHA-256 Hash Chain](diagrams/cases_100/case_099.png)

### How the System Works Step-by-Step

1. **Whenever any financial record is created, edited, voided, or viewed, an audit event is triggered.**
2. **Blynt captures the timestamp, user ID, IP address, action, and payload diff.**
3. **The system fetches the SHA-256 hash of the immediately preceding audit record.**
4. **Computes a new hash: SHA-256(previousHash + timestamp + payload).**
5. **The event is appended to the audit table, creating a tamper-evident cryptographic blockchain.**

### Success Outcome
Provides statutory proof to HMRC that company accounting logs have not been manipulated off-the-books.

### Safety Guardrails & Failure Handling
Any broken link in the hash chain immediately triggers an automated compliance alert.

* **Domain Rejection Code:** `500 AUDIT_CHAIN_BROKEN`

---

## UC-100: Database Direct Deletion Prevention Trigger

* **Functional Module:** Statutory Immutability
* **Primary Actor:** PostgreSQL Engine
* **Business Goal:** Block direct SQL attacks from deleting compliance audit trails.

### Visual Flowchart Architecture

![Figure 100 - Database Direct Deletion Prevention Trigger](diagrams/cases_100/case_100.png)

### How the System Works Step-by-Step

1. **A malicious attacker or rogue database administrator runs: 'DELETE FROM audit_logs;'.**
2. **A PostgreSQL database-level 'BEFORE DELETE OR UPDATE' trigger fires instantly.**
3. **The trigger executes an unconditional exception: 'RAISE EXCEPTION "AUDIT LOGS ARE IMMUTABLE";'.**
4. **The database transaction is aborted and rolled back immediately.**
5. **Zero rows are deleted; 100% of the audit trail is permanently preserved.**

### Success Outcome
Compliance records are physically protected at the database engine level against any deletion.

### Safety Guardrails & Failure Handling
Database returns: 'Audit logs are permanent and immutable. Direct deletion is prohibited.'

* **Domain Rejection Code:** `500 DIRECT_SQL_MODIFICATION_BLOCKED`

---

