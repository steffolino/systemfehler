import datetime

from crawlers.shared.validator import SchemaValidator


def make_sample_entry():
    now = datetime.datetime.utcnow().isoformat() + 'Z'
    return {
        "id": "11111111-1111-4111-8111-111111111111",
        "title": "Beratung für Beispiel / Example Advice",
        "summary": {"de": "Kurzbeschreibung", "en": "Short summary"},
        "content": {"de": "Voller Inhalt", "en": "Full content"},
        "url": "https://example.org/service/1",
        "status": "active",
        "provenance": {"source": "example.org", "crawledAt": now},
        "firstSeen": now,
        "lastSeen": now,
        "topics": ["housing"],
        "tags": ["pilot"],
        "qualityScores": {"iqs": 80, "ais": 70, "computedAt": now},
        "translations": {
            "de-EINFACH": {
                "title": "Beratung in einfacher Sprache",
                "summary": "Kurze und klare Zusammenfassung.",
                "body": "Das ist ein gepruefter Text in einfacher Sprache.",
                "provenance": {"source": "example.org", "crawledAt": now},
                "method": "human",
                "generator": "editor",
                "timestamp": now,
                "reviewed": True,
                "variant": "einfach",
                "reviewStatus": "approved",
                "reviewedBy": "admin@example.org",
                "reviewedAt": now
            },
            "de-EINFACH-SUGGESTED": {
                "title": "Beratung (einfach vorgeschlagen)",
                "summary": "Kurze klare Zusammenfassung.",
                "body": "Das ist ein Vorschlag in einfacher Sprache.",
                "provenance": {"source": "example.org", "crawledAt": now},
                "method": "rule",
                "generator": "systemfehler-plain-language-v1",
                "timestamp": now,
                "reviewed": False,
                "variant": "einfach",
                "reviewStatus": "suggested"
            },
            "de-LEICHT": {
                "title": "Beratung (leicht)",
                "summary": "Kurze, einfache Zusammenfassung.",
                "body": "Einfacher Text in Leichter Sprache.",
                "provenance": {"source": "example.org", "crawledAt": now},
                "method": "llm",
                "generator": "test-model",
                "timestamp": now,
                "reviewed": False,
                "variant": "leicht",
                "reviewStatus": "suggested"
            },
            "en": {
                "title": "Advice (simple)",
                "summary": "Short simple summary.",
                "body": "Simplified text in English.",
                "provenance": {"source": "example.org", "crawledAt": now},
                "method": "mt",
                "generator": "test-mt",
                "timestamp": now,
                "reviewed": True
            }
        }
    }


def test_translations_validate_ok(tmp_path):
    # Use project schema directory
    # Use default SchemaValidator so it loads schemas from the repository
    v = SchemaValidator()

    entry = make_sample_entry()

    result = v.validate_entry(entry, domain='contacts')

    assert result['valid'], f"Validation failed: {result['errors']}"


def test_rejects_unknown_top_level_key():
    v = SchemaValidator()
    entry = make_sample_entry()
    entry['unexpectedField'] = 'not-allowed'

    result = v.validate_entry(entry, domain='contacts')

    assert result['valid'] is False
    assert any("Unknown top-level field 'unexpectedField'" in err for err in result['errors'])


def test_rejects_invalid_translation_payload():
    v = SchemaValidator()
    entry = make_sample_entry()
    entry['translations']['de-LEICHT']['extra'] = 'invalid'
    del entry['translations']['en']['provenance']

    result = v.validate_entry(entry, domain='contacts')

    assert result['valid'] is False
    assert any('translations.de-LEICHT: Unknown field' in err for err in result['errors'])
    assert any('translations.en.provenance: Missing required field' in err for err in result['errors'])


def test_rejects_invalid_plain_language_review_status():
    v = SchemaValidator()
    entry = make_sample_entry()
    entry['translations']['de-EINFACH-SUGGESTED']['reviewStatus'] = 'pending'

    result = v.validate_entry(entry, domain='contacts')

    assert result['valid'] is False
    assert any('translations.de-EINFACH-SUGGESTED.reviewStatus' in err for err in result['errors'])


def test_rejects_invalid_provenance_shape():
    v = SchemaValidator()
    entry = make_sample_entry()
    entry['provenance'] = 'example.org'

    result = v.validate_entry(entry, domain='contacts')

    assert result['valid'] is False
    assert any('provenance: Must be an object' in err for err in result['errors'])
