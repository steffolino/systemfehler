import json
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from backend.ai_service.cache import TTLCache, ai_cache, fingerprint_payload, normalize_query
from backend.ai_service.gateway import app
from backend.ai_service.provider import AIProviderError
from backend.ai_service.schemas import Evidence


client = TestClient(app)


def load_sample_entry():
    with open("data/benefits/entries.json", encoding="utf-8") as handle:
        payload = json.load(handle)
    entries = payload["entries"] if isinstance(payload, dict) else payload
    return entries[0]


class AIBackendUnitTests(unittest.TestCase):
    def setUp(self):
        with ai_cache._lock:
            ai_cache._store.clear()
        self.turnstile_patch = patch("backend.ai_service.gateway.is_turnstile_configured", return_value=False)
        self.turnstile_patch.start()

    def tearDown(self):
        self.turnstile_patch.stop()

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

    def test_enrich_endpoint_uses_topic_profile_keywords(self):
        entry = {
            "id": "entry-1",
            "title": "Was bedeutet Bedarfsgemeinschaft?",
            "summary_de": "Informationen zur Bedarfsgemeinschaft und zum Regelbedarf.",
            "content_de": "Der Regelbedarf und Mehrbedarf werden fuer die Bedarfsgemeinschaft erklaert.",
            "topics": [],
            "tags": [],
            "target_groups": [],
        }
        topic_profiles = [
            {
                "id": "bedarfsgemeinschaft",
                "name": "Bedarfsgemeinschaft",
                "keywords": ["bedarfsgemeinschaft", "regelbedarf", "mehrbedarf"],
            }
        ]

        with patch("backend.ai_service.endpoints.TOPIC_PROFILES", topic_profiles):
            response = client.post("/enrich", json={"entry_id": entry["id"], "entry": entry})

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIn("Matched trusted topic profiles: Bedarfsgemeinschaft.", payload["summary"])
        self.assertIn("regelbedarf", payload["metadata"]["keywords"]["suggested"])
        self.assertEqual(payload["provenance"]["matched_topics"][0]["id"], "bedarfsgemeinschaft")

    def test_rewrite_endpoint_uses_deterministic_local_strategy(self):
        with patch("backend.ai_service.endpoints.provider.name", "ollama"), patch(
            "backend.ai_service.endpoints.provider.is_configured",
            return_value=True,
        ), patch("backend.ai_service.endpoints.LOCAL_REWRITE_STRATEGY", "deterministic"):
            response = client.post("/rewrite", json={"query": "Ich habe meinen Job verloren. Was nun?"})

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["provider"], "ollama")
        self.assertIn("deterministic", payload["model"])
        self.assertIn("jobcenter", payload["rewritten_query"])
        self.assertIsInstance(payload["matched_topics"], list)

    def test_rewrite_endpoint_prefers_topic_keywords_when_profile_matches(self):
        topic_profiles = [
            {
                "id": "kinderzuschlag",
                "name": "Kinderzuschlag",
                "keywords": ["kinderzuschlag", "familie", "anspruch", "hoehe"],
            }
        ]

        with patch("backend.ai_service.endpoints.provider.name", "ollama"), patch(
            "backend.ai_service.endpoints.provider.is_configured",
            return_value=True,
        ), patch("backend.ai_service.endpoints.LOCAL_REWRITE_STRATEGY", "deterministic"), patch(
            "backend.ai_service.endpoints.TOPIC_PROFILES",
            topic_profiles,
        ):
            response = client.post("/rewrite", json={"query": "Wie hoch ist der Kinderzuschlag fuer Familien?"})

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIn("kinderzuschlag", payload["rewritten_query"])
        self.assertIn("familie", payload["rewritten_query"])
        self.assertIn("Kinderzuschlag", payload["matched_topics"])

    def test_synthesize_endpoint_uses_extractive_fast_path(self):
        fake_evidence = [
            Evidence(
                source="https://example.org",
                content=json.dumps(
                    {
                        "title": "Buergergeld",
                        "summary": {"de": "Kurzinfo"},
                        "url": "https://example.org",
                        "domain": "benefits",
                    }
                ),
                confidence=0.91,
            )
        ]

        with patch("backend.ai_service.endpoints.provider.name", "ollama"), patch(
            "backend.ai_service.endpoints.LOCAL_SYNTHESIS_STRATEGY",
            "extractive",
        ), patch(
            "backend.ai_service.endpoints.retrieve_evidence",
            return_value=fake_evidence,
        ):
            response = client.post("/synthesize", json={"query": "Ich bin arbeitslos geworden. Was nun?"})

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertFalse(payload["fallback"])
        self.assertIn("extractive", payload["model"])
        self.assertTrue(payload["answer"].startswith("Wahrscheinlich zuerst relevant:"))
        self.assertGreaterEqual(len(payload["evidence"]), 1)

    def test_synthesize_endpoint_falls_back_when_provider_errors(self):
        fake_evidence = [
            Evidence(
                source="https://example.org",
                content=json.dumps(
                    {
                        "title": "Buergergeld",
                        "summary": {"de": "Kurzinfo"},
                        "url": "https://example.org",
                        "domain": "benefits",
                    }
                ),
                confidence=0.91,
            )
        ]

        with patch("backend.ai_service.endpoints.LOCAL_SYNTHESIS_STRATEGY", "llm"), patch(
            "backend.ai_service.endpoints.retrieve_evidence",
            return_value=fake_evidence,
        ), patch(
            "backend.ai_service.endpoints.provider.generate_text",
            side_effect=AIProviderError("provider exploded"),
        ):
            response = client.post("/synthesize", json={"query": "Buergergeld"})

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["fallback"])
        self.assertEqual(payload["explanation"], "provider exploded")
        self.assertEqual(payload["sources"], ["https://example.org"])

    def test_health_endpoint_reports_provider_shape(self):
        response = client.get("/health")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["status"], "ok")
        self.assertIn("provider", payload)
        self.assertIn("configured", payload["provider"])


if __name__ == "__main__":
    unittest.main()
