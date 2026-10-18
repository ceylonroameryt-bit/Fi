import base64
import json
import urllib.request

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

# Check active sprints on board 1
req = urllib.request.Request(f"{JIRA_URL}/rest/agile/1.0/board/1/sprint?state=active", headers=headers)
try:
    with urllib.request.urlopen(req) as resp:
        sprints = json.loads(resp.read().decode())
        print("Active sprints:", [s.get("name") for s in sprints.get("values", [])])
except Exception as e:
    print("Sprint error:", e)

# Check issues on board
req = urllib.request.Request(f"{JIRA_URL}/rest/agile/1.0/board/1/issue", headers=headers)
try:
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode())
        issues = data.get("issues", [])
        print(f"Total issues on board: {len(issues)}")
        for iss in issues:
            k = iss.get("key")
            s = iss.get("fields", {}).get("summary")
            st = iss.get("fields", {}).get("status", {}).get("name")
            print(f"  [{st}] {k}: {s}")
except Exception as e:
    print("Issues error:", e)
