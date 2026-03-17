import json
import tempfile
import unittest
from pathlib import Path

from crawlers.shared.topic_discovery import TopicDiscovery


class TopicSeedSyncTests(unittest.TestCase):
    def test_sync_topic_seeds_enriches_benefits_manifest(self):
        with tempfile.TemporaryDirectory() as tmp:
            data_dir = Path(tmp) / "data"
            (data_dir / "_topics").mkdir(parents=True)
            (data_dir / "benefits").mkdir(parents=True)
            (data_dir / "_sources").mkdir(parents=True)

            (data_dir / "_sources" / "registered_sources.json").write_text(
                json.dumps(
                    {
                        "sources": [
                            {
                                "id": "arbeitsagentur",
                                "name": "Bundesagentur fuer Arbeit",
                                "baseUrl": "https://www.arbeitsagentur.de",
                                "domains": ["benefits"],
                                "sourceTier": "tier_1_official",
                                "institutionType": "government",
                                "jurisdiction": "DE",
                                "defaultTargetGroups": ["unemployed", "general_public"],
                            }
                        ]
                    }
                ),
                encoding="utf-8",
            )
            (data_dir / "_topics" / "trusted_topic_sources.json").write_text(
                json.dumps(
                    {
                        "topics": [
                            {
                                "id": "buergergeld",
                                "name": "Buergergeld",
                                "domains": ["benefits"],
                                "keywords": ["buergergeld"],
                                "sources": [
                                    {
                                        "sourceId": "arbeitsagentur",
                                        "role": "official_rule_source",
                                        "priority": "critical",
                                        "seedUrls": [
                                            "https://www.arbeitsagentur.de/arbeitslos-arbeit-finden/buergergeld/finanziell-absichern/antrag-bescheid"
                                        ],
                                    }
                                ],
                            }
                        ]
                    }
                ),
                encoding="utf-8",
            )
            (data_dir / "benefits" / "seeds.json").write_text(
                json.dumps(
                    {
                        "version": "0.1.0",
                        "domain": "benefits",
                        "seeds": [],
                    }
                ),
                encoding="utf-8",
            )

            report = TopicDiscovery(data_dir).sync_seed_manifest("benefits")
            payload = json.loads((data_dir / "benefits" / "seeds.json").read_text(encoding="utf-8"))

            self.assertEqual(report["seedCount"], 1)
            seed = payload["seeds"][0]
            self.assertEqual(seed["source"], "arbeitsagentur")
            self.assertIn("buergergeld", seed["topics"])
            self.assertIn("financial_support", seed["topics"])
            self.assertIn("official_rule_source", seed["tags"])
            self.assertIn("unemployed", seed["targetGroups"])

    def test_sync_topic_seeds_filters_by_requested_topic(self):
        with tempfile.TemporaryDirectory() as tmp:
            data_dir = Path(tmp) / "data"
            (data_dir / "_topics").mkdir(parents=True)
            (data_dir / "contacts").mkdir(parents=True)
            (data_dir / "_sources").mkdir(parents=True)

            (data_dir / "_sources" / "registered_sources.json").write_text(
                json.dumps(
                    {
                        "sources": [
                            {
                                "id": "bmas",
                                "name": "BMAS",
                                "baseUrl": "https://www.bmas.de",
                                "domains": ["contacts"],
                                "sourceTier": "tier_1_official",
                                "institutionType": "government",
                                "jurisdiction": "DE",
                                "defaultTargetGroups": ["general_public"],
                            }
                        ]
                    }
                ),
                encoding="utf-8",
            )
            (data_dir / "_topics" / "trusted_topic_sources.json").write_text(
                json.dumps(
                    {
                        "topics": [
                            {
                                "id": "kontakt_arbeitsagentur",
                                "name": "Kontakt Arbeitsagentur",
                                "domains": ["contacts"],
                                "keywords": ["kontakt"],
                                "sources": [],
                            },
                            {
                                "id": "regelbedarf",
                                "name": "Regelbedarf",
                                "domains": ["contacts"],
                                "keywords": ["regelbedarf"],
                                "sources": [
                                    {
                                        "sourceId": "bmas",
                                        "role": "official_contact_source",
                                        "priority": "high",
                                        "seedUrls": [
                                            "https://www.bmas.de/DE/Service/Kontakt/Buergertelefon/buergertelefon.html"
                                        ],
                                    }
                                ],
                            },
                        ]
                    }
                ),
                encoding="utf-8",
            )
            (data_dir / "contacts" / "seeds.json").write_text(
                json.dumps({"version": "0.1.0", "domain": "contacts", "seeds": []}),
                encoding="utf-8",
            )

            report = TopicDiscovery(data_dir).sync_seed_manifest("contacts", topic_ids=["regelbedarf"])
            payload = json.loads((data_dir / "contacts" / "seeds.json").read_text(encoding="utf-8"))

            self.assertEqual(report["topicIds"], ["regelbedarf"])
            self.assertEqual(len(payload["seeds"]), 1)
            self.assertTrue(payload["seeds"][0]["url"].endswith("buergertelefon.html"))

    def test_sync_topic_seeds_allows_trusted_tool_sources_for_tools(self):
        with tempfile.TemporaryDirectory() as tmp:
            data_dir = Path(tmp) / "data"
            (data_dir / "_topics").mkdir(parents=True)
            (data_dir / "tools").mkdir(parents=True)
            (data_dir / "_sources").mkdir(parents=True)

            (data_dir / "_sources" / "registered_sources.json").write_text(
                json.dumps(
                    {
                        "sources": [
                            {
                                "id": "dasstehtdirzu",
                                "name": "Das steht dir zu",
                                "baseUrl": "https://www.das-steht-dir-zu.de",
                                "domains": ["tools"],
                                "sourceTier": "tier_2_ngo_watchdog",
                                "institutionType": "advisory",
                                "jurisdiction": "DE",
                                "defaultTargetGroups": ["unemployed", "general_public"],
                            }
                        ]
                    }
                ),
                encoding="utf-8",
            )
            (data_dir / "_topics" / "trusted_topic_sources.json").write_text(
                json.dumps(
                    {
                        "topics": [
                            {
                                "id": "buergergeld_rechner",
                                "name": "Buergergeld Rechner",
                                "domains": ["tools"],
                                "keywords": ["rechner"],
                                "sources": [
                                    {
                                        "sourceId": "dasstehtdirzu",
                                        "role": "trusted_tool_source",
                                        "priority": "critical",
                                        "seedUrls": [
                                            "https://www.das-steht-dir-zu.de/arbeit/buergergeld/der-buergergeld-rechner/index.html"
                                        ],
                                    }
                                ],
                            }
                        ]
                    }
                ),
                encoding="utf-8",
            )
            (data_dir / "tools" / "seeds.json").write_text(
                json.dumps({"version": "0.1.0", "domain": "tools", "seeds": []}),
                encoding="utf-8",
            )

            report = TopicDiscovery(data_dir).sync_seed_manifest("tools")
            payload = json.loads((data_dir / "tools" / "seeds.json").read_text(encoding="utf-8"))

            self.assertEqual(report["seedCount"], 1)
            self.assertEqual(payload["seeds"][0]["source"], "dasstehtdirzu")
            self.assertIn("trusted_tool_source", payload["seeds"][0]["tags"])


if __name__ == "__main__":
    unittest.main()
