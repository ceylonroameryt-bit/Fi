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

body = {"jql": "project = SCRUM ORDER BY created ASC", "maxResults": 100, "fields": ["summary", "issuetype", "status"]}
req = urllib.request.Request(f"{JIRA_URL}/rest/api/3/search/jql", method="POST", headers=headers, data=json.dumps(body).encode())
with urllib.request.urlopen(req) as resp:
    res = json.loads(resp.read().decode())
    issues = res.get("issues", [])

print(f"Total issues: {len(issues)}")
for iss in issues:
    f = iss.get("fields", {})
    print(f"{iss.get('key')}: [{f.get('issuetype', {}).get('name')}] {f.get('summary')} -> Status: {f.get('status', {}).get('name')}")
