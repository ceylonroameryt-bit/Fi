import os
import base64
import json
import urllib.request

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

req = urllib.request.Request(f"{JIRA_URL}/rest/api/3/issue/10052", headers=headers)
with urllib.request.urlopen(req) as resp:
    res = json.loads(resp.read().decode())
    print("Issue Key:", res.get("key"))
    print("Summary:", res.get("fields", {}).get("summary"))
    print("Type:", res.get("fields", {}).get("issuetype", {}).get("name"))
    print("Status:", res.get("fields", {}).get("status", {}).get("name"))
