import os
import requests
import markdown
from bs4 import BeautifulSoup

CONFLUENCE_URL = "https://blynt-co.atlassian.net/wiki"
EMAIL = "blynttechnologies@gmail.com"
API_TOKEN = "ATATT3xFfGF0fCmX0geTVLXs5-U05HWdeD12Ltg_TSyF7i9_8X8XdMzjuJDosb3Iqk9kHteICNzJO6SkshyWow7r-MMAan7QBFDTd4MRBDQPtJOFfhwP37MS3WIv6Rl8oMjVw7Rw_oRq_bQCSl2v5j8YT2_kOnxHv4Q0EgKRwbZ-qL-ZKsbgvcY=F5D7FBCF"
AUTH = (EMAIL, API_TOKEN)
SPACE_KEY = "SCRUM"
MASTER_PAGE_ID = "753681"

MD_PATH = r"d:\Project\F!\docs\BLYNT_JIRA_AND_CONFLUENCE_WORKFLOW.md"
PDF_PATH = r"d:\Project\F!\docs\blynt_Jira_and_Confluence_Workflow.pdf"

with open(MD_PATH, "r", encoding="utf-8") as f:
    md_text = f.read()

raw_html = markdown.markdown(md_text, extensions=["extra", "tables", "fenced_code", "nl2br"], output_format="xhtml")

soup = BeautifulSoup(raw_html, "html.parser")
for img in soup.find_all("img"):
    alt = img.get("alt", "Diagram")
    p = soup.new_tag("p")
    p.string = f"[Diagram: {alt}] (Refer to attached official PDF: blynt_Jira_and_Confluence_Workflow.pdf)"
    img.replace_with(p)

cleaned_html = str(soup)

header_banner = """
<div style="background-color: #deebff; border-left: 4px solid #0052cc; padding: 12px 16px; margin-bottom: 24px; border-radius: 3px;">
    <p style="margin: 0; font-weight: bold; color: #0747a6;">Certified Project Specification &amp; Governance Standard</p>
    <p style="margin: 4px 0 0 0; color: #172b4d;">
        This page defines the authoritative <strong>Jira &amp; Confluence Agile Delivery, Review &amp; Governance Manual</strong>. 
        The certified institutional PDF (<code>blynt_Jira_and_Confluence_Workflow.pdf</code>) is attached to this page.
    </p>
</div>
"""

storage_xhtml = header_banner + cleaned_html

# Create new page under MASTER_PAGE_ID
title = "blynt: Jira & Confluence Agile Workflow & Governance"
payload = {
    "type": "page",
    "title": title,
    "space": {"key": SPACE_KEY},
    "ancestors": [{"id": MASTER_PAGE_ID}],
    "body": {
        "storage": {
            "value": storage_xhtml,
            "representation": "storage"
        }
    }
}

resp = requests.post(f"{CONFLUENCE_URL}/rest/api/content", auth=AUTH, json=payload)
if resp.status_code in [200, 201]:
    new_page_id = resp.json()["id"]
    print(f"Successfully created page: {title} (ID: {new_page_id})")
    
    # Upload PDF attachment
    filename = os.path.basename(PDF_PATH)
    with open(PDF_PATH, "rb") as f:
        att_resp = requests.post(
            f"{CONFLUENCE_URL}/rest/api/content/{new_page_id}/child/attachment",
            auth=AUTH,
            headers={"X-Atlassian-Token": "nocheck"},
            files={"file": (filename, f, "application/pdf")}
        )
        print(f"Attachment upload status: {att_resp.status_code}")
else:
    print(f"Create failed: {resp.status_code} - {resp.text}")
