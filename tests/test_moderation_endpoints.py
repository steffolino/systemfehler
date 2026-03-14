import os
import subprocess
import time
import requests
import tempfile
import shutil
import pytest
from moderation import api

PORT = 8999
BASE_URL = f'http://127.0.0.1:{PORT}'

@pytest.fixture(scope='module')
def moderation_server():
    # Use a temp queue file for isolation
    orig_path = api.QUEUE_PATH
    with tempfile.TemporaryDirectory() as tmpdir:
        temp_path = os.path.join(tmpdir, 'review_queue.json')
        shutil.copyfile(orig_path, temp_path)
        # Patch QUEUE_PATH for the server
        api.QUEUE_PATH = temp_path
        # Start the server as a subprocess
        proc = subprocess.Popen(['python', '-m', 'moderation.api', str(PORT)])
        time.sleep(1.5)  # Wait for server to start
        try:
            yield
        finally:
            proc.terminate()
            proc.wait()
            api.QUEUE_PATH = orig_path


def test_queue_endpoint(moderation_server):
    r = requests.get(f'{BASE_URL}/api/queue')
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert all('id' in entry for entry in data)

def test_review_accept_and_reject(moderation_server):
    # Get a pending entry
    r = requests.get(f'{BASE_URL}/api/queue')
    entry = next(e for e in r.json() if e['status'] == 'pending')
    payload = {'domain': entry['domain'], 'entry_id': entry['entryId'], 'decision': 'accept'}
    r2 = requests.post(f'{BASE_URL}/api/review', json=payload)
    assert r2.status_code == 200
    # Confirm status changed
    r3 = requests.get(f'{BASE_URL}/api/queue')
    updated = next(e for e in r3.json() if e['id'] == entry['id'])
    assert updated['status'] == 'accepted'
    # Now reject
    payload['decision'] = 'reject'
    r4 = requests.post(f'{BASE_URL}/api/review', json=payload)
    assert r4.status_code == 200
    r5 = requests.get(f'{BASE_URL}/api/queue')
    updated2 = next(e for e in r5.json() if e['id'] == entry['id'])
    assert updated2['status'] == 'rejected'

def test_review_batch(moderation_server):
    r = requests.get(f'{BASE_URL}/api/queue')
    pending = [e for e in r.json() if e['status'] == 'pending'][:2]
    actions = [{'domain': e['domain'], 'entryId': e['entryId'], 'decision': 'accept'} for e in pending]
    r2 = requests.post(f'{BASE_URL}/api/review/batch', json={'actions': actions})
    assert r2.status_code == 200
    result = r2.json()
    assert 'updated' in result
    for upd in result['updated']:
        assert upd['status'] == 'accepted'
