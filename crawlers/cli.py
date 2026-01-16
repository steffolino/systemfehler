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
from crawlers.shared.validator import SchemaValidator
from crawlers.shared.quality_scorer import QualityScorer
from crawlers.shared.diff_generator import DiffGenerator


# Load environment variables
load_dotenv()

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('systemfehler.cli')


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
            result = validator.validate_entry(entry, 'benefits')
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
            generate_diffs(entries, existing_entries_path, output_dir)
        
        logger.info(f"Crawl completed successfully. {len(entries)} entries extracted.")
        return True
        
    except Exception as e:
        logger.error(f"Crawl failed: {e}", exc_info=True)
        return False
    finally:
        crawler.close()


def generate_diffs(new_entries, existing_path, output_dir):
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
        
        # Create moderation queue entry
        queue_entry = {
            'id': new_entry['id'],
            'entryId': old_entry['id'] if old_entry else None,
            'domain': 'benefits',
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
        
        moderation_queue.append(queue_entry)
        
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
        queue_data = {'version': '0.1.0', 'queue': []}
    
    # Add new entries to queue
    queue_data['queue'].extend(moderation_queue)
    
    # Save updated queue
    with open(queue_path, 'w', encoding='utf-8') as f:
        json.dump(queue_data, f, indent=2, ensure_ascii=False)
    
    logger.info(f"Added {len(moderation_queue)} entries to moderation queue")


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
    
    # Print report
    report = validator.generate_validation_report(results)
    print(report)
    
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
                # Insert into entries table
                cur.execute("""
                    INSERT INTO entries (
                        id, domain, title_de, title_en, title_easy_de,
                        summary_de, summary_en, summary_easy_de,
                        content_de, content_en, content_easy_de,
                        url, topics, tags, target_groups,
                        valid_from, valid_until, deadline, status,
                        first_seen, last_seen, source_unavailable,
                        provenance, quality_scores
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
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
                        quality_scores = EXCLUDED.quality_scores,
                        updated_at = NOW()
                """, (
                    entry['id'], domain,
                    entry.get('title', {}).get('de'), entry.get('title', {}).get('en'), entry.get('title', {}).get('easy_de'),
                    entry.get('summary', {}).get('de'), entry.get('summary', {}).get('en'), entry.get('summary', {}).get('easy_de'),
                    entry.get('content', {}).get('de'), entry.get('content', {}).get('en'), entry.get('content', {}).get('easy_de'),
                    entry['url'], entry.get('topics', []), entry.get('tags', []), entry.get('targetGroups', []),
                    entry.get('validFrom'), entry.get('validUntil'), entry.get('deadline'), entry['status'],
                    entry.get('firstSeen'), entry.get('lastSeen'), entry.get('sourceUnavailable', False),
                    Json(entry.get('provenance', {})), Json(entry.get('qualityScores', {}))
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
                        entry.get('benefitAmount', {}).get('de'),
                        entry.get('benefitAmount', {}).get('en'),
                        entry.get('benefitAmount', {}).get('easy_de'),
                        entry.get('duration'),
                        entry.get('eligibilityCriteria', {}).get('de'),
                        entry.get('eligibilityCriteria', {}).get('en'),
                        entry.get('eligibilityCriteria', {}).get('easy_de'),
                        Json(entry.get('applicationSteps', [])),
                        Json(entry.get('requiredDocuments', [])),
                        entry.get('formLink'),
                        Json(entry.get('contactInfo', {}))
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
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        sys.exit(1)
    
    # Execute command
    success = False
    
    if args.command == 'crawl':
        if args.domain == 'benefits':
            success = crawl_benefits(args.source, args.output)
        else:
            logger.error(f"Crawler for domain '{args.domain}' not yet implemented")
    
    elif args.command == 'validate':
        success = validate_domain(args.domain, args.data_dir)
    
    elif args.command == 'import':
        if args.to_db:
            success = import_to_db(args.domain, args.data_dir)
        else:
            logger.error("--to-db flag required for import command")
    
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()
