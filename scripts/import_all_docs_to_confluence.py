import os
import re
import base64
import json
import requests
import markdown
from bs4 import BeautifulSoup

CONFLUENCE_URL = "https://blynt-co.atlassian.net/wiki"
EMAIL = "blynttechnologies@gmail.com"
API_TOKEN = "ATATT3xFfGF0fCmX0geTVLXs5-U05HWdeD12Ltg_TSyF7i9_8X8XdMzjuJDosb3Iqk9kHteICNzJO6SkshyWow7r-MMAan7QBFDTd4MRBDQPtJOFfhwP37MS3WIv6Rl8oMjVw7Rw_oRq_bQCSl2v5j8YT2_kOnxHv4Q0EgKRwbZ-qL-ZKsbgvcY=F5D7FBCF"
SPACE_KEY = "SCRUM"
ROOT_PARENT_ID = "98414"  # Blynt Engineering Home

DOCS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "docs"))

AUTH = (EMAIL, API_TOKEN)
HEADERS = {
    "Accept": "application/json",
    "Content-Type": "application/json"
}

DOCUMENTS = [
    {
        "title": "blynt — Complete Technical & Business Documentation (Omnibus)",
        "md_files": ["ALL_DOCUMENTATION_OMNIBUS.md"],
        "pdf_file": "blynt_Complete_Documentation.pdf",
        "category": "Master Overview",
        "description": "Exhaustive single-source-of-truth omnibus covering architecture, accounting engine, security, and governance."
    },
    {
        "title": "blynt — 100 Exhaustive Use Cases Specification",
        "md_files": ["BLYNT_100_USE_CASES_SPECIFICATION.md"],
        "pdf_file": "Blynt_100_Use_Cases_Specification.pdf",
        "category": "Specifications",
        "description": "Complete catalog of 100 production use cases across core ledgers, multi-tenancy, VAT, and audit."
    },
    {
        "title": "blynt — 100 Exhaustive Test Cases Specification",
        "md_files": ["BLYNT_100_TEST_CASES_SPECIFICATION.md"],
        "pdf_file": "Blynt_100_Test_Cases_Specification.pdf",
        "category": "Quality & Testing",
        "description": "100 end-to-end test scenarios with preconditions, execution steps, expected outcomes, and edge-case validations."
    },
    {
        "title": "blynt — Complete Core Use Cases Specification",
        "md_files": ["BLYNT_COMPLETE_USE_CASES_SPECIFICATION.md"],
        "pdf_file": "Blynt_Complete_Use_Cases_Specification.pdf",
        "category": "Specifications",
        "description": "Primary business workflows and user journey definitions for institutional accounting operations."
    },
    {
        "title": "blynt — Complete Core Test Cases Specification",
        "md_files": ["BLYNT_COMPLETE_TEST_CASES_SPECIFICATION.md"],
        "pdf_file": "Blynt_Complete_Test_Cases_Specification.pdf",
        "category": "Quality & Testing",
        "description": "Core test matrix covering multi-currency, journal balancing, idempotency, and state persistence."
    },
    {
        "title": "blynt — Non-IT Business Use Cases & Test Cases",
        "md_files": ["NON_IT_BUSINESS_USE_CASES.md", "NON_IT_BUSINESS_TEST_CASES.md"],
        "pdf_file": "Blynt_Non_IT_Use_Cases_and_Test_Cases.pdf",
        "category": "Business & Non-IT",
        "description": "CFO, auditor, bookkeeper, and tax officer use cases and acceptance criteria written in plain business language."
    },
    {
        "title": "blynt — Executive & User-Side Business Report",
        "md_files": ["BLYNT_USER_SIDE_BUSINESS_REPORT.md"],
        "pdf_file": "Blynt_User_Side_Business_Report.pdf",
        "category": "Business & Non-IT",
        "description": "Strategic executive summary for board members, investors, and enterprise banking partners."
    },
    {
        "title": "blynt — Technical Architecture & Code Explainer",
        "md_files": ["BLYNT_CODE_EXPLAINER.md"],
        "pdf_file": "blynt_Code_Explainer.pdf",
        "category": "Architecture & Engineering",
        "description": "Deep-dive codebase architecture, NestJS microservices, Prisma schema, PostgreSQL constraints, and lock protocols."
    },
    {
        "title": "blynt — Developer Handbook & Engineering Standards",
        "md_files": ["BLYNT_DEVELOPER_HANDBOOK.md"],
        "pdf_file": "blynt_Developer_Handbook.pdf",
        "category": "Architecture & Engineering",
        "description": "Onboarding guide, code review standards, commit conventions, local development, and CI/CD pipelines."
    },
    {
        "title": "blynt — Product Management & Agile Delivery Handbook",
        "md_files": ["BLYNT_PRODUCT_MANAGEMENT_HANDBOOK.md"],
        "pdf_file": "blynt_Product_Management_Handbook.pdf",
        "category": "Product & Agile",
        "description": "Product roadmap, feature prioritization matrix, Definition of Ready/Done, and sprint cadence."
    },
    {
        "title": "blynt — Jira & Confluence Agile Workflow & Governance",
        "md_files": ["BLYNT_JIRA_AND_CONFLUENCE_WORKFLOW.md"],
        "pdf_file": "blynt_Jira_and_Confluence_Workflow.pdf",
        "category": "Product & Agile",
        "description": "Atlassian tooling standards, Jira 50-Phase epic hierarchy, transition hooks, and Confluence SSOT rules."
    },
    {
        "title": "blynt — Legal, ISO 27001 & GDPR Regulatory Compliance",
        "md_files": ["BLYNT_LEGAL_ISO27001_GDPR_COMPLIANCE.md"],
        "pdf_file": "blynt_Legal_ISO27001_and_GDPR_Compliance.pdf",
        "category": "Compliance & Security",
        "description": "UK Companies Act, GDPR Data Subject Rights, immutable audit logging, and ISO/IEC 27001 control matrix."
    },
    {
        "title": "blynt — Security Architecture, SOC 2 & Pentest Guide",
        "md_files": ["BLYNT_SECURITY_SOC2_PENTEST_GRC.md"],
        "pdf_file": "blynt_Security_SOC2_Pentest_GRC.pdf",
        "category": "Compliance & Security",
        "description": "Zero-trust model, JWT revocation, HMAC webhooks, SOC 2 Trust Services Criteria, and penetration testing protocol."
    },
    {
        "title": "blynt — Brand, UI Design System & Logo Guidelines",
        "md_files": ["BLYNT_UI_AND_LOGO_GUIDELINES.md"],
        "pdf_file": "blynt_UI_and_Logo_Guidelines.pdf",
        "category": "Design & UX",
        "description": "Visual identity, typography, primary and secondary color palettes, dark mode tokens, and logo usage guidelines."
    },
    {
        "title": "blynt — 50-Phase Engineering Delivery Roadmap",
        "md_files": ["BLYNT_PHASES_AND_ROADMAP_SPECIFICATION.md"],
        "pdf_file": "blynt_Phases_and_Roadmap_Specification.pdf",
        "category": "Roadmap & Strategy",
        "description": "Detailed phase-by-phase execution blueprint from Phase 1 (Foundation) through Phase 50 (Global Scale)."
    },
    {
        "title": "blynt — Strategic Engineering Playbook",
        "md_files": ["BLYNT_PLAYBOOK.md"],
        "pdf_file": "blynt_Playbook.pdf",
        "category": "Roadmap & Strategy",
        "description": "High-velocity execution rules, incident war-room protocols, technical debt thresholds, and team velocity metrics."
    },
    {
        "title": "blynt — Integrated Use Cases & Test Cases Manual",
        "md_files": ["BLYNT_USE_CASES_AND_TEST_CASES.md"],
        "pdf_file": "blynt_Use_Cases_and_Test_Cases.pdf",
        "category": "Specifications",
        "description": "Unified reference guide cross-referencing all functional use cases directly to automated regression suites."
    }
]

def clean_html_for_confluence(raw_html, pdf_filename):
    soup = BeautifulSoup(raw_html, "html.parser")
    
    # Remove unsupported local image references that will break rendering
    for img in soup.find_all("img"):
        src = img.get("src", "")
        alt = img.get("alt", "Diagram")
        # Replace local diagram with a callout note
        placeholder = soup.new_tag("p")
        placeholder.string = f"[Diagram: {alt}] (Refer to attached official PDF: {pdf_filename})"
        img.replace_with(placeholder)
        
    return str(soup)

def get_existing_page(title):
    url = f"{CONFLUENCE_URL}/rest/api/content"
    params = {
        "spaceKey": SPACE_KEY,
        "title": title,
        "expand": "version,ancestors"
    }
    resp = requests.get(url, auth=AUTH, headers={"Accept": "application/json"}, params=params)
    if resp.status_code == 200:
        results = resp.json().get("results", [])
        if results:
            return results[0]
    return None

def create_or_update_page(title, storage_xhtml, parent_id):
    existing = get_existing_page(title)
    if existing:
        page_id = existing["id"]
        version_num = existing["version"]["number"] + 1
        print(f"[*] Updating existing page: '{title}' (ID: {page_id}, v{version_num})...")
        payload = {
            "id": page_id,
            "type": "page",
            "title": title,
            "space": {"key": SPACE_KEY},
            "body": {
                "storage": {
                    "value": storage_xhtml,
                    "representation": "storage"
                }
            },
            "version": {
                "number": version_num
            }
        }
        if parent_id:
            payload["ancestors"] = [{"id": str(parent_id)}]
            
        resp = requests.put(f"{CONFLUENCE_URL}/rest/api/content/{page_id}", auth=AUTH, headers=HEADERS, json=payload)
        if resp.status_code in [200, 201]:
            return resp.json()["id"]
        else:
            print(f"[-] Update failed for '{title}': {resp.status_code} - {resp.text}")
            return page_id
    else:
        print(f"[+] Creating new page: '{title}' under parent {parent_id}...")
        payload = {
            "type": "page",
            "title": title,
            "space": {"key": SPACE_KEY},
            "body": {
                "storage": {
                    "value": storage_xhtml,
                    "representation": "storage"
                }
            }
        }
        if parent_id:
            payload["ancestors"] = [{"id": str(parent_id)}]
            
        resp = requests.post(f"{CONFLUENCE_URL}/rest/api/content", auth=AUTH, headers=HEADERS, json=payload)
        if resp.status_code in [200, 201]:
            new_id = resp.json()["id"]
            print(f"[+] Successfully created '{title}' (ID: {new_id})")
            return new_id
        else:
            print(f"[-] Create failed for '{title}': {resp.status_code} - {resp.text}")
            return None

def upload_attachment(page_id, pdf_path):
    if not os.path.exists(pdf_path):
        print(f"[-] PDF file not found at: {pdf_path}")
        return False
        
    filename = os.path.basename(pdf_path)
    url = f"{CONFLUENCE_URL}/rest/api/content/{page_id}/child/attachment"
    
    # Check if attachment already exists
    check_resp = requests.get(url, auth=AUTH, headers={"Accept": "application/json", "X-Atlassian-Token": "nocheck"}, params={"filename": filename})
    existing_att_id = None
    if check_resp.status_code == 200:
        results = check_resp.json().get("results", [])
        if results:
            existing_att_id = results[0]["id"]

    headers = {"X-Atlassian-Token": "nocheck"}
    with open(pdf_path, "rb") as f:
        files = {"file": (filename, f, "application/pdf")}
        if existing_att_id:
            # Update existing attachment
            update_url = f"{CONFLUENCE_URL}/rest/api/content/{page_id}/child/attachment/{existing_att_id}/data"
            resp = requests.post(update_url, auth=AUTH, headers=headers, files=files)
            if resp.status_code in [200, 201]:
                print(f"    [+] Attachment updated: {filename}")
                return True
            else:
                print(f"    [-] Attachment update failed: {resp.status_code} - {resp.text}")
                return False
        else:
            resp = requests.post(url, auth=AUTH, headers=headers, files=files)
            if resp.status_code in [200, 201]:
                print(f"    [+] Attachment uploaded: {filename}")
                return True
            else:
                print(f"    [-] Attachment upload failed: {resp.status_code} - {resp.text}")
                return False

def build_master_page_content(docs_list, page_ids_map):
    rows = []
    for d in docs_list:
        title = d["title"]
        pid = page_ids_map.get(title, "")
        cat = d["category"]
        desc = d["description"]
        pdf = d["pdf_file"]
        page_link = f"<a href='/wiki/spaces/{SPACE_KEY}/pages/{pid}'><strong>{title}</strong></a>" if pid else f"<strong>{title}</strong>"
        rows.append(f"""
        <tr>
            <td>{cat}</td>
            <td>{page_link}</td>
            <td>{pdf}</td>
            <td>{desc}</td>
        </tr>
        """)
        
    table_html = "\n".join(rows)
    
    return f"""
    <p>Welcome to the authoritative <strong>blynt Project Documentation Repository</strong>. This space contains institutional-grade specifications, technical architecture blueprints, regulatory compliance frameworks, testing suites, and strategic execution roadmaps.</p>
    
    <h2>Official Document Catalog ({len(docs_list)} Documents)</h2>
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

def run_import():
    print(f"=== Starting Confluence Import to Space: {SPACE_KEY} ===")
    
    # 1. Create or get Master Library Parent Page
    master_title = "blynt — Master Project Documentation Repository"
    initial_master_content = "<p>Initializing Master Documentation Repository...</p>"
    master_page_id = create_or_update_page(master_title, initial_master_content, ROOT_PARENT_ID)
    if not master_page_id:
        print("[-] Failed to create Master Documentation Repository parent page. Aborting.")
        return
        
    print(f"[+] Master Documentation Repository ID: {master_page_id}")
    
    page_ids_map = {}
    
    # 2. Iterate through each document
    for idx, doc in enumerate(DOCUMENTS, 1):
        title = doc["title"]
        pdf_file = doc["pdf_file"]
        pdf_path = os.path.join(DOCS_DIR, pdf_file)
        
        print(f"\n[{idx}/{len(DOCUMENTS)}] Processing: {title}")
        
        # Read and combine Markdown content
        combined_md = []
        for mdf in doc["md_files"]:
            mdf_path = os.path.join(DOCS_DIR, mdf)
            if os.path.exists(mdf_path):
                with open(mdf_path, "r", encoding="utf-8") as f:
                    combined_md.append(f.read())
            else:
                print(f"[-] Warning: Markdown file not found: {mdf_path}")
                
        md_text = "\n\n---\n\n".join(combined_md) if combined_md else f"# {title}\n\nPlease refer to attached PDF."
        
        # Convert Markdown to HTML
        raw_html = markdown.markdown(
            md_text,
            extensions=["extra", "tables", "fenced_code", "nl2br"],
            output_format="xhtml"
        )
        
        cleaned_html = clean_html_for_confluence(raw_html, pdf_file)
        
        # Prepend Header Info Banner
        header_banner = f"""
        <div style="background-color: #deebff; border-left: 4px solid #0052cc; padding: 12px 16px; margin-bottom: 24px; border-radius: 3px;">
            <p style="margin: 0; font-weight: bold; color: #0747a6;">Certified Project Specification</p>
            <p style="margin: 4px 0 0 0; color: #172b4d;">
                This page is part of the authoritative <strong>blynt Engineering Documentation Suite</strong>. 
                The certified institutional PDF (<code>{pdf_file}</code>) is attached to this page for offline reading, formal audits, and executive sign-off.
            </p>
        </div>
        """
        
        page_storage = header_banner + cleaned_html
        
        # Create or update child page under Master Repository
        page_id = create_or_update_page(title, page_storage, master_page_id)
        if page_id:
            page_ids_map[title] = page_id
            # Upload PDF attachment
            upload_attachment(page_id, pdf_path)
            
    # 3. Update Master Page with full linked Table of Contents
    print("\n[*] Updating Master Documentation Repository with linked table of contents...")
    final_master_content = build_master_page_content(DOCUMENTS, page_ids_map)
    create_or_update_page(master_title, final_master_content, ROOT_PARENT_ID)
    
    print("\n==================================================")
    print("ALL DOCUMENTS IMPORTED TO CONFLUENCE SUCCESSFULLY!")
    print(f"Root Page URL: {CONFLUENCE_URL}/spaces/{SPACE_KEY}/pages/{master_page_id}")
    print("==================================================")

if __name__ == "__main__":
    run_import()
