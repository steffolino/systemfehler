#!/usr/bin/env python3
"""Build source-domain context from robots.txt, sitemap XML, and page metadata.

The output is intentionally source-level, not entry-level: it helps reviewers
and retrieval tooling understand what a registered domain appears to cover
without broad crawling.
"""

from __future__ import annotations

import argparse
import gzip
import http.client
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from crawlers.shared.text_cleaning import clean_text, decode_payload  # noqa: E402

REGISTRY_FILE = ROOT / "data" / "_sources" / "registered_sources.json"
OUTPUT_JSON = ROOT / "data" / "_sources" / "source_site_context.json"
OUTPUT_MD = ROOT / "data" / "_quality" / "source_site_context.md"

DEFAULT_TIMEOUT_SECONDS = 12
USER_AGENT = "systemfehler-source-context-bot/0.1 (+https://systemfehler.pages.dev)"
LOW_SIGNAL_PARTS = {
    "datenschutz",
    "impressum",
    "presse",
    "news",
    "aktuelles",
    "newsletter",
    "cookie",
    "login",
    "warenkorb",
    "shop",
    "mediathek",
}
HIGH_SIGNAL_PARTS = {
    "beratung",
    "hilfe",
    "kontakt",
    "service",
    "leistungen",
    "antrag",
    "rechner",
    "suche",
    "krank",
    "depression",
    "krise",
    "pflege",
    "familie",
    "arbeit",
    "arbeitslos",
    "weiterbildung",
    "schulden",
    "wohnen",
    "migration",
    "integration",
    "einsamkeit",
}
HINT_PATTERNS = {
    "contacts": ("kontakt", "beratung", "hotline", "telefon", "sprechstunde", "standort", "stelle"),
    "tools": ("rechner", "tool", "suche", "finder", "online", "antrag", "formular"),
    "benefits": ("leistung", "anspruch", "geld", "antrag", "foerder", "rente", "buergergeld"),
    "mental_health": ("depression", "krise", "suizid", "psych", "burnout", "einsamkeit"),
    "caregiving": ("pflege", "angehoerige", "pflegezeit", "entlastung"),
    "employment": ("arbeit", "arbeitslos", "weiterbildung", "beruf", "job"),
    "family": ("familie", "kind", "eltern", "schwanger", "jugend"),
    "housing_debt": ("wohnung", "miete", "schulden", "energie", "strom"),
    "migration": ("migration", "integration", "aufenthalt", "sprache", "asyl"),
}
CAPABILITY_LABELS_DE = {
    "contacts": "Kontakt- und Beratungsstellen",
    "tools": "Online-Tools, Suche, Anträge oder Formulare",
    "benefits": "Informationen zu Leistungen, Ansprüchen oder Geldleistungen",
    "mental_health": "Psychische Gesundheit, Krisenhilfe oder Einsamkeit",
    "caregiving": "Pflege, Angehörige und Entlastung",
    "employment": "Arbeit, Arbeitslosigkeit, Weiterbildung oder Beruf",
    "family": "Familie, Kinder, Eltern oder Jugend",
    "housing_debt": "Wohnen, Miete, Energie oder Schulden",
    "migration": "Migration, Integration, Aufenthalt oder Sprache",
}


class HeadMetadataParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.in_title = False
        self.title_parts: list[str] = []
        self.meta: dict[str, str] = {}
        self.canonical = ""

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        attrs_dict = {key.lower(): value or "" for key, value in attrs}
        if tag == "title":
            self.in_title = True
        elif tag == "meta":
            name = (attrs_dict.get("name") or attrs_dict.get("property") or "").lower()
            content = clean_text(attrs_dict.get("content") or "")
            if name and content:
                self.meta[name] = content
        elif tag == "link" and attrs_dict.get("rel", "").lower() == "canonical":
            self.canonical = attrs_dict.get("href", "").strip()

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "title":
            self.in_title = False

    def handle_data(self, data: str) -> None:
        if self.in_title:
            self.title_parts.append(data)

    @property
    def title(self) -> str:
        return clean_text(" ".join(self.title_parts))

    @property
    def description(self) -> str:
        return (
            self.meta.get("description")
            or self.meta.get("og:description")
            or self.meta.get("twitter:description")
            or ""
        )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build sitemap/meta-description context for registered source domains")
    parser.add_argument("--registry", default=str(REGISTRY_FILE))
    parser.add_argument("--output", default=str(OUTPUT_JSON))
    parser.add_argument("--markdown", default=str(OUTPUT_MD))
    parser.add_argument("--source-ids", nargs="*", default=None, help="Optional registered source ids to process")
    parser.add_argument("--limit-sources", type=int, default=0, help="Optional max number of sources")
    parser.add_argument("--max-sitemap-urls", type=int, default=250)
    parser.add_argument("--max-sitemaps", type=int, default=12)
    parser.add_argument("--max-pages", type=int, default=10)
    parser.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT_SECONDS)
    parser.add_argument("--delay", type=float, default=0.15)
    return parser.parse_args()


def normalize_host(value: str) -> str:
    parsed = urllib.parse.urlparse(value if "://" in value else f"https://{value}")
    host = (parsed.netloc or parsed.path or "").lower().strip("/")
    return host[4:] if host.startswith("www.") else host


def origin_from_url(url: str) -> str:
    parsed = urllib.parse.urlparse(url)
    if not parsed.scheme or not parsed.netloc:
        return f"https://{normalize_host(url)}"
    return f"{parsed.scheme}://{parsed.netloc}"


def canonical_domain(source: dict[str, Any]) -> str:
    return normalize_host(
        source.get("canonicalDomain")
        or source.get("sourceDomain")
        or source.get("baseUrl")
        or ""
    )


def source_hosts(source: dict[str, Any]) -> list[str]:
    hosts = [
        normalize_host(source.get("baseUrl") or ""),
        canonical_domain(source),
        *[normalize_host(item) for item in source.get("hosts", []) if isinstance(item, str)],
    ]
    return [host for host in dict.fromkeys(hosts) if host]


def same_source_host(url: str, hosts: list[str]) -> bool:
    host = normalize_host(url)
    return any(host == source_host or host.endswith(f".{source_host}") for source_host in hosts)


def fetch_bytes(url: str, timeout: int) -> tuple[bytes, str | None]:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "*/*"})
    with urllib.request.urlopen(req, timeout=timeout) as response:
        charset = response.headers.get_content_charset()
        try:
            return response.read(), charset
        except http.client.IncompleteRead as exc:
            return exc.partial, charset


def maybe_decompress(url: str, payload: bytes) -> bytes:
    if url.lower().endswith(".gz"):
        return gzip.decompress(payload)
    if payload[:2] == b"\x1f\x8b":
        return gzip.decompress(payload)
    return payload


def fetch_text(url: str, timeout: int) -> str:
    payload, charset = fetch_bytes(url, timeout)
    payload = maybe_decompress(url, payload)
    return decode_payload(payload, charset)


def robots_sitemaps(origin: str, timeout: int) -> list[str]:
    robots_url = urllib.parse.urljoin(origin + "/", "robots.txt")
    try:
        body = fetch_text(robots_url, timeout)
    except Exception:
        return []
    urls = []
    for line in body.splitlines():
        if line.lower().startswith("sitemap:"):
            value = line.split(":", 1)[1].strip()
            if value:
                urls.append(value)
    return urls


def default_sitemaps(origin: str) -> list[str]:
    return [
        urllib.parse.urljoin(origin + "/", "sitemap.xml"),
        urllib.parse.urljoin(origin + "/", "sitemap_index.xml"),
    ]


def local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1].lower()


def parse_sitemap_locations(xml_text: str) -> tuple[str, list[str]]:
    root = ET.fromstring(xml_text)
    kind = local_name(root.tag)
    locations = []
    for node in root.iter():
        if local_name(node.tag) == "loc" and node.text:
            locations.append(clean_text(node.text))
    return kind, locations


def collect_sitemap_urls(
    source: dict[str, Any],
    *,
    max_sitemap_urls: int,
    max_sitemaps: int,
    timeout: int,
    delay: float,
) -> dict[str, Any]:
    base_url = source.get("baseUrl") or f"https://{canonical_domain(source)}"
    origin = origin_from_url(base_url)
    hosts = source_hosts(source)
    queue = [
        *robots_sitemaps(origin, timeout),
        *default_sitemaps(origin),
    ]
    queue = [url for url in dict.fromkeys(queue) if url]
    visited_sitemaps: set[str] = set()
    urls: list[str] = []
    errors: list[str] = []

    while queue and len(visited_sitemaps) < max_sitemaps and len(urls) < max_sitemap_urls:
        sitemap_url = queue.pop(0)
        if sitemap_url in visited_sitemaps:
            continue
        visited_sitemaps.add(sitemap_url)
        try:
            xml_text = fetch_text(sitemap_url, timeout)
            kind, locations = parse_sitemap_locations(xml_text)
        except (urllib.error.URLError, TimeoutError, ET.ParseError, OSError, ValueError) as exc:
            errors.append(f"{sitemap_url}: {type(exc).__name__}")
            continue

        if kind == "sitemapindex":
            for loc in locations:
                if loc not in visited_sitemaps and same_source_host(loc, hosts):
                    queue.append(loc)
        else:
            for loc in locations:
                if same_source_host(loc, hosts):
                    urls.append(loc)
                if len(urls) >= max_sitemap_urls:
                    break
        if delay > 0:
            time.sleep(delay)

    return {
        "sitemapsChecked": sorted(visited_sitemaps),
        "sitemapUrlCount": len(urls),
        "urls": list(dict.fromkeys(urls)),
        "errors": errors[:20],
    }


def path_parts(url: str) -> list[str]:
    parsed = urllib.parse.urlparse(url)
    parts = [
        urllib.parse.unquote(part).strip().lower()
        for part in parsed.path.split("/")
        if part.strip()
    ]
    return parts


def score_url(url: str) -> int:
    parts = path_parts(url)
    joined = " ".join(parts)
    score = 0
    for part in HIGH_SIGNAL_PARTS:
        if part in joined:
            score += 3
    for part in LOW_SIGNAL_PARTS:
        if part in joined:
            score -= 4
    score -= min(len(parts), 8)
    if len(parts) <= 2:
        score += 1
    return score


def select_meta_sample_urls(urls: list[str], max_pages: int) -> list[str]:
    ranked = sorted(dict.fromkeys(urls), key=lambda url: (-score_url(url), len(url), url))
    return ranked[:max_pages]


def fetch_page_metadata(url: str, timeout: int) -> dict[str, str]:
    try:
        body = fetch_text(url, timeout)
    except Exception as exc:
        return {"url": url, "error": type(exc).__name__}
    head = body[:120_000]
    parser = HeadMetadataParser()
    try:
        parser.feed(head)
    except Exception:
        pass
    return {
        "url": url,
        "title": parser.title,
        "description": parser.description,
        "canonical": parser.canonical,
    }


def summarize_paths(urls: list[str]) -> list[dict[str, Any]]:
    counter: Counter[str] = Counter()
    for url in urls:
        parts = path_parts(url)
        if not parts:
            counter["/"] += 1
        else:
            key = "/" + "/".join(parts[:2])
            counter[key] += 1
    return [{"path": path, "count": count} for path, count in counter.most_common(25)]


def infer_coverage_hints(urls: list[str], pages: list[dict[str, str]]) -> list[str]:
    blob = " ".join(
        [
            " ".join(urls[:500]),
            *[page.get("title", "") for page in pages],
            *[page.get("description", "") for page in pages],
        ]
    ).lower()
    hints = []
    for hint, needles in HINT_PATTERNS.items():
        if any(needle in blob for needle in needles):
            hints.append(hint)
    return hints


def capability_evidence(
    hint: str,
    urls: list[str],
    pages: list[dict[str, str]],
    *,
    max_items: int = 4,
) -> list[dict[str, str]]:
    needles = HINT_PATTERNS.get(hint, ())
    evidence: list[dict[str, str]] = []

    for page in pages:
        haystack = " ".join(
            [
                page.get("url", ""),
                page.get("title", ""),
                page.get("description", ""),
            ]
        ).lower()
        if any(needle in haystack for needle in needles):
            evidence.append(
                {
                    "url": page.get("url", ""),
                    "title": page.get("title") or page.get("url", ""),
                    "description": page.get("description", ""),
                }
            )
        if len(evidence) >= max_items:
            return evidence

    seen = {item["url"] for item in evidence}
    for url in urls:
        lowered = url.lower()
        if url not in seen and any(needle in lowered for needle in needles):
            evidence.append({"url": url, "title": url, "description": ""})
        if len(evidence) >= max_items:
            break
    return evidence


def infer_domain_capabilities(urls: list[str], pages: list[dict[str, str]]) -> list[dict[str, Any]]:
    text_parts = [
        *urls[:500],
        *[page.get("title", "") for page in pages],
        *[page.get("description", "") for page in pages],
    ]
    blob = " ".join(text_parts).lower()
    capabilities = []
    for hint, needles in HINT_PATTERNS.items():
        score = sum(blob.count(needle) for needle in needles)
        if score <= 0:
            continue
        confidence = "high" if score >= 8 else "medium" if score >= 3 else "low"
        capabilities.append(
            {
                "id": hint,
                "labelDe": CAPABILITY_LABELS_DE.get(hint, hint),
                "confidence": confidence,
                "score": score,
                "evidence": capability_evidence(hint, urls, pages),
            }
        )
    return sorted(capabilities, key=lambda item: (-item["score"], item["id"]))


def source_overview(source: dict[str, Any], urls: list[str], pages: list[dict[str, str]]) -> dict[str, Any]:
    capabilities = infer_domain_capabilities(urls, pages)
    labels = [item["labelDe"] for item in capabilities[:5]]
    if labels:
        summary = f"{source.get('name') or source.get('id')} wirkt laut Sitemap besonders relevant für: {', '.join(labels)}."
    else:
        summary = (
            f"Für {source.get('name') or source.get('id')} konnte aus der Sitemap noch kein belastbares "
            "Themenprofil abgeleitet werden."
        )
    return {
        "summaryDe": summary,
        "capabilities": capabilities,
    }


def build_source_context(source: dict[str, Any], args: argparse.Namespace) -> dict[str, Any]:
    sitemap = collect_sitemap_urls(
        source,
        max_sitemap_urls=args.max_sitemap_urls,
        max_sitemaps=args.max_sitemaps,
        timeout=args.timeout,
        delay=args.delay,
    )
    sample_urls = select_meta_sample_urls(sitemap["urls"], args.max_pages)
    pages = []
    for url in sample_urls:
        pages.append(fetch_page_metadata(url, args.timeout))
        if args.delay > 0:
            time.sleep(args.delay)

    urls = sitemap["urls"]
    overview = source_overview(source, urls, pages)
    return {
        "sourceId": source.get("id"),
        "name": source.get("name"),
        "baseUrl": source.get("baseUrl"),
        "canonicalDomain": canonical_domain(source),
        "hosts": source_hosts(source),
        "sourceTier": source.get("sourceTier") or "tier_unknown",
        "reviewStatus": source.get("reviewStatus") or "unknown",
        "checkedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "sitemapsChecked": sitemap["sitemapsChecked"],
        "sitemapUrlCount": sitemap["sitemapUrlCount"],
        "pathClusters": summarize_paths(urls),
        "coverageHints": infer_coverage_hints(urls, pages),
        "overview": overview,
        "samplePages": pages,
        "errors": sitemap["errors"],
    }


def write_markdown(path: Path, payload: dict[str, Any]) -> None:
    lines = [
        "# Source Site Context",
        "",
        f"Generated: {payload['generatedAt']}",
        "",
        f"Sources processed: {len(payload['sources'])}",
        "",
    ]
    for source in payload["sources"]:
        lines.extend(
            [
                f"## {source['sourceId']} - {source['canonicalDomain']}",
                "",
                f"- Tier: `{source['sourceTier']}`",
                f"- Review: `{source['reviewStatus']}`",
                f"- Sitemap URLs: {source['sitemapUrlCount']}",
                f"- Coverage hints: {', '.join(source['coverageHints']) or '(none)'}",
                f"- Overview: {source.get('overview', {}).get('summaryDe') or '(none)'}",
                f"- Sitemaps checked: {', '.join(source['sitemapsChecked'][:5]) or '(none)'}",
                "",
                "Capabilities:",
            ]
        )
        for item in source.get("overview", {}).get("capabilities", [])[:8]:
            lines.append(f"- {item['labelDe']} (`{item['confidence']}`, score {item['score']})")
            for evidence in item.get("evidence", [])[:2]:
                title = evidence.get("title") or evidence.get("url")
                description = evidence.get("description") or ""
                lines.append(f"  - [{title}]({evidence.get('url')}) - {description}")
        lines.extend(
            [
                "",
                "Top path clusters:",
            ]
        )
        for item in source["pathClusters"][:10]:
            lines.append(f"- `{item['path']}`: {item['count']}")
        lines.extend(["", "Sample meta descriptions:"])
        for page in source["samplePages"][:8]:
            title = page.get("title") or "(untitled)"
            description = page.get("description") or page.get("error") or ""
            lines.append(f"- [{title}]({page.get('url')}) - {description}")
        if source["errors"]:
            lines.extend(["", "Errors:"])
            for error in source["errors"][:5]:
                lines.append(f"- {error}")
        lines.append("")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    args = parse_args()
    registry = json.loads(Path(args.registry).read_text(encoding="utf-8"))
    sources = [source for source in registry.get("sources", []) if isinstance(source, dict)]
    sources = [source for source in sources if str(source.get("status") or "active").lower() == "active"]
    if args.source_ids:
        selected = set(args.source_ids)
        sources = [source for source in sources if source.get("id") in selected]
    if args.limit_sources and args.limit_sources > 0:
        sources = sources[: args.limit_sources]

    built = []
    for index, source in enumerate(sources, start=1):
        print(f"[{index}/{len(sources)}] {source.get('id')} {source.get('baseUrl')}")
        built.append(build_source_context(source, args))

    payload = {
        "version": "0.1.0",
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "policy": {
            "maxSitemapUrls": args.max_sitemap_urls,
            "maxSitemaps": args.max_sitemaps,
            "maxPages": args.max_pages,
            "userAgent": USER_AGENT,
        },
        "sources": built,
    }

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    write_markdown(Path(args.markdown), payload)
    print(f"Wrote {output}")
    print(f"Wrote {args.markdown}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
