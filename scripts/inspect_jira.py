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

# 1. Check project statuses
url = f"{JIRA_URL}/rest/api/3/project/SCRUM/statuses"
req = urllib.request.Request(url, headers=headers)
try:
    with urllib.request.urlopen(req) as resp:
        statuses = json.loads(resp.read().decode())
        print("=== Issue Types & Statuses in SCRUM ===")
        for it in statuses:
            it_name = it.get("name")
            print(f"IssueType: {it_name}")
            for st in it.get("statuses", []):
                s_name = st.get("name")
                cat_name = st.get("statusCategory", {}).get("name")
                print(f"   - Status: {s_name} (Category: {cat_name})")
except urllib.error.HTTPError as e:
    print("Statuses error:", e.code, e.read().decode())

# 2. Check boards
url = f"{JIRA_URL}/rest/agile/1.0/board?projectKeyOrId=SCRUM"
req = urllib.request.Request(url, headers=headers)
try:
    with urllib.request.urlopen(req) as resp:
        boards = json.loads(resp.read().decode())
        print("\n=== Boards in SCRUM ===")
        for b in boards.get("values", []):
            bid = b.get("id")
            bname = b.get("name")
            btype = b.get("type")
            print(f"Board ID: {bid}, Name: {bname}, Type: {btype}")
            # Get board configuration
            cfg_url = f"{JIRA_URL}/rest/agile/1.0/board/{bid}/configuration"
            cfg_req = urllib.request.Request(cfg_url, headers=headers)
            try:
                with urllib.request.urlopen(cfg_req) as cfg_resp:
                    cfg_data = json.loads(cfg_resp.read().decode())
                    cols = cfg_data.get("columnConfig", {}).get("columns", [])
                    print(f"  Columns on Board {bid}:")
                    for c in cols:
                        c_name = c.get("name")
                        c_statuses = [s.get("id") for s in c.get("statuses", [])]
                        print(f"    - Column: '{c_name}' (status IDs: {c_statuses})")
            except Exception as ce:
                print("  Config error:", ce)
except urllib.error.HTTPError as e:
    print("Boards error:", e.code, e.read().decode())
