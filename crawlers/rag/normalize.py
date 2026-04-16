"""
Text normalization for the systemfehler RAG pipeline.

Handles common extraction artifacts from PDFs and HTML pages:
  - broken line-wraps within sentences (common in PDFs)
  - excessive whitespace / blank lines
  - repeated boilerplate blocks (page numbers, headers/footers)
  - encoding artifacts (mojibake-like patterns)
  - German-specific ligatures / hyphenation artefacts

Returns clean, well-structured text suitable for chunking.
"""

from __future__ import annotations

import hashlib
import re


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _remove_pdf_artifacts(text: str) -> str:
    """Remove common PDF extraction noise."""
    # Page number patterns: "Seite 3 von 12", "- 3 -"
    text = re.sub(r"(?m)^[-–]\s*\d+\s*[-–]\s*$", "", text)
    text = re.sub(r"(?m)^Seite\s+\d+\s+(von\s+\d+)?\s*$", "", text, flags=re.IGNORECASE)
    # Running headers/footers that repeat: identify lines appearing 4+ times and remove
    lines = text.split("\n")
    from collections import Counter
    freq = Counter(line.strip() for line in lines if len(line.strip()) > 4)
    repeated = {line for line, count in freq.items() if count >= 4}
    lines = [line for line in lines if line.strip() not in repeated]
    return "\n".join(lines)


def _fix_broken_line_wraps(text: str) -> str:
    """
    Rejoin lines that were broken in the middle of a sentence.

    Heuristic: a line ending without sentence-final punctuation that is
    followed by a lowercase letter (or German Umlaut) was probably wrapped.
    Does not join lines that follow a blank line (paragraph boundary).
    """
    lines = text.split("\n")
    result: list[str] = []
    i = 0
    while i < len(lines):
        current = lines[i]
        # If next line is blank or current ends sentence, keep as-is
        if i + 1 >= len(lines) or not lines[i + 1].strip():
            result.append(current)
            i += 1
            continue

        next_line = lines[i + 1]
        current_stripped = current.rstrip()

        # Heading lines: never merge
        if current_stripped.startswith("#") or next_line.startswith("#"):
            result.append(current)
            i += 1
            continue

        # If current line ends mid-word (no trailing space, no punctuation)
        # and next line starts lowercase → merge
        ends_incomplete = (
            current_stripped
            and current_stripped[-1] not in ".!?:;\"'\u2019\u00bb"
            and not current_stripped.endswith("-")
        )
        next_starts_lower = next_line and (
            next_line[0].islower() or next_line[0] in "äöüß"
        )

        if ends_incomplete and next_starts_lower:
            lines[i + 1] = current_stripped + " " + next_line.lstrip()
        else:
            result.append(current)
        i += 1

    # One trailing item
    if lines and lines[-1] not in result:
        result.append(lines[-1])

    return "\n".join(result)


def _fix_german_hyphenation(text: str) -> str:
    """
    Rejoin German compound words split across lines with a hyphen.

    e.g.  "Arbeits-\nlosengeld"  →  "Arbeitslosengeld"
    """
    return re.sub(r"-\n([a-zäöüß])", r"\1", text)


def _collapse_whitespace(text: str) -> str:
    # Collapse horizontal whitespace within lines
    lines = [re.sub(r"[ \t]{2,}", " ", line) for line in text.split("\n")]
    text = "\n".join(lines)
    # Collapse 3+ blank lines to 2
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def _fix_encoding_artifacts(text: str) -> str:
    """Fix common mojibake patterns that survive PDF/HTML extraction."""
    replacements = [
        ("Ã¤", "ä"), ("Ã¶", "ö"), ("Ã¼", "ü"), ("ÃŸ", "ß"),
        ("Ã„", "Ä"), ("Ã–", "Ö"), ("Ãœ", "Ü"),
        ("â€œ", "\u201c"), ("â€\x9d", "\u201d"), ("â€˜", "\u2018"), ("â€™", "\u2019"),
        ("\u00e2\u20ac\u201c", "\u2013"), ("\u00e2\u20ac\u201d", "\u2014"),
        ("\u00ad", ""),   # soft hyphen
        ("\uf0b7", "-"),  # PDF bullet artifact
        ("\uf020", " "),  # PDF space artifact
    ]
    for bad, good in replacements:
        text = text.replace(bad, good)
    return text


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def normalize(text: str) -> str:
    """
    Full normalization pipeline.

    Applies in order:
      1. encoding artifact fixes
      2. PDF artifact removal (page numbers, repeated headers)
      3. German hyphenation rejoin
      4. broken line-wrap rejoin
      5. whitespace collapse
    """
    text = _fix_encoding_artifacts(text)
    text = _remove_pdf_artifacts(text)
    text = _fix_german_hyphenation(text)
    text = _fix_broken_line_wraps(text)
    text = _collapse_whitespace(text)
    return text


def content_hash(text: str) -> str:
    """SHA-256 hex digest of the normalized text (for dedup / freshness checks)."""
    return hashlib.sha256(text.encode("utf-8", errors="replace")).hexdigest()
