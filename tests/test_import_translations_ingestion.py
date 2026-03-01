import json
import sys
import types
from pathlib import Path

from crawlers import cli


def test_import_to_db_includes_translations_and_provenance(monkeypatch, tmp_path):
    data_dir = tmp_path / 'data' / 'benefits'
    data_dir.mkdir(parents=True, exist_ok=True)

    entry = {
        'id': '22222222-2222-4222-8222-222222222222',
        'title': {'de': 'Titel'},
        'summary': {'de': 'Kurz'},
        'content': {'de': 'Inhalt'},
        'url': 'https://example.org/benefit',
        'topics': ['housing'],
        'tags': ['pilot'],
        'targetGroups': ['families'],
        'status': 'active',
        'firstSeen': '2026-01-01T00:00:00Z',
        'lastSeen': '2026-01-02T00:00:00Z',
        'sourceUnavailable': False,
        'provenance': {'source': 'example.org', 'crawledAt': '2026-01-01T00:00:00Z'},
        'translations': {
            'de-LEICHT': {
                'title': 'Leichter Titel',
                'timestamp': '2026-01-01T00:00:00Z',
                'provenance': {'source': 'example.org', 'crawledAt': '2026-01-01T00:00:00Z'}
            }
        },
        'qualityScores': {'iqs': 80, 'ais': 70, 'computedAt': '2026-01-01T00:00:00Z'},
        'benefitAmount': {'de': '100 EUR'},
        'eligibilityCriteria': {'de': 'Wohnsitz in DE'}
    }

    entries_file = data_dir / 'entries.json'
    entries_file.write_text(json.dumps({'entries': [entry]}), encoding='utf-8')

    executed = []

    class FakeCursor:
        def execute(self, sql, params=None):
            executed.append((sql, params))

        def close(self):
            return None

    class FakeConn:
        def __init__(self):
            self.cursor_obj = FakeCursor()

        def cursor(self):
            return self.cursor_obj

        def commit(self):
            return None

        def rollback(self):
            return None

        def close(self):
            return None

    fake_conn = FakeConn()

    fake_psycopg2 = types.ModuleType('psycopg2')
    fake_psycopg2.connect = lambda _url: fake_conn

    fake_psycopg2_extras = types.ModuleType('psycopg2.extras')
    fake_psycopg2_extras.Json = lambda value: value

    monkeypatch.setitem(sys.modules, 'psycopg2', fake_psycopg2)
    monkeypatch.setitem(sys.modules, 'psycopg2.extras', fake_psycopg2_extras)
    monkeypatch.setenv('DATABASE_URL', 'postgresql://test/test')

    ok = cli.import_to_db('benefits', str(tmp_path / 'data'))
    assert ok is True

    entries_query = next(sql for (sql, _params) in executed if 'INSERT INTO entries' in sql)
    entries_params = next(params for (sql, params) in executed if 'INSERT INTO entries' in sql)

    assert 'translations' in entries_query
    assert len(entries_params) == 25
    assert entries_params[-3] == entry['provenance']
    assert entries_params[-2] == entry['translations']
