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

req = urllib.request.Request(f"{JIRA_URL}/rest/agile/1.0/board/1/sprint", headers=headers)
with urllib.request.urlopen(req) as resp:
    res = json.loads(resp.read().decode())
    print("Sprints on Board:")
    for s in res.get("values", []):
        print(f"  - Id: {s.get('id')}, Name: {s.get('name')}, State: {s.get('state')}")
