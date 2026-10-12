import base64
import json
import urllib.request
import urllib.error

CONFLUENCE_URL = "https://blynt-co.atlassian.net/wiki"
EMAIL = "blynttechnologies@gmail.com"
API_TOKEN = "ATATT3xFfGF0fCmX0geTVLXs5-U05HWdeD12Ltg_TSyF7i9_8X8XdMzjuJDosb3Iqk9kHteICNzJO6SkshyWow7r-MMAan7QBFDTd4MRBDQPtJOFfhwP37MS3WIv6Rl8oMjVw7Rw_oRq_bQCSl2v5j8YT2_kOnxHv4Q0EgKRwbZ-qL-ZKsbgvcY=F5D7FBCF"

auth_str = f"{EMAIL}:{API_TOKEN}"
b64_auth = base64.b64encode(auth_str.encode()).decode()
headers = {
    "Authorization": f"Basic {b64_auth}",
    "Content-Type": "application/json",
    "Accept": "application/json"
}

def test_confluence():
    url = f"{CONFLUENCE_URL}/rest/api/space"
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
            print(f"[+] Confluence is ACTIVE! Found {len(data.get('results', []))} space(s):")
            for sp in data.get('results', []):
                print(f"    - Key: {sp.get('key')}, Name: {sp.get('name')}")
            return True
    except urllib.error.HTTPError as e:
        print(f"[-] Confluence check failed: {e.code} - {e.read().decode()}")
        return False

if __name__ == "__main__":
    test_confluence()
