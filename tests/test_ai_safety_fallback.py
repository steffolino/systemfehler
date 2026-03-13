import pytest
from fastapi.testclient import TestClient
from backend.ai_service.gateway import app

client = TestClient(app)

def test_synthesize_fallback_for_unsupported_query():
    # Query unlikely to match any evidence
    response = client.post("/synthesize", json={"query": "unsupported random query"})
    assert response.status_code == 200
    data = response.json()
    assert data["fallback"] is True
    assert data["answer"] is None
    assert "Keine verlässliche Information gefunden." in data["explanation"]
    assert data["sources"] == []

def test_synthesize_success_for_supported_query():
    # Query matches seeded entry title
    response = client.post("/synthesize", json={"query": "Bürgergeld"})
    assert response.status_code == 200
    data = response.json()
    assert data["fallback"] is False
    assert data["answer"] is not None
    assert "Antwort basiert auf verlässlichen Daten." in data["explanation"]
    assert len(data["sources"]) > 0
