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

def assign_fix_version(issue_key, version_name):
    url = f"{JIRA_URL}/rest/api/3/issue/{issue_key}"
    payload = {
        "fields": {
            "fixVersions": [{"name": version_name}]
        }
    }
    req = urllib.request.Request(url, method="PUT", headers=headers, data=json.dumps(payload).encode())
    try:
        with urllib.request.urlopen(req):
            print(f"[+] Assigned {issue_key} -> Version: {version_name}")
    except urllib.error.HTTPError as e:
        print(f"[-] Could not assign version to {issue_key}: {e.code} - {e.read().decode()}")

def create_sprint(name, goal, start_date=None, end_date=None):
    url = f"{JIRA_URL}/rest/agile/1.0/sprint"
    payload = {
        "name": name,
        "originBoardId": 1,
        "goal": goal
    }
    if start_date and end_date:
        payload["startDate"] = start_date
        payload["endDate"] = end_date
    req = urllib.request.Request(url, method="POST", headers=headers, data=json.dumps(payload).encode())
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
            print(f"[+] Created Sprint: {name} (Id: {data.get('id')})")
            return data.get('id')
    except urllib.error.HTTPError as e:
        print(f"[-] Failed sprint {name}: {e.code} - {e.read().decode()}")
        return None

def main():
    print("[1] Assigning release versions to Epics & Stories...")
    # v0.1.0 - Foundation (M1: Phases 1 to 8)
    for i in range(9, 17):
        assign_fix_version(f"SCRUM-{i}", "v0.1.0 - Foundation & Zero-Drift Core")
    assign_fix_version("SCRUM-5", "v0.1.0 - Foundation & Zero-Drift Core")
    assign_fix_version("SCRUM-68", "v0.1.0 - Foundation & Zero-Drift Core")

    # v0.2.0 - Commercial (M2: Phases 9 to 15)
    for i in range(17, 24):
        assign_fix_version(f"SCRUM-{i}", "v0.2.0 - Commercial Invoicing & Subledgers")
    assign_fix_version("SCRUM-6", "v0.2.0 - Commercial Invoicing & Subledgers")

    # v0.3.0 - AWS Production Cloud Architecture
    for k in ["SCRUM-63", "SCRUM-64", "SCRUM-65", "SCRUM-66", "SCRUM-67", "SCRUM-62", "SCRUM-69"]:
        assign_fix_version(k, "v0.3.0 - AWS Production Cloud Architecture")

    # v1.0.0 - UK Statutory Tax & HMRC MTD (M3: Phases 16 to 25)
    for i in range(24, 34):
        assign_fix_version(f"SCRUM-{i}", "v1.0.0 - UK Statutory Tax & HMRC MTD")
    assign_fix_version("SCRUM-7", "v1.0.0 - UK Statutory Tax & HMRC MTD")
    assign_fix_version("SCRUM-59", "v1.0.0 - UK Statutory Tax & HMRC MTD")
    assign_fix_version("SCRUM-60", "v1.0.0 - UK Statutory Tax & HMRC MTD")

    # v2.0.0 - Open Banking & AI Automation (M4A: Phases 26 to 35)
    for i in range(34, 44):
        assign_fix_version(f"SCRUM-{i}", "v2.0.0 - Open Banking & AI Automation")
    assign_fix_version("SCRUM-61", "v2.0.0 - Open Banking & AI Automation")

    # v2.5.0 - Machine Learning Insights & Multi-Currency (M4B: Phases 36 to 45)
    for i in range(44, 54):
        assign_fix_version(f"SCRUM-{i}", "v2.5.0 - Machine Learning Insights & Multi-Currency")

    # v3.0.0 - Enterprise Intercompany & Group Consolidation (M4C: Phases 46 to 50)
    for i in range(54, 59):
        assign_fix_version(f"SCRUM-{i}", "v3.0.0 - Enterprise Intercompany & Group Consolidation")
    assign_fix_version("SCRUM-8", "v3.0.0 - Enterprise Intercompany & Group Consolidation")

    print("\n[2] Creating future planned sprints across the roadmap...")
    future_sprints = [
        ("Sprint 4 - UK 9-Box VAT & CIS", "Deliver automated UK 9-box VAT returns and CIS reverse charge rules.", "2026-10-16T10:00:00.000Z", "2026-10-31T17:00:00.000Z"),
        ("Sprint 5 - HMRC MTD Direct API", "Establish direct OAuth 2.0 digital submission to HMRC MTD VAT endpoints.", "2026-11-01T10:00:00.000Z", "2026-11-15T17:00:00.000Z"),
        ("Sprint 6 - Year-End & Assets", "Deliver automated fiscal year closing and fixed asset depreciation register.", "2026-11-16T10:00:00.000Z", "2026-11-30T17:00:00.000Z"),
        ("Sprint 7 - Practice & FRS 105", "Deliver multi-client accountant practice portal and Companies House FRS 105 filing.", "2026-12-01T10:00:00.000Z", "2026-12-15T17:00:00.000Z"),
        ("Sprint 8 - Open Banking Feeds", "Live TrueLayer bank transaction streaming for UK business accounts.", "2027-01-05T10:00:00.000Z", "2027-01-20T17:00:00.000Z"),
        ("Sprint 9 - AI Receipt OCR", "Automated mobile receipt scanning, tax extraction, and bill creation.", "2027-01-21T10:00:00.000Z", "2027-02-05T17:00:00.000Z"),
        ("Sprint 10 - ML Categorization", "Predictive machine learning nominal account recommendations and anomaly alerts.", "2027-02-06T10:00:00.000Z", "2027-02-20T17:00:00.000Z"),
        ("Sprint 11 - Multi-Currency GL", "Dual base currency architecture and realized/unrealized FX revaluations.", "2027-02-21T10:00:00.000Z", "2027-03-07T17:00:00.000Z"),
        ("Sprint 12 - Group Consolidation", "Parent/subsidiary hierarchy, intercompany eliminations, and group reporting.", "2027-03-08T10:00:00.000Z", "2027-03-22T17:00:00.000Z")
    ]

    for name, goal, st, en in future_sprints:
        create_sprint(name, goal, st, en)

    print("\n[+] All versions and future sprints mapped successfully!")

if __name__ == "__main__":
    main()
