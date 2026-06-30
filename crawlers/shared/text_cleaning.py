"""Shared text cleanup for crawler, ingest, and generated source context."""

from __future__ import annotations

import html
import re
from copy import deepcopy
from typing import Any


TEXT_FIELD_KEYS = {
    "title",
    "summary",
    "content",
    "description",
    "name",
    "label",
    "notes",
    "note",
    "providerName",
    "publisherName",
    "operatorName",
    "author",
    "labelDe",
    "label_de",
    "labelEn",
    "label_en",
    "summaryDe",
    "summary_de",
    "descriptionDe",
    "description_de",
    "titleDe",
    "title_de",
    "easy_de",
    "de",
    "en",
}
SKIP_TEXT_KEYS = {
    "id",
    "url",
    "canonical",
    "canonicalUrl",
    "canonicalDomain",
    "baseUrl",
    "source",
    "sourceDomain",
    "host",
    "hosts",
    "href",
}
MOJIBAKE_MARKERS = ("Ã", "Â", "â€", "â€“", "â€”", "â€ž", "â€œ", "â€˜", "â€™")
BINARY_TEXT_MARKERS = ("%PDF-", " endstream ", " startxref ", "/FlateDecode")


def _mojibake_score(value: str) -> int:
    return sum(value.count(marker) for marker in MOJIBAKE_MARKERS)


def repair_mojibake(value: str) -> str:
    """Repair common UTF-8-as-Latin-1 mojibake when the fix is clearly better."""

    if not any(marker in value for marker in MOJIBAKE_MARKERS):
        return value
    for encoding in ("latin-1", "cp1252"):
        try:
            repaired = value.encode(encoding).decode("utf-8")
        except UnicodeError:
            continue
        if _mojibake_score(repaired) < _mojibake_score(value):
            return repaired
    return value


def clean_text(value: Any) -> str:
    raw = str(value or "")
    if looks_like_binary_text(raw):
        return ""
    text = repair_mojibake(raw)
    text = html.unescape(text)
    text = text.replace("\u00a0", " ").replace("\ufeff", "")
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def looks_like_binary_text(value: str) -> bool:
    sample = value[:4000]
    if any(marker in sample for marker in BINARY_TEXT_MARKERS):
        return True
    if not sample:
        return False
    replacement_count = sample.count("\ufffd")
    control_count = sum(1 for char in sample if ord(char) < 32 and char not in "\n\r\t")
    return replacement_count >= 8 or control_count >= 8


def decode_payload(payload: bytes, charset: str | None = None) -> str:
    if charset:
        try:
            return payload.decode(charset, errors="replace")
        except LookupError:
            pass

    head = payload[:4096]
    declared = re.search(br"<meta[^>]+charset=[\"']?([^\"'\s/>]+)", head, re.I)
    if declared:
        try:
            return payload.decode(declared.group(1).decode("ascii", errors="ignore"), errors="replace")
        except LookupError:
            pass

    try:
        return payload.decode("utf-8")
    except UnicodeDecodeError:
        return payload.decode("cp1252", errors="replace")


def clean_human_text_fields(value: Any, *, key: str | None = None) -> Any:
    """Recursively clean human-facing strings without touching identifiers/URLs."""

    if isinstance(value, str):
        if key in SKIP_TEXT_KEYS:
            return value.strip()
        if key is None or key in TEXT_FIELD_KEYS:
            return clean_text(value)
        return value.strip()
    if isinstance(value, list):
        return [clean_human_text_fields(item, key=key) for item in value]
    if isinstance(value, dict):
        return {
            item_key: clean_human_text_fields(item_value, key=str(item_key))
            for item_key, item_value in value.items()
        }
    return value


def clean_entry_text(entry: dict[str, Any]) -> bool:
    """Clean an entry in place. Returns True when it changed."""

    cleaned = clean_human_text_fields(deepcopy(entry))
    if cleaned != entry:
        entry.clear()
        entry.update(cleaned)
        return True
    return False
