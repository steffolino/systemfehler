import unittest
from unittest.mock import patch

from backend.ai_service import retrieval


class RetrievalTopicRoleTests(unittest.TestCase):
    def test_topic_role_boost_prefers_official_rule_source_for_buergergeld(self):
        topic_registry = [
            {
                "id": "buergergeld",
                "keywords": ["buergergeld", "bedarfsgemeinschaft"],
                "sources": [
                    {
                        "sourceId": "arbeitsagentur",
                        "role": "official_rule_source",
                        "preferredPathPatterns": ["/arbeitslos-arbeit-finden/buergergeld/"],
                    }
                ],
            }
        ]
        source_hosts = {"arbeitsagentur": "arbeitsagentur.de"}
        entry = {
            "url": "https://www.arbeitsagentur.de/arbeitslos-arbeit-finden/buergergeld/finanziell-absichern/antrag-bescheid",
            "provenance": {"source": "https://www.arbeitsagentur.de"},
        }

        with patch.object(retrieval, "_load_topic_registry", return_value=topic_registry), patch.object(
            retrieval, "_load_registered_source_hosts", return_value=source_hosts
        ):
            boost = retrieval._topic_role_boost(
                entry,
                "Wie beantrage ich Buergergeld?",
                ["buergergeld", "antrag"],
                {"application"},
            )

        self.assertGreaterEqual(boost, 6.0)

    def test_topic_role_boost_prefers_glossary_sources_for_definition_terms(self):
        topic_registry = [
            {
                "id": "buergergeld",
                "keywords": ["buergergeld", "bedarfsgemeinschaft"],
                "sources": [
                    {
                        "sourceId": "arbeitsagentur",
                        "role": "official_glossary_source",
                        "preferredPathPatterns": ["/lexikon/"],
                    }
                ],
            }
        ]
        source_hosts = {"arbeitsagentur": "arbeitsagentur.de"}
        entry = {
            "url": "https://www.arbeitsagentur.de/lexikon/bedarfsgemeinschaft",
            "provenance": {"source": "https://www.arbeitsagentur.de"},
        }

        with patch.object(retrieval, "_load_topic_registry", return_value=topic_registry), patch.object(
            retrieval, "_load_registered_source_hosts", return_value=source_hosts
        ):
            boost = retrieval._topic_role_boost(
                entry,
                "Was bedeutet Bedarfsgemeinschaft?",
                ["bedarfsgemeinschaft"],
                set(),
            )

        self.assertGreaterEqual(boost, 5.0)


if __name__ == "__main__":
    unittest.main()
