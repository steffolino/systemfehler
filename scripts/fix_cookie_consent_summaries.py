"""
One-off fix: re-fetch real summaries for entries whose summary.de contains
cookie-consent boilerplate ("Mit der Einwilligung von Nutzenden...").

Usage:
    python scripts/fix_cookie_consent_summaries.py [--dry-run]

After running, re-seed the local D1 DB:
    python crawlers/cli.py import --domain aid --to-db
    python crawlers/cli.py import --domain contacts --to-db
    python crawlers/cli.py import --domain organizations --to-db
    python crawlers/cli.py import --domain tools --to-db
"""
from __future__ import annotations

import argparse
import json
import pathlib
import time

import requests
from bs4 import BeautifulSoup

BAD_TOKENS = (
    "einwilligung",
    "webverhalten",
    "tracking",
    "analyse-tool",
    "cookie",
    "datenschutz",
)

_SESSION = requests.Session()
_SESSION.headers["User-Agent"] = (
    "systemfehler-fix-bot/1.0 (+https://github.com/steffolino/systemfehler)"
)


def _is_bad(text: str) -> bool:
    t = text.lower()
    return any(tok in t for tok in BAD_TOKENS)


def _fetch_summary(url: str) -> str:
    """Fetch first meaningful paragraph from the page."""
    try:
        resp = _SESSION.get(url, timeout=15)
        resp.raise_for_status()
    except Exception as exc:
        print(f"  FETCH ERROR {url}: {exc}")
        return ""

    soup = BeautifulSoup(resp.text, "lxml")

    # 1. Try og:description / twitter:description (NOT plain "description" which bmbfsfj poisons)
    for prop in ("og:description", "twitter:description"):
        tag = soup.find("meta", attrs={"property": prop}) or soup.find(
            "meta", attrs={"name": prop}
        )
        if tag:
            content = (tag.get("content") or "").strip()
            if content and not _is_bad(content) and len(content) > 40:
                return content

    # 2. Walk main/article paragraphs
    main = (
        soup.find("main")
        or soup.find("article")
        or soup.find(id="content")
        or soup.body
    )
    if not main:
        return ""

    for p in main.find_all("p"):
        text = p.get_text(separator=" ", strip=True)
        if len(text) < 50:
            continue
        if _is_bad(text):
            continue
        # Skip nav/footer parents
        bad_parent = False
        for parent in p.parents:
            tag_name = getattr(parent, "name", None)
            if tag_name in ("nav", "footer", "header", "aside", "form", "dialog"):
                bad_parent = True
                break
            cls = " ".join(parent.get("class", [])).lower() if parent.get("class") else ""
            pid = (parent.get("id") or "").lower()
            if any(t in cls + pid for t in ("nav", "footer", "cookie", "sidebar", "menu")):
                bad_parent = True
                break
        if bad_parent:
            continue
        return text[:500]

    return ""


def fix_file(path: pathlib.Path, dry_run: bool) -> int:
    raw = json.loads(path.read_text(encoding="utf-8-sig"))
    entries = raw.get("entries", [])
    fixed = 0

    for entry in entries:
        old_de = entry.get("summary", {}).get("de", "")
        if not _is_bad(old_de):
            continue

        url = entry.get("url", "")
        print(f"  [{entry.get('id','?')}] {url[:80]}")
        new_de = _fetch_summary(url)

        if new_de:
            print(f"    > {new_de[:100]}")
            if not dry_run:
                entry.setdefault("summary", {})["de"] = new_de
            fixed += 1
        else:
            print("    > no replacement found, clearing to empty string")
            if not dry_run:
                entry.setdefault("summary", {})["de"] = ""

        time.sleep(0.3)  # polite rate limit

    if not dry_run and fixed:
        path.write_text(
            json.dumps(raw, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        print(f"  Saved {path} ({fixed} entries updated)")

    return fixed


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Print changes without saving")
    args = parser.parse_args()

    data_root = pathlib.Path(__file__).parent.parent / "data"
    total = 0
    for f in sorted(data_root.rglob("entries.json")):
        raw = json.loads(f.read_text(encoding="utf-8-sig"))
        if not any(_is_bad(e.get("summary", {}).get("de", "")) for e in raw.get("entries", [])):
            continue
        print(f"\n=== {f.relative_to(data_root.parent)} ===")
        total += fix_file(f, args.dry_run)

    print(f"\nDone. {'Would fix' if args.dry_run else 'Fixed'} {total} entries.")
    if not args.dry_run:
        print("\nNext: re-seed D1 with:")
        print("  python crawlers/cli.py import --domain aid --to-db")
        print("  python crawlers/cli.py import --domain contacts --to-db")
        print("  python crawlers/cli.py import --domain organizations --to-db")
        print("  python crawlers/cli.py import --domain tools --to-db")


if __name__ == "__main__":
    main()
