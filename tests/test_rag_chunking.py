"""
Unit tests for section-aware RAG chunking (crawlers/rag/chunk_docs.py).
"""

import unittest

from crawlers.rag.chunk_docs import _parse_sections, chunk_document
from crawlers.rag.schemas import (
    DocumentType,
    IngestStatus,
    KnowledgeLayer,
    RagDocument,
    SourceTrustLevel,
)

_INGEST_OK = IngestStatus.OK


def _make_doc(text: str, doc_id: str = "test-doc") -> RagDocument:
    return RagDocument(
        document_id=doc_id,
        source_id="test-source",
        title="Testdokument",
        url="https://example.com/test",
        source_name="Test Source",
        source_trust_level=SourceTrustLevel.TIER_2_OFFICIAL,
        document_type=DocumentType.MERKBLATT,
        knowledge_layer=KnowledgeLayer.OFFICIAL_GUIDANCE,
        language="de",
        jurisdiction="DE",
        topics=["employment"],
        target_groups=["general_public"],
        text=text,
        content_hash="",
        last_checked_at="2024-01-01T00:00:00Z",
        status=_INGEST_OK,
    )


class ParseSectionsTests(unittest.TestCase):
    def test_no_headings_single_section(self):
        text = "Dies ist ein Absatz.\n\nNoch ein Absatz."
        sections = _parse_sections(text)
        self.assertEqual(len(sections), 1)
        self.assertEqual(sections[0].heading, "")

    def test_heading_creates_two_sections(self):
        text = "Preamble text.\n\n## Abschnitt A\n\nBody of A."
        sections = _parse_sections(text)
        self.assertGreaterEqual(len(sections), 2)
        headings = [s.heading for s in sections]
        self.assertIn("Abschnitt A", headings)

    def test_multiple_heading_levels(self):
        text = (
            "# Titel\n\nEinleitung.\n\n"
            "## Abschnitt 1\n\nText 1.\n\n"
            "### Unterabschnitt\n\nText 1.1.\n\n"
            "## Abschnitt 2\n\nText 2."
        )
        sections = _parse_sections(text)
        headings = [s.heading for s in sections if s.heading]
        self.assertIn("Abschnitt 1", headings)
        self.assertIn("Unterabschnitt", headings)
        self.assertIn("Abschnitt 2", headings)

    def test_empty_text_returns_empty(self):
        sections = _parse_sections("")
        self.assertEqual(sections, [])

    def test_only_headings_no_body_skipped(self):
        text = "## Section A\n\n## Section B\n\nBody for B."
        sections = _parse_sections(text)
        # Section A has no body → should be skipped
        for s in sections:
            self.assertTrue(s.text.strip(), "Empty-body sections should be filtered")


class ChunkDocumentTests(unittest.TestCase):
    def test_empty_document_returns_no_chunks(self):
        doc = _make_doc("")
        chunks = chunk_document(doc)
        self.assertEqual(chunks, [])

    def test_chunks_have_provenance_fields(self):
        doc = _make_doc("Ein Absatz.\n\nNoch ein Absatz.")
        chunks = chunk_document(doc)
        self.assertGreater(len(chunks), 0)
        for chunk in chunks:
            self.assertEqual(chunk.source_id, "test-source")
            self.assertEqual(chunk.url, "https://example.com/test")
            self.assertEqual(chunk.source_trust_level, SourceTrustLevel.TIER_2_OFFICIAL)
            self.assertEqual(chunk.knowledge_layer, KnowledgeLayer.OFFICIAL_GUIDANCE)
            self.assertEqual(chunk.document_type, DocumentType.MERKBLATT)

    def test_chunk_ids_are_unique(self):
        text = "\n\n".join(f"Absatz {i} mit etwas Text." for i in range(20))
        doc = _make_doc(text)
        chunks = chunk_document(doc)
        ids = [c.chunk_id for c in chunks]
        self.assertEqual(len(ids), len(set(ids)), "chunk_ids must be unique")

    def test_total_chunks_backfilled(self):
        text = "\n\n".join(f"Absatz {i}." for i in range(5))
        doc = _make_doc(text)
        chunks = chunk_document(doc)
        expected = len(chunks)
        for chunk in chunks:
            self.assertEqual(chunk.total_chunks, expected)

    def test_char_offsets_are_non_negative(self):
        text = "Erster Absatz.\n\nZweiter Absatz.\n\nDritter Absatz."
        doc = _make_doc(text)
        chunks = chunk_document(doc)
        for chunk in chunks:
            self.assertGreaterEqual(chunk.char_start, 0)
            self.assertGreaterEqual(chunk.char_end, chunk.char_start)

    def test_section_heading_propagates_to_chunk(self):
        text = "## Antragsvoraussetzungen\n\nSie müssen folgende Bedingungen erfüllen."
        doc = _make_doc(text)
        chunks = chunk_document(doc)
        self.assertGreater(len(chunks), 0)
        self.assertEqual(chunks[0].section_title, "Antragsvoraussetzungen")

    def test_max_chars_respected(self):
        # Create a single long paragraph well above the limit
        long_para = "x" * 2000
        doc = _make_doc(long_para)
        chunks = chunk_document(doc, max_chars=900)
        for chunk in chunks:
            self.assertLessEqual(
                len(chunk.text),
                900 + 200,  # allow small overshoot from heading prefix
                f"Chunk too long: {len(chunk.text)} chars",
            )

    def test_topics_and_target_groups_propagated(self):
        doc = _make_doc("Kurzer Text.")
        doc.topics = ["employment", "financial_support"]
        doc.target_groups = ["unemployed"]
        chunks = chunk_document(doc)
        for chunk in chunks:
            self.assertIn("employment", chunk.topics)
            self.assertIn("unemployed", chunk.target_groups)

    def test_chunk_index_sequential(self):
        text = "\n\n".join(f"Absatz {i} mit Text." for i in range(10))
        doc = _make_doc(text)
        chunks = chunk_document(doc)
        for expected_idx, chunk in enumerate(chunks):
            self.assertEqual(chunk.chunk_index, expected_idx)


if __name__ == "__main__":
    unittest.main()
