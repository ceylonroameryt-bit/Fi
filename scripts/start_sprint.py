import base64
import json
import urllib.request
import urllib.error
from datetime import datetime, timedelta

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

now = datetime.utcnow()
end = now + timedelta(days=14)

payload = {
    "state": "active",
    "startDate": now.strftime("%Y-%m-%dT%H:%M:%S.000Z"),
    "endDate": end.strftime("%Y-%m-%dT%H:%M:%S.000Z")
}

url = f"{JIRA_URL}/rest/agile/1.0/sprint/5"
req = urllib.request.Request(url, method="POST", headers=headers, data=json.dumps(payload).encode())
try:
    with urllib.request.urlopen(req) as resp:
        print("[+] Successfully activated Sprint 3 - UK VAT & HMRC MTD on your Jira board!")
except urllib.error.HTTPError as e:
    print(f"[-] Could not activate sprint 5: {e.code} - {e.read().decode()}")
