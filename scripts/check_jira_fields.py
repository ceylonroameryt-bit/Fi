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

def api_call(path):
    url = f"{JIRA_URL}{path}"
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))

fields = api_call("/rest/api/3/field")
print("Relevant fields:")
for f in fields:
    name = f.get("name", "").lower()
    if any(k in name for k in ["story point", "epic", "component", "parent", "sprint"]):
        print(f"  - Name: {f.get('name')}, Id: {f.get('id')}, Custom: {f.get('custom')}")
