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

def transition_issue(key, target_name):
    # Fetch available transitions
    url = f"{JIRA_URL}/rest/api/3/issue/{key}/transitions"
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            transitions = json.loads(resp.read().decode()).get("transitions", [])
    except Exception as e:
        print(f"[-] Could not get transitions for {key}: {e}")
        return

    trans_id = None
    for t in transitions:
        if t.get("to", {}).get("name", "").lower() == target_name.lower():
            trans_id = t.get("id")
            break

    if not trans_id:
        # Check current status
        print(f"[*] {key} already in target status or no transition to '{target_name}'")
        return

    payload = {"transition": {"id": trans_id}}
    req = urllib.request.Request(url, method="POST", headers=headers, data=json.dumps(payload).encode())
    try:
        with urllib.request.urlopen(req) as resp:
            print(f"[+] Transitioned {key} -> {target_name}")
    except Exception as e:
        print(f"[-] Failed to transition {key}: {e}")

def create_issue(summary, desc, issuetype, component, status, sprint_id=None):
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
            print(f"[+] Created {issuetype} {key}: {summary}")
            
            # Transition if not To Do
            if status.lower() != "to do":
                transition_issue(key, status)
                
            # Assign sprint
            if sprint_id:
                s_url = f"{JIRA_URL}/rest/agile/1.0/sprint/{sprint_id}/issue"
                s_req = urllib.request.Request(s_url, method="POST", headers=headers, data=json.dumps({"issues": [key]}).encode())
                try:
                    with urllib.request.urlopen(s_req):
                        print(f"    -> Added {key} to Sprint {sprint_id}")
                except Exception as se:
                    pass
            return key
    except urllib.error.HTTPError as e:
        print(f"[-] Failed to create {summary}: {e.code} - {e.read().decode()}")
        return None

def main():
    print("[1] Updating Milestone 3 & Milestone 4 Epics to realistic planned statuses...")
    # Milestone 3 task (SCRUM-7)
    transition_issue("SCRUM-7", "To Do")
    # Milestone 4 task (SCRUM-8)
    transition_issue("SCRUM-8", "To Do")

    # Phase 16 (SCRUM-24) -> In Progress (part of active Sprint 3)
    transition_issue("SCRUM-24", "In Progress")

    # Phases 17 to 25 (SCRUM-25 to SCRUM-33) -> To Do
    for i in range(25, 34):
        transition_issue(f"SCRUM-{i}", "To Do")

    # Phases 26 to 50 (SCRUM-34 to SCRUM-58) -> To Do
    for i in range(34, 59):
        transition_issue(f"SCRUM-{i}", "To Do")

    print("\n[2] Creating completed infrastructure & architectural milestone issues...")
    infra_issues = [
        ("Cloud Architecture: Eliminate Render, Vercel & Railway for 100% AWS Stack",
         "Decommissioned legacy deployment configurations. Standardized production architecture entirely on AWS native services (eu-west-2 London) to ensure regulatory compliance and strict SLA latency.",
         "Task", "Infrastructure & AWS", "Done", 4),
        ("Provision Amazon RDS PostgreSQL 16.10 Database & Apply 11 Prisma Migrations",
         "Created production RDS PostgreSQL cluster with VPC security groups, temporal btree_gist extension, immutable audit triggers, and 11 relational schema migrations.",
         "Task", "Core Engine", "Done", 3),
        ("Deploy NestJS 11 Backend API on AWS App Runner with VPC Egress Connector",
         "Containerized API with Docker, pushed to Amazon ECR (blynt-dev-api), provisioned App Runner service arpi2ujw2t.eu-west-2.awsapprunner.com with zero-downtime rolling deployments.",
         "Task", "Core Engine", "Done", 4),
        ("Host Next.js 15 Web Frontend on AWS App Runner with Dynamic API Rewrites",
         "Containerized modern Next.js 15 App Router web application, pushed to ECR (blynt-dev-web), hosted on App Runner 6k98b79a9x.eu-west-2.awsapprunner.com with reverse proxy to API.",
         "Task", "Billing & Invoicing", "Done", 4),
        ("Build Automated GitHub Actions CI/CD Pipeline with App Runner Settle Loops",
         "Configured deploy-aws-dev.yml with OIDC authentication, automated Docker multi-stage builds, Terraform infrastructure management, and service stability polling.",
         "Task", "Infrastructure & AWS", "Done", 4),
        ("Execute Zero-Drift Ledger Verification: 26 Test Suites & 127 Test Cases",
         "Executed comprehensive test automation suite validating the 15 double-entry accounting invariants, timing-safe auth, multi-tenant isolation, and subledger dynamic balance calculation.",
         "Task", "Core Engine", "Done", 3),
        ("Configure Custom Domain Routing & DNS Records for blynt.co on Hostinger",
         "Configured App Runner custom domain associations for blynt.co, www.blynt.co, app.blynt.co, api.blynt.co, and dev.blynt.co. Prepared Hostinger DNS CNAME routing and ACM validation.",
         "Story", "Infrastructure & AWS", "In Progress", 5)
    ]

    for summary, desc, itype, comp, st, sp_id in infra_issues:
        create_issue(summary, desc, itype, comp, st, sp_id)

    print("\n[+] Full project history successfully synchronized with Jira!")

if __name__ == "__main__":
    main()
