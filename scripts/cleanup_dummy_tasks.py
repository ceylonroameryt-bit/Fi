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

def delete_issue(key):
    url = f"{JIRA_URL}/rest/api/3/issue/{key}"
    req = urllib.request.Request(url, method="DELETE", headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            print(f"[+] Deleted dummy issue {key}")
    except urllib.error.HTTPError as e:
        print(f"[-] Could not delete {key}: {e.code}")

for k in ["SCRUM-4", "SCRUM-3", "SCRUM-2", "SCRUM-1"]:
    delete_issue(k)
