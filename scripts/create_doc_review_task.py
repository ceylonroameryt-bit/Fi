import base64
import json
import urllib.request
import urllib.error

JIRA_URL = "https://blynt-co.atlassian.net"
EMAIL = "blynttechnologies@gmail.com"
API_TOKEN = "ATATT3xFfGF0fCmX0geTVLXs5-U05HWdeD12Ltg_TSyF7i9_8X8XdMzjuJDosb3Iqk9kHteICNzJO6SkshyWow7r-MMAan7QBFDTd4MRBDQPtJOFfhwP37MS3WIv6Rl8oMjVw7Rw_oRq_bQCSl2v5j8YT2_kOnxHv4Q0EgKRwbZ-qL-ZKsbgvcY=F5D7FBCF"
CONFLUENCE_DOC_URL = "https://blynt-co.atlassian.net/wiki/spaces/SCRUM/pages/753681"

auth_str = f"{EMAIL}:{API_TOKEN}"
b64_auth = base64.b64encode(auth_str.encode()).decode()
headers = {
    "Authorization": f"Basic {b64_auth}",
    "Content-Type": "application/json",
    "Accept": "application/json"
}

# Construct rich ADF description
description_adf = {
    "type": "doc",
    "version": 1,
    "content": [
        {
            "type": "paragraph",
            "content": [
                {
                    "type": "text",
                    "text": "Review and formal sign-off of the complete institutional blynt engineering and business documentation suite imported into Confluence."
                }
            ]
        },
        {
            "type": "panel",
            "attrs": {"panelType": "info"},
            "content": [
                {
                    "type": "paragraph",
                    "content": [
                        {
                            "type": "text",
                            "text": "Confluence Master Documentation Repository: ",
                            "marks": [{"type": "strong"}]
                        },
                        {
                            "type": "text",
                            "text": "blynt: Master Project Documentation Repository (17 Documents)",
                            "marks": [
                                {
                                    "type": "link",
                                    "attrs": {"href": CONFLUENCE_DOC_URL}
                                }
                            ]
                        }
                    ]
                }
            ]
        },
        {
            "type": "heading",
            "attrs": {"level": 3},
            "content": [
                {
                    "type": "text",
                    "text": "Document Review Checklist (17 Core Deliverables)"
                }
            ]
        },
        {
            "type": "bulletList",
            "content": [
                {
                    "type": "listItem",
                    "content": [
                        {
                            "type": "paragraph",
                            "content": [
                                {"type": "text", "text": "blynt: Complete Technical & Business Documentation (Omnibus) [Attached: blynt_Complete_Documentation.pdf]"}
                            ]
                        }
                    ]
                },
                {
                    "type": "listItem",
                    "content": [
                        {
                            "type": "paragraph",
                            "content": [
                                {"type": "text", "text": "blynt: 100 Exhaustive Use Cases Specification [Attached: Blynt_100_Use_Cases_Specification.pdf]"}
                            ]
                        }
                    ]
                },
                {
                    "type": "listItem",
                    "content": [
                        {
                            "type": "paragraph",
                            "content": [
                                {"type": "text", "text": "blynt: 100 Exhaustive Test Cases Specification [Attached: Blynt_100_Test_Cases_Specification.pdf]"}
                            ]
                        }
                    ]
                },
                {
                    "type": "listItem",
                    "content": [
                        {
                            "type": "paragraph",
                            "content": [
                                {"type": "text", "text": "blynt: Technical Architecture & Code Explainer [Attached: blynt_Code_Explainer.pdf]"}
                            ]
                        }
                    ]
                },
                {
                    "type": "listItem",
                    "content": [
                        {
                            "type": "paragraph",
                            "content": [
                                {"type": "text", "text": "blynt: Developer Handbook & Engineering Standards [Attached: blynt_Developer_Handbook.pdf]"}
                            ]
                        }
                    ]
                },
                {
                    "type": "listItem",
                    "content": [
                        {
                            "type": "paragraph",
                            "content": [
                                {"type": "text", "text": "blynt: Jira & Confluence Agile Workflow & Governance [Attached: blynt_Jira_and_Confluence_Workflow.pdf]"}
                            ]
                        }
                    ]
                },
                {
                    "type": "listItem",
                    "content": [
                        {
                            "type": "paragraph",
                            "content": [
                                {"type": "text", "text": "blynt: Legal, ISO 27001 & GDPR Regulatory Compliance [Attached: blynt_Legal_ISO27001_and_GDPR_Compliance.pdf]"}
                            ]
                        }
                    ]
                },
                {
                    "type": "listItem",
                    "content": [
                        {
                            "type": "paragraph",
                            "content": [
                                {"type": "text", "text": "blynt: Security Architecture, SOC 2 & Pentest Guide [Attached: blynt_Security_SOC2_Pentest_GRC.pdf]"}
                            ]
                        }
                    ]
                },
                {
                    "type": "listItem",
                    "content": [
                        {
                            "type": "paragraph",
                            "content": [
                                {"type": "text", "text": "blynt: 50-Phase Engineering Delivery Roadmap [Attached: blynt_Phases_and_Roadmap_Specification.pdf]"}
                            ]
                        }
                    ]
                }
            ]
        },
        {
            "type": "heading",
            "attrs": {"level": 3},
            "content": [
                {
                    "type": "text",
                    "text": "Sign-off Matrix"
                }
            ]
        },
        {
            "type": "paragraph",
            "content": [
                {
                    "type": "text",
                    "text": "[ ] Lead Architect Approval\n[ ] Product Owner Acceptance\n[ ] QA Lead Verification\n[ ] Compliance & Legal Sign-off"
                }
            ]
        }
    ]
}

# 1. Create Issue in project SCRUM
issue_payload = {
    "fields": {
        "project": {"key": "SCRUM"},
        "summary": "Review & Sign-Off Authoritative Project Documentation Suite (17 Confluence Documents)",
        "issuetype": {"id": "10003"},  # Task
        "description": description_adf,
        "customfield_10020": 5,  # Sprint 3 - UK VAT & HMRC MTD
        "labels": ["documentation", "confluence", "review", "governance"]
    }
}

req = urllib.request.Request(
    f"{JIRA_URL}/rest/api/3/issue",
    headers=headers,
    data=json.dumps(issue_payload).encode(),
    method="POST"
)

try:
    with urllib.request.urlopen(req) as resp:
        res = json.loads(resp.read().decode())
        issue_key = res.get("key")
        issue_id = res.get("id")
        print(f"[+] Successfully created Jira issue: {issue_key} (ID: {issue_id})")
        
        # 2. Transition to In Review (Transition ID 31)
        transition_payload = {
            "transition": {"id": "31"}  # In Review
        }
        tr_req = urllib.request.Request(
            f"{JIRA_URL}/rest/api/3/issue/{issue_key}/transitions",
            headers=headers,
            data=json.dumps(transition_payload).encode(),
            method="POST"
        )
        try:
            with urllib.request.urlopen(tr_req) as tr_resp:
                print(f"[+] Successfully transitioned {issue_key} to 'In Review' (Status: {tr_resp.status})")
        except urllib.error.HTTPError as te:
            print(f"[-] Transition failed: {te.code} - {te.read().decode()}")

        # 3. Add Remote Link to Confluence
        remotelink_payload = {
            "object": {
                "url": CONFLUENCE_DOC_URL,
                "title": "blynt: Master Project Documentation Repository (17 Documents)",
                "icon": {
                    "url16x16": "https://blynt-co.atlassian.net/wiki/favicon.ico",
                    "title": "Confluence Documentation"
                }
            },
            "relationship": "documents"
        }
        link_req = urllib.request.Request(
            f"{JIRA_URL}/rest/api/3/issue/{issue_key}/remotelink",
            headers=headers,
            data=json.dumps(remotelink_payload).encode(),
            method="POST"
        )
        try:
            with urllib.request.urlopen(link_req) as link_resp:
                print(f"[+] Successfully linked Confluence Master Doc to {issue_key}")
        except urllib.error.HTTPError as le:
            print(f"[-] Remote link failed: {le.code} - {le.read().decode()}")

except urllib.error.HTTPError as e:
    print(f"[-] Issue creation failed: {e.code} - {e.read().decode()}")
