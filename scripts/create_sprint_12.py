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

url = f"{JIRA_URL}/rest/agile/1.0/sprint"
payload = {
    "name": "Sprint 12 - Consolidation",
    "originBoardId": 1,
    "goal": "Parent/subsidiary hierarchy, intercompany eliminations, and group reporting.",
    "startDate": "2027-03-08T10:00:00.000Z",
    "endDate": "2027-03-22T17:00:00.000Z"
}
req = urllib.request.Request(url, method="POST", headers=headers, data=json.dumps(payload).encode())
with urllib.request.urlopen(req) as resp:
    data = json.loads(resp.read().decode())
    print(f"[+] Created Sprint 12: {data.get('name')} (Id: {data.get('id')})")
