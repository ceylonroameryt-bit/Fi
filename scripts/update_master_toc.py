import requests

CONFLUENCE_URL = "https://blynt-co.atlassian.net/wiki"
EMAIL = "blynttechnologies@gmail.com"
API_TOKEN = "ATATT3xFfGF0fCmX0geTVLXs5-U05HWdeD12Ltg_TSyF7i9_8X8XdMzjuJDosb3Iqk9kHteICNzJO6SkshyWow7r-MMAan7QBFDTd4MRBDQPtJOFfhwP37MS3WIv6Rl8oMjVw7Rw_oRq_bQCSl2v5j8YT2_kOnxHv4Q0EgKRwbZ-qL-ZKsbgvcY=F5D7FBCF"
AUTH = (EMAIL, API_TOKEN)

PAGES = [
    ("720899", "Master Overview", "blynt: Complete Technical & Business Documentation (Omnibus)", "blynt_Complete_Documentation.pdf", "Exhaustive single-source-of-truth omnibus covering architecture, accounting engine, security, and governance."),
    ("688146", "Specifications", "blynt: 100 Exhaustive Use Cases Specification", "Blynt_100_Use_Cases_Specification.pdf", "Complete catalog of 100 production use cases across core ledgers, multi-tenancy, VAT, and audit."),
    ("917505", "Quality & Testing", "blynt: 100 Exhaustive Test Cases Specification", "Blynt_100_Test_Cases_Specification.pdf", "100 end-to-end test scenarios with preconditions, execution steps, expected outcomes, and edge-case validations."),
    ("983041", "Specifications", "blynt: Complete Core Use Cases Specification", "Blynt_Complete_Use_Cases_Specification.pdf", "Primary business workflows and user journey definitions for institutional accounting operations."),
    ("983057", "Quality & Testing", "blynt: Complete Core Test Cases Specification", "Blynt_Complete_Test_Cases_Specification.pdf", "Core test matrix covering multi-currency, journal balancing, idempotency, and state persistence."),
    ("688162", "Business & Non-IT", "blynt: Non-IT Business Use Cases & Test Cases", "Blynt_Non_IT_Use_Cases_and_Test_Cases.pdf", "CFO, auditor, bookkeeper, and tax officer use cases and acceptance criteria written in plain business language."),
    ("1015815", "Business & Non-IT", "blynt: Executive & User-Side Business Report", "Blynt_User_Side_Business_Report.pdf", "Strategic executive summary for board members, investors, and enterprise banking partners."),
    ("688178", "Architecture & Engineering", "blynt: Technical Architecture & Code Explainer", "blynt_Code_Explainer.pdf", "Deep-dive codebase architecture, NestJS microservices, Prisma schema, PostgreSQL constraints, and lock protocols."),
    ("884743", "Architecture & Engineering", "blynt: Developer Handbook & Engineering Standards", "blynt_Developer_Handbook.pdf", "Onboarding guide, code review standards, commit conventions, local development, and CI/CD pipelines."),
    ("983079", "Product & Agile", "blynt: Product Management & Agile Delivery Handbook", "blynt_Product_Management_Handbook.pdf", "Product roadmap, feature prioritization matrix, Definition of Ready/Done, and sprint cadence."),
    ("1114159", "Product & Agile", "blynt: Jira & Confluence Agile Workflow & Governance", "blynt_Jira_and_Confluence_Workflow.pdf", "Atlassian tooling standards, Jira 50-Phase epic hierarchy, transition hooks, and Confluence SSOT rules."),
    ("688194", "Compliance & Security", "blynt: Legal, ISO 27001 & GDPR Regulatory Compliance", "blynt_Legal_ISO27001_and_GDPR_Compliance.pdf", "UK Companies Act, GDPR Data Subject Rights, immutable audit logging, and ISO/IEC 27001 control matrix."),
    ("1114113", "Compliance & Security", "blynt: Security Architecture, SOC 2 & Pentest Guide", "blynt_Security_SOC2_Pentest_GRC.pdf", "Zero-trust model, JWT revocation, HMAC webhooks, SOC 2 Trust Services Criteria, and penetration testing protocol."),
    ("688210", "Design & UX", "blynt: Brand, UI Design System & Logo Guidelines", "blynt_UI_and_Logo_Guidelines.pdf", "Visual identity, typography, primary and secondary color palettes, dark mode tokens, and logo usage guidelines."),
    ("1081351", "Roadmap & Strategy", "blynt: 50-Phase Engineering Delivery Roadmap", "blynt_Phases_and_Roadmap_Specification.pdf", "Detailed phase-by-phase execution blueprint from Phase 1 (Foundation) through Phase 50 (Global Scale)."),
    ("819213", "Roadmap & Strategy", "blynt: Strategic Engineering Playbook", "blynt_Playbook.pdf", "High-velocity execution rules, incident war-room protocols, technical debt thresholds, and team velocity metrics."),
    ("950285", "Specifications", "blynt: Integrated Use Cases & Test Cases Manual", "blynt_Use_Cases_and_Test_Cases.pdf", "Unified reference guide cross-referencing all functional use cases directly to automated regression suites.")
]

rows = []
for pid, cat, title, pdf, desc in PAGES:
    link = f'<a href="/wiki/spaces/SCRUM/pages/{pid}"><strong>{title}</strong></a>'
    rows.append(f'<tr><td>{cat}</td><td>{link}</td><td><code>{pdf}</code></td><td>{desc}</td></tr>')

table_html = "\n".join(rows)

content = f"""
<p>Welcome to the authoritative <strong>blynt Project Documentation Repository</strong>. This space contains institutional-grade specifications, technical architecture blueprints, regulatory compliance frameworks, testing suites, and strategic execution roadmaps.</p>

<h2>Official Document Catalog ({len(PAGES)} Documents)</h2>
<p>Every document is published as a native interactive Confluence page and includes its certified PDF attached for download or printing.</p>

<table border="1" cellpadding="8" style="border-collapse: collapse; width: 100%;">
    <thead>
        <tr style="background-color: #f4f5f7;">
            <th style="width: 18%;">Category</th>
            <th style="width: 32%;">Document Title</th>
            <th style="width: 20%;">Attached PDF</th>
            <th style="width: 30%;">Description</th>
        </tr>
    </thead>
    <tbody>
        {table_html}
    </tbody>
</table>

<hr />
<p><em>Published automatically by blynt DevOps Integration Suite • October 2026</em></p>
"""

resp = requests.get(f"{CONFLUENCE_URL}/rest/api/content/753681", auth=AUTH).json()
vnum = resp.get("version", {}).get("number", 1) + 1

payload = {
    "id": "753681",
    "type": "page",
    "title": "blynt: Master Project Documentation Repository",
    "space": {"key": "SCRUM"},
    "body": {
        "storage": {
            "value": content,
            "representation": "storage"
        }
    },
    "version": {"number": vnum}
}

r = requests.put(f"{CONFLUENCE_URL}/rest/api/content/753681", auth=AUTH, json=payload)
print(f"Master Table of Contents updated! HTTP Status: {r.status_code}")
