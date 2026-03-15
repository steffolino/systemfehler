import json
import unittest

from fastapi.testclient import TestClient

from backend.ai_service.cache import TTLCache, fingerprint_payload, normalize_query
from backend.ai_service.gateway import app


client = TestClient(app)


def load_sample_entry():
    with open("data/benefits/entries.json", encoding="utf-8") as handle:
        payload = json.load(handle)
    entries = payload["entries"] if isinstance(payload, dict) else payload
    return entries[0]


class AIBackendUnitTests(unittest.TestCase):
    def test_normalize_query_collapses_whitespace_and_case(self):
        self.assertEqual(normalize_query("  Ich   BIN  arbeitslos  "), "ich bin arbeitslos")

    def test_ttl_cache_roundtrip(self):
        cache = TTLCache(max_entries=2)
        cache.set("key", {"value": 1}, ttl_seconds=60)
        self.assertEqual(cache.get("key"), {"value": 1})

    def test_fingerprint_payload_changes_with_content(self):
        first = fingerprint_payload({"id": "1", "tags": ["a"]})
        second = fingerprint_payload({"id": "1", "tags": ["b"]})
        self.assertNotEqual(first, second)

    def test_retrieve_endpoint_returns_structured_evidence(self):
        response = client.post("/retrieve", json={"query": "Buergergeld"})
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIn("evidence", payload)
        self.assertIsInstance(payload["evidence"], list)
        self.assertIn("latency_ms", payload)

    def test_enrich_endpoint_returns_structured_metadata_suggestions(self):
        entry = load_sample_entry()
        response = client.post("/enrich", json={"entry_id": entry["id"], "entry": entry})
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["entry_id"], entry["id"])
        self.assertIn("metadata", payload)
        self.assertEqual(
            set(payload["metadata"].keys()),
            {"topics", "tags", "target_groups", "keywords"},
        )
        self.assertIn("confidence", payload["metadata"]["topics"])
        self.assertIsInstance(payload["summary"], list)

    def test_health_endpoint_reports_provider_shape(self):
        response = client.get("/health")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["status"], "ok")
        self.assertIn("provider", payload)
        self.assertIn("configured", payload["provider"])


if __name__ == "__main__":
    unittest.main()
