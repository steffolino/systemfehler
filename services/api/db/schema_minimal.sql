-- Minimal schema for D1: only tables and indexes, no views or triggers

CREATE TABLE IF NOT EXISTS organization (
  id TEXT PRIMARY KEY,
  url TEXT,
  title_de TEXT,
  title_simple_de TEXT,
  title_en TEXT,
  summary_de TEXT,
  summary_simple_de TEXT,
  summary_en TEXT,
  topic TEXT,
  language TEXT,
  content TEXT,
  keywords TEXT,
  status TEXT CHECK (status IN ('unverified','auto_processed','verified')),
  last_checked TEXT,
  updatedAt TEXT,
  org_name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT
);
CREATE TABLE IF NOT EXISTS service (
  id TEXT PRIMARY KEY,
  url TEXT,
  title_de TEXT,
  title_simple_de TEXT,
  title_en TEXT,
  summary_de TEXT,
  summary_simple_de TEXT,
  summary_en TEXT,
  topic TEXT,
  language TEXT,
  content TEXT,
  keywords TEXT,
  status TEXT CHECK (status IN ('unverified','auto_processed','verified')),
  last_checked TEXT,
  updatedAt TEXT
);
CREATE TABLE IF NOT EXISTS tool (
  id TEXT PRIMARY KEY,
  url TEXT,
  title_de TEXT,
  title_simple_de TEXT,
  title_en TEXT,
  summary_de TEXT,
  summary_simple_de TEXT,
  summary_en TEXT,
  topic TEXT,
  language TEXT,
  content TEXT,
  keywords TEXT,
  status TEXT CHECK (status IN ('unverified','auto_processed','verified')),
  last_checked TEXT,
  updatedAt TEXT
);
CREATE TABLE IF NOT EXISTS form (
  id TEXT PRIMARY KEY,
  url TEXT,
  title_de TEXT,
  title_simple_de TEXT,
  title_en TEXT,
  summary_de TEXT,
  summary_simple_de TEXT,
  summary_en TEXT,
  topic TEXT,
  language TEXT,
  content TEXT,
  keywords TEXT,
  status TEXT CHECK (status IN ('unverified','auto_processed','verified')),
  last_checked TEXT,
  updatedAt TEXT
);
CREATE TABLE IF NOT EXISTS glossary (
  id TEXT PRIMARY KEY,
  url TEXT,
  title_de TEXT,
  title_simple_de TEXT,
  title_en TEXT,
  summary_de TEXT,
  summary_simple_de TEXT,
  summary_en TEXT,
  topic TEXT,
  language TEXT,
  content TEXT,
  keywords TEXT,
  status TEXT CHECK (status IN ('unverified','auto_processed','verified')),
  last_checked TEXT,
  updatedAt TEXT
);
CREATE TABLE IF NOT EXISTS legal_aid (
  id TEXT PRIMARY KEY,
  url TEXT,
  title_de TEXT,
  title_simple_de TEXT,
  title_en TEXT,
  summary_de TEXT,
  summary_simple_de TEXT,
  summary_en TEXT,
  topic TEXT,
  language TEXT,
  content TEXT,
  keywords TEXT,
  status TEXT CHECK (status IN ('unverified','auto_processed','verified')),
  last_checked TEXT,
  updatedAt TEXT
);
CREATE TABLE IF NOT EXISTS association (
  id TEXT PRIMARY KEY,
  url TEXT,
  title_de TEXT,
  title_simple_de TEXT,
  title_en TEXT,
  summary_de TEXT,
  summary_simple_de TEXT,
  summary_en TEXT,
  topic TEXT,
  language TEXT,
  content TEXT,
  keywords TEXT,
  status TEXT CHECK (status IN ('unverified','auto_processed','verified')),
  last_checked TEXT,
  updatedAt TEXT
);
CREATE TABLE IF NOT EXISTS staging_entry (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_domain TEXT NOT NULL,
  title TEXT,
  summary TEXT,
  language TEXT,
  topic TEXT,
  content TEXT,
  keywords TEXT,
  payload JSON,
  first_seen TEXT NOT NULL,
  last_seen TEXT NOT NULL,
  checksum TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_staging_category ON staging_entry(category);
CREATE INDEX IF NOT EXISTS idx_staging_domain   ON staging_entry(source_domain);
