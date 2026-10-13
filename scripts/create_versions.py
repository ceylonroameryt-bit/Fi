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

def create_version(name, desc, start_date, release_date, released=False):
    url = f"{JIRA_URL}/rest/api/3/version"
    payload = {
        "name": name,
        "description": desc,
        "project": "SCRUM",
        "startDate": start_date,
        "releaseDate": release_date,
        "released": released
    }
    req = urllib.request.Request(url, method="POST", headers=headers, data=json.dumps(payload).encode())
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
            print(f"[+] Created Version: {name} (Id: {data.get('id')})")
            return data.get('id')
    except urllib.error.HTTPError as e:
        print(f"[-] Failed to create version {name}: {e.code} - {e.read().decode()}")
        return None

versions = [
    ("v0.1.0 - Foundation & Zero-Drift Core", 
     "Double-entry general ledger, 15 mathematical invariants, multi-tenancy, RBAC, Chart of Accounts, financial periods, and zero-drift verification.", 
     "2026-07-01", "2026-08-15", True),
    ("v0.2.0 - Commercial Invoicing & Subledgers", 
     "Real-time sales invoicing, AR/AP subledgers, dynamic customer/supplier balances, customer statements, Trial Balance, P&L, Balance Sheet.", 
     "2026-08-16", "2026-09-30", True),
    ("v0.3.0 - AWS Production Cloud Architecture", 
     "100% AWS native architecture (eu-west-2 London), App Runner web and API, RDS PostgreSQL 16, Secrets Manager, S3, and automated GitHub CI/CD.", 
     "2026-10-01", "2026-10-15", False),
    ("v1.0.0 - UK Statutory Tax & HMRC MTD", 
     "Automated UK 9-box VAT return calculation, direct HMRC Making Tax Digital (MTD) VAT API submission, FRS 105 micro-entity filing, and year-end close.", 
     "2026-10-16", "2027-03-31", False),
    ("v2.0.0 - Open Banking & AI Automation", 
     "Live UK Open Banking transaction streaming via TrueLayer, AI receipt OCR document ingestion, line-item tax extraction, and automated bank rules.", 
     "2027-04-01", "2027-06-30", False),
    ("v2.5.0 - Machine Learning Insights & Multi-Currency", 
     "Machine learning nominal code recommendation, anomaly detection, cash flow forecasting, multi-currency ledger, and period-end FX revaluations.", 
     "2027-07-01", "2027-09-30", False),
    ("v3.0.0 - Enterprise Intercompany & Group Consolidation", 
     "Multi-entity parent/subsidiary hierarchy, intercompany cross-postings, automated elimination journals, consolidated group reports, and public API.", 
     "2027-10-01", "2027-12-31", False)
]

for name, desc, start, rel_date, is_rel in versions:
    create_version(name, desc, start, rel_date, is_rel)
