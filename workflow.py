#!/usr/bin/env python3
"""
Clean Unified Workflow for systemfehler

This script implements the complete pipeline:
1. Crawl domains via scrapy
2. Parse content to extract topics and searchable data 
3. Ingest into database
4. Update API
5. Update frontend

Usage:
    python workflow.py --step all           # Run complete pipeline
    python workflow.py --step crawl         # Run only crawling
    python workflow.py --step ingest        # Run only ingestion
    python workflow.py --step api           # Start API server
    python workflow.py --step frontend      # Start frontend
    python workflow.py --dry-run            # Test mode without actual changes
"""

import argparse
import subprocess
import sys
import os
import json
from pathlib import Path


class SystemfehlerWorkflow:
    def __init__(self, dry_run=False):
        self.dry_run = dry_run
        self.repo_root = Path(__file__).parent.absolute()
        self.scrapy_dir = self.repo_root / "services" / "scrapy_crawler"
        self.ingest_dir = self.repo_root / "services" / "ingest"
        self.api_dir = self.repo_root / "services" / "api" 
        self.frontend_dir = self.repo_root / "apps" / "fe"
        self.data_dir = self.repo_root / "data"
        
    def log(self, message):
        print(f"[WORKFLOW] {message}")
        
    def run_command(self, cmd, cwd=None, check=True):
        """Run a command and return result"""
        if self.dry_run:
            self.log(f"DRY RUN: {cmd} (cwd: {cwd})")
            return True
            
        self.log(f"Running: {cmd}")
        try:
            result = subprocess.run(cmd, shell=True, cwd=cwd, check=check, 
                                  capture_output=True, text=True)
            if result.stdout:
                self.log(f"Output: {result.stdout}")
            return result
        except subprocess.CalledProcessError as e:
            self.log(f"Error: {e}")
            self.log(f"Stderr: {e.stderr}")
            if check:
                raise
            return None

    def step_crawl(self):
        """Step 1: Crawl domains via scrapy"""
        self.log("=== STEP 1: CRAWLING DOMAINS ===")
        
        # Ensure output directories exist
        output_dirs = [
            self.data_dir / "benefits",
            self.data_dir / "aid", 
            self.data_dir / "tools",
            self.data_dir / "contacts",
            self.data_dir / "meta"
        ]
        
        for dir_path in output_dirs:
            dir_path.mkdir(exist_ok=True, parents=True)
            self.log(f"Ensured directory exists: {dir_path}")
        
        # Run scrapy crawlers
        spiders = ["benefits", "aid", "tools", "contacts", "meta"]
        
        for spider in spiders:
            self.log(f"Running {spider} spider...")
            cmd = f"scrapy crawl {spider}"
            self.run_command(cmd, cwd=self.scrapy_dir)
            
        self.log("✅ Crawling completed")

    def step_convert_to_ndjson(self):
        """Convert JSON arrays to NDJSON for ingest service"""
        self.log("=== CONVERTING TO NDJSON ===")
        
        json_files = [
            self.data_dir / "benefits" / "entries.json",
            self.data_dir / "aid" / "entries.json", 
            self.data_dir / "tools" / "entries.json",
            self.data_dir / "contacts" / "entries.json",
            self.data_dir / "meta" / "entries.json"
        ]
        
        for json_file in json_files:
            if not json_file.exists():
                self.log(f"Skipping missing file: {json_file}")
                continue
                
            ndjson_file = json_file.with_suffix('.ndjson')
            
            if not self.dry_run:
                try:
                    with open(json_file, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    
                    with open(ndjson_file, 'w', encoding='utf-8') as f:
                        for item in data:
                            f.write(json.dumps(item, ensure_ascii=False) + '\n')
                    
                    self.log(f"Converted {json_file} to {ndjson_file}")
                except Exception as e:
                    self.log(f"Error converting {json_file}: {e}")
            else:
                self.log(f"DRY RUN: Would convert {json_file} to {ndjson_file}")

    def step_ingest(self):
        """Step 3: Ingest into database"""
        self.log("=== STEP 3: INGESTING INTO DATABASE ===")
        
        # First convert JSON to NDJSON
        self.step_convert_to_ndjson()
        
        # Run ingest for each data directory
        data_dirs = ["benefits", "aid", "tools", "contacts", "meta"]
        
        for data_type in data_dirs:
            data_path = self.data_dir / data_type
            if data_path.exists():
                self.log(f"Ingesting {data_type} data...")
                cmd = f"node ingest.js --dir {data_path}"
                self.run_command(cmd, cwd=self.ingest_dir)
        
        self.log("✅ Database ingestion completed")

    def step_api(self):
        """Step 4: Start API server"""
        self.log("=== STEP 4: STARTING API SERVER ===")
        
        if self.dry_run:
            self.log("DRY RUN: Would start API server")
            return
            
        cmd = "npm run dev"
        self.log("Starting API server (press Ctrl+C to stop)...")
        try:
            self.run_command(cmd, cwd=self.api_dir, check=False)
        except KeyboardInterrupt:
            self.log("API server stopped")

    def step_frontend(self):
        """Step 5: Start frontend"""  
        self.log("=== STEP 5: STARTING FRONTEND ===")
        
        if self.dry_run:
            self.log("DRY RUN: Would start frontend")
            return
            
        cmd = "npm run dev"
        self.log("Starting frontend (press Ctrl+C to stop)...")
        try:
            self.run_command(cmd, cwd=self.frontend_dir, check=False)
        except KeyboardInterrupt:
            self.log("Frontend stopped")

    def step_all(self):
        """Run complete pipeline"""
        self.log("=== RUNNING COMPLETE PIPELINE ===")
        
        self.step_crawl()
        self.step_ingest()
        
        self.log("✅ Pipeline completed successfully!")
        self.log("To start services:")
        self.log("  API:      python workflow.py --step api")
        self.log("  Frontend: python workflow.py --step frontend")
        self.log("  Both:     pnpm run dev (from repo root)")

    def validate_environment(self):
        """Check if environment is properly set up"""
        self.log("=== VALIDATING ENVIRONMENT ===")
        
        # Check if required directories exist
        required_dirs = [self.scrapy_dir, self.ingest_dir, self.api_dir, self.frontend_dir]
        for dir_path in required_dirs:
            if not dir_path.exists():
                raise RuntimeError(f"Required directory missing: {dir_path}")
        
        # Check if scrapy is available
        try:
            subprocess.run(["scrapy", "version"], capture_output=True, check=True)
        except (subprocess.CalledProcessError, FileNotFoundError):
            raise RuntimeError("Scrapy not found. Run: pip install scrapy")
        
        # Check if node modules are installed
        for js_dir in [self.api_dir, self.frontend_dir]:
            if not (js_dir / "node_modules").exists():
                self.log(f"Installing dependencies in {js_dir}")
                self.run_command("npm install", cwd=js_dir)
        
        self.log("✅ Environment validation passed")


def main():
    parser = argparse.ArgumentParser(description="systemfehler unified workflow")
    parser.add_argument("--step", choices=["all", "crawl", "ingest", "api", "frontend"], 
                       default="all", help="Which step to run")
    parser.add_argument("--dry-run", action="store_true", 
                       help="Show what would be done without executing")
    
    args = parser.parse_args()
    
    workflow = SystemfehlerWorkflow(dry_run=args.dry_run)
    
    try:
        workflow.validate_environment()
        
        if args.step == "all":
            workflow.step_all()
        elif args.step == "crawl":
            workflow.step_crawl()
        elif args.step == "ingest":
            workflow.step_ingest()
        elif args.step == "api":
            workflow.step_api()
        elif args.step == "frontend":
            workflow.step_frontend()
            
    except Exception as e:
        workflow.log(f"ERROR: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()