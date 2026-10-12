import csv
import os

WORKSPACE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS_DIR = os.path.join(WORKSPACE_DIR, "docs")
OUTPUT_CSV = os.path.join(DOCS_DIR, "BLYNT_JIRA_IMPORT_50_PHASES.csv")

phases = [
    # Milestone 1: The Indestructible Foundation (Phases 1-8)
    (1, "Phase 1: Project & Database Foundation", "Core Engine", "Highest", 8, "COMPLETED",
     "Production monorepo architecture, Docker containerization, NestJS 11 backend, Prisma ORM, PostgreSQL 16 engine with btree_gist extension and immutability triggers."),
    (2, "Phase 2: Authentication & Sessions", "Security", "Highest", 5, "COMPLETED",
     "Node.js native scrypt password hashing, timing-safe equality verification, stateful session tokens in user_sessions table, multi-device tracking, and instant revocation."),
    (3, "Phase 3: Multi-Organisation Management", "Multi-Tenancy", "Highest", 5, "COMPLETED",
     "Tenant isolation with composite foreign keys, slug generation, user membership mapping, and strict cross-tenant access prevention."),
    (4, "Phase 4: Roles & Permissions (RBAC)", "Security", "Highest", 5, "COMPLETED",
     "Granular role-based access control with predefined system roles (Owner, Admin, Accountant, Viewer), permission matrices, and NestJS RBAC guards."),
    (5, "Phase 5: Chart of Accounts & Seed Data", "Accounting", "Highest", 8, "COMPLETED",
     "Hierarchical standard UK chart of accounts, nominal classification (Assets, Liabilities, Equity, Revenue, Expenses), nominal code validation, and default template seeding."),
    (6, "Phase 6: Financial Years & Accounting Periods", "Accounting", "High", 5, "COMPLETED",
     "Period lifecycle management (Open, Locked, Closed), non-overlapping period constraints via PostgreSQL temporal btree_gist, and posting restrictions."),
    (7, "Phase 7: Manual Journal Entry & Multi-Line Grid", "Accounting", "Highest", 13, "COMPLETED",
     "Multi-line manual journal entry grid with real-time debit/credit balancing, description fields, source document tracking, and draft vs posted workflows."),
    (8, "Phase 8: Central Posting & Validation Engine (15 Invariants)", "Core Engine", "Highest", 13, "COMPLETED",
     "The mathematical heart of Blynt. Atomically enforces zero-drift sum(debit) == sum(credit), debit>=0, credit>=0, period lock checks, and immutable journal lines."),

    # Milestone 2: Commercial Workflows & Subledgers (Phases 9-15)
    (9, "Phase 9: Contacts V2 & Subledger Architecture", "Subledgers", "High", 8, "COMPLETED",
     "Customer and supplier directory with dynamic balance computation from general ledger journal lines, eliminating cached balance drift."),
    (10, "Phase 10: Sales Invoicing & Billing Auto-Posting", "Billing", "Highest", 13, "COMPLETED",
     "Complete sales invoicing lifecycle: draft, approve, send, void. Automatic GL journal posting to Accounts Receivable (1100), Sales Revenue (4000), and Output VAT (2200)."),
    (11, "Phase 11: Customer Statements & AR Ageing", "Reporting", "High", 8, "COMPLETED",
     "Accounts Receivable ageing analysis (Current, 30, 60, 90+ days), PDF customer statements generation, and outstanding balance summaries."),
    (12, "Phase 12: Purchase Bills & Accounts Payable Subledger", "Purchasing", "Highest", 13, "COMPLETED",
     "Supplier purchase bill capture, expense categorization, line-item tax calculation, and automated GL posting to Accounts Payable (2100) and Input VAT (2201)."),
    (13, "Phase 13: Customer Receipts & Supplier Payments", "Banking", "Highest", 8, "COMPLETED",
     "Multi-invoice settlement and partial payment allocations for AR and AP with automated balancing ledger postings."),
    (14, "Phase 14: Bank Accounts & Statement Reconciliation", "Banking", "Highest", 13, "COMPLETED",
     "Bank account management, CSV/OFX statement upload, line-item matching against ledger transactions, and automated bank reconciliation state tracking."),
    (15, "Phase 15: Financial Reporting Suite V1 (TB, P&L, Balance Sheet)", "Reporting", "Highest", 13, "COMPLETED",
     "Real-time institutional reporting engine generating Trial Balance, Profit & Loss statement, and Balance Sheet with zero caching drift."),

    # Milestone 3: UK Statutory Tax & HMRC MTD Integration (Phases 16-25)
    (16, "Phase 16: UK 9-Box VAT Return Calculation", "Tax & Compliance", "Highest", 13, "PLANNED",
     "Automated UK 9-box VAT return calculation engine deriving sales/purchase net and tax totals across Standard, Reduced, Zero-rated, and Exempt tax treatments."),
    (17, "Phase 17: HMRC Making Tax Digital (MTD) Direct API Integration", "Tax & Compliance", "Highest", 21, "PLANNED",
     "Direct OAuth 2.0 connection to HMRC MTD VAT API for digital submission, obligation retrieval, liability tracking, and payment history."),
    (18, "Phase 18: Year-End Close Automation & Retained Earnings", "Accounting", "High", 13, "PLANNED",
     "Automated fiscal year closing wizard, revenue/expense zeroing, retained earnings rollover posting, and permanent period locking."),
    (19, "Phase 19: Fixed Asset Register & Depreciation", "Accounting", "Medium", 8, "PLANNED",
     "Asset acquisition tracking, straight-line and reducing balance depreciation schedules, and automated monthly depreciation journal postings."),
    (20, "Phase 20: EC Sales List & Domestic Reverse Charge VAT", "Tax & Compliance", "Medium", 8, "PLANNED",
     "Construction Industry Scheme (CIS) reverse charge VAT and post-Brexit EU goods/services reporting compliance."),
    (21, "Phase 21: Multi-Client Accounting Practice Portal", "Practice Management", "High", 13, "PLANNED",
     "Accountant and bookkeeper multi-client dashboard with bulk organization switching, practice staff assignments, and client audit queues."),
    (22, "Phase 22: Companies House Micro-Entity Filing (FRS 105)", "Tax & Compliance", "High", 13, "PLANNED",
     "Direct iXBRL generation and electronic filing of micro-entity annual accounts with Companies House."),
    (23, "Phase 23: Departmental Budgeting & Variance Reporting", "Reporting", "Medium", 8, "PLANNED",
     "Cost center and departmental budget allocation with actual vs budget variance tracking and alerts."),
    (24, "Phase 24: Recurring Journals, Prepayments & Accruals", "Accounting", "Medium", 8, "PLANNED",
     "Automated recurring journals engine for monthly rent, insurance prepayments, and periodic expense accruals."),
    (25, "Phase 25: Statutory Compliance & External Audit Export", "Audit & Security", "High", 8, "PLANNED",
     "SAF-T and GAAP compliant audit data export package with complete cryptographic transaction hashes."),

    # Milestone 4: Advanced Operations, AI & Ecosystem (Phases 26-50)
    (26, "Phase 26: UK Open Banking Bank Feeds - TrueLayer", "Banking", "Highest", 13, "PLANNED", "Live automated bank transaction feeds via TrueLayer Open Banking API."),
    (27, "Phase 27: Open Banking Consent & Token Lifecycle", "Banking", "High", 8, "PLANNED", "90-day SCA re-authentication flows, secure token refresh, and consent management."),
    (28, "Phase 28: Automated Bank Rule Matching Engine", "Banking", "High", 8, "PLANNED", "Rule-based pattern matching (regex, payee, amount thresholds) for automated ledger categorization."),
    (29, "Phase 29: Plaid Integration for North America & International", "Banking", "Medium", 8, "PLANNED", "International multi-bank support via Plaid Link API."),
    (30, "Phase 30: Open Banking Instant Payment Initiation (PIS)", "Banking", "Medium", 13, "PLANNED", "Pay-by-Bank instant account-to-account invoice settlement."),
    (31, "Phase 31: AI Receipt OCR Document Ingestion", "AI & Automation", "High", 13, "PLANNED", "Mobile receipt capture and PDF document ingestion pipeline via AWS Textract / S3."),
    (32, "Phase 32: Receipt Line Item & Tax Extraction", "AI & Automation", "High", 13, "PLANNED", "Intelligent parsing of vendor name, total, VAT amount, and line item breakdowns."),
    (33, "Phase 33: Receipt to Purchase Bill Auto-Creation", "AI & Automation", "High", 8, "PLANNED", "Draft purchase bill auto-population with side-by-side verification preview."),
    (34, "Phase 34: Duplicate Receipt Detection", "AI & Automation", "Medium", 5, "PLANNED", "Perceptual hashing and date-amount heuristics to block duplicate expense claims."),
    (35, "Phase 35: Email Inward Bill Inbox (inbox@blynt.co)", "AI & Automation", "Medium", 8, "PLANNED", "Dedicated organization email addresses for forwarding supplier PDF bills."),
    (36, "Phase 36: Machine Learning Nominal Code Recommendation", "AI & Automation", "High", 13, "PLANNED", "NLP model predicting nominal account codes based on historical organization ledger postings."),
    (37, "Phase 37: ML Outlier & Anomaly Detection", "AI & Automation", "High", 8, "PLANNED", "Statistical anomaly detection identifying duplicate payments and unusual account entries."),
    (38, "Phase 38: Cash Flow Forecasting Engine", "AI & Automation", "High", 13, "PLANNED", "30/60/90-day probabilistic cash flow forecasting based on AR/AP due dates and recurring run-rates."),
    (39, "Phase 39: AI Accounting Assistant Chatbot (Blynt Copilot)", "AI & Automation", "Medium", 13, "PLANNED", "Natural language queries for financial insights and financial ratio inquiries."),
    (40, "Phase 40: Automated VAT Health-Check & Drift Scanner", "AI & Automation", "High", 8, "PLANNED", "Continuous background scanner identifying potential VAT errors before filing."),
    (41, "Phase 41: Multi-Currency General Ledger", "Multi-Currency", "Highest", 13, "PLANNED", "Dual base currency architecture with transaction, base, and reporting currencies."),
    (42, "Phase 42: Live FX Rate Synchronization", "Multi-Currency", "High", 5, "PLANNED", "Daily automated exchange rate feeds from Bank of England and European Central Bank."),
    (43, "Phase 43: Realized FX Gains & Losses on Payment Settlement", "Multi-Currency", "High", 8, "PLANNED", "Automatic GL posting of realized currency gains/losses upon invoice payment."),
    (44, "Phase 44: Unrealized Period-End FX Revaluation", "Multi-Currency", "High", 8, "PLANNED", "Balance sheet revaluation wizard for foreign bank accounts, debtors, and creditors."),
    (45, "Phase 45: Multi-Currency Invoicing & Bank Accounts", "Multi-Currency", "High", 8, "PLANNED", "Customer invoicing in foreign currencies (EUR, USD) with statutory GBP VAT equivalents."),
    (46, "Phase 46: Multi-Entity Parent/Subsidiary Hierarchy", "Enterprise", "High", 13, "PLANNED", "Entity tree configuration, ownership percentage tracking, and consolidation rules."),
    (47, "Phase 47: Intercompany Cross-Posting Engine", "Enterprise", "High", 13, "PLANNED", "Bilateral journal postings between subsidiaries with automatic intercompany loan balances."),
    (48, "Phase 48: Intercompany Elimination Journal Automation", "Enterprise", "High", 8, "PLANNED", "Automated elimination of intra-group sales, purchases, and intercompany receivables/payables."),
    (49, "Phase 49: Consolidated Group Financial Statements", "Enterprise", "Highest", 13, "PLANNED", "Unified group Trial Balance, consolidated P&L, and Balance Sheet with minority interest calculations."),
    (50, "Phase 50: Enterprise API, Webhooks & Developer Ecosystem", "Enterprise", "High", 13, "PLANNED", "Public REST/GraphQL API, authenticated webhooks, OAuth 2.0 app marketplace, and developer sandbox.")
]

def generate_csv():
    os.makedirs(DOCS_DIR, exist_ok=True)
    with open(OUTPUT_CSV, mode="w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        # Standard Jira Import Header
        writer.writerow([
            "Issue Type",
            "Summary",
            "Description",
            "Component/s",
            "Priority",
            "Original Estimate",
            "Story Points",
            "Status",
            "Epic Name",
            "Epic Link",
            "Labels"
        ])

        # Write 4 Milestone Initiatives
        milestones = [
            ("Initiative", "Milestone 1: The Indestructible Foundation (Phases 1-8)", "Mathematical zero-drift core, double-entry general ledger, multi-tenancy, RBAC, 15 invariants. 127 tests passing.", "Core Engine", "Highest", "COMPLETED", "M1-FOUNDATION", "milestone-1,completed"),
            ("Initiative", "Milestone 2: Commercial Workflows & Subledgers (Phases 9-15)", "Commercial invoicing, AP/AR subledgers, dynamic contact balances, bank statements, financial reporting.", "Commercial", "Highest", "COMPLETED", "M2-COMMERCIAL", "milestone-2,active"),
            ("Initiative", "Milestone 3: UK Statutory Tax & HMRC MTD Integration (Phases 16-25)", "Making Tax Digital (MTD) direct VAT submission, FRS 105 micro-entity accounts, fixed assets.", "Tax & Compliance", "Highest", "PLANNED", "M3-TAX-MTD", "milestone-3,q1-2027"),
            ("Initiative", "Milestone 4: Advanced Operations, AI & Ecosystem (Phases 26-50)", "Open Banking live feeds, OCR receipt extraction, ML nominal suggestions, multi-currency, consolidation.", "AI & Ecosystem", "High", "PLANNED", "M4-AI-ECOSYSTEM", "milestone-4,q2-2027")
        ]

        for itype, summary, desc, comp, prio, status, epic_name, labels in milestones:
            writer.writerow([
                itype,
                summary,
                desc,
                comp,
                prio,
                "",
                "",
                status,
                epic_name,
                "",
                labels
            ])

        # Write 50 Epics
        for num, title, comp, prio, sp, status, desc in phases:
            epic_key = f"BLYNT-EPIC-{num:02d}"
            labels = f"phase-{num},epic,blynt-50-phase"
            if num <= 8:
                labels += ",milestone-1,verified"
            elif num <= 15:
                labels += ",milestone-2,delivered"
            elif num <= 25:
                labels += ",milestone-3,q1-2027"
            else:
                labels += ",milestone-4,future"

            writer.writerow([
                "Epic",
                title,
                desc,
                comp,
                prio,
                f"{sp * 8}h",
                sp,
                status,
                epic_key,
                "",
                labels
            ])

        # Write sample standard user stories for Phase 16 (HMRC VAT Return) and Phase 26 (Open Banking)
        sample_stories = [
            ("Story", "Calculate UK VAT Return Box 1 to 9 from Posted Invoices and Bills", 
             "As an Accountant, I want Blynt to automatically compute Box 1 to 9 of the UK VAT return from posted general ledger transactions, so that statutory HMRC figures are guaranteed accurate.\n\nAcceptance Criteria:\n- Given posted sales invoices in the period, When Box 1 is calculated, Then output VAT matches nominal 2200.\n- Given zero-drift invariant, When Box 5 is net payable, Then Box 3 minus Box 4 equals Box 5.",
             "Tax & Compliance", "Highest", "16h", 8, "To Do", "", "BLYNT-EPIC-16", "vat,hmrc,story"),
            ("Story", "Authenticate with HMRC MTD API using OAuth 2.0 Authorization Flow", 
             "As a System Administrator, I want to authenticate our Blynt organization with HMRC Making Tax Digital using OAuth 2.0, so that we can submit digital VAT returns securely.\n\nAcceptance Criteria:\n- OAuth state token validated.\n- Refresh token encrypted in AWS Secrets Manager.",
             "Tax & Compliance", "Highest", "24h", 13, "To Do", "", "BLYNT-EPIC-17", "hmrc,oauth,story"),
            ("Story", "Integrate TrueLayer Open Banking Connect Flow for UK Bank Accounts",
             "As a Business Owner, I want to link my Barclays/NatWest bank account via TrueLayer Open Banking, so that transactions stream into Blynt automatically every day.\n\nAcceptance Criteria:\n- TrueLayer auth dialog launched.\n- Bank account IBAN and account number stored securely.",
             "Banking", "Highest", "24h", 13, "To Do", "", "BLYNT-EPIC-26", "open-banking,truelayer,story"),
            ("Story", "AWS App Runner Production Health & CloudWatch SRE Dashboard",
             "As a Lead SRE, I want continuous CloudWatch metrics and alarms on App Runner services, so that any 5xx spikes or database latency triggers instant notifications.\n\nAcceptance Criteria:\n- P95 latency alarm configured.\n- App Runner HTTP 200 health check verified.",
             "Infrastructure", "High", "8h", 5, "Done", "", "BLYNT-EPIC-01", "devops,aws,monitoring")
        ]

        for itype, summary, desc, comp, prio, est, sp, status, epic_name, epic_link, labels in sample_stories:
            writer.writerow([
                itype,
                summary,
                desc,
                comp,
                prio,
                est,
                sp,
                status,
                epic_name,
                epic_link,
                labels
            ])

    print(f"[+] Successfully generated Jira import CSV: {OUTPUT_CSV}")

if __name__ == "__main__":
    generate_csv()
