import os
import base64
import json
import urllib.request
import urllib.error

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

def get_versions():
    url = f"{JIRA_URL}/rest/api/3/project/SCRUM/versions"
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())

print("Existing versions in project SCRUM:", get_versions())
