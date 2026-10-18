import requests

CONFLUENCE_URL = "https://blynt-co.atlassian.net/wiki"
EMAIL = "blynttechnologies@gmail.com"
API_TOKEN = "ATATT3xFfGF0fCmX0geTVLXs5-U05HWdeD12Ltg_TSyF7i9_8X8XdMzjuJDosb3Iqk9kHteICNzJO6SkshyWow7r-MMAan7QBFDTd4MRBDQPtJOFfhwP37MS3WIv6Rl8oMjVw7Rw_oRq_bQCSl2v5j8YT2_kOnxHv4Q0EgKRwbZ-qL-ZKsbgvcY=F5D7FBCF"
AUTH = (EMAIL, API_TOKEN)

ID_TO_TITLE = {
    "98414": "Blynt Engineering Home",
    "753681": "blynt: Master Project Documentation Repository",
    "720899": "blynt: Complete Technical & Business Documentation (Omnibus)",
    "688146": "blynt: 100 Exhaustive Use Cases Specification",
    "917505": "blynt: 100 Exhaustive Test Cases Specification",
    "983041": "blynt: Complete Core Use Cases Specification",
    "983057": "blynt: Complete Core Test Cases Specification",
    "688162": "blynt: Non-IT Business Use Cases & Test Cases",
    "1015815": "blynt: Executive & User-Side Business Report",
    "688178": "blynt: Technical Architecture & Code Explainer",
    "884743": "blynt: Developer Handbook & Engineering Standards",
    "983079": "blynt: Product Management & Agile Delivery Handbook",
    "1015831": "blynt: Jira & Confluence Agile Workflow & Governance",
    "688194": "blynt: Legal, ISO 27001 & GDPR Regulatory Compliance",
    "1114113": "blynt: Security Architecture, SOC 2 & Pentest Guide",
    "688210": "blynt: Brand, UI Design System & Logo Guidelines",
    "1081351": "blynt: 50-Phase Engineering Delivery Roadmap",
    "819213": "blynt: Strategic Engineering Playbook",
    "950285": "blynt: Integrated Use Cases & Test Cases Manual",
}

for pid, title in ID_TO_TITLE.items():
    resp = requests.get(f"{CONFLUENCE_URL}/rest/api/content/{pid}", auth=AUTH).json()
    vnum = resp.get("version", {}).get("number", 1) + 1
    payload = {
        "id": pid,
        "type": "page",
        "title": title,
        "space": {"key": "SCRUM"},
        "version": {"number": vnum}
    }
    r = requests.put(f"{CONFLUENCE_URL}/rest/api/content/{pid}", auth=AUTH, json=payload)
    print(f"Set [{pid}] -> '{title}' ({r.status_code})")
