import pytest
from services.api.api_service import ApiService

def test_get_success(monkeypatch):
    api = ApiService(base_url='http://test/')
    def fake_get(url, params=None, **kwargs):
        class Resp:
            def raise_for_status(self): pass
            def json(self): return {'ok': True}
        assert url == 'http://test/endpoint'
        return Resp()
    monkeypatch.setattr('requests.get', fake_get)
    assert api.get('endpoint') == {'ok': True}

def test_post_success(monkeypatch):
    api = ApiService(base_url='http://test/')
    def fake_post(url, data=None, json=None, **kwargs):
        class Resp:
            def raise_for_status(self): pass
            def json(self): return {'posted': True}
        assert url == 'http://test/endpoint'
        return Resp()
    monkeypatch.setattr('requests.post', fake_post)
    assert api.post('endpoint', json={'foo': 'bar'}) == {'posted': True}
