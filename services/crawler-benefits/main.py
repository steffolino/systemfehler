import json
from utils import fetch_info_page, save_data

if __name__ == "__main__":
    with open("urls.json", "r") as f:
        entries = json.load(f)

    results = []

    for entry in entries:
        print(f"📥 Crawling: {entry['url']}")
        data = fetch_info_page(entry["url"])
        if data:
            data["topic"] = entry.get("topic")
            data["source"] = entry.get("source")
            results.append(data)

    save_data("output/antragsinfos.json", results)
    print(f"✅ Gespeichert: {len(results)} Seiten mit Topic/Source")
