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

def api_call(path, method="GET", data=None):
    url = f"{JIRA_URL}{path}"
    req = urllib.request.Request(url, method=method, headers=headers)
    if data:
        req.data = json.dumps(data).encode("utf-8")
    try:
        with urllib.request.urlopen(req) as resp:
            content = resp.read().decode("utf-8")
            if content:
                return json.loads(content)
            return {}
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8")
        print(f"HTTP Error {e.code} for {url}: {err}")
        return None

def inspect_project():
    proj = api_call("/rest/api/3/project/10000")
    print(f"Project Name: {proj.get('name')}")
    print("Issue types:")
    for it in proj.get("issueTypes", []):
        print(f"  - Id: {it.get('id')}, Name: {it.get('name')}, HierarchyLevel: {it.get('hierarchyLevel')}, Subtask: {it.get('subtask')}")

    statuses = api_call("/rest/api/3/project/10000/statuses")
    print("\nWorkflow Statuses:")
    for st_group in statuses or []:
        print(f"For IssueType: {st_group.get('name')}")
        for s in st_group.get('statuses', []):
            print(f"  - Status Id: {s.get('id')}, Name: {s.get('name')}, Category: {s.get('statusCategory', {}).get('name')}")

if __name__ == "__main__":
    inspect_project()
