# services/crawler/run.py
import argparse, json, importlib, glob, os
from core.base import create, list_plugins
from core.io import save_json

OUT = "../api/data/benefits.json"

def load_cfg(plugin_name: str) -> dict:
    cfg_path = f"plugins/{plugin_name}/config.json"
    with open(cfg_path, "r", encoding="utf-8") as f:
        return json.load(f)

def auto_import_plugins():
    for path in glob.glob("plugins/**/plugin.py", recursive=True):
        mod_path = path.replace("/", ".").replace("\\", ".").removesuffix(".py")
        importlib.import_module(mod_path)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--plugins", nargs="*", default=[],
                        help="plugin names, e.g. arbeitsagentur wohngeld generic_sitemap")
    parser.add_argument("--out", default=OUT)
    args = parser.parse_args()

    auto_import_plugins()

    records = []
    targets = args.plugins or [p for p in list_plugins() if p != "generic"]  # default: all specific
    for name in targets:
        cfg = load_cfg(name)
        crawler = create(name, cfg)
        discovered = list(crawler.discover())
        print(f"🔎 {name}: {len(discovered)} urls")
        for i, item in enumerate(discovered, 1):
            print(f"📥 [{name} {i}/{len(discovered)}] {item.url}")
            rec = crawler.fetch_one(item)
            records.append(crawler.normalize(rec))

    save_json(args.out, records)
    print(f"✅ Saved {len(records)} records to {args.out}")

if __name__ == "__main__":
    main()
