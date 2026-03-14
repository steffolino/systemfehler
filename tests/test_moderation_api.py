import os
import json
import tempfile
import shutil
import pytest
from moderation import api
from crawlers.shared import moderation_queue

@pytest.fixture
def temp_queue_file(monkeypatch):
    # Copy the real queue to a temp file for isolated tests
    orig_path = api.QUEUE_PATH
    with tempfile.TemporaryDirectory() as tmpdir:
        temp_path = os.path.join(tmpdir, 'review_queue.json')
        shutil.copyfile(orig_path, temp_path)
        monkeypatch.setattr(api, 'QUEUE_PATH', temp_path)
        yield temp_path

@pytest.fixture
def sample_queue():
    # Use canonicalized entries from the real queue
    with open(api.QUEUE_PATH, encoding='utf-8') as f:
        return moderation_queue.canonicalize_queue_payload(json.load(f))

def test_read_queue_returns_canonical_entries(temp_queue_file, sample_queue):
    entries = api.read_queue()
    assert isinstance(entries, list)
    for entry in entries:
        errors = moderation_queue.validate_queue_entry(entry)
        assert not errors

def test_write_queue_roundtrip(temp_queue_file, sample_queue):
    api.write_queue(sample_queue)
    loaded = api.read_queue()
    assert loaded == sample_queue

def test_get_entries_file_for_domain_valid():
    for domain in api.ALLOWED_DOMAINS:
        path = api.get_entries_file_for_domain(domain)
        assert path is not None
        assert domain in path

def test_get_entries_file_for_domain_invalid():
    assert api.get_entries_file_for_domain('notadomain') is None
