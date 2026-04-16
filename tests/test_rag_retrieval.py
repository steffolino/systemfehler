"""
Unit tests for hybrid RAG retrieval (backend/ai_service/vector_retrieval.py).
"""

import json
import unittest
from unittest.mock import MagicMock, patch

from backend.ai_service.vector_retrieval import (
    _rrf_fuse,
    _rrf_score,
    _token_overlap,
    hybrid_retrieve,
    rerank_vector_results,
)
from backend.ai_service.schemas import Evidence


# ---------------------------------------------------------------------------
# RRF helpers
# ---------------------------------------------------------------------------

class RrfScoreTests(unittest.TestCase):
    def test_first_rank_highest(self):
        self.assertGreater(_rrf_score(0), _rrf_score(1))
        self.assertGreater(_rrf_score(1), _rrf_score(10))

    def test_score_positive(self):
        for rank in range(20):
            self.assertGreater(_rrf_score(rank), 0.0)


class RrfFuseTests(unittest.TestCase):
    def _kw_item(self, url: str) -> dict:
        return {"id": url, "url": url, "title": "KW item"}

    def _vec_item(self, url: str, score: float = 0.8) -> dict:
        return {"chunk_id": url, "url": url, "title": "Vec item", "raw_score": score}

    def test_returns_sorted_by_score(self):
        kw = [self._kw_item(f"https://example.com/{i}") for i in range(5)]
        vec = [self._vec_item(f"https://example.com/{i}") for i in range(3)]
        fused = _rrf_fuse(kw, vec)
        scores = [s for s, _ in fused]
        self.assertEqual(scores, sorted(scores, reverse=True))

    def test_shared_item_gets_higher_score_than_exclusive(self):
        shared_url = "https://example.com/shared"
        kw = [self._kw_item(shared_url), self._kw_item("https://example.com/kw-only")]
        vec = [self._vec_item(shared_url, 0.9), self._vec_item("https://example.com/vec-only")]
        fused = _rrf_fuse(
            kw, vec,
            key_fn_kw=lambda e: e["url"],
            key_fn_vec=lambda e: e["url"],
        )
        score_map = {item["url"]: score for score, item in fused}
        self.assertGreater(score_map[shared_url], score_map.get("https://example.com/kw-only", 0.0))

    def test_empty_inputs_return_empty(self):
        self.assertEqual(_rrf_fuse([], []), [])

    def test_items_with_no_key_are_skipped(self):
        kw = [{"id": "", "title": "no key"}]
        vec = [{"chunk_id": "", "raw_score": 0.5}]
        result = _rrf_fuse(kw, vec)
        self.assertEqual(result, [])

    def test_origin_set_on_keyword_only(self):
        kw = [self._kw_item("https://a.com")]
        fused = _rrf_fuse(kw, [])
        _, item = fused[0]
        self.assertEqual(item["_origin"], "keyword")

    def test_origin_set_hybrid_for_shared(self):
        shared_url = "https://a.com"
        kw = [self._kw_item(shared_url)]
        vec = [self._vec_item(shared_url)]
        fused = _rrf_fuse(kw, vec, key_fn_kw=lambda e: e["url"], key_fn_vec=lambda e: e["url"])
        items = {item["url"]: item for _, item in fused}
        self.assertEqual(items[shared_url]["_origin"], "hybrid")


# ---------------------------------------------------------------------------
# Token overlap
# ---------------------------------------------------------------------------

class TokenOverlapTests(unittest.TestCase):
    def test_exact_match(self):
        score = _token_overlap("Bürgergeld Antrag", "Bürgergeld Antrag stellen")
        self.assertEqual(score, 1.0)

    def test_no_match(self):
        score = _token_overlap("Bürgergeld Antrag", "Steuererklärung Formular")
        self.assertEqual(score, 0.0)

    def test_partial_match(self):
        score = _token_overlap("Bürgergeld Antrag Voraussetzungen", "Bürgergeld Frist Antrag")
        self.assertGreater(score, 0.0)
        self.assertLess(score, 1.0)

    def test_empty_query(self):
        score = _token_overlap("", "Bürgergeld Antrag")
        self.assertEqual(score, 0.0)


# ---------------------------------------------------------------------------
# Reranker
# ---------------------------------------------------------------------------

class RerankerTests(unittest.TestCase):
    def _make_chunk(self, trust: str, layer: str, text: str = "x" * 200) -> dict:
        return {
            "chunk_id": f"{trust}-{layer}",
            "url": f"https://example.com/{trust}",
            "title": "Test",
            "text": text,
            "source_trust_level": trust,
            "knowledge_layer": layer,
            "raw_score": 0.75,
            "source_weight": 0.0,  # force computation from trust+layer
        }

    def test_law_tier_outranks_ngo(self):
        chunks = [
            self._make_chunk("tier_3_ngo", "ngo_guidance"),
            self._make_chunk("tier_1_law", "law"),
        ]
        ranked = rerank_vector_results("Bürgergeld beantragen", chunks)
        self.assertEqual(ranked[0]["source_trust_level"], "tier_1_law")

    def test_returns_same_count(self):
        chunks = [self._make_chunk("tier_2_official", "official_guidance") for _ in range(5)]
        ranked = rerank_vector_results("query", chunks)
        self.assertEqual(len(ranked), 5)

    def test_final_score_added(self):
        chunks = [self._make_chunk("tier_2_official", "official_guidance")]
        ranked = rerank_vector_results("query", chunks)
        self.assertIn("final_score", ranked[0])


# ---------------------------------------------------------------------------
# hybrid_retrieve
# ---------------------------------------------------------------------------

class HybridRetrieveTests(unittest.TestCase):
    def _make_keyword_entry(self, entry_id: str) -> dict:
        return {
            "id": entry_id,
            "url": f"https://example.com/{entry_id}",
            "title": "Keyword Entry",
            "summary": {"de": "Ein Eintrag aus der Datenbank."},
        }

    def test_fallback_keyword_only_when_rag_disabled(self):
        entries = [self._make_keyword_entry(f"entry-{i}") for i in range(4)]
        with patch("backend.ai_service.vector_retrieval._is_rag_enabled", return_value=False):
            results = hybrid_retrieve("Bürgergeld", entries)
        self.assertIsInstance(results, list)
        self.assertGreater(len(results), 0)
        for ev in results:
            self.assertIsInstance(ev, Evidence)

    def test_confidence_in_range(self):
        entries = [self._make_keyword_entry("entry-1")]
        with patch("backend.ai_service.vector_retrieval._is_rag_enabled", return_value=False):
            results = hybrid_retrieve("Bürgergeld", entries)
        for ev in results:
            self.assertGreaterEqual(ev.confidence, 0.0)
            self.assertLessEqual(ev.confidence, 1.0)

    def test_rag_chunk_evidence_has_provenance(self):
        """When Qdrant returns chunks, evidence payload must include provenance."""
        fake_chunk = {
            "chunk_id": "ba_merkblatt_buergergeld-c0000",
            "document_id": "ba_merkblatt_buergergeld",
            "source_id": "ba_merkblatt_buergergeld",
            "title": "Merkblatt Bürgergeld",
            "section_title": "Anspruchsvoraussetzungen",
            "url": "https://www.arbeitsagentur.de/datei/test.pdf",
            "source_name": "Bundesagentur für Arbeit",
            "source_trust_level": "tier_2_official",
            "document_type": "merkblatt",
            "knowledge_layer": "official_guidance",
            "topics": ["employment"],
            "publication_date": "2024-01",
            "text": "Sie haben Anspruch auf Bürgergeld wenn ...",
            "raw_score": 0.88,
            "source_weight": 1.5,
        }

        mock_indexer = MagicMock()
        mock_indexer.search.return_value = [fake_chunk]

        with (
            patch("backend.ai_service.vector_retrieval._is_rag_enabled", return_value=True),
            patch("backend.ai_service.vector_retrieval._get_indexer", return_value=mock_indexer),
        ):
            results = hybrid_retrieve("Bürgergeld beantragen", [])

        self.assertGreater(len(results), 0)
        rag_results = [ev for ev in results if ev.source == "rag"]
        self.assertGreater(len(rag_results), 0)

        payload = json.loads(rag_results[0].content)
        provenance = payload.get("provenance", {})
        self.assertIn("source_trust_level", provenance)
        self.assertIn("knowledge_layer", provenance)
        self.assertIn("section_title", provenance)
        self.assertEqual(provenance["source_trust_level"], "tier_2_official")
        self.assertEqual(provenance["knowledge_layer"], "official_guidance")

    def test_returns_list_of_evidence(self):
        with patch("backend.ai_service.vector_retrieval._is_rag_enabled", return_value=False):
            results = hybrid_retrieve("query", [])
        self.assertIsInstance(results, list)
        # Empty input + RAG disabled → single "no evidence" item or empty
        # (the function appends a placeholder)


if __name__ == "__main__":
    unittest.main()
