import unittest
from datetime import datetime, timezone

from crawlers.shared.source_metadata_enrichment import enrich_entry_source_metadata
from crawlers.shared.source_registry import SourceProfile


class StubRegistry:
    def __init__(self, profile):
        self.profile = profile

    def resolve(self, url, domain):
        return self.profile


class SourceMetadataEnrichmentTest(unittest.TestCase):
    def test_fills_unknown_tier_from_registry(self):
        profile = SourceProfile(
            source_id="gesund_bund_de",
            name="gesund.bund.de",
            base_url="https://gesund.bund.de",
            domains=("aid",),
            canonical_domain="gesund.bund.de",
            publisher_name="Bundesministerium fuer Gesundheit",
            source_tier="tier_1_official",
            source_tier_status="verified",
            institution_type="government",
            provider_level="federal",
            review_status="approved",
        )
        entry = {
            "url": "https://gesund.bund.de/depression",
            "provenance": {"sourceTier": "tier_unknown"},
        }

        changed = enrich_entry_source_metadata(
            entry,
            "aid",
            StubRegistry(profile),
            now=datetime(2026, 6, 30, tzinfo=timezone.utc),
        )

        self.assertTrue(changed)
        self.assertEqual(entry["provenance"]["sourceTier"], "tier_1_official")
        self.assertEqual(entry["provenance"]["sourceTierStatus"], "verified")
        self.assertEqual(entry["provenance"]["sourceTierResolvedFrom"], "source_registry")
        self.assertEqual(entry["provenance"]["institutionType"], "government")
        self.assertEqual(entry["provenance"]["providerName"], "gesund.bund.de")
        self.assertEqual(entry["provenance"]["host"], "gesund.bund.de")
        self.assertEqual(entry["provenance"]["canonicalDomain"], "gesund.bund.de")
        self.assertEqual(entry["provenance"]["sourceDomain"], "gesund.bund.de")
        self.assertEqual(entry["provenance"]["publisherName"], "Bundesministerium fuer Gesundheit")
        self.assertEqual(entry["provenance"]["reviewStatus"], "approved")

    def test_preserves_curated_tier_without_overwrite(self):
        profile = SourceProfile(
            source_id="caritas_de",
            name="Caritas",
            base_url="https://www.caritas.de",
            domains=("aid",),
            source_tier="tier_2_ngo_watchdog",
            institution_type="ngo",
        )
        entry = {
            "url": "https://www.caritas.de/hilfeundberatung",
            "provenance": {"sourceTier": "tier_1_official", "institutionType": "government"},
        }

        changed = enrich_entry_source_metadata(entry, "aid", StubRegistry(profile))

        self.assertTrue(changed)
        self.assertEqual(entry["provenance"]["sourceTier"], "tier_1_official")
        self.assertEqual(entry["provenance"]["institutionType"], "government")
        self.assertEqual(entry["provenance"]["sourceId"], "caritas_de")

    def test_overwrite_replaces_curated_tier_when_explicit(self):
        profile = SourceProfile(
            source_id="caritas_de",
            name="Caritas",
            base_url="https://www.caritas.de",
            domains=("aid",),
            source_tier="tier_2_ngo_watchdog",
            institution_type="ngo",
        )
        entry = {
            "url": "https://www.caritas.de/hilfeundberatung",
            "provenance": {"sourceTier": "tier_1_official", "institutionType": "government"},
        }

        changed = enrich_entry_source_metadata(entry, "aid", StubRegistry(profile), overwrite=True)

        self.assertTrue(changed)
        self.assertEqual(entry["provenance"]["sourceTier"], "tier_2_ngo_watchdog")
        self.assertEqual(entry["provenance"]["institutionType"], "ngo")


if __name__ == "__main__":
    unittest.main()
