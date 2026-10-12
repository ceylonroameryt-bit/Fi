import base64
import json
import urllib.request
import urllib.error

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
