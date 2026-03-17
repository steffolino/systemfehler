from bs4 import BeautifulSoup

from crawlers.contacts.seeded_crawler import SeededContactsCrawler


def test_contacts_related_discovery_extracts_high_signal_internal_links():
    crawler = SeededContactsCrawler("Systemfehler-Test/0.1")
    soup = BeautifulSoup(
        """
        <html><body>
          <a href="/gebaerdensprache">115 in Gebaerdensprache</a>
          <a href="/de-leicht">115 in Leichter Sprache</a>
          <a href="/news">News</a>
          <a href="https://www.bmas.de/DE/Service/Kontakt/Kontaktformular/kontaktformular.html">BMAS Kontakt</a>
        </body></html>
        """,
        "lxml",
    )

    seed = {
        "url": "https://www.115.de/",
        "source": "service115",
        "topics": ["contacts", "public_service"],
        "tags": ["official_contact_source", "contact"],
        "targetGroups": ["general_public", "persons_with_disabilities"],
    }

    records = crawler.discover_related_seed_records(seed["url"], soup, seed)
    urls = {record["url"] for record in records}
    source_by_url = {record["url"]: record["source"] for record in records}

    assert "https://www.115.de/gebaerdensprache" in urls
    assert "https://www.115.de/de-leicht" in urls
    assert "https://www.bmas.de/DE/Service/Kontakt/Kontaktformular/kontaktformular.html" in urls
    assert "https://www.115.de/news" not in urls
    assert source_by_url["https://www.bmas.de/DE/Service/Kontakt/Kontaktformular/kontaktformular.html"] == "bmas"
