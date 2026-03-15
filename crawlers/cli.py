#!/usr/bin/env python3
"""
Systemfehler Crawler CLI

Command-line interface for running crawlers, validating data, and importing to database.

Usage:
    python crawlers/cli.py crawl benefits --source arbeitsagentur
    python crawlers/cli.py validate --domain benefits
    python crawlers/cli.py import --domain benefits --to-db
"""

import argparse
import json
import logging
import os
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv

from crawlers.benefits.arbeitsagentur_crawler import ArbeitsagenturCrawler
from crawlers.aid.seeded_crawler import SeededAidCrawler
from crawlers.tools.seeded_crawler import SeededToolsCrawler
from crawlers.organizations.seeded_crawler import SeededOrganizationsCrawler
from crawlers.contacts.seeded_crawler import SeededContactsCrawler
from crawlers.shared.validator import SchemaValidator
from crawlers.shared.quality_scorer import QualityScorer
from crawlers.shared.diff_generator import DiffGenerator
from crawlers.shared.link_expander import LinkExpander
from crawlers.shared.moderation_queue import (
    canonicalize_queue_payload,
    canonicalize_queue_entry,
    validate_queue_entry,
)


# Load environment variables
load_dotenv()

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('systemfehler.cli')


def _get_localized_value(entry: dict, field: str, lang: str) -> str | None:
    value = entry.get(field)
    if isinstance(value, str):
        return value if lang == 'de' else None
    if isinstance(value, dict):
        return value.get(lang)
    return None


def _get_easy_title(entry: dict) -> str | None:
    direct = _get_localized_value(entry, 'title', 'easy_de')
    if direct:
        return direct

    translations = entry.get('translations') or {}
    easy = translations.get('de-LEICHT') if isinstance(translations, dict) else None
    if isinstance(easy, dict):
        title = easy.get('title')
        if isinstance(title, str):
            return title
    return None


def _json_value(raw):
    return raw if raw not in (None, '', [], {}) else None


def crawl_benefits(source: str, output_dir: str):
    """
    Crawl benefits data from specified source
    
    Args:
        source: Source name (e.g., 'arbeitsagentur')
        output_dir: Output directory for candidates
    """
    logger.info(f"Starting benefits crawl from source: {source}")
    
    # Get configuration from environment
    user_agent = os.getenv('CRAWLER_USER_AGENT', 'Systemfehler/0.1.0')
    rate_limit = float(os.getenv('CRAWLER_RATE_LIMIT_DELAY', '2000')) / 1000  # Convert ms to seconds
    
    if source == 'arbeitsagentur':
        crawler = ArbeitsagenturCrawler(user_agent, rate_limit)
    else:
        logger.error(f"Unknown source: {source}")
        return False
    
    try:
        # Run crawler
        entries = crawler.crawl()
        
        if not entries:
            logger.warning("No entries extracted")
            return False
        
        # Save candidates
        output_path = os.path.join(output_dir, 'benefits', 'candidates.json')
        crawler.save_candidates(entries, output_path)
        
        # Validate entries
        validator = SchemaValidator()
        for entry in entries:
            # Remove non-schema fields before validation
            entry_for_validation = dict(entry)
            entry_for_validation.pop('head', None)
            result = validator.validate_entry(entry_for_validation, 'benefits')
            if not result['valid']:
                logger.error(f"Validation failed for entry {entry.get('id')}")
                for error in result['errors']:
                    logger.error(f"  - {error}")
            else:
                logger.info(f"Entry {entry.get('id')} validated successfully")
                if result['warnings']:
                    for warning in result['warnings']:
                        logger.warning(f"  - {warning}")
        
        # Generate diffs if existing entries exist
        existing_entries_path = os.path.join(output_dir, 'benefits', 'entries.json')
        if os.path.exists(existing_entries_path):
            logger.info("Generating diffs against existing entries")
            generate_diffs(entries, existing_entries_path, output_dir, 'benefits')
        
        logger.info(f"Crawl completed successfully. {len(entries)} entries extracted.")
        return True
        
    except Exception as e:
        logger.error(f"Crawl failed: {e}", exc_info=True)
        return False
    finally:
        crawler.close()


def crawl_seeded_domain(domain: str, source: str, output_dir: str):
    """Crawl non-benefits domains using seeded URL lists."""
    logger.info(f"Starting {domain} crawl from source: {source}")

    if source not in ('seeded', 'urls', 'auto'):
        logger.error(f"Unknown source '{source}' for domain '{domain}'. Use --source seeded")
        return False

    user_agent = os.getenv('CRAWLER_USER_AGENT', 'Systemfehler/0.1.0')
    rate_limit = float(os.getenv('CRAWLER_RATE_LIMIT_DELAY', '2000')) / 1000

    crawler_map = {
        'aid': SeededAidCrawler,
        'tools': SeededToolsCrawler,
        'organizations': SeededOrganizationsCrawler,
        'contacts': SeededContactsCrawler,
    }

    crawler_cls = crawler_map.get(domain)
    if not crawler_cls:
        logger.error(f"Unsupported seeded crawler domain: {domain}")
        return False

    crawler = crawler_cls(user_agent, rate_limit, data_dir=output_dir)

    try:
        entries = crawler.crawl()
        if not entries:
            logger.warning(f"No entries extracted for domain {domain}")
            return False

        output_path = os.path.join(output_dir, domain, 'candidates.json')
        crawler.save_candidates(entries, output_path)
        metrics_path = os.path.join(output_dir, domain, 'crawl_metrics.json')
        metrics = crawler.save_metrics(metrics_path)

        existing_entries_path = os.path.join(output_dir, domain, 'entries.json')
        if os.path.exists(existing_entries_path):
            logger.info(f"Generating diffs against existing {domain} entries")
            generate_diffs(entries, existing_entries_path, output_dir, domain)

        logger.info(
            "%s crawl completed successfully. entries=%s avg_iqs=%s avg_ais=%s metrics=%s",
            domain,
            len(entries),
            metrics['quality']['avgIqs'],
            metrics['quality']['avgAis'],
            metrics_path,
        )
        return True
    except Exception as e:
        logger.error(f"{domain} crawl failed: {e}", exc_info=True)
        return False
    finally:
        crawler.close()


def generate_diffs(new_entries, existing_path, output_dir, domain):
    """Generate diffs and add to moderation queue"""
    diff_generator = DiffGenerator()
    
    # Load existing entries
    with open(existing_path, 'r', encoding='utf-8') as f:
        existing_data = json.load(f)
        existing_entries = existing_data.get('entries', [])
    
    # Create lookup by URL for matching
    existing_by_url = {e['url']: e for e in existing_entries if 'url' in e}
    
    moderation_queue = []
    
    for new_entry in new_entries:
        url = new_entry.get('url')
        old_entry = existing_by_url.get(url)
        
        # Generate diff
        diff = diff_generator.generate_diff(old_entry, new_entry)
        diff_summary = diff_generator.get_diff_summary(diff)
        important_changes = diff_generator.highlight_important_changes(diff)
        
        # Create moderation queue entry (canonical shape)
        queue_entry = {
            'id': new_entry['id'],
            'entryId': old_entry['id'] if old_entry else None,
            'domain': domain,
            'action': 'update' if old_entry else 'create',
            'status': 'pending',
            'candidateData': new_entry,
            'existingData': old_entry,
            'diff': diff,
            'diffSummary': diff_summary,
            'importantChanges': important_changes,
            'provenance': new_entry.get('provenance'),
            'createdAt': new_entry.get('provenance', {}).get('crawledAt')
        }

        canonical_entry = canonicalize_queue_entry(queue_entry)
        validation_errors = validate_queue_entry(canonical_entry)
        if validation_errors:
            logger.error(f"Skipping moderation item for {url} due to invalid queue format")
            for err in validation_errors:
                logger.error(f"  - {err}")
            continue

        moderation_queue.append(canonical_entry)
        
        logger.info(f"Generated diff for {url}: {diff_summary['total_changes']} changes")
        if important_changes:
            logger.warning(f"Important changes detected:")
            for change in important_changes:
                logger.warning(f"  - {change}")
    
    # Save to moderation queue
    queue_path = os.path.join(output_dir, '..', 'moderation', 'review_queue.json')
    os.makedirs(os.path.dirname(queue_path), exist_ok=True)
    
    # Load existing queue
    if os.path.exists(queue_path):
        with open(queue_path, 'r', encoding='utf-8') as f:
            queue_data = json.load(f)
    else:
        queue_data = []

    existing_queue = canonicalize_queue_payload(queue_data)

    # Add new entries to queue
    existing_queue.extend(moderation_queue)
    
    # Save updated queue
    with open(queue_path, 'w', encoding='utf-8') as f:
        json.dump(existing_queue, f, indent=2, ensure_ascii=False)
    
    logger.info(f"Added {len(moderation_queue)} entries to moderation queue")


def run_link_expander(domain: str, data_dir: str, limit: int, verify: bool):
    """Run Python link expansion for a domain URL queue."""
    user_agent = os.getenv('CRAWLER_USER_AGENT', 'Systemfehler/0.1.0')
    rate_limit = float(os.getenv('CRAWLER_RATE_LIMIT_DELAY', '2000')) / 1000

    expander = LinkExpander(user_agent=user_agent, rate_limit_delay=rate_limit, data_dir=data_dir)
    try:
        report = expander.expand(domain=domain, limit=limit, verify=verify)
        logger.info(
            "Link expansion report for %s: scanned=%s discovered=%s added=%s broken=%s queued=%s",
            report['domain'],
            report['scanned'],
            report['discovered'],
            report['added'],
            report['broken'],
            report['queued'],
        )
        return True
    except Exception as e:
        logger.error(f"Link expansion failed for {domain}: {e}", exc_info=True)
        return False
    finally:
        expander.close()


def validate_domain(domain: str, data_dir: str):
    """
    Validate all entries in a domain
    
    Args:
        domain: Domain name (benefits, aid, etc.)
        data_dir: Data directory path
    """
    logger.info(f"Validating {domain} entries")
    
    entries_path = os.path.join(data_dir, domain, 'entries.json')
    
    if not os.path.exists(entries_path):
        logger.error(f"Entries file not found: {entries_path}")
        return False
    
    # Load entries
    with open(entries_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        entries = data.get('entries', [])
    
    if not entries:
        logger.warning(f"No entries found in {domain}")
        return True
    
    # Validate
    validator = SchemaValidator()
    results = validator.validate_batch(entries, domain)
    
    # Print report (force UTF-8 encoding)
    report = validator.generate_validation_report(results)
    try:
        print(report)
    except UnicodeEncodeError:
        import sys
        sys.stdout.buffer.write(report.encode('utf-8'))
    
    return results['invalid'] == 0


def import_to_db(domain: str, data_dir: str):
    """
    Import entries to PostgreSQL database
    
    Args:
        domain: Domain name
        data_dir: Data directory path
    """
    logger.info(f"Importing {domain} entries to database")
    
    try:
        import psycopg2
        from psycopg2.extras import Json
    except ImportError:
        logger.error("psycopg2 not installed. Run: pip install psycopg2-binary")
        return False
    
    # Get database URL from environment
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        logger.error("DATABASE_URL not set in environment")
        return False
    
    # Load entries
    entries_path = os.path.join(data_dir, domain, 'entries.json')
    if not os.path.exists(entries_path):
        logger.error(f"Entries file not found: {entries_path}")
        return False
    
    with open(entries_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        entries = data.get('entries', [])
    
    if not entries:
        logger.warning(f"No entries to import from {domain}")
        return True
    
    try:
        # Connect to database
        conn = psycopg2.connect(database_url)
        cur = conn.cursor()
        
        imported_count = 0
        
        for entry in entries:
            try:
                title_de = _get_localized_value(entry, 'title', 'de')
                title_en = _get_localized_value(entry, 'title', 'en')
                title_easy_de = _get_easy_title(entry)
                summary_de = _get_localized_value(entry, 'summary', 'de')
                summary_en = _get_localized_value(entry, 'summary', 'en')
                summary_easy_de = _get_localized_value(entry, 'summary', 'easy_de')
                content_de = _get_localized_value(entry, 'content', 'de')
                content_en = _get_localized_value(entry, 'content', 'en')
                content_easy_de = _get_localized_value(entry, 'content', 'easy_de')

                # Insert into entries table
                cur.execute("""
                    INSERT INTO entries (
                        id, domain, title_de, title_en, title_easy_de,
                        summary_de, summary_en, summary_easy_de,
                        content_de, content_en, content_easy_de,
                        url, topics, tags, target_groups,
                        valid_from, valid_until, deadline, status,
                        first_seen, last_seen, source_unavailable,
                        provenance, translations, quality_scores
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                    )
                    ON CONFLICT (id) DO UPDATE SET
                        title_de = EXCLUDED.title_de,
                        title_en = EXCLUDED.title_en,
                        title_easy_de = EXCLUDED.title_easy_de,
                        summary_de = EXCLUDED.summary_de,
                        summary_en = EXCLUDED.summary_en,
                        summary_easy_de = EXCLUDED.summary_easy_de,
                        content_de = EXCLUDED.content_de,
                        content_en = EXCLUDED.content_en,
                        content_easy_de = EXCLUDED.content_easy_de,
                        url = EXCLUDED.url,
                        topics = EXCLUDED.topics,
                        tags = EXCLUDED.tags,
                        target_groups = EXCLUDED.target_groups,
                        valid_from = EXCLUDED.valid_from,
                        valid_until = EXCLUDED.valid_until,
                        deadline = EXCLUDED.deadline,
                        status = EXCLUDED.status,
                        last_seen = EXCLUDED.last_seen,
                        source_unavailable = EXCLUDED.source_unavailable,
                        provenance = EXCLUDED.provenance,
                        translations = EXCLUDED.translations,
                        quality_scores = EXCLUDED.quality_scores,
                        updated_at = NOW()
                """, (
                    entry['id'], domain,
                    title_de, title_en, title_easy_de,
                    summary_de, summary_en, summary_easy_de,
                    content_de, content_en, content_easy_de,
                    entry['url'], entry.get('topics', []), entry.get('tags', []), entry.get('targetGroups', []),
                    entry.get('validFrom'), entry.get('validUntil'), entry.get('deadline'), entry['status'],
                    entry.get('firstSeen'), entry.get('lastSeen'), entry.get('sourceUnavailable', False),
                    Json(entry.get('provenance', {})), Json(entry.get('translations', {})), Json(entry.get('qualityScores', {}))
                ))
                
                # Insert into domain-specific table if applicable
                if domain == 'benefits':
                    cur.execute("""
                        INSERT INTO benefits (
                            entry_id, benefit_amount_de, benefit_amount_en, benefit_amount_easy_de,
                            duration, eligibility_criteria_de, eligibility_criteria_en, eligibility_criteria_easy_de,
                            application_steps, required_documents, form_link, contact_info
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (entry_id) DO UPDATE SET
                            benefit_amount_de = EXCLUDED.benefit_amount_de,
                            benefit_amount_en = EXCLUDED.benefit_amount_en,
                            benefit_amount_easy_de = EXCLUDED.benefit_amount_easy_de,
                            duration = EXCLUDED.duration,
                            eligibility_criteria_de = EXCLUDED.eligibility_criteria_de,
                            eligibility_criteria_en = EXCLUDED.eligibility_criteria_en,
                            eligibility_criteria_easy_de = EXCLUDED.eligibility_criteria_easy_de,
                            application_steps = EXCLUDED.application_steps,
                            required_documents = EXCLUDED.required_documents,
                            form_link = EXCLUDED.form_link,
                            contact_info = EXCLUDED.contact_info
                    """, (
                        entry['id'],
                        _get_localized_value(entry, 'benefitAmount', 'de'),
                        _get_localized_value(entry, 'benefitAmount', 'en'),
                        _get_localized_value(entry, 'benefitAmount', 'easy_de'),
                        entry.get('duration'),
                        _get_localized_value(entry, 'eligibilityCriteria', 'de'),
                        _get_localized_value(entry, 'eligibilityCriteria', 'en'),
                        _get_localized_value(entry, 'eligibilityCriteria', 'easy_de'),
                        Json(entry.get('applicationSteps', [])),
                        Json(entry.get('requiredDocuments', [])),
                        entry.get('formLink'),
                        Json(_json_value(entry.get('contactInfo')))
                    ))
                elif domain == 'aid':
                    cur.execute("""
                        INSERT INTO aid (
                            entry_id, aid_type, provider,
                            amount_de, amount_en, amount_easy_de,
                            eligibility_de, eligibility_en, eligibility_easy_de,
                            application_process, required_documents, form_link, contact_info
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (entry_id) DO UPDATE SET
                            aid_type = EXCLUDED.aid_type,
                            provider = EXCLUDED.provider,
                            amount_de = EXCLUDED.amount_de,
                            amount_en = EXCLUDED.amount_en,
                            amount_easy_de = EXCLUDED.amount_easy_de,
                            eligibility_de = EXCLUDED.eligibility_de,
                            eligibility_en = EXCLUDED.eligibility_en,
                            eligibility_easy_de = EXCLUDED.eligibility_easy_de,
                            application_process = EXCLUDED.application_process,
                            required_documents = EXCLUDED.required_documents,
                            form_link = EXCLUDED.form_link,
                            contact_info = EXCLUDED.contact_info
                    """, (
                        entry['id'],
                        entry.get('aidType'),
                        entry.get('providingOrganization'),
                        _get_localized_value(entry, 'amount', 'de'),
                        _get_localized_value(entry, 'amount', 'en'),
                        _get_localized_value(entry, 'amount', 'easy_de'),
                        _get_localized_value(entry, 'eligibility', 'de'),
                        _get_localized_value(entry, 'eligibility', 'en'),
                        _get_localized_value(entry, 'eligibility', 'easy_de'),
                        Json(entry.get('applicationProcess', [])),
                        Json(entry.get('requiredDocuments', [])),
                        entry.get('formLink'),
                        Json(_json_value(entry.get('contactInfo')))
                    ))
                elif domain == 'tools':
                    cur.execute("""
                        INSERT INTO tools (
                            entry_id, tool_type, tool_url,
                            instructions_de, instructions_en, instructions_easy_de,
                            features, requirements
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (entry_id) DO UPDATE SET
                            tool_type = EXCLUDED.tool_type,
                            tool_url = EXCLUDED.tool_url,
                            instructions_de = EXCLUDED.instructions_de,
                            instructions_en = EXCLUDED.instructions_en,
                            instructions_easy_de = EXCLUDED.instructions_easy_de,
                            features = EXCLUDED.features,
                            requirements = EXCLUDED.requirements
                    """, (
                        entry['id'],
                        entry.get('toolType'),
                        entry.get('toolUrl') or entry.get('url'),
                        _get_localized_value(entry, 'instructions', 'de'),
                        _get_localized_value(entry, 'instructions', 'en'),
                        _get_localized_value(entry, 'instructions', 'easy_de'),
                        Json(entry.get('features', [])),
                        entry.get('requirements')
                    ))
                elif domain == 'organizations':
                    cur.execute("""
                        INSERT INTO organizations (
                            entry_id, organization_type,
                            description_de, description_en, description_easy_de,
                            services_offered, locations,
                            contact_info, operating_hours, accessibility_info
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (entry_id) DO UPDATE SET
                            organization_type = EXCLUDED.organization_type,
                            description_de = EXCLUDED.description_de,
                            description_en = EXCLUDED.description_en,
                            description_easy_de = EXCLUDED.description_easy_de,
                            services_offered = EXCLUDED.services_offered,
                            locations = EXCLUDED.locations,
                            contact_info = EXCLUDED.contact_info,
                            operating_hours = EXCLUDED.operating_hours,
                            accessibility_info = EXCLUDED.accessibility_info
                    """, (
                        entry['id'],
                        entry.get('organizationType'),
                        _get_localized_value(entry, 'description', 'de'),
                        _get_localized_value(entry, 'description', 'en'),
                        _get_localized_value(entry, 'description', 'easy_de'),
                        Json(entry.get('servicesOffered', [])),
                        Json(entry.get('locations', [])),
                        Json(_json_value(entry.get('contactInfo'))),
                        entry.get('operatingHours'),
                        entry.get('accessibilityInfo')
                    ))
                elif domain == 'contacts':
                    availability = entry.get('availability') if isinstance(entry.get('availability'), dict) else {}
                    cur.execute("""
                        INSERT INTO contacts (
                            entry_id, contact_type,
                            name, phone, email, address,
                            description_de, description_en, description_easy_de,
                            available_hours, languages_supported
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (entry_id) DO UPDATE SET
                            contact_type = EXCLUDED.contact_type,
                            name = EXCLUDED.name,
                            phone = EXCLUDED.phone,
                            email = EXCLUDED.email,
                            address = EXCLUDED.address,
                            description_de = EXCLUDED.description_de,
                            description_en = EXCLUDED.description_en,
                            description_easy_de = EXCLUDED.description_easy_de,
                            available_hours = EXCLUDED.available_hours,
                            languages_supported = EXCLUDED.languages_supported
                    """, (
                        entry['id'],
                        entry.get('contactType'),
                        entry.get('name'),
                        entry.get('phone'),
                        entry.get('email'),
                        entry.get('address'),
                        _get_localized_value(entry, 'description', 'de'),
                        _get_localized_value(entry, 'description', 'en'),
                        _get_localized_value(entry, 'description', 'easy_de'),
                        availability.get('hours'),
                        availability.get('languages', [])
                    ))
                
                imported_count += 1
                
            except Exception as e:
                logger.error(f"Failed to import entry {entry.get('id')}: {e}")
                conn.rollback()
                continue
        
        conn.commit()
        cur.close()
        conn.close()
        
        logger.info(f"Successfully imported {imported_count}/{len(entries)} entries")
        return True
        
    except Exception as e:
        logger.error(f"Database import failed: {e}", exc_info=True)
        return False


def main():
    parser = argparse.ArgumentParser(
        description='Systemfehler Crawler CLI',
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    
    subparsers = parser.add_subparsers(dest='command', help='Command to execute')
    
    # Crawl command
    crawl_parser = subparsers.add_parser('crawl', help='Run a crawler')
    crawl_parser.add_argument('domain', choices=['benefits', 'aid', 'tools', 'organizations', 'contacts'],
                             help='Domain to crawl')
    crawl_parser.add_argument('--source', required=True, help='Source to crawl (e.g., arbeitsagentur)')
    crawl_parser.add_argument('--output', default='./data', help='Output directory')
    
    # Validate command
    validate_parser = subparsers.add_parser('validate', help='Validate entries')
    validate_parser.add_argument('--domain', required=True,
                                choices=['benefits', 'aid', 'tools', 'organizations', 'contacts'],
                                help='Domain to validate')
    validate_parser.add_argument('--data-dir', default='./data', help='Data directory')
    
    # Import command
    import_parser = subparsers.add_parser('import', help='Import entries to database')
    import_parser.add_argument('--domain', required=True,
                              choices=['benefits', 'aid', 'tools', 'organizations', 'contacts'],
                              help='Domain to import')
    import_parser.add_argument('--data-dir', default='./data', help='Data directory')
    import_parser.add_argument('--to-db', action='store_true', help='Import to PostgreSQL database')

    # Link expansion command
    expand_parser = subparsers.add_parser('expand-links', help='Discover additional URLs from existing source pages')
    expand_parser.add_argument('--domain', required=True,
                               choices=['benefits', 'aid', 'tools', 'organizations', 'contacts'],
                               help='Domain URL queue to expand')
    expand_parser.add_argument('--data-dir', default='./data', help='Data directory')
    expand_parser.add_argument('--limit', type=int, default=25, help='Max seed URLs to scan')
    expand_parser.add_argument('--no-verify', action='store_true', help='Skip HTTP verification of discovered links')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        sys.exit(1)
    
    # Execute command
    success = False
    
    if args.command == 'crawl':
        if args.domain == 'benefits':
            success = crawl_benefits(args.source, args.output)
        elif args.domain in ('aid', 'tools', 'organizations', 'contacts'):
            success = crawl_seeded_domain(args.domain, args.source, args.output)
        else:
            logger.error(f"Crawler for domain '{args.domain}' not yet implemented")
    
    elif args.command == 'validate':
        success = validate_domain(args.domain, args.data_dir)
    
    elif args.command == 'import':
        if args.to_db:
            success = import_to_db(args.domain, args.data_dir)
        else:
            logger.error("--to-db flag required for import command")

    elif args.command == 'expand-links':
        success = run_link_expander(
            domain=args.domain,
            data_dir=args.data_dir,
            limit=args.limit,
            verify=not args.no_verify,
        )
    
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()
