import json
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from crawlers.shared.topic_discovery import TopicDiscovery, TopicRegistry


def _write_urls(base: Path, domain: str, urls: list[str]):
    domain_dir = base / domain
    domain_dir.mkdir(parents=True, exist_ok=True)
    (domain_dir / 'urls.json').write_text(
        json.dumps(
            {
                'version': '0.1.0',
                'domain': domain,
                'urls': urls,
            }
        ),
        encoding='utf-8',
    )


class TopicDiscoveryTests(unittest.TestCase):
    def test_topic_discovery_prefers_seed_and_glossary_sources(self):
        with TemporaryDirectory() as temp_dir:
            data_dir = Path(temp_dir) / 'data'
            (data_dir / '_sources').mkdir(parents=True, exist_ok=True)
            (data_dir / '_topics').mkdir(parents=True, exist_ok=True)

            (data_dir / '_sources' / 'registered_sources.json').write_text(
                json.dumps(
                    {
                        'sources': [
                            {
                                'id': 'arbeitsagentur',
                                'name': 'Bundesagentur fuer Arbeit',
                                'baseUrl': 'https://www.arbeitsagentur.de',
                                'domains': ['benefits', 'aid'],
                                'sourceTier': 'tier_1_official',
                                'institutionType': 'government',
                            },
                            {
                                'id': 'sanktionsfrei',
                                'name': 'Sanktionsfrei',
                                'baseUrl': 'https://sanktionsfrei.de',
                                'domains': ['aid'],
                                'sourceTier': 'tier_2_ngo_watchdog',
                                'institutionType': 'ngo',
                            },
                        ]
                    }
                ),
                encoding='utf-8',
            )

            (data_dir / '_topics' / 'trusted_topic_sources.json').write_text(
                json.dumps(
                    {
                        'topics': [
                            {
                                'id': 'buergergeld',
                                'name': 'Buergergeld',
                                'domains': ['benefits', 'aid'],
                                'keywords': ['buergergeld', 'bedarfsgemeinschaft'],
                                'sources': [
                                    {
                                        'sourceId': 'arbeitsagentur',
                                        'role': 'official_rule_source',
                                        'priority': 'critical',
                                        'preferredPathPatterns': ['/arbeitslos-arbeit-finden/buergergeld/', '/lexikon/'],
                                        'seedUrls': [
                                            'https://www.arbeitsagentur.de/arbeitslos-arbeit-finden/buergergeld/finanziell-absichern/antrag-bescheid'
                                        ],
                                    },
                                    {
                                        'sourceId': 'sanktionsfrei',
                                        'role': 'ngo_context_source',
                                        'priority': 'high',
                                        'preferredPathPatterns': ['/studie'],
                                        'seedUrls': ['https://sanktionsfrei.de/studie25'],
                                    },
                                ],
                            }
                        ]
                    }
                ),
                encoding='utf-8',
            )

            _write_urls(
                data_dir,
                'benefits',
                [
                    'https://www.arbeitsagentur.de/impressum',
                    'https://www.arbeitsagentur.de/lexikon/bedarfsgemeinschaft',
                    'https://www.arbeitsagentur.de/arbeitslos-arbeit-finden/buergergeld/finanziell-absichern/antrag-bescheid',
                ],
            )
            _write_urls(
                data_dir,
                'aid',
                [
                    'https://sanktionsfrei.de/studie25',
                    'https://sanktionsfrei.de/meta/impressum',
                ],
            )

            discovery = TopicDiscovery(data_dir)
            report = discovery.discover('buergergeld', limit=5, persist=False)

            top_candidates = report['topCandidates']
            self.assertTrue(top_candidates[0]['url'].endswith('/antrag-bescheid'))
            self.assertTrue(any(item['url'].endswith('/lexikon/bedarfsgemeinschaft') for item in top_candidates))
            self.assertTrue(any(item['url'].endswith('/studie25') for item in top_candidates))
            self.assertTrue(all('/impressum' not in item['url'] for item in top_candidates))

    def test_topic_registry_matches_free_text_query(self):
        with TemporaryDirectory() as temp_dir:
            data_dir = Path(temp_dir) / 'data'
            (data_dir / '_topics').mkdir(parents=True, exist_ok=True)

            (data_dir / '_topics' / 'trusted_topic_sources.json').write_text(
                json.dumps(
                    {
                        'topics': [
                            {
                                'id': 'buergergeld',
                                'name': 'Buergergeld',
                                'domains': ['benefits'],
                                'keywords': ['buergergeld', 'bedarfsgemeinschaft'],
                                'sources': [],
                            },
                            {
                                'id': 'kinderzuschlag',
                                'name': 'Kinderzuschlag',
                                'domains': ['benefits'],
                                'keywords': ['kinderzuschlag', 'familie'],
                                'sources': [],
                            },
                        ]
                    }
                ),
                encoding='utf-8',
            )

            registry = TopicRegistry(data_dir)
            matches = registry.match_query('Wie beantrage ich Kinderzuschlag fuer meine Familie?')

            self.assertEqual(matches[0].topic_id, 'kinderzuschlag')
            self.assertTrue(all(topic.topic_id != 'buergergeld' for topic in matches[1:]))

    def test_topic_registry_prefers_specific_subtopic_match(self):
        with TemporaryDirectory() as temp_dir:
            data_dir = Path(temp_dir) / 'data'
            (data_dir / '_topics').mkdir(parents=True, exist_ok=True)

            (data_dir / '_topics' / 'trusted_topic_sources.json').write_text(
                json.dumps(
                    {
                        'topics': [
                            {
                                'id': 'buergergeld',
                                'name': 'Buergergeld',
                                'domains': ['benefits'],
                                'keywords': ['buergergeld', 'bedarf'],
                                'sources': [],
                            },
                            {
                                'id': 'mehrbedarf',
                                'name': 'Mehrbedarf',
                                'domains': ['benefits'],
                                'keywords': ['mehrbedarf', 'sonderbedarf', 'zuschlag'],
                                'sources': [],
                            },
                        ]
                    }
                ),
                encoding='utf-8',
            )

            registry = TopicRegistry(data_dir)
            matches = registry.match_query('Wann bekomme ich Mehrbedarf beim Buergergeld?')

            self.assertEqual(matches[0].topic_id, 'mehrbedarf')

    def test_topic_registry_matches_procedural_topic(self):
        with TemporaryDirectory() as temp_dir:
            data_dir = Path(temp_dir) / 'data'
            (data_dir / '_topics').mkdir(parents=True, exist_ok=True)

            (data_dir / '_topics' / 'trusted_topic_sources.json').write_text(
                json.dumps(
                    {
                        'topics': [
                            {
                                'id': 'buergergeld',
                                'name': 'Buergergeld',
                                'domains': ['benefits'],
                                'keywords': ['buergergeld'],
                                'sources': [],
                            },
                            {
                                'id': 'antrag_bescheid',
                                'name': 'Antrag und Bescheid',
                                'domains': ['benefits'],
                                'keywords': ['antrag', 'bescheid', 'beantragen', 'formular'],
                                'sources': [],
                            },
                        ]
                    }
                ),
                encoding='utf-8',
            )

            registry = TopicRegistry(data_dir)
            matches = registry.match_query('Wie funktioniert der Antrag und wann kommt der Bescheid?')

            self.assertEqual(matches[0].topic_id, 'antrag_bescheid')

    def test_topic_registry_matches_glossary_topic(self):
        with TemporaryDirectory() as temp_dir:
            data_dir = Path(temp_dir) / 'data'
            (data_dir / '_topics').mkdir(parents=True, exist_ok=True)

            (data_dir / '_topics' / 'trusted_topic_sources.json').write_text(
                json.dumps(
                    {
                        'topics': [
                            {
                                'id': 'buergergeld',
                                'name': 'Buergergeld',
                                'domains': ['benefits'],
                                'keywords': ['buergergeld'],
                                'sources': [],
                            },
                            {
                                'id': 'aufstocker',
                                'name': 'Aufstocker',
                                'domains': ['benefits'],
                                'keywords': ['aufstocker', 'einkommen ergaenzen', 'zusaetzliches einkommen'],
                                'sources': [],
                            },
                        ]
                    }
                ),
                encoding='utf-8',
            )

            registry = TopicRegistry(data_dir)
            matches = registry.match_query('Was bedeutet Aufstocker?')

            self.assertEqual(matches[0].topic_id, 'aufstocker')


if __name__ == '__main__':
    unittest.main()
