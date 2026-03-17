from bs4 import BeautifulSoup

from crawlers.benefits.seeded_crawler import SeededBenefitsCrawler


def test_benefits_related_discovery_extracts_high_signal_internal_links():
    crawler = SeededBenefitsCrawler("Systemfehler-Test/0.1")
    soup = BeautifulSoup(
        """
        <html><body>
          <a href="/arbeitslos-arbeit-finden/buergergeld/buergergeld-beantragen">Beantragen</a>
          <a href="/arbeitslos-arbeit-finden/buergergeld/pflichten-verstehen-und-beachten">Pflichten</a>
          <a href="/datenschutz">Datenschutz</a>
          <a href="https://www.bmas.de/DE/Arbeit/Grundsicherung-Buergergeld/Buergergeld/buergergeld.html">BMAS</a>
        </body></html>
        """,
        "lxml",
    )

    seed = {
        "url": "https://www.arbeitsagentur.de/arbeitslos-arbeit-finden/buergergeld",
        "source": "arbeitsagentur",
        "topics": ["financial_support", "buergergeld"],
        "tags": ["official_rule_source"],
        "targetGroups": ["unemployed"],
    }

    records = crawler.discover_related_seed_records(seed["url"], soup, seed)
    urls = {record["url"] for record in records}
    source_by_url = {record["url"]: record["source"] for record in records}

    assert "https://www.arbeitsagentur.de/arbeitslos-arbeit-finden/buergergeld/buergergeld-beantragen" in urls
    assert "https://www.arbeitsagentur.de/arbeitslos-arbeit-finden/buergergeld/pflichten-verstehen-und-beachten" in urls
    assert "https://www.bmas.de/DE/Arbeit/Grundsicherung-Buergergeld/Buergergeld/buergergeld.html" in urls
    assert "https://www.arbeitsagentur.de/datenschutz" not in urls
    assert source_by_url["https://www.bmas.de/DE/Arbeit/Grundsicherung-Buergergeld/Buergergeld/buergergeld.html"] == "bmas"
