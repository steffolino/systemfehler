import unittest

from scripts.build_source_site_context import (
    HeadMetadataParser,
    decode_payload,
    infer_domain_capabilities,
    infer_coverage_hints,
    parse_sitemap_locations,
    select_meta_sample_urls,
    summarize_paths,
)


class SourceSiteContextTest(unittest.TestCase):
    def test_parse_sitemap_locations(self):
        kind, locations = parse_sitemap_locations(
            """<?xml version="1.0" encoding="UTF-8"?>
            <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
              <url><loc>https://example.org/beratung</loc></url>
              <url><loc>https://example.org/kontakt</loc></url>
            </urlset>"""
        )

        self.assertEqual(kind, "urlset")
        self.assertEqual(locations, ["https://example.org/beratung", "https://example.org/kontakt"])

    def test_extract_head_metadata(self):
        parser = HeadMetadataParser()
        parser.feed(
            """<html><head>
            <title> Beratung finden </title>
            <meta name="description" content="Hilfe und Beratung vor Ort finden.">
            <meta property="og:description" content="Fallback">
            </head><body>ignored</body></html>"""
        )

        self.assertEqual(parser.title, "Beratung finden")
        self.assertEqual(parser.description, "Hilfe und Beratung vor Ort finden.")

    def test_selects_high_signal_urls_first(self):
        urls = [
            "https://example.org/presse/news",
            "https://example.org/datenschutz",
            "https://example.org/beratung/kontakt",
        ]

        self.assertEqual(select_meta_sample_urls(urls, 1), ["https://example.org/beratung/kontakt"])

    def test_summarizes_paths_and_hints(self):
        urls = [
            "https://example.org/beratung/kontakt",
            "https://example.org/beratung/online",
            "https://example.org/depression/hilfe",
        ]
        pages = [{"title": "Depression Hilfe", "description": "Psychische Krise und Beratung"}]

        self.assertEqual(summarize_paths(urls)[0], {"path": "/beratung/kontakt", "count": 1})
        self.assertIn("mental_health", infer_coverage_hints(urls, pages))
        self.assertIn("contacts", infer_coverage_hints(urls, pages))

    def test_infers_capabilities_with_evidence(self):
        urls = [
            "https://example.org/pflege/beratung",
            "https://example.org/familie/kinderzuschlag",
        ]
        pages = [
            {
                "url": "https://example.org/pflege/beratung",
                "title": "Pflegeberatung",
                "description": "Beratung und Entlastung für pflegende Angehörige.",
            }
        ]

        capabilities = infer_domain_capabilities(urls, pages)
        ids = [item["id"] for item in capabilities]
        self.assertIn("caregiving", ids)
        self.assertTrue(next(item for item in capabilities if item["id"] == "caregiving")["evidence"])

    def test_decodes_cp1252_when_utf8_fails(self):
        self.assertEqual(decode_payload("Maßnahmen".encode("cp1252")), "Maßnahmen")


if __name__ == "__main__":
    unittest.main()
