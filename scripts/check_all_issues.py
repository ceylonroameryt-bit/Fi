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

body = {"jql": "project = SCRUM ORDER BY created ASC", "maxResults": 100, "fields": ["summary", "issuetype", "status"]}
req = urllib.request.Request(f"{JIRA_URL}/rest/api/3/search/jql", method="POST", headers=headers, data=json.dumps(body).encode())
with urllib.request.urlopen(req) as resp:
    res = json.loads(resp.read().decode())
    issues = res.get("issues", [])
    print(f"Total issues found: {len(issues)}")
    for iss in issues[:15]:
        fields = iss.get("fields", {})
        print(f"  {iss.get('key')}: [{fields.get('issuetype', {}).get('name')}] {fields.get('summary')} ({fields.get('status', {}).get('name')})")
