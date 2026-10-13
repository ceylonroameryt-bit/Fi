import base64
import json
import time
import urllib.request
import urllib.error

JIRA_URL = "https://blynt-co.atlassian.net"
EMAIL = "blynttechnologies@gmail.com"
API_TOKEN = "ATATT3xFfGF0fCmX0geTVLXs5-U05HWdeD12Ltg_TSyF7i9_8X8XdMzjuJDosb3Iqk9kHteICNzJO6SkshyWow7r-MMAan7QBFDTd4MRBDQPtJOFfhwP37MS3WIv6Rl8oMjVw7Rw_oRq_bQCSl2v5j8YT2_kOnxHv4Q0EgKRwbZ-qL-ZKsbgvcY=F5D7FBCF"

auth_str = f"{EMAIL}:{API_TOKEN}"
b64_auth = base64.b64encode(auth_str.encode()).decode()
headers = {
    "Authorization": f"Basic {b64_auth}",
    "Content-Type": "application/json",
    "Accept": "application/json"
}

def api_request(path, method="GET", payload=None):
    url = f"{JIRA_URL}{path}"
    data = json.dumps(payload).encode() if payload else None
    req = urllib.request.Request(url, method=method, headers=headers, data=data)
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req) as resp:
                raw = resp.read().decode()
                return json.loads(raw) if raw else {}
        except urllib.error.HTTPError as e:
            err = e.read().decode()
            if e.code == 429:
                time.sleep(2)
                continue
            print(f"[-] HTTP {e.code} on {path}: {err}")
            return None
        except Exception as e:
            time.sleep(1)
            continue
    return None

def transition_issue(key, target_status):
    trans_data = api_request(f"/rest/api/3/issue/{key}/transitions")
    if not trans_data:
        return
    tid = None
    for t in trans_data.get("transitions", []):
        if t.get("to", {}).get("name", "").lower() == target_status.lower():
            tid = t.get("id")
            break
    if tid:
        api_request(f"/rest/api/3/issue/{key}/transitions", method="POST", payload={"transition": {"id": tid}})

def create_issue(summary, desc, issuetype, component, status, parent_key=None, fix_version=None):
    payload = {
        "fields": {
            "project": {"key": "SCRUM"},
            "summary": summary,
            "description": {
                "type": "doc",
                "version": 1,
                "content": [
                    {
                        "type": "paragraph",
                        "content": [{"type": "text", "text": desc}]
                    }
                ]
            },
            "issuetype": {"name": issuetype},
            "components": [{"name": component}]
        }
    }
    if parent_key:
        payload["fields"]["parent"] = {"key": parent_key}
    if fix_version:
        payload["fields"]["fixVersions"] = [{"name": fix_version}]

    res = api_request("/rest/api/3/issue", method="POST", payload=payload)
    if res and "key" in res:
        key = res["key"]
        if status.lower() != "to do":
            transition_issue(key, status)
        print(f"[+] Created {issuetype} {key} [{status}]: {summary[:45]}...")
        return key
    return None

# 50 Phases breakdown specification
phase_specs = [
    # Milestone 1: The Indestructible Foundation (Phases 1-8) - Status: Done
    (1, "SCRUM-9", "Core Engine", "v0.1.0 - Foundation & Zero-Drift Core", "Done", [
        ("Setup Production Monorepo, Docker & PostgreSQL 16 Schema", "Initialize Turborepo, NestJS 11, Prisma ORM, and PostgreSQL temporal btree_gist extension."),
        ("Configure Audit Logs Immutability Trigger & Request Tracing", "Implement PostgreSQL trigger blocking UPDATE/DELETE on audit_logs and attach correlation IDs.")
    ]),
    (2, "SCRUM-10", "Security & Auth", "v0.1.0 - Foundation & Zero-Drift Core", "Done", [
        ("Implement Node.js Native scrypt Password Hashing & Timing-Safe Verification", "Store secure 64-byte hashes with random 16-byte salt and prevent timing side-channels."),
        ("Build Multi-Device Session Management in user_sessions Table", "Support stateful session revocation, refresh tokens, and instant remote session termination.")
    ]),
    (3, "SCRUM-11", "Multi-Tenancy", "v0.1.0 - Foundation & Zero-Drift Core", "Done", [
        ("Enforce Composite Foreign Keys (organization_id, id) for Tenant Isolation", "PostgreSQL relational integrity guaranteeing cross-tenant data leakage is physically blocked."),
        ("Build Organization Switcher & User Membership Matrix in apps/api", "Handle organization context switching and active tenant payload injection in NestJS guards.")
    ]),
    (4, "SCRUM-12", "Security & Auth", "v0.1.0 - Foundation & Zero-Drift Core", "Done", [
        ("Implement Hierarchical Role-Based Access Control (RBAC) System Roles", "Predefined Owner, Admin, Accountant, Viewer roles with granular CRUD permission policies."),
        ("Create NestJS RBAC Decorators & Guard Interceptors across API", "Enforce role permissions on all endpoints with structured 403 Forbidden security responses.")
    ]),
    (5, "SCRUM-13", "Accounting", "v0.1.0 - Foundation & Zero-Drift Core", "Done", [
        ("Design Hierarchical UK Chart of Accounts (COA) Model", "Standard 4-digit UK nominal codes categorized into Assets (1xxx), Liabilities (2xxx), Equity (3xxx), Revenue (4xxx), Expenses (5-8xxx)."),
        ("Implement Default COA Seeding Service for New Organizations", "Seed 45 standard UK nominal accounts upon organization creation.")
    ]),
    (6, "SCRUM-14", "Accounting", "v0.1.0 - Foundation & Zero-Drift Core", "Done", [
        ("Implement Financial Year & Accounting Periods Model with Temporal Constraints", "Prevent overlapping financial periods via PostgreSQL btree_gist exclusion constraints."),
        ("Build Period Lock & Year-End Freeze Validation in Journal Posting", "Block any backdated journal posting into locked or closed accounting periods.")
    ]),
    (7, "SCRUM-15", "Accounting", "v0.1.0 - Foundation & Zero-Drift Core", "Done", [
        ("Build Multi-Line Manual Journal Entry Interface in apps/web", "Dynamic interactive multi-line entry grid calculating live debits, credits, and out-of-balance differences."),
        ("Implement Manual Journal Draft, Review & Posting API Lifecycle", "Support draft journal saving and explicit posting approval workflows.")
    ]),
    (8, "SCRUM-16", "Core Engine", "v0.1.0 - Foundation & Zero-Drift Core", "Done", [
        ("Implement The 15 Double-Entry Accounting Invariants in PostingEngineService", "Enforce atomic transaction sum(debit) == sum(credit), debit>=0, credit>=0, and non-empty line validation."),
        ("Verify Zero-Drift Ledger Correctness with 26 Test Suites (127 Tests)", "Full unit and integration test coverage validating absolute ledger balance integrity.")
    ]),

    # Milestone 2: Commercial Workflows & Subledgers (Phases 9-15) - Status: Done
    (9, "SCRUM-17", "Subledgers", "v0.2.0 - Commercial Invoicing & Subledgers", "Done", [
        ("Implement Contacts V2 Directory for Customers & Suppliers", "Unified contact model with statutory registration numbers, default payment terms, and VAT settings."),
        ("Build Dynamic Contact Balance Derivation from General Ledger", "Derive customer and supplier balances directly from posted journal lines, eliminating cached balance drift.")
    ]),
    (10, "SCRUM-18", "Billing & Invoicing", "v0.2.0 - Commercial Invoicing & Subledgers", "Done", [
        ("Implement Sales Invoicing Full Lifecycle (Draft, Approve, Send, Void)", "Line-item tax calculation, customer assignment, invoice numbering sequence, and PDF generation."),
        ("Implement Automated General Ledger Auto-Posting for Sales Invoices", "Post balanced journals: Debit Debtors (1100), Credit Sales (4000), Credit Output VAT (2200).")
    ]),
    (11, "SCRUM-19", "Reporting & Statements", "v0.2.0 - Commercial Invoicing & Subledgers", "Done", [
        ("Build Accounts Receivable (AR) Ageing Engine (Current, 30, 60, 90+ Days)", "Calculate invoice ageing buckets based on invoice due dates and unallocated balances."),
        ("Implement Customer Statement PDF Generation & Statement Emailing", "Generate professional monthly customer statements with running ledger balance.")
    ]),
    (12, "SCRUM-20", "Purchasing & AP", "v0.2.0 - Commercial Invoicing & Subledgers", "Done", [
        ("Implement Purchase Bills & Accounts Payable Subledger Entry", "Capture supplier invoices, line-item expense codes, due dates, and payment instructions."),
        ("Implement Automated General Ledger Auto-Posting for Purchase Bills", "Post balanced journals: Debit Expense (5000+), Debit Input VAT (2201), Credit Creditors (2100).")
    ]),
    (13, "SCRUM-21", "Banking & Reconciliation", "v0.2.0 - Commercial Invoicing & Subledgers", "Done", [
        ("Build Customer Receipts & Supplier Payments Allocation Engine", "Support partial settlements, multi-invoice allocations, and unallocated account credit."),
        ("Post Cash Settlement Balancing Journals to Bank Nominal Accounts", "Debit Bank (1200) / Credit Debtors (1100), and Debit Creditors (2100) / Credit Bank (1200).")
    ]),
    (14, "SCRUM-22", "Banking & Reconciliation", "v0.2.0 - Commercial Invoicing & Subledgers", "Done", [
        ("Implement Bank Accounts Management & CSV Statement Importer", "Support multiple currency bank accounts and parse OFX/CSV bank statement records."),
        ("Build Interactive Bank Statement Reconciliation Matching Grid", "Match bank statement transactions against posted subledger payments with 1-click reconcile.")
    ]),
    (15, "SCRUM-23", "Reporting & Statements", "v0.2.0 - Commercial Invoicing & Subledgers", "Done", [
        ("Build Real-Time Trial Balance Generation Engine with Zero Caching", "Aggregate all posted journal lines grouped by nominal code with debit and credit balance proof."),
        ("Build Profit & Loss (Income Statement) and Balance Sheet Financial Reports", "Generate statutory P&L and Balance Sheet reports with period comparison and drill-down.")
    ]),

    # Milestone 3: UK Statutory Tax & HMRC MTD (Phases 16-25) - Status: In Progress / To Do
    (16, "SCRUM-24", "Tax & HMRC MTD", "v1.0.0 - UK Statutory Tax & HMRC MTD", "In Progress", [
        ("Implement UK 9-Box VAT Return Derivation Logic from General Ledger", "Derive Box 1 (sales VAT), Box 4 (purchase VAT), Box 5 (net payable), and total sales/purchases Box 6-9."),
        ("Build UK VAT Return Review, Audit Trail & Sign-Off UI in apps/web", "Interface for accountants to verify invoice and bill line items before digital submission.")
    ]),
    (17, "SCRUM-25", "Tax & HMRC MTD", "v1.0.0 - UK Statutory Tax & HMRC MTD", "To Do", [
        ("Implement HMRC Making Tax Digital (MTD) OAuth 2.0 Client", "Connect to HMRC MTD VAT API for secure token exchange and automatic token refreshes in AWS Secrets Manager."),
        ("Build Digital VAT Return Direct Submission & Receipt Logging to HMRC", "Submit 9-box payloads to HMRC endpoint /organisations/vat/{vrn}/returns and store cryptographic submission receipts.")
    ]),
    (18, "SCRUM-26", "Accounting", "v1.0.0 - UK Statutory Tax & HMRC MTD", "To Do", [
        ("Implement Automated Fiscal Year-End Close Wizard", "Transfer net profit/loss to Retained Earnings (3100) and zero out revenue and expense nominals."),
        ("Enforce Permanent Period Lock and Year-End Audit Snapshot", "Lock all financial years and generate immutable closing audit pack.")
    ]),
    (19, "SCRUM-27", "Accounting", "v1.0.0 - UK Statutory Tax & HMRC MTD", "To Do", [
        ("Build Fixed Asset Register with Straight-Line & Reducing Balance Schedules", "Track asset acquisition, net book value, useful life, and residual value."),
        ("Automate Monthly Depreciation Journal Posting to General Ledger", "Debit Depreciation Expense (7000) and Credit Accumulated Depreciation (1010).")
    ]),
    (20, "SCRUM-28", "Tax & HMRC MTD", "v1.0.0 - UK Statutory Tax & HMRC MTD", "To Do", [
        ("Implement Construction Industry Scheme (CIS) Domestic Reverse Charge VAT", "Support CIS reverse charge rules on sales and purchases with automated box 1/4 allocations."),
        ("Build Post-Brexit EC Sales List & Reverse Charge Accounting Engine", "Handle Northern Ireland protocol and EU cross-border B2B service reverse charge rules.")
    ]),
    (21, "SCRUM-29", "Practice Management", "v1.0.0 - UK Statutory Tax & HMRC MTD", "To Do", [
        ("Build Multi-Client Practice Portal for Certified Accountants & Bookkeepers", "Unified practice dashboard allowing accountants to switch across hundreds of client companies."),
        ("Implement Practice Staff Permissions & Client Audit Queue Management", "Assign senior accountants and junior bookkeepers to specific client portfolios with sign-off workflows.")
    ]),
    (22, "SCRUM-30", "Tax & HMRC MTD", "v1.0.0 - UK Statutory Tax & HMRC MTD", "To Do", [
        ("Implement Companies House Micro-Entity Filing (FRS 105) Generator", "Generate statutory balance sheet, footnotes, and statements of financial position for micro-entities."),
        ("Build iXBRL Tagging & Direct Electronic Filing Gateway with Companies House", "Transmit signed accounts directly to Companies House XML/iXBRL gateway.")
    ]),
    (23, "SCRUM-31", "Reporting & Statements", "v1.0.0 - UK Statutory Tax & HMRC MTD", "To Do", [
        ("Implement Departmental & Cost Center Budget Allocation", "Define quarterly and annual budgets per nominal account and business unit."),
        ("Build Actual vs Budget Variance Analysis & Real-Time Alerting", "Generate variance reports highlighting budget overruns and margin compression.")
    ]),
    (24, "SCRUM-32", "Accounting", "v1.0.0 - UK Statutory Tax & HMRC MTD", "To Do", [
        ("Build Automated Recurring Journal Schedules Engine", "Schedule monthly recurring journals for leases, subscriptions, and standing accruals."),
        ("Implement Prepayments & Accruals Amortization Wizard", "Automatically amortize multi-month prepayments with monthly reversal journals.")
    ]),
    (25, "SCRUM-33", "Security & Auth", "v1.0.0 - UK Statutory Tax & HMRC MTD", "To Do", [
        ("Implement Standard Audit File for Tax (SAF-T) Export Package", "Export OECD compliant SAF-T XML files with complete transaction hashes."),
        ("Build Cryptographic Tamper-Proof Audit Trail Verification System", "Verify SHA-256 hash chains across all posted financial transactions for external auditors.")
    ]),

    # Milestone 4A: Banking & AI Automation (Phases 26-35) - Status: To Do
    (26, "SCRUM-34", "Banking & Reconciliation", "v2.0.0 - Open Banking & AI Automation", "To Do", [
        ("Integrate TrueLayer Open Banking Connect Flow for UK Business Accounts", "Stream transactions from Barclays, NatWest, HSBC, Lloyds, Monzo, and Revolut."),
        ("Build Automated Daily Bank Transaction Sync & Webhook Receiver", "Ingest bank transactions in background worker and notify accountants of new feed items.")
    ]),
    (27, "SCRUM-35", "Banking & Reconciliation", "v2.0.0 - Open Banking & AI Automation", "To Do", [
        ("Implement 90-Day Open Banking Strong Customer Authentication (SCA) Reconnect", "Automated email and in-app reminder prompts for business owners to renew bank consents."),
        ("Build Secure Banking Token Vault with AWS KMS Envelope Encryption", "Protect bank OAuth refresh tokens using dedicated AWS KMS customer-managed keys.")
    ]),
    (28, "SCRUM-36", "Banking & Reconciliation", "v2.0.0 - Open Banking & AI Automation", "To Do", [
        ("Build Automated Bank Transaction Matching & Categorization Rules Engine", "Regex and fuzzy matching on payee, description, and amount to auto-create ledger transactions."),
        ("Implement 1-Click Bank Feed Reconciliation Approval Queue", "High-velocity reconciliation interface enabling bookkeepers to clear 50 items in 60 seconds.")
    ]),
    (29, "SCRUM-37", "Banking & Reconciliation", "v2.0.0 - Open Banking & AI Automation", "To Do", [
        ("Integrate Plaid Link for International & North American Bank Feeds", "Expand bank connectivity to US, Canadian, and European financial institutions."),
        ("Standardize Plaid Multi-Account Data Schemas into Blynt Banking Engine", "Normalize routing numbers, account numbers, and transaction codes into standard bank subledger.")
    ]),
    (30, "SCRUM-38", "Banking & Reconciliation", "v2.0.0 - Open Banking & AI Automation", "To Do", [
        ("Implement Open Banking Payment Initiation Service (PIS) for Invoice Settlement", "Allow customers to click 'Pay by Bank' directly from invoices with instant zero-fee settlement."),
        ("Automate Instant General Ledger Posting upon PIS Payment Settlement", "Auto-reconcile invoice and post customer receipt journal in real-time.")
    ]),
    (31, "SCRUM-39", "AI & Automation", "v2.0.0 - Open Banking & AI Automation", "To Do", [
        ("Build Multi-Channel Receipt & Invoice Ingestion Pipeline (Upload, Mobile, S3)", "Ingest receipts via drag-and-drop, mobile camera, and secure Amazon S3 ingestion bucket."),
        ("Integrate AWS Textract Optical Character Recognition (OCR) Engine", "Extract raw text, table key-value pairs, and structural lines from PDF and image files.")
    ]),
    (32, "SCRUM-40", "AI & Automation", "v2.0.0 - Open Banking & AI Automation", "To Do", [
        ("Implement Intelligent Entity Parsing (Vendor, Invoice No, Net, VAT, Total)", "High-accuracy parsing of supplier names, VAT registration numbers, dates, and amounts."),
        ("Extract Multi-Line Receipt Item Details & Tax Rates", "Decompose line items and map to appropriate 20%, 5%, 0% UK VAT treatments.")
    ]),
    (33, "SCRUM-41", "AI & Automation", "v2.0.0 - Open Banking & AI Automation", "To Do", [
        ("Build Draft Purchase Bill Auto-Creation from OCR Extraction", "Pre-fill purchase bill forms with document preview alongside editable fields."),
        ("Implement Split-Screen Side-by-Side Document Review Interface", "Review OCR accuracy with high-contrast document highlighting in Next.js web app.")
    ]),
    (34, "SCRUM-42", "AI & Automation", "v2.0.0 - Open Banking & AI Automation", "To Do", [
        ("Implement Perceptual Image Hashing & Duplicate Document Detection", "Block duplicate expense submissions by comparing perceptual image hashes and vendor metadata."),
        ("Build Duplicate Flagging & Fraud Warning Alerts in Purchase Ledger", "Warn accountants when an invoice number has already been entered or claimed.")
    ]),
    (35, "SCRUM-43", "AI & Automation", "v2.0.0 - Open Banking & AI Automation", "To Do", [
        ("Create Dedicated Organization Inward Bill Email Inboxes (bills@blynt.co)", "Assign unique incoming email addresses per tenant to automatically ingest forwarded supplier bills."),
        ("Build Automated Email Attachment Processing & OCR Routing Lambda", "Parse incoming MIME attachments and forward PDFs directly to the ingestion queue.")
    ]),

    # Milestone 4B: ML Insights & Multi-Currency (Phases 36-45) - Status: To Do
    (36, "SCRUM-44", "AI & Automation", "v2.5.0 - Machine Learning Insights & Multi-Currency", "To Do", [
        ("Implement Machine Learning Nominal Account Code Predictor", "Predict correct expense accounts based on supplier description, historical postings, and industry classification."),
        ("Train Organization-Specific Feedback Loop on Accountant Corrections", "Improve prediction accuracy over time as bookkeepers adjust suggested codes.")
    ]),
    (37, "SCRUM-45", "AI & Automation", "v2.5.0 - Machine Learning Insights & Multi-Currency", "To Do", [
        ("Implement Statistical Anomaly & Outlier Detection in General Ledger", "Identify unusual journal amounts, unexpected nominal postings, and off-hour entries."),
        ("Build Financial Health Anomaly Dashboard & Lead Accountant Alerts", "Notify CFOs of suspicious activity or accounting inconsistencies before period close.")
    ]),
    (38, "SCRUM-46", "AI & Automation", "v2.5.0 - Machine Learning Insights & Multi-Currency", "To Do", [
        ("Build 30/60/90-Day Probabilistic Cash Flow Forecasting Engine", "Forecast future cash positions based on AR/AP due dates, payroll cycles, and recurring burn rates."),
        ("Provide Interactive Scenario Modeling (Best/Worst/Base Case)", "Allow business owners to simulate large capex purchases or delayed customer payments.")
    ]),
    (39, "SCRUM-47", "AI & Automation", "v2.5.0 - Machine Learning Insights & Multi-Currency", "To Do", [
        ("Develop Blynt Copilot: Generative AI Financial Intelligence Assistant", "Natural language interface for queries: 'What was our marketing spend last quarter compared to budget?'"),
        ("Enforce Strict Tenant Boundary & Zero-Data-Leakage Guardrails in AI Engine", "Ensure LLM prompts are isolated strictly within tenant memory and never shared across organizations.")
    ]),
    (40, "SCRUM-48", "Tax & HMRC MTD", "v2.5.0 - Machine Learning Insights & Multi-Currency", "To Do", [
        ("Build Continuous VAT Health-Check & Drift Scanner", "Background worker scanning posted transactions for missing VAT numbers, incorrect tax rates, or anomalous box entries."),
        ("Generate Pre-Filing VAT Risk Assessment Report with 1-Click Fixes", "Provide accountants with a pre-flight audit checklist before submitting returns to HMRC.")
    ]),
    (41, "SCRUM-49", "Multi-Currency", "v2.5.0 - Machine Learning Insights & Multi-Currency", "To Do", [
        ("Implement Dual Base Currency General Ledger Architecture", "Store transaction currency, base functional currency (GBP), and reporting currency on every journal line."),
        ("Ensure Zero-Drift Balancing in Both Transaction and Base Currencies", "Enforce dual balancing invariants: sum(debit_base) == sum(credit_base).")
    ]),
    (42, "SCRUM-50", "Multi-Currency", "v2.5.0 - Machine Learning Insights & Multi-Currency", "To Do", [
        ("Implement Live Foreign Exchange (FX) Rate Synchronization", "Ingest daily reference rates from Bank of England and European Central Bank."),
        ("Support Manual Custom FX Rate Overrides on Individual Transactions", "Allow custom agreed exchange rates for specialized international commercial contracts.")
    ]),
    (43, "SCRUM-51", "Multi-Currency", "v2.5.0 - Machine Learning Insights & Multi-Currency", "To Do", [
        ("Implement Realized FX Gain & Loss Calculation on Invoice Settlement", "Calculate currency gain/loss between invoice date rate and payment date rate."),
        ("Automate GL Posting to Realized Foreign Exchange Gain/Loss Nominal", "Post balanced entries: Debit/Credit Realized FX Gain/Loss (7900) upon payment allocation.")
    ]),
    (44, "SCRUM-52", "Multi-Currency", "v2.5.0 - Machine Learning Insights & Multi-Currency", "To Do", [
        ("Build Period-End Balance Sheet Unrealized FX Revaluation Wizard", "Revalue foreign bank accounts, debtors, and creditors at closing period exchange rates."),
        ("Post Automated Unrealized FX Revaluation & Next-Period Reversal Journals", "Post unrealized gain/loss to balance sheet and schedule automatic reversing entry on Day 1 of next period.")
    ]),
    (45, "SCRUM-53", "Multi-Currency", "v2.5.0 - Machine Learning Insights & Multi-Currency", "To Do", [
        ("Support Multi-Currency Customer Invoicing & Supplier Billing", "Issue invoices in USD, EUR, JPY with statutory GBP VAT equivalents printed on invoices."),
        ("Build Multi-Currency Bank Accounts & FX Transfer Ledger Workflows", "Support inter-account currency transfers with explicit conversion spreads.")
    ]),

    # Milestone 4C: Enterprise Group Consolidation (Phases 46-50) - Status: To Do
    (46, "SCRUM-54", "Enterprise & Consolidation", "v3.0.0 - Enterprise Intercompany & Group Consolidation", "To Do", [
        ("Implement Multi-Entity Parent & Subsidiary Tree Hierarchy", "Define corporate group structure, equity ownership percentages, and functional currencies."),
        ("Build Entity Group Access Control & Consolidated Organization Switcher", "Manage multi-entity roles allowing group CFOs to oversee all subsidiary books.")
    ]),
    (47, "SCRUM-55", "Enterprise & Consolidation", "v3.0.0 - Enterprise Intercompany & Group Consolidation", "To Do", [
        ("Implement Bilateral Intercompany Cross-Posting Engine", "Automatically generate mirrored journal entries across two entities with intercompany loan balances."),
        ("Enforce Intercompany Settlement & Balance Reconciliation Verification", "Ensure Entity A's intercompany receivable exactly matches Entity B's intercompany payable.")
    ]),
    (48, "SCRUM-56", "Enterprise & Consolidation", "v3.0.0 - Enterprise Intercompany & Group Consolidation", "To Do", [
        ("Build Automated Intercompany Elimination Journal Engine", "Automatically eliminate intra-group sales, management charges, and reciprocal loans upon consolidation."),
        ("Maintain Complete Audit Trail of All Elimination Adjustments", "Transparent audit trail showing unconsolidated vs consolidated ledger adjustments.")
    ]),
    (49, "SCRUM-57", "Enterprise & Consolidation", "v3.0.0 - Enterprise Intercompany & Group Consolidation", "To Do", [
        ("Build Consolidated Group Financial Reporting (Group Trial Balance, P&L, Balance Sheet)", "Generate consolidated financial statements with foreign subsidiary translation into group reporting currency."),
        ("Calculate Minority Interest & Cumulative Translation Adjustment (CTA)", "Handle non-controlling interests and balance sheet foreign currency translation reserves.")
    ]),
    (50, "SCRUM-58", "Enterprise & Consolidation", "v3.0.0 - Enterprise Intercompany & Group Consolidation", "To Do", [
        ("Build Public Developer REST & GraphQL API with Granular OAuth 2.0 Scopes", "Provide authenticated APIs for external integrations, CRM, and custom billing engines."),
        ("Implement Secure Outbound Webhook Delivery Engine with HMAC Signatures", "Stream real-time events (invoice.posted, payment.received) to external subscriber webhooks.")
    ])
]

# AWS Migration Detailed Stories
aws_migration_stories = [
    ("Epic: 100% AWS Cloud Native Infrastructure & Production Migration",
     "Complete migration to enterprise AWS native architecture (eu-west-2 London), removing all legacy platforms (Render, Vercel, Railway, Supabase) with high availability and automated CI/CD.",
     "Epic", "Infrastructure & AWS", "In Progress", None, "v0.3.0 - AWS Production Cloud Architecture"),
    ("Provision Amazon ECR Repositories for API and Web Frontend",
     "Created private container registries blynt-dev-api and blynt-dev-web with scanOnPush vulnerability scanning.",
     "Task", "Infrastructure & AWS", "Done", None, "v0.3.0 - AWS Production Cloud Architecture"),
    ("Deploy Amazon RDS PostgreSQL 16.10 Database with btree_gist Extension",
     "Provisioned managed PostgreSQL cluster blynt-dev-db in private DB subnets with temporal btree_gist extension and 11 Prisma schema migrations applied.",
     "Task", "Core Engine", "Done", None, "v0.3.0 - AWS Production Cloud Architecture"),
    ("Configure AWS Secrets Manager for Centralized Database & App Credentials",
     "Created blynt-dev-secrets-872Vy5 storing DATABASE_URL, DIRECT_URL, SESSION_SECRET, and encryption keys with IAM access control.",
     "Task", "Security & Auth", "Done", None, "v0.3.0 - AWS Production Cloud Architecture"),
    ("Deploy Blynt Backend API on AWS App Runner with VPC Egress Connector",
     "Containerized NestJS API, deployed on App Runner arpi2ujw2t.eu-west-2.awsapprunner.com with zero-downtime rolling deploys and health checks.",
     "Task", "Core Engine", "Done", None, "v0.3.0 - AWS Production Cloud Architecture"),
    ("Deploy Blynt Web Frontend on AWS App Runner with Dynamic API Reverse Proxy",
     "Containerized Next.js 15 App Router web application, deployed on App Runner 6k98b79a9x.eu-west-2.awsapprunner.com with live /api/v1 rewrite proxying.",
     "Task", "Billing & Invoicing", "Done", None, "v0.3.0 - AWS Production Cloud Architecture"),
    ("Build Automated GitHub Actions CI/CD Pipeline with Settle Polling Loops",
     "Constructed .github/workflows/deploy-aws-dev.yml with OIDC authentication, Docker buildx cache, and Terraform settlement loops preventing race conditions.",
     "Task", "Infrastructure & AWS", "Done", None, "v0.3.0 - AWS Production Cloud Architecture"),
    ("Complete Decommissioning & Cleanup of Legacy Render, Vercel, and Railway Configs",
     "Removed render.yaml, vercel.json, apps/web/vercel.json, railway.json, and purged legacy dependencies to guarantee 100% AWS compliance.",
     "Task", "Infrastructure & AWS", "Done", None, "v0.3.0 - AWS Production Cloud Architecture"),
    ("Configure AWS App Runner Custom Domain Association for dev.blynt.co & blynt.co",
     "Created custom domain associations in Terraform, configured Hostinger DNS CNAME routing and ACM validation records for test and production environments.",
     "Story", "Infrastructure & AWS", "In Progress", None, "v0.3.0 - AWS Production Cloud Architecture"),
    ("Configure CloudWatch Logs & SRE Metric Alarms for App Runner & RDS",
     "Provisioned centralized CloudWatch log groups (/aws/apprunner/blynt-dev-api, /aws/apprunner/blynt-dev-web) with latency and HTTP 5xx alerting.",
     "Task", "Infrastructure & AWS", "Done", None, "v0.3.0 - AWS Production Cloud Architecture")
]

def main():
    print("[1] Creating AWS Migration Epic & Comprehensive Infrastructure Stories...")
    aws_epic_key = None
    for item in aws_migration_stories:
        summary, desc, itype, comp, st, _, fv = item
        if itype == "Epic":
            aws_epic_key = create_issue(summary, desc, itype, comp, st, fix_version=fv)
        else:
            create_issue(summary, desc, itype, comp, st, parent_key=aws_epic_key, fix_version=fv)
        time.sleep(0.15)

    print("\n[2] Populating separate, concrete stories for all 50 Phases...")
    created_count = 0
    for phase_num, epic_key, comp, fv, default_st, stories in phase_specs:
        print(f"\n[*] Processing Phase {phase_num} (Epic: {epic_key})...")
        for summary, desc in stories:
            create_issue(summary, desc, "Story", comp, default_st, parent_key=epic_key, fix_version=fv)
            created_count += 1
            time.sleep(0.15)

    print(f"\n[+] Successfully created and linked {created_count} separate stories across all 50 phases and AWS migration!")

if __name__ == "__main__":
    main()
