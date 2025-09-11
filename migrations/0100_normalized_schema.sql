-- Normalized schema for DB-First-Codegen
CREATE TABLE IF NOT EXISTS org_kind (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS service_kind (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS item_kind (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS topic (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS language (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS target_group (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS organization (
  id TEXT PRIMARY KEY,
  name TEXT,
  kind_id INTEGER,
  popularity_id INTEGER,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS contact (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  opening_hours TEXT,
  source_url TEXT,
  domain TEXT,
  last_seen TEXT,
  tags TEXT,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS service (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  kind_id INTEGER,
  title TEXT,
  summary TEXT,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS knowledge_item (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  kind_id INTEGER,
  title TEXT,
  summary TEXT,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS organization_topic (
  organization_id TEXT,
  topic_id INTEGER,
  PRIMARY KEY (organization_id, topic_id)
);
CREATE TABLE IF NOT EXISTS organization_language (
  organization_id TEXT,
  language_id INTEGER,
  PRIMARY KEY (organization_id, language_id)
);
CREATE TABLE IF NOT EXISTS organization_target_group (
  organization_id TEXT,
  target_group_id INTEGER,
  PRIMARY KEY (organization_id, target_group_id)
);
CREATE TABLE IF NOT EXISTS service_topic (
  service_id TEXT,
  topic_id INTEGER,
  PRIMARY KEY (service_id, topic_id)
);
CREATE TABLE IF NOT EXISTS service_language (
  service_id TEXT,
  language_id INTEGER,
  PRIMARY KEY (service_id, language_id)
);
CREATE TABLE IF NOT EXISTS service_target_group (
  service_id TEXT,
  target_group_id INTEGER,
  PRIMARY KEY (service_id, target_group_id)
);
CREATE TABLE IF NOT EXISTS item_topic (
  item_id TEXT,
  topic_id INTEGER,
  PRIMARY KEY (item_id, topic_id)
);
CREATE TABLE IF NOT EXISTS item_language (
  item_id TEXT,
  language_id INTEGER,
  PRIMARY KEY (item_id, language_id)
);
CREATE TABLE IF NOT EXISTS item_target_group (
  item_id TEXT,
  target_group_id INTEGER,
  PRIMARY KEY (item_id, target_group_id)
);
CREATE TABLE IF NOT EXISTS popularity (
  id INTEGER PRIMARY KEY,
  score INTEGER
);
CREATE TABLE IF NOT EXISTS related_link (
  id INTEGER PRIMARY KEY,
  entity_id TEXT,
  url TEXT,
  description TEXT
);
-- FTS tables (optional for codegen)
CREATE VIRTUAL TABLE IF NOT EXISTS organization_fts USING fts5(id, name);
CREATE VIRTUAL TABLE IF NOT EXISTS service_fts USING fts5(id, title, summary);
CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_item_fts USING fts5(id, title, summary);
-- Views
CREATE VIEW IF NOT EXISTS v_service_full AS SELECT * FROM service;
CREATE VIEW IF NOT EXISTS v_item_full AS SELECT * FROM knowledge_item;
