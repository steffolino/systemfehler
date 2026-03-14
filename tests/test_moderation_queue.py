import json
import os
import pytest
from crawlers.shared import moderation_queue

REVIEW_QUEUE_PATH = os.path.join(os.path.dirname(__file__), '../moderation/review_queue.json')
SCHEMA_PATH = os.path.join(os.path.dirname(__file__), '../data/_schemas/moderation_queue.schema.json')

@pytest.fixture
def review_queue_entries():
    with open(REVIEW_QUEUE_PATH, encoding='utf-8') as f:
        return json.load(f)

def test_review_queue_entries_canonical_and_valid(review_queue_entries):
    for entry in review_queue_entries:
        canonical = moderation_queue.canonicalize_queue_entry(entry)
        errors = moderation_queue.validate_queue_entry(canonical)
        assert not errors, f"Entry {canonical.get('id')} failed validation: {errors}"

def test_review_queue_entries_schema(review_queue_entries):
    import jsonschema
    with open(SCHEMA_PATH, encoding='utf-8') as f:
        schema = json.load(f)
    for entry in review_queue_entries:
        canonical = moderation_queue.canonicalize_queue_entry(entry)
        jsonschema.validate(instance=canonical, schema=schema)
