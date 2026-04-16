"""
CLI entry point for the RAG pipeline.

Commands:
    python -m crawlers.rag list                # list registered sources
    python -m crawlers.rag ingest              # fetch + chunk all sources
    python -m crawlers.rag ingest --source-id X --force
    python -m crawlers.rag index               # ingest + embed + upsert all
    python -m crawlers.rag index --source-id X --force
    python -m crawlers.rag search "query"      # test semantic search
    python -m crawlers.rag download-page URL [URL ...]   # bulk-download all PDFs from page(s)
    python -m crawlers.rag download-page URL --out DIR   # download to custom directory
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path
from urllib.parse import urljoin, urlparse

# Load .env from repo root before any module-level env reads
try:
    from dotenv import load_dotenv as _load_dotenv
    _load_dotenv(Path(__file__).resolve().parents[2] / ".env", override=False, encoding="utf-8")
except ImportError:
    pass


def cmd_download_page(args: argparse.Namespace) -> None:
    """Scrape one or more pages for PDF links and download them all."""
    import requests
    from bs4 import BeautifulSoup

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    session = requests.Session()
    session.headers["User-Agent"] = (
        "systemfehler-rag-bot/1.0 (+https://github.com/steffolino/systemfehler)"
    )

    all_pdf_urls: list[tuple[str, str]] = []  # (page_url, pdf_url)

    for page_url in args.urls:
        print(f"\nScraping {page_url} ...")
        try:
            resp = session.get(page_url, timeout=30)
            resp.raise_for_status()
        except Exception as e:
            print(f"  ERROR fetching page: {e}", file=sys.stderr)
            continue

        soup = BeautifulSoup(resp.text, "lxml")
        pdf_links = []
        for a in soup.find_all("a", href=True):
            href: str = a["href"]
            if ".pdf" not in href.lower():
                continue
            abs_url = urljoin(page_url, href)
            pdf_links.append(abs_url)

        # deduplicate while preserving order
        seen: set[str] = set()
        unique = []
        for u in pdf_links:
            if u not in seen:
                seen.add(u)
                unique.append(u)

        print(f"  Found {len(unique)} PDF link(s)")
        for u in unique:
            all_pdf_urls.append((page_url, u))

    if not all_pdf_urls:
        print("No PDFs found.")
        return

    downloaded = 0
    skipped = 0
    failed = 0

    for _page, pdf_url in all_pdf_urls:
        filename = Path(urlparse(pdf_url).path).name
        dest = out_dir / filename

        if dest.exists() and not args.force:
            skipped += 1
            continue

        print(f"  Downloading {filename} ...", end=" ", flush=True)
        try:
            r = session.get(pdf_url, timeout=60, stream=True)
            r.raise_for_status()
            content_type = r.headers.get("Content-Type", "")
            if "html" in content_type and "pdf" not in content_type:
                print(f"SKIP (got HTML, not PDF)")
                failed += 1
                continue
            dest.write_bytes(r.content)
            size_kb = dest.stat().st_size // 1024
            print(f"ok ({size_kb} KB)")
            downloaded += 1
        except Exception as e:
            print(f"FAIL: {e}")
            failed += 1
        time.sleep(0.3)  # be polite

    print(f"\nDone: {downloaded} downloaded, {skipped} skipped (already exist), {failed} failed.")
    print(f"Output: {out_dir.resolve()}")


def cmd_list(_args: argparse.Namespace) -> None:
    from .sources import load_registry, compute_source_weight

    sources = load_registry()
    print(f"{'ID':<38} {'TRUST':<22} {'LAYER':<22} {'W':<6} TITLE")
    print("-" * 110)
    for s in sources:
        w = compute_source_weight(s)
        print(
            f"{s.id:<38} {s.source_trust_level.value:<22} {s.knowledge_layer.value:<22}"
            f" {w:<6.2f} {s.title[:38]}"
        )


def cmd_ingest(args: argparse.Namespace) -> None:
    from .ingest import ingest_source, ingest_all
    from .sources import load_registry, get_source

    if args.source_id:
        for sid in args.source_id:
            source = get_source(sid)
            if source is None:
                print(f"ERROR: source_id '{sid}' not found in registry.", file=sys.stderr)
                sys.exit(1)
            chunks = ingest_source(source, force_refetch=args.force)
            print(f"{sid}: {len(chunks)} chunks")
    else:
        result = ingest_all(force_refetch=args.force)
        total = sum(len(v) for v in result.values())
        print(f"\nTotal: {total} chunks across {len(result)} sources.")


def cmd_index(args: argparse.Namespace) -> None:
    from .ingest import ingest_source, ingest_all
    from .index_docs import RagIndexer
    from .sources import load_registry, get_source

    idx = RagIndexer()
    if not idx.embedder.healthcheck():
        print("ERROR: Ollama is not reachable at", idx.embedder.base_url, file=sys.stderr)
        print("Start Ollama with: ollama serve", file=sys.stderr)
        sys.exit(1)

    if args.source_id:
        sources = []
        for sid in args.source_id:
            s = get_source(sid)
            if s is None:
                print(f"ERROR: source_id '{sid}' not found.", file=sys.stderr)
                sys.exit(1)
            sources.append(s)
    else:
        sources = load_registry()

    total_indexed = 0
    for source in sources:
        chunks = ingest_source(source, force_refetch=args.force)
        if not chunks:
            print(f"  {source.id}: 0 chunks (skipped)")
            continue
        print(f"  {source.id}: indexing {len(chunks)} chunks ... ", end="", flush=True)
        n = idx.index_chunks(chunks)
        print(f"{n} indexed")
        total_indexed += n

    print(f"\nTotal: {total_indexed} chunks indexed.")


def cmd_search(args: argparse.Namespace) -> None:
    from .index_docs import RagIndexer

    idx = RagIndexer()
    results = idx.search(args.query, limit=args.limit)
    if not results:
        print("No results.")
        return
    for i, r in enumerate(results, 1):
        score = r.get("score", r.get("raw_score", 0.0))
        raw = r.get("raw_score", 0.0)
        sw = r.get("source_weight_applied", 1.0)
        tb = r.get("topic_boost_applied", 1.0)
        trust = r.get("source_trust_level", "?")
        layer = r.get("knowledge_layer", "?")
        title = (r.get("title") or "")[:55]
        section = (r.get("section_title") or "")[:40]
        text = (r.get("text") or "")[:200]
        boost_str = f"  [raw={raw:.3f} × sw={sw:.2f} × tb={tb:.2f}]" if (sw != 1.0 or tb != 1.0) else ""
        print(f"[{i}] score={score:.3f}{boost_str}  trust={trust}  layer={layer}")
        print(f"     {title}")
        if section:
            print(f"     § {section}")
        print(f"     {text}\n")


def main() -> None:
    # Re-load .env in case modules were imported before the top-level load ran
    # (e.g. when running as `python -m crawlers.rag`)
    try:
        from dotenv import load_dotenv
        load_dotenv(Path(__file__).resolve().parents[2] / ".env", override=False, encoding="utf-8")
    except ImportError:
        pass

    parser = argparse.ArgumentParser(
        prog="crawlers.rag", description="Systemfehler RAG pipeline"
    )
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("list", help="List registered RAG sources")

    p_ingest = sub.add_parser("ingest", help="Fetch, extract, normalize, chunk sources")
    p_ingest.add_argument("--source-id", nargs="*")
    p_ingest.add_argument("--force", action="store_true", help="Re-fetch even if cached")

    p_index = sub.add_parser("index", help="Ingest + embed + upsert to Qdrant")
    p_index.add_argument("--source-id", nargs="*")
    p_index.add_argument("--force", action="store_true")

    p_search = sub.add_parser("search", help="Semantic search test")
    p_search.add_argument("query")
    p_search.add_argument("--limit", type=int, default=5)

    _default_local = str(
        Path(__file__).parent.parent.parent / "data" / "_rag_sources" / "local"
    )
    p_dl = sub.add_parser(
        "download-page",
        help="Scrape page(s) for PDF links and download them all",
    )
    p_dl.add_argument("urls", nargs="+", metavar="URL", help="Page URL(s) to scrape")
    p_dl.add_argument(
        "--out",
        default=_default_local,
        metavar="DIR",
        help=f"Output directory (default: {_default_local})",
    )
    p_dl.add_argument("--force", action="store_true", help="Re-download existing files")

    args = parser.parse_args()
    dispatch = {
        "list": cmd_list,
        "ingest": cmd_ingest,
        "index": cmd_index,
        "search": cmd_search,
        "download-page": cmd_download_page,
    }
    dispatch[args.command](args)


if __name__ == "__main__":
    main()
