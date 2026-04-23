"""
Document fetcher for the RAG corpus.

Handles:
  - PDF downloads  (BA Merkblätter, Fachliche Weisungen)
  - HTML scraping  (gesetze-im-internet.de, NGO pages)

Each fetched document is returned as a NormalizedDoc dict:
{
    "id": str,
    "title": str,
    "source_id": str,
    "tier": str,
    "type": str,
    "legal_level": str,
    "language": str,
    "topics": list[str],
    "target_groups": list[str],
    "url": str,
    "text": str,          # raw extracted text
    "fetch_status": str,  # "ok" | "error" | "skipped"
    "error": str | None,
}

Usage:
    python -m crawlers.rag.fetch_docs
    python -m crawlers.rag.fetch_docs --source-id ba_merkblatt_alg1
"""

from __future__ import annotations

import io
import re
import time
import argparse
import json
import os
from pathlib import Path
from typing import Any
from datetime import datetime, timezone

import requests
from bs4 import BeautifulSoup

from .sources import RAG_SOURCES

# Directory where raw text is cached so we don't re-fetch on every run
_CACHE_DIR = Path(__file__).parent.parent.parent / "data" / "_rag_cache"
_CACHE_DIR.mkdir(parents=True, exist_ok=True)
_ERROR_REGISTRY_PATH = Path(__file__).parent.parent.parent / "data" / "_rag_sources" / "errored_sources.json"

_PROJECT_ROOT = Path(__file__).parent.parent.parent

_SESSION = requests.Session()
_SESSION.headers["User-Agent"] = (
    "systemfehler-rag-bot/1.0 (+https://github.com/steffolino/systemfehler)"
)
_REQUEST_TIMEOUT = 30
_RETRY_WAIT = 2.0


def _load_error_registry() -> dict[str, Any]:
    if not _ERROR_REGISTRY_PATH.exists():
        return {
            "version": "0.1.0",
            "blockedSourceIds": [],
            "blockedUrls": [],
            "errorsBySourceId": {},
        }
    try:
        payload = json.loads(_ERROR_REGISTRY_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {
            "version": "0.1.0",
            "blockedSourceIds": [],
            "blockedUrls": [],
            "errorsBySourceId": {},
        }
    if not isinstance(payload, dict):
        return {
            "version": "0.1.0",
            "blockedSourceIds": [],
            "blockedUrls": [],
            "errorsBySourceId": {},
        }
    payload.setdefault("version", "0.1.0")
    payload.setdefault("blockedSourceIds", [])
    payload.setdefault("blockedUrls", [])
    payload.setdefault("errorsBySourceId", {})
    return payload


def _save_error_registry(payload: dict[str, Any]) -> None:
    _ERROR_REGISTRY_PATH.parent.mkdir(parents=True, exist_ok=True)
    _ERROR_REGISTRY_PATH.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def _is_blocked_source(source: dict[str, Any], registry: dict[str, Any]) -> bool:
    source_id = source.get("id")
    source_url = source.get("url")
    blocked_ids = {
        str(value).strip()
        for value in registry.get("blockedSourceIds", [])
        if isinstance(value, str) and value.strip()
    }
    blocked_urls = {
        str(value).strip()
        for value in registry.get("blockedUrls", [])
        if isinstance(value, str) and value.strip()
    }
    return (isinstance(source_id, str) and source_id in blocked_ids) or (
        isinstance(source_url, str) and source_url in blocked_urls
    )


def _record_source_error(source: dict[str, Any], error_message: str) -> None:
    source_id = str(source.get("id") or "").strip()
    if not source_id:
        return

    registry = _load_error_registry()
    errors = registry.get("errorsBySourceId")
    if not isinstance(errors, dict):
        errors = {}
        registry["errorsBySourceId"] = errors

    current = errors.get(source_id) if isinstance(errors.get(source_id), dict) else {}
    fail_count = int(current.get("failCount", 0)) + 1
    errors[source_id] = {
        "failCount": fail_count,
        "lastError": error_message,
        "lastSeenAt": datetime.now(timezone.utc).isoformat(),
        "url": source.get("url"),
        "title": source.get("title"),
    }
    _save_error_registry(registry)


def _cache_path(source_id: str) -> Path:
    return _CACHE_DIR / f"{source_id}.txt"


def _fetch_local_pdf(path: str) -> str:
    """Read a local PDF file and extract plain text."""
    try:
        import pypdf
    except ImportError:
        raise RuntimeError("pypdf is required for PDF ingestion. Run: pip install pypdf")

    abs_path = _PROJECT_ROOT / path
    if not abs_path.exists():
        raise FileNotFoundError(f"Local file not found: {abs_path}")
    reader = pypdf.PdfReader(str(abs_path))
    pages = [page.extract_text() or "" for page in reader.pages]
    return "\n\n".join(pages)


def _fetch_pdf(url: str) -> str:
    """Download PDF and extract plain text using pypdf."""
    try:
        import pypdf  # optional dep
    except ImportError:
        raise RuntimeError(
            "pypdf is required for PDF ingestion. "
            "Run: pip install pypdf"
        )

    resp = _SESSION.get(url, timeout=_REQUEST_TIMEOUT)
    resp.raise_for_status()
    reader = pypdf.PdfReader(io.BytesIO(resp.content))
    pages = []
    for page in reader.pages:
        text = page.extract_text() or ""
        pages.append(text)
    return "\n\n".join(pages)


def _fetch_html(url: str) -> str:
    """Fetch HTML page and extract body text."""
    resp = _SESSION.get(url, timeout=_REQUEST_TIMEOUT)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "lxml")

    # Remove nav, footer, script, style, ads
    for tag in soup.select("nav, footer, header, script, style, aside, .cookie-banner, #sidebar"):
        tag.decompose()

    # Prefer article/main content if present
    main = soup.find("main") or soup.find("article") or soup.find(id="content") or soup.body
    if not main:
        return soup.get_text(separator="\n", strip=True)

    # Walk the element tree to preserve heading structure
    lines: list[str] = []
    for element in main.find_all(["h1", "h2", "h3", "h4", "p", "li", "dt", "dd"]):
        text = element.get_text(separator=" ", strip=True)
        if not text:
            continue
        tag = element.name
        if tag in ("h1", "h2"):
            lines.append(f"\n## {text}\n")
        elif tag in ("h3", "h4"):
            lines.append(f"\n### {text}\n")
        elif tag == "li":
            lines.append(f"- {text}")
        else:
            lines.append(text)

    raw = "\n".join(lines)
    # Collapse excessive blank lines
    return re.sub(r"\n{3,}", "\n\n", raw).strip()


def _fetch_text(source: dict[str, Any]) -> str:
    source_type: str = source.get("source_type", "")
    url: str = source["url"]
    if source_type == "local_file":
        return _fetch_local_pdf(url)
    if url.lower().endswith(".pdf"):
        return _fetch_pdf(url)
    return _fetch_html(url)


def fetch_source(source: dict[str, Any], force: bool = False) -> dict[str, Any]:
    """Fetch one source entry. Returns NormalizedDoc dict."""
    sid = source["id"]
    registry = _load_error_registry()
    if _is_blocked_source(source, registry):
        return {**source, "text": "", "fetch_status": "skipped", "error": "blocked_by_error_registry"}

    cache = _cache_path(sid)

    if not force and cache.exists():
        text = cache.read_text(encoding="utf-8")
        return {**source, "text": text, "fetch_status": "cached", "error": None}

    for attempt in range(1, 4):
        try:
            text = _fetch_text(source)
            cache.write_text(text, encoding="utf-8")
            return {**source, "text": text, "fetch_status": "ok", "error": None}
        except Exception as exc:
            if attempt < 3:
                time.sleep(_RETRY_WAIT * attempt)
            else:
                _record_source_error(source, str(exc))
                return {**source, "text": "", "fetch_status": "error", "error": str(exc)}

    # unreachable, but keeps type-checker happy
    return {**source, "text": "", "fetch_status": "error", "error": "unknown"}


def fetch_all(
    source_ids: list[str] | None = None,
    force: bool = False,
) -> list[dict[str, Any]]:
    """Fetch all (or a subset of) RAG sources. Returns NormalizedDoc dicts."""
    sources = RAG_SOURCES
    if source_ids:
        sources = [s for s in sources if s["id"] in source_ids]

    results: list[dict[str, Any]] = []
    for source in sources:
        print(f"  [{source['tier'].upper()}] {source['id']} ...", end=" ", flush=True)
        doc = fetch_source(source, force=force)
        status = doc["fetch_status"]
        size = len(doc.get("text", ""))
        print(f"{status} ({size:,} chars)")
        results.append(doc)

    ok = sum(1 for d in results if d["fetch_status"] in ("ok", "cached"))
    err = sum(1 for d in results if d["fetch_status"] == "error")
    print(f"\nDone: {ok} ok, {err} errors out of {len(results)} sources.")
    return results


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch RAG source documents")
    parser.add_argument("--source-id", nargs="*", help="Fetch only these source IDs")
    parser.add_argument("--force", action="store_true", help="Ignore cached downloads")
    parser.add_argument("--output", default=None, help="Write results as JSON to this path")
    args = parser.parse_args()

    docs = fetch_all(source_ids=args.source_id, force=args.force)

    if args.output:
        out_path = Path(args.output)
        out_path.write_text(
            json.dumps(
                [{"id": d["id"], "title": d["title"], "status": d["fetch_status"], "chars": len(d.get("text", ""))}
                 for d in docs],
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )
        print(f"Summary written to {out_path}")


if __name__ == "__main__":
    main()
