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

def create_issue(summary, desc, issuetype, component, status):
    url = f"{JIRA_URL}/rest/api/3/issue"
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
    req = urllib.request.Request(url, method="POST", headers=headers, data=json.dumps(payload).encode())
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
            key = data.get("key")
            print(f"[+] Created {key}: {summary}")
            return key
    except urllib.error.HTTPError as e:
        print(f"[-] Failed to create {summary}: {e.code} - {e.read().decode()}")
        return None

def move_issues_to_sprint(sprint_id, issue_keys):
    url = f"{JIRA_URL}/rest/agile/1.0/sprint/{sprint_id}/issue"
    payload = {"issues": issue_keys}
    req = urllib.request.Request(url, method="POST", headers=headers, data=json.dumps(payload).encode())
    try:
        with urllib.request.urlopen(req):
            print(f"[+] Successfully moved {len(issue_keys)} issues to active board (Sprint {sprint_id})")
    except urllib.error.HTTPError as e:
        print(f"[-] Failed to move issues to sprint: {e.code} - {e.read().decode()}")

def main():
    print("[1] Creating immediate pending execution tasks...")
    immediate_tasks = [
        ("Verify DNS Propagation & ACM SSL Certificate for dev.blynt.co", 
         "Verify CNAME routing to 6k98b79a9x.eu-west-2.awsapprunner.com and ACM TLS certificate issuance in Hostinger DNS zone.",
         "Task", "Infrastructure & AWS", "To Do"),
        ("Review & Approve Web UI Design and Accounting Experience on dev.blynt.co",
         "Conduct thorough UX/UI inspection of the live Next.js 15 application running on AWS App Runner prior to production domain cutover.",
         "Story", "Billing & Invoicing", "To Do"),
        ("Promote & Link Production Custom Domain (blynt.co & app.blynt.co) on Hostinger",
         "Add production CNAME records in Hostinger DNS to route root traffic to AWS App Runner upon design sign-off.",
         "Task", "Infrastructure & AWS", "To Do"),
        ("Build UK 9-Box VAT Return Calculation Engine in apps/api",
         "Calculate Box 1 through Box 9 directly from posted GL journals with zero cached drift.",
         "Story", "Tax & HMRC MTD", "To Do"),
        ("Implement VAT Return Review & Sign-Off Grid in apps/web",
         "Design accountant approval interface for reviewing quarterly VAT liability before HMRC filing.",
         "Story", "Tax & HMRC MTD", "To Do")
    ]

    new_keys = []
    for summary, desc, itype, comp, st in immediate_tasks:
        k = create_issue(summary, desc, itype, comp, st)
        if k:
            new_keys.append(k)

    print("\n[2] Gathering all pending roadmap phases (Phases 16 to 50)...")
    pending_phase_keys = [f"SCRUM-{i}" for i in range(24, 59)]  # SCRUM-24 to SCRUM-58
    milestone_keys = ["SCRUM-7", "SCRUM-8"]

    all_pending_keys = new_keys + pending_phase_keys + milestone_keys
    print(f"Total pending items to display on board: {len(all_pending_keys)}")

    # Move to active Sprint 5 in chunks of 50
    chunk_size = 40
    for idx in range(0, len(all_pending_keys), chunk_size):
        chunk = all_pending_keys[idx:idx + chunk_size]
        move_issues_to_sprint(5, chunk)

    print("\n[+] All pending tasks and phases are now active on your Jira board!")

if __name__ == "__main__":
    main()
