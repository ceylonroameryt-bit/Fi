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

body = {"jql": "project = SCRUM AND sprint in openSprints()", "fields": ["summary", "status", "components"]}
req = urllib.request.Request(f"{JIRA_URL}/rest/api/3/search/jql", method="POST", headers=headers, data=json.dumps(body).encode())
with urllib.request.urlopen(req) as resp:
    res = json.loads(resp.read().decode())
    print("Issues currently in Active Sprint (Board View):")
    for iss in res.get("issues", []):
        f = iss.get("fields", {})
        print(f"  [{f.get('status', {}).get('name')}] {iss.get('key')}: {f.get('summary')}")
