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

url = f"{JIRA_URL}/rest/api/3/issue"
payload = {
    "fields": {
        "project": {"key": "SCRUM"},
        "summary": "Test Parent Link to Epic Phase 1",
        "description": {
            "type": "doc",
            "version": 1,
            "content": [
                {
                    "type": "paragraph",
                    "content": [{"type": "text", "text": "Testing linking to Epic SCRUM-9"}]
                }
            ]
        },
        "issuetype": {"name": "Story"},
        "parent": {"key": "SCRUM-9"}
    }
}
req = urllib.request.Request(url, method="POST", headers=headers, data=json.dumps(payload).encode())
try:
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode())
        print(f"[+] Successfully created child story with parent: {data.get('key')}")
        # Clean up test issue
        del_req = urllib.request.Request(f"{JIRA_URL}/rest/api/3/issue/{data.get('key')}", method="DELETE", headers=headers)
        urllib.request.urlopen(del_req)
        print(f"[+] Cleaned up test issue {data.get('key')}")
except urllib.error.HTTPError as e:
    print(f"[-] Error: {e.code} - {e.read().decode()}")
