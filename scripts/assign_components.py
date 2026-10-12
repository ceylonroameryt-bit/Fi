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

# Fetch all issues
body = {"jql": "project = SCRUM", "maxResults": 100, "fields": ["summary", "components"]}
req = urllib.request.Request(f"{JIRA_URL}/rest/api/3/search/jql", method="POST", headers=headers, data=json.dumps(body).encode())
with urllib.request.urlopen(req) as resp:
    res = json.loads(resp.read().decode())
    issues = res.get("issues", [])

# Mapping keyword in summary to component name
comp_map = [
    ("Foundation", "Core Engine"),
    ("Database", "Core Engine"),
    ("Authentication", "Security & Auth"),
    ("Roles", "Security & Auth"),
    ("Multi-Organisation", "Multi-Tenancy"),
    ("Chart of Accounts", "Accounting"),
    ("Financial Years", "Accounting"),
    ("Journal", "Accounting"),
    ("Posting", "Core Engine"),
    ("Contacts", "Subledgers"),
    ("Invoicing", "Billing & Invoicing"),
    ("Statements", "Reporting & Statements"),
    ("Purchase Bills", "Purchasing & AP"),
    ("Receipts", "Banking & Reconciliation"),
    ("Bank", "Banking & Reconciliation"),
    ("Reporting", "Reporting & Statements"),
    ("VAT", "Tax & HMRC MTD"),
    ("HMRC", "Tax & HMRC MTD"),
    ("Open Banking", "Banking & Reconciliation"),
    ("Receipt OCR", "AI & Automation"),
    ("Machine Learning", "AI & Automation"),
    ("AI", "AI & Automation"),
    ("Cash Flow", "AI & Automation"),
    ("Multi-Currency", "Multi-Currency"),
    ("FX", "Multi-Currency"),
    ("Consolidation", "Enterprise & Consolidation"),
    ("Intercompany", "Enterprise & Consolidation"),
    ("Enterprise API", "Enterprise & Consolidation"),
    ("AWS", "Infrastructure & AWS")
]

print(f"Assigning components across {len(issues)} issues...")
for iss in issues:
    summary = iss.get("fields", {}).get("summary", "")
    key = iss.get("key")
    matched_comp = None
    for kw, comp_name in comp_map:
        if kw.lower() in summary.lower():
            matched_comp = comp_name
            break
    
    if matched_comp:
        put_url = f"{JIRA_URL}/rest/api/3/issue/{key}"
        update_data = {
            "fields": {
                "components": [{"name": matched_comp}]
            }
        }
        put_req = urllib.request.Request(put_url, method="PUT", headers=headers, data=json.dumps(update_data).encode())
        try:
            with urllib.request.urlopen(put_req) as resp:
                print(f"[+] {key} ({summary[:30]}...) -> Component: {matched_comp}")
        except urllib.error.HTTPError as e:
            pass
