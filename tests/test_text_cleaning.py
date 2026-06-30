import unittest

from crawlers.shared.text_cleaning import clean_entry_text, clean_text, decode_payload


class TextCleaningTest(unittest.TestCase):
    def test_repairs_common_mojibake_and_entities(self):
        mojibake = b"Ma\xc3\x9fnahmen&nbsp;f\xc3\xbcr&nbsp;Angeh\xc3\xb6rige".decode("cp1252")
        self.assertEqual(
            clean_text(mojibake),
            "Maßnahmen für Angehörige",
        )

    def test_decodes_cp1252_payloads(self):
        self.assertEqual(decode_payload("Maßnahmen".encode("cp1252")), "Maßnahmen")

    def test_drops_pdf_binary_text_from_human_fields(self):
        entry = {
            "id": "pdf",
            "url": "https://example.org/file.pdf",
            "summary": {"de": "%PDF-1.6 37 0 obj <> stream h���� endstream startxref"},
            "content": {"de": "Normale Beschreibung"},
        }

        self.assertTrue(clean_entry_text(entry))
        self.assertEqual(entry["summary"]["de"], "")
        self.assertEqual(entry["content"]["de"], "Normale Beschreibung")

    def test_cleans_human_fields_without_rewriting_ids_or_urls(self):
        mojibake_id = b"Ma\xc3\x9fnahmen".decode("cp1252")
        mojibake_title = b"Hilfe&nbsp;f\xc3\xbcr Familien".decode("cp1252")
        mojibake_provider = b"Bundesagentur f\xc3\xbcr Arbeit".decode("cp1252")
        entry = {
            "id": "entry " + mojibake_id,
            "url": "https://example.org/a?x=1&amp;y=2",
            "title": {"de": mojibake_title},
            "summary": {"de": "Zeile\u000b mit Kontrolle"},
            "provenance": {"providerName": mojibake_provider},
        }

        changed = clean_entry_text(entry)

        self.assertTrue(changed)
        self.assertEqual(entry["id"], "entry " + mojibake_id)
        self.assertEqual(entry["url"], "https://example.org/a?x=1&amp;y=2")
        self.assertEqual(entry["title"]["de"], "Hilfe für Familien")
        self.assertEqual(entry["summary"]["de"], "Zeile mit Kontrolle")
        self.assertEqual(entry["provenance"]["providerName"], "Bundesagentur für Arbeit")


if __name__ == "__main__":
    unittest.main()
