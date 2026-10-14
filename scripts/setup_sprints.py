import os
import base64
import json
import urllib.request
import urllib.error

JIRA_URL = "https://blynt-co.atlassian.net"
EMAIL = os.environ.get("JIRA_EMAIL", "blynttechnologies@gmail.com")
API_TOKEN = os.environ.get("JIRA_API_TOKEN")
if not API_TOKEN:
    raise SystemExit("Set the JIRA_API_TOKEN environment variable (never commit tokens).")

auth_str = f"{EMAIL}:{API_TOKEN}"
b64_auth = base64.b64encode(auth_str.encode()).decode()
headers = {
    "Authorization": f"Basic {b64_auth}",
    "Content-Type": "application/json",
    "Accept": "application/json"
}

def create_sprint(name, goal):
    url = f"{JIRA_URL}/rest/agile/1.0/sprint"
    payload = {
        "name": name,
        "originBoardId": 1,
        "goal": goal
    }
    req = urllib.request.Request(url, method="POST", headers=headers, data=json.dumps(payload).encode())
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
            print(f"[+] Created Sprint: {name} (Id: {data.get('id')})")
            return data.get('id')
    except urllib.error.HTTPError as e:
        print(f"[-] Failed sprint {name}: {e.code} - {e.read().decode()}")
        return None

def move_issues_to_sprint(sprint_id, issue_keys):
    url = f"{JIRA_URL}/rest/agile/1.0/sprint/{sprint_id}/issue"
    payload = {
        "issues": issue_keys
    }
    req = urllib.request.Request(url, method="POST", headers=headers, data=json.dumps(payload).encode())
    try:
        with urllib.request.urlopen(req) as resp:
            print(f"[+] Moved {issue_keys} to sprint {sprint_id}")
    except urllib.error.HTTPError as e:
        print(f"[-] Failed to move issues: {e.code} - {e.read().decode()}")

sprint1_id = create_sprint("Sprint 1 - Foundation & Core", "Deliver zero-drift core, 15 invariants, and multi-tenancy.")
sprint2_id = create_sprint("Sprint 2 - Invoicing & AP/AR", "Deliver real-time sales invoicing, AR/AP subledgers, and financial reports.")
sprint3_id = create_sprint("Sprint 3 - UK VAT & HMRC MTD", "Implement UK 9-box VAT calculations and HMRC Making Tax Digital OAuth.")

if sprint3_id:
    # SCRUM-59 (VAT return), SCRUM-60 (HMRC OAuth), SCRUM-61 (Open Banking)
    move_issues_to_sprint(sprint3_id, ["SCRUM-59", "SCRUM-60", "SCRUM-61"])
