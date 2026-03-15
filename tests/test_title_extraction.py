from crawlers.shared.base_crawler import BaseCrawler


class DummyCrawler(BaseCrawler):
    def __init__(self):
        super().__init__("dummy", "Systemfehler-Test/0.1.0", rate_limit_delay=0)


def test_best_title_prefers_head_metadata_over_cta_h1():
    crawler = DummyCrawler()
    soup = crawler.parse_html(
        """
        <html>
          <head>
            <title>Bürgergeld beantragen | Bundesagentur für Arbeit</title>
            <meta property="og:title" content="Bürgergeld beantragen" />
            <meta name="description" content="Offizielle Informationen zu Anspruch und Antrag." />
          </head>
          <body>
            <main>
              <h1>Jetzt Bürgergeld sichern</h1>
              <p>Offizielle Informationen zu Anspruch und Antrag.</p>
            </main>
          </body>
        </html>
        """
    )

    assert crawler._get_best_title(soup, seed_name="benefits", url="https://example.org") == "Bürgergeld beantragen"


def test_best_title_falls_back_to_h1_when_head_title_is_generic():
    crawler = DummyCrawler()
    soup = crawler.parse_html(
        """
        <html>
          <head>
            <title>Startseite</title>
            <meta name="description" content="Hilfen für Familien" />
          </head>
          <body>
            <main>
              <h1>Unterhaltsvorschuss</h1>
            </main>
          </body>
        </html>
        """
    )

    assert crawler._get_best_title(soup, seed_name="aid", url="https://example.org") == "Unterhaltsvorschuss"
