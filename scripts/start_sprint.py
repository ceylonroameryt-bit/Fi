import os
import base64
import json
import urllib.request
import urllib.error
from datetime import datetime, timedelta

JIRA_URL = "https://blynt-co.atlassian.net"
EMAIL = os.environ.get("JIRA_EMAIL", "blynttechnologies@gmail.com")
API_TOKEN = os.environ.get("JIRA_API_TOKEN")
if not API_TOKEN:
    raise SystemExit("Set the JIRA_API_TOKEN environment variable (never commit tokens).")

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
