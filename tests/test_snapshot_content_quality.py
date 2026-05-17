import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DOMAINS = ("benefits", "aid", "tools", "organizations", "contacts")
BAD_TEXT_TOKENS = (
    "mit der einwilligung von nutzenden",
    "webverhalten- analysetool",
    "webverhalten-analysetool",
    "webverhalten analysetool",
    "matomo",
    "einwilligen ablehnen",
)
BAD_URL_TOKENS = (
    "/dynamic/action/",
    "!zip-search",
)


def load_entries(domain):
    path = ROOT / "data" / domain / "entries.json"
    payload = json.loads(path.read_text(encoding="utf-8-sig"))
    return payload["entries"] if isinstance(payload, dict) else payload


def best_text(entry, field):
    value = entry.get(field)
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        for key in ("de", "easy_de", "en"):
            nested = value.get(key)
            if isinstance(nested, str) and nested.strip():
                return nested
    return ""


class SnapshotContentQualityTests(unittest.TestCase):
    def test_snapshots_do_not_publish_cookie_consent_boilerplate(self):
        offenders = []
        for domain in DOMAINS:
            for entry in load_entries(domain):
                url = str(entry.get("url") or "").lower()
                text = " ".join((best_text(entry, "summary"), best_text(entry, "content"))).lower()
                if any(token in text for token in BAD_TEXT_TOKENS) or any(token in url for token in BAD_URL_TOKENS):
                    offenders.append(f"{domain}:{entry.get('id')}:{entry.get('url')}")

        self.assertEqual(offenders, [])


if __name__ == "__main__":
    unittest.main()
