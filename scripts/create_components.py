import base64
import json
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

components_to_create = [
    ("Core Engine", "Double-entry general ledger, journal posting engine, 15 invariants, zero-drift validation."),
    ("Security & Auth", "RBAC roles, authentication, sessions, crypto scrypt, and tenant isolation."),
    ("Multi-Tenancy", "Organization management, composite foreign keys, and multi-tenant security."),
    ("Accounting", "Chart of accounts, financial periods, journal grids, year-end close."),
    ("Subledgers", "Accounts Receivable & Accounts Payable subledgers and dynamic balance tracking."),
    ("Billing & Invoicing", "Sales invoicing lifecycle, invoice lines, and automated revenue/tax posting."),
    ("Reporting & Statements", "Trial balance, Profit & Loss, Balance Sheet, and customer ageing statements."),
    ("Purchasing & AP", "Purchase bills capture, line items, expense classification, and supplier payments."),
    ("Banking & Reconciliation", "Bank accounts, statement reconciliation, transaction matching, and settlement."),
    ("Tax & HMRC MTD", "UK 9-box VAT return, Making Tax Digital (MTD) direct API integration, and tax treatments."),
    ("Practice Management", "Multi-client practice portal, accountant dashboard, and client audit queues."),
    ("AI & Automation", "OCR receipt scanning, ML nominal suggestions, cash flow forecasting, and drift scanner."),
    ("Multi-Currency", "FX exchange rates, multi-currency ledger, realized and unrealized gain/loss calculations."),
    ("Enterprise & Consolidation", "Intercompany accounts, consolidation engine, elimination entries, and group reports."),
    ("Infrastructure & AWS", "AWS App Runner, RDS PostgreSQL, VPC, S3 storage, and GitHub CI/CD automation.")
]

def create_components():
    url = f"{JIRA_URL}/rest/api/3/component"
    for name, desc in components_to_create:
        payload = {
            "name": name,
            "description": desc,
            "project": "SCRUM"
        }
        req = urllib.request.Request(url, method="POST", headers=headers, data=json.dumps(payload).encode())
        try:
            with urllib.request.urlopen(req) as resp:
                data = json.loads(resp.read().decode())
                print(f"[+] Created component: {name} (Id: {data.get('id')})")
        except urllib.error.HTTPError as e:
            err = e.read().decode()
            if "already exists" in err:
                print(f"[*] Component {name} already exists.")
            else:
                print(f"[-] Failed component {name}: {e.code} - {err}")

if __name__ == "__main__":
    create_components()
