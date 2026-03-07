#!/usr/bin/env python3
"""
Automated end-to-end test for Systemfehler crawl-to-database workflow.
Runs crawl, validate, and import in sequence, logs errors to file, and writes a summary report.
"""
import subprocess
import sys
import json
from datetime import datetime
from pathlib import Path

WORKFLOW_STEPS = [
    {
        'name': 'crawl',
        'cmd': [sys.executable, 'crawlers/cli.py', 'crawl', 'benefits', '--source', 'arbeitsagentur'],
    },
    {
        'name': 'validate',
        'cmd': [sys.executable, 'crawlers/cli.py', 'validate', '--domain', 'benefits'],
    },
    {
        'name': 'import',
        'cmd': [sys.executable, 'crawlers/cli.py', 'import', '--domain', 'benefits', '--to-db'],
    },
]

LOG_DIR = Path('logs')
LOG_DIR.mkdir(exist_ok=True)
ERROR_LOG = LOG_DIR / f"workflow_errors_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
SUMMARY_REPORT = LOG_DIR / f"workflow_summary_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"

summary = {'steps': [], 'errors': []}

for step in WORKFLOW_STEPS:
    print(f"Running step: {step['name']}")
    try:
        result = subprocess.run(
            step['cmd'],
            capture_output=True,
            text=True,
            encoding='utf-8',  # Force UTF-8 decoding
            errors='replace'   # Replace undecodable bytes
        )
        step_result = {
            'name': step['name'],
            'returncode': result.returncode,
            'stdout': result.stdout,
            'stderr': result.stderr,
        }
        summary['steps'].append(step_result)
        if result.returncode != 0 or 'error' in result.stderr.lower():
            error_entry = {
                'step': step['name'],
                'stderr': result.stderr,
                'stdout': result.stdout,
            }
            summary['errors'].append(error_entry)
            with open(ERROR_LOG, 'a', encoding='utf-8') as elog:
                elog.write(f"[{step['name'].upper()} ERROR]\n{result.stderr}\n\n")
    except Exception as exc:
        import traceback
        tb = traceback.format_exc()
        error_entry = {
            'step': step['name'],
            'exception': str(exc),
            'traceback': tb,
        }
        summary['errors'].append(error_entry)
        with open(ERROR_LOG, 'a', encoding='utf-8') as elog:
            elog.write(f"[{step['name'].upper()} EXCEPTION]\n{tb}\n\n")

with open(SUMMARY_REPORT, 'w', encoding='utf-8') as sfile:
    json.dump(summary, sfile, indent=2, ensure_ascii=False)

print(f"Workflow complete. Summary written to {SUMMARY_REPORT}")
if summary['errors']:
    print(f"Errors logged to {ERROR_LOG}")
else:
    print("No errors detected.")
