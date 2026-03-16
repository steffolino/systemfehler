import json

from crawlers.shared.topic_discovery import TopicDiscovery


def _write_urls(base, domain, urls):
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


def test_topic_discovery_prefers_seed_and_glossary_sources(tmp_path):
    data_dir = tmp_path / 'data'
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
                    }
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
                                ]
                            },
                            {
                                'sourceId': 'sanktionsfrei',
                                'role': 'ngo_context_source',
                                'priority': 'high',
                                'preferredPathPatterns': ['/studie'],
                                'seedUrls': ['https://sanktionsfrei.de/studie25']
                            }
                        ]
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
    assert top_candidates[0]['url'].endswith('/antrag-bescheid')
    assert any(item['url'].endswith('/lexikon/bedarfsgemeinschaft') for item in top_candidates)
    assert any(item['url'].endswith('/studie25') for item in top_candidates)
    assert all('/impressum' not in item['url'] for item in top_candidates)
