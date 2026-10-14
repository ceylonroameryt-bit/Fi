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

def test_conn():
    print("[*] Testing Jira connectivity...")
    me = api_call("/rest/api/3/myself")
    if me:
        print(f"[+] Authenticated as: {me.get('displayName')} ({me.get('emailAddress')})")
    
    projects = api_call("/rest/api/3/project")
    print(f"[+] Found {len(projects)} project(s):")
    for p in projects:
        print(f"    - Key: {p.get('key')}, Name: {p.get('name')}, Id: {p.get('id')}")
        
    return projects

if __name__ == "__main__":
    test_conn()
