"""
Section-aware chunking for the systemfehler RAG pipeline.

Strategy:
  1. Parse the normalized text into sections delimited by Markdown headings
     (# / ## / ### prefixes produced by extract.py from HTML, or implied
     structure in PDFs).
  2. Split each section into overlap-aware character chunks (max 900 chars,
     140-char overlap with the previous chunk).
  3. Every chunk carries:
     - its own text
     - the nearest heading (section_title)
     - char_start / char_end relative to the full document text
     - full provenance from the parent RagDocument

This preserves semantic coherence far better than naive fixed-length splits.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import NamedTuple

from .schemas import (
    DocumentType,
    KnowledgeLayer,
    RagChunk,
    RagDocument,
    SourceTrustLevel,
)


# ---------------------------------------------------------------------------
# Section parsing
# ---------------------------------------------------------------------------

class Section(NamedTuple):
    heading: str          # "" for preamble before first heading
    text: str             # body text under this heading (excluding the heading line)
    char_start: int       # absolute offset in full document text


_HEADING_RE = re.compile(r"^(#{1,4})\s+(.+)$", re.MULTILINE)


def _parse_sections(text: str) -> list[Section]:
    """
    Split normalized document text into sections on Markdown headings.

    Falls back to a single section containing the entire text if no headings
    are found.
    """
    sections: list[Section] = []
    last_end = 0
    last_heading = ""
    last_heading_end = 0

    for match in _HEADING_RE.finditer(text):
        body = text[last_heading_end:match.start()].strip()
        if body or last_heading:
            sections.append(Section(
                heading=last_heading,
                text=body,
                char_start=last_end,
            ))
        last_heading = match.group(2).strip()
        last_heading_end = match.end()
        last_end = match.start()

    # Final section (after last heading)
    tail = text[last_heading_end:].strip()
    if tail or last_heading:
        sections.append(Section(
            heading=last_heading,
            text=tail,
            char_start=last_end,
        ))

    # Fallback: no headings found
    if not sections:
        sections.append(Section(heading="", text=text.strip(), char_start=0))

    return [s for s in sections if s.text.strip()]


# ---------------------------------------------------------------------------
# Overlap-aware text splitting within a section
# ---------------------------------------------------------------------------

def _split_section(text: str, max_chars: int, overlap_chars: int) -> list[tuple[str, int]]:
    """
    Split text into (chunk_text, relative_char_start) pairs.

    Splits on paragraph boundaries (double newlines) where possible.
    Falls back to hard splits for very long paragraphs.
    Returns offset relative to the start of the section text.
    """
    paragraphs = [(p.strip(), m.start()) for m, p in [
        (m, text[m.start():m.end()]) for m in re.finditer(r"[^\n][^\n]*", text)
        if text[m.start():m.end()].strip()
    ]]
    # Simpler paragraph split keeping offsets
    raw_paras: list[tuple[str, int]] = []
    for match in re.finditer(r"(?s).+?(?=\n\n|\Z)", text):
        chunk = match.group(0).strip()
        if chunk:
            raw_paras.append((chunk, match.start()))

    if not raw_paras:
        return [(text.strip(), 0)]

    chunks: list[tuple[str, int]] = []
    current_text = ""
    current_start = 0

    for para, para_start in raw_paras:
        candidate = (current_text + "\n\n" + para).strip() if current_text else para
        if len(candidate) <= max_chars:
            if not current_text:
                current_start = para_start
            current_text = candidate
            continue

        # Flush current
        if current_text:
            chunks.append((current_text, current_start))
            # Overlap: last N chars of current_text
            overlap = current_text[-overlap_chars:] if overlap_chars > 0 else ""
            current_text = (overlap + "\n\n" + para).strip() if overlap else para
            current_start = max(0, para_start - overlap_chars)
        else:
            # Para itself exceeds max_chars → hard split
            pos = 0
            while pos < len(para):
                chunks.append((para[pos:pos + max_chars], para_start + pos))
                pos += max_chars - overlap_chars

            current_text = ""

    if current_text:
        chunks.append((current_text, current_start))

    return chunks if chunks else [(text.strip(), 0)]


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def chunk_document(
    doc: RagDocument,
    max_chars: int = 900,
    overlap_chars: int = 140,
) -> list[RagChunk]:
    """
    Chunk a RagDocument into indexable RagChunk objects.

    Every chunk inherits the full provenance of its parent document.
    """
    if not doc.text.strip():
        return []

    sections = _parse_sections(doc.text)
    all_chunks: list[RagChunk] = []
    chunk_index = 0

    for section in sections:
        splits = _split_section(
            text=section.text,
            max_chars=max_chars,
            overlap_chars=overlap_chars,
        )
        for chunk_text, rel_start in splits:
            if not chunk_text.strip():
                continue
            abs_start = section.char_start + rel_start
            abs_end = abs_start + len(chunk_text)

            # Prepend heading to chunk if it was stripped off during section split
            display_text = chunk_text
            if section.heading and not chunk_text.startswith(section.heading):
                display_text = f"{section.heading}\n{chunk_text}".strip()

            all_chunks.append(
                RagChunk(
                    chunk_id=f"{doc.document_id}-c{chunk_index:04d}",
                    document_id=doc.document_id,
                    source_id=doc.source_id,
                    title=doc.title,
                    section_title=section.heading,
                    url=doc.url,
                    source_name=doc.source_name,
                    source_trust_level=doc.source_trust_level,
                    document_type=doc.document_type,
                    knowledge_layer=doc.knowledge_layer,
                    language=doc.language,
                    jurisdiction=doc.jurisdiction,
                    topics=list(doc.topics),
                    target_groups=list(doc.target_groups),
                    publication_date=doc.publication_date,
                    license_or_rights=doc.license_or_rights,
                    text=display_text,
                    char_start=abs_start,
                    char_end=abs_end,
                    chunk_index=chunk_index,
                    total_chunks=0,      # back-filled below
                    source_weight=1.0,   # back-filled by indexer from sources.py
                )
            )
            chunk_index += 1

    # Back-fill total_chunks
    total = len(all_chunks)
    for chunk in all_chunks:
        chunk.total_chunks = total

    return all_chunks

