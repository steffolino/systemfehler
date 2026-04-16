"""
Text extraction for the systemfehler RAG pipeline.

Supports:
  - PDF  (.pdf)   – via pypdf (optional dep)
  - HTML          – via requests + BeautifulSoup
  - Plain text    – direct read

Returns raw text only. Normalization is in normalize.py.
"""

from __future__ import annotations

import io
import re
import time
from pathlib import Path
from typing import Any

import requests
from bs4 import BeautifulSoup

_SESSION = requests.Session()
_SESSION.headers["User-Agent"] = (
    "systemfehler-rag-bot/1.0 (+https://github.com/steffolino/systemfehler)"
)
_TIMEOUT = 30
_RETRY_WAIT = 2.0


# ---------------------------------------------------------------------------
# PDF
# ---------------------------------------------------------------------------

def extract_pdf(source: bytes | Path | str) -> str:
    """Extract text from a PDF (bytes, local path, or URL string)."""
    try:
        import pypdf
    except ImportError:
        raise RuntimeError(
            "pypdf is required for PDF extraction. "
            "Run: pip install pypdf"
        )

    if isinstance(source, (str, Path)):
        path = Path(source)
        if path.exists():
            raw = path.read_bytes()
        else:
            # Treat as URL
            raw = _http_get_bytes(str(source))
    else:
        raw = source

    reader = pypdf.PdfReader(io.BytesIO(raw))
    pages: list[str] = []
    for page in reader.pages:
        text = page.extract_text() or ""
        pages.append(text)
    return "\n\n".join(pages)


def _http_get_bytes(url: str) -> bytes:
    resp = _SESSION.get(url, timeout=_TIMEOUT)
    resp.raise_for_status()
    return resp.content


# ---------------------------------------------------------------------------
# HTML
# ---------------------------------------------------------------------------

def extract_html(source: str | bytes, base_url: str = "") -> str:
    """
    Extract structured text from an HTML page.

    Preserves heading hierarchy as Markdown-style ## / ### prefixes so the
    chunker can split on semantic boundaries.
    """
    if isinstance(source, str) and source.startswith("http"):
        resp = _SESSION.get(source, timeout=_TIMEOUT)
        resp.raise_for_status()
        html = resp.text
    elif isinstance(source, bytes):
        html = source.decode("utf-8", errors="replace")
    else:
        html = source

    soup = BeautifulSoup(html, "lxml")

    # Remove boilerplate
    for tag in soup.select(
        "nav, footer, header, script, style, aside, "
        ".cookie-banner, .cookie-notice, #sidebar, "
        "[aria-hidden='true'], .skip-nav"
    ):
        tag.decompose()

    # Prefer semantic content container
    main = (
        soup.find("main")
        or soup.find("article")
        or soup.find(id="content")
        or soup.find(id="main-content")
        or soup.body
    )
    if not main:
        return soup.get_text(separator="\n", strip=True)

    lines: list[str] = []
    for el in main.find_all(
        ["h1", "h2", "h3", "h4", "h5", "p", "li", "dt", "dd", "blockquote"]
    ):
        text = el.get_text(separator=" ", strip=True)
        if not text:
            continue
        tag = el.name
        if tag == "h1":
            lines.append(f"\n# {text}\n")
        elif tag == "h2":
            lines.append(f"\n## {text}\n")
        elif tag in ("h3", "h4", "h5"):
            lines.append(f"\n### {text}\n")
        elif tag in ("li", "dd"):
            lines.append(f"- {text}")
        elif tag == "blockquote":
            lines.append(f"> {text}")
        else:
            lines.append(text)

    raw = "\n".join(lines)
    return re.sub(r"\n{3,}", "\n\n", raw).strip()


# ---------------------------------------------------------------------------
# Plain text / fallback
# ---------------------------------------------------------------------------

def extract_text_file(path: str | Path) -> str:
    return Path(path).read_text(encoding="utf-8", errors="replace")


# ---------------------------------------------------------------------------
# Dispatcher
# ---------------------------------------------------------------------------

def extract(url_or_path: str, content_type: str | None = None) -> str:
    """
    Auto-detect and extract text from a URL or local file path.

    content_type: force "pdf" | "html" | "text" (auto-detected from URL if None)
    """
    lower = url_or_path.lower()

    if content_type == "pdf" or (content_type is None and lower.endswith(".pdf")):
        return extract_pdf(url_or_path)

    if content_type == "text" or (
        content_type is None
        and (lower.endswith(".txt") or lower.endswith(".md"))
    ):
        if Path(url_or_path).exists():
            return extract_text_file(url_or_path)

    # Default: HTML fetch
    last_error: Exception | None = None
    for attempt in range(1, 4):
        try:
            return extract_html(url_or_path)
        except Exception as exc:
            last_error = exc
            if attempt < 3:
                time.sleep(_RETRY_WAIT * attempt)

    raise RuntimeError(f"Extraction failed for {url_or_path}: {last_error}") from last_error
