PRAGMA foreign_keys = ON;

-- Staging tables for Scrapy ingest
CREATE TABLE IF NOT EXISTS Organization_Staging (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  url TEXT NOT NULL,
  description_de TEXT,
  description_en TEXT,
  topics TEXT,        -- JSON array
  languages TEXT,     -- JSON array
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS Contact_Staging (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  url TEXT NOT NULL,
  emails TEXT,        -- JSON array
  phones TEXT,        -- JSON array
  opening_hours TEXT,
  notes TEXT,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS AidOffer_Staging (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  title_de TEXT, title_en TEXT,
  summary_de TEXT, summary_en TEXT,
  topic TEXT,         -- JSON array
  language TEXT,      -- JSON array
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS organization (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,

-- Additional Staging Tables for ETL
CREATE TABLE IF NOT EXISTS Tool_Staging (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  title TEXT,
  summary TEXT,
  topic TEXT,
  language TEXT,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS Form_Staging (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  title TEXT,
  summary TEXT,
  topic TEXT,
  language TEXT,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS Glossary_Staging (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  title TEXT,
  summary TEXT,
  topic TEXT,
  language TEXT,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS LegalAid_Staging (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  title TEXT,
  summary TEXT,
  topic TEXT,
  language TEXT,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS Association_Staging (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  title TEXT,
  summary TEXT,
  topic TEXT,
  language TEXT,
  updatedAt TEXT NOT NULL
);
  domain TEXT NOT NULL,
  url TEXT NOT NULL,
  description_de TEXT,
  description_en TEXT,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS contact (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  url TEXT NOT NULL,
  emails TEXT,
  phones TEXT,
  opening_hours TEXT,
  notes TEXT,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (organization_id) REFERENCES organization(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS aid_offer (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  title_de TEXT, title_en TEXT,
  summary_de TEXT, summary_en TEXT,
  topic TEXT,
  language TEXT,
  updatedAt TEXT NOT NULL
);

-- Junction tables
CREATE TABLE IF NOT EXISTS organization_topic (
  organization_id TEXT NOT NULL,
  topic_code TEXT NOT NULL,
  PRIMARY KEY (organization_id, topic_code),
  FOREIGN KEY (organization_id) REFERENCES organization(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS organization_language (
  organization_id TEXT NOT NULL,
  language_code TEXT NOT NULL,
  PRIMARY KEY (organization_id, language_code),
  FOREIGN KEY (organization_id) REFERENCES organization(id) ON DELETE CASCADE
);

-- SearchDoc (denormalized)
CREATE TABLE IF NOT EXISTS SearchDoc (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT,
  subtitle TEXT,
  url TEXT,
  text TEXT,
  topics TEXT,
  languages TEXT,
  org_id TEXT,
  updatedAt TEXT NOT NULL
);

-- Meta
CREATE TABLE IF NOT EXISTS Meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
INSERT OR IGNORE INTO Meta(key,value) VALUES ('SCHEMA_VERSION','2');
