import json
import os
import sys
import subprocess
import requests

# Configuration
D1_API_URL = os.environ.get("D1_API_URL")  # e.g. "https://<your-worker-subdomain>.workers.dev/admin/upsert-benefit"
CRAWLER_CMD = ["python", "main.py"]  # Adjust if your crawler entrypoint is different
BENEFITS_JSON = os.path.join(os.path.dirname(__file__), "../api/data/benefits.json")
REQUIRED_FIELDS = ["id", "url", "title", "meta_description", "h1", "excerpt", "content", "source", "language", "status", "last_crawled_at"]

def run_crawler():
    print("Running crawler...")
    result = subprocess.run(CRAWLER_CMD, cwd=os.path.dirname(__file__), capture_output=True, text=True)
    if result.returncode != 0:
        print("Crawler failed:", result.stderr)
        sys.exit(1)
    print("Crawler finished.")

def validate_benefit(benefit):
    missing = [f for f in REQUIRED_FIELDS if f not in benefit]
    if missing:
        return False, f"Missing fields: {missing}"
    if not isinstance(benefit["language"], list):
        return False, "language must be a list"
    return True, ""

def check_upsert_endpoint():
    global D1_API_URL
    candidates = [
        D1_API_URL,
        D1_API_URL.replace('/admin/upsert-benefit', '/api/admin/upsert-benefit'),
        D1_API_URL.replace('/admin/upsert-benefit', '/services/api/admin/upsert-benefit'),
    ]
    for url in candidates:
        try:
            resp = requests.get(url)
            if resp.status_code == 404:
                continue
            print(f"Upsert endpoint found: {url}")
            D1_API_URL = url
            return
        except Exception:
            continue
    print(f"ERROR: Upsert endpoint not found (404). Tried: {candidates}. Is your Worker deployed and the path correct?")
    sys.exit(1)

def upsert_benefit(benefit):
    try:
        resp = requests.post(D1_API_URL, json=benefit)
    except Exception as e:
        return False, f"Request failed: {e}"
    if resp.status_code != 200:
        return False, f"Upsert failed ({resp.status_code}) for {benefit.get('id')}: {resp.text} (URL: {D1_API_URL})"
    return True, ""

def validate_in_db(benefit):
    # Fetch from API and compare
    url = f"{D1_API_URL.replace('/admin/upsert-benefit', '/api/benefits/')}{benefit['id']}"
    resp = requests.get(url)
    if resp.status_code != 200:
        return False, f"Validation fetch failed: {resp.status_code} {resp.text}"
    db_benefit = resp.json()
    # Compare a few key fields
    for key in ["id", "title", "url"]:
        if db_benefit.get(key) != benefit.get(key):
            return False, f"Mismatch for {key}: {db_benefit.get(key)} != {benefit.get(key)}"
    return True, ""

def main():
    if not D1_API_URL:
        print("Set D1_API_URL environment variable to your Worker endpoint for upserting benefits.")
        sys.exit(1)

    check_upsert_endpoint()
    run_crawler()

    with open(BENEFITS_JSON, encoding="utf-8") as f:
        benefits = json.load(f)

    total = len(benefits)
    ok_count = 0
    for benefit in benefits:
        valid, msg = validate_benefit(benefit)
        if not valid:
            print(f"Validation failed for {benefit.get('id')}: {msg}")
            continue
        ok, msg = upsert_benefit(benefit)
        if not ok:
            print(msg)
            continue
        ok, msg = validate_in_db(benefit)
        if ok:
            print(f"Benefit {benefit['id']} upserted and validated.")
            ok_count += 1
        else:
            print(f"Validation after upsert failed for {benefit['id']}: {msg}")

    print(f"Done. {ok_count}/{total} benefits upserted and validated.")

if __name__ == "__main__":
    main()
