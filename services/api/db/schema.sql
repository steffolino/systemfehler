CREATE TABLE IF NOT EXISTS benefit (
  id TEXT PRIMARY KEY,
  url TEXT,
  title TEXT,
  meta_description TEXT,
  h1 TEXT,
  excerpt TEXT,
  content TEXT,
  topic TEXT, -- store as JSON string representing an array of topics
  source TEXT,
  language TEXT, -- store as JSON string representing an array
  status TEXT,
  last_crawled_at TEXT
);
PRAGMA foreign_keys = ON;

-- Lookups
CREATE TABLE IF NOT EXISTS org_kind (code TEXT PRIMARY KEY, label TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS service_kind (code TEXT PRIMARY KEY, label TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS item_kind (code TEXT PRIMARY KEY, label TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS topic (code TEXT PRIMARY KEY, label TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS language (code TEXT PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS target_group (code TEXT PRIMARY KEY, label TEXT NOT NULL);

-- Basisklasse (kanonisch)
CREATE TABLE IF NOT EXISTS entity (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('organization','service','knowledge_item')),
  region TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TRIGGER IF NOT EXISTS trg_entity_updated
AFTER UPDATE ON entity
FOR EACH ROW BEGIN
  UPDATE entity SET updatedAt = datetime('now') WHERE id = NEW.id;
END;

-- Fach-Tabellen (1:1-Vererbung von entity)
CREATE TABLE IF NOT EXISTS organization (
  id TEXT PRIMARY KEY REFERENCES entity(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind_code TEXT NOT NULL REFERENCES org_kind(code),
  domain TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL,
  description_de TEXT,
  description_en TEXT
);
CREATE INDEX IF NOT EXISTS idx_organization_kind ON organization(kind_code);

CREATE TABLE IF NOT EXISTS service (
  id TEXT PRIMARY KEY REFERENCES entity(id) ON DELETE CASCADE,
  organization_id TEXT REFERENCES organization(id) ON DELETE SET NULL,
  kind_code TEXT NOT NULL REFERENCES service_kind(code),
  title_de TEXT NOT NULL,
  title_en TEXT,
  url TEXT NOT NULL,
  summary_de TEXT,
  summary_en TEXT
);
CREATE INDEX IF NOT EXISTS idx_service_kind ON service(kind_code);
CREATE INDEX IF NOT EXISTS idx_service_org ON service(organization_id);

CREATE TABLE IF NOT EXISTS knowledge_item (
  id TEXT PRIMARY KEY REFERENCES entity(id) ON DELETE CASCADE,
  organization_id TEXT REFERENCES organization(id) ON DELETE SET NULL,
  kind_code TEXT NOT NULL REFERENCES item_kind(code),
  title_de TEXT NOT NULL,
  title_en TEXT,
  url TEXT NOT NULL,
  summary_de TEXT,
  summary_en TEXT
);
CREATE INDEX IF NOT EXISTS idx_item_kind ON knowledge_item(kind_code);
CREATE INDEX IF NOT EXISTS idx_item_org ON knowledge_item(organization_id);

-- Kontakte
CREATE TABLE IF NOT EXISTS contact (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  opening_hours TEXT,
  source_url TEXT,
  domain TEXT,
  last_seen TEXT,
  tags TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TRIGGER IF NOT EXISTS trg_contact_updated
AFTER UPDATE ON contact
FOR EACH ROW BEGIN
  UPDATE contact SET updatedAt = datetime('now') WHERE id = NEW.id;
END;

-- Taxonomie-Junctions
CREATE TABLE IF NOT EXISTS organization_topic (
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  topic_code TEXT NOT NULL REFERENCES topic(code),
  PRIMARY KEY (organization_id, topic_code)
);
CREATE TABLE IF NOT EXISTS organization_language (
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL REFERENCES language(code),
  PRIMARY KEY (organization_id, language_code)
);
CREATE TABLE IF NOT EXISTS organization_target_group (
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  target_group_code TEXT NOT NULL REFERENCES target_group(code),
  PRIMARY KEY (organization_id, target_group_code)
);
CREATE TABLE IF NOT EXISTS service_topic (
  service_id TEXT NOT NULL REFERENCES service(id) ON DELETE CASCADE,
  topic_code TEXT NOT NULL REFERENCES topic(code),
  PRIMARY KEY (service_id, topic_code)
);
CREATE TABLE IF NOT EXISTS service_language (
  service_id TEXT NOT NULL REFERENCES service(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL REFERENCES language(code),
  PRIMARY KEY (service_id, language_code)
);
CREATE TABLE IF NOT EXISTS service_target_group (
  service_id TEXT NOT NULL REFERENCES service(id) ON DELETE CASCADE,
  target_group_code TEXT NOT NULL REFERENCES target_group(code),
  PRIMARY KEY (service_id, target_group_code)
);
CREATE TABLE IF NOT EXISTS item_topic (
  item_id TEXT NOT NULL REFERENCES knowledge_item(id) ON DELETE CASCADE,
  topic_code TEXT NOT NULL REFERENCES topic(code),
  PRIMARY KEY (item_id, topic_code)
);
CREATE TABLE IF NOT EXISTS item_language (
  item_id TEXT NOT NULL REFERENCES knowledge_item(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL REFERENCES language(code),
  PRIMARY KEY (item_id, language_code)
);
CREATE TABLE IF NOT EXISTS item_target_group (
  item_id TEXT NOT NULL REFERENCES knowledge_item(id) ON DELETE CASCADE,
  target_group_code TEXT NOT NULL REFERENCES target_group(code),
  PRIMARY KEY (item_id, target_group_code)
);

-- Telemetrie & Kuratierung (an entity aufgehängt)
CREATE TABLE IF NOT EXISTS popularity (
  entity_id TEXT PRIMARY KEY REFERENCES entity(id) ON DELETE CASCADE,
  score REAL NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS related_link (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT,
  relation TEXT,
  proposedAsEntry INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending'
);

-- FTS5
CREATE VIRTUAL TABLE IF NOT EXISTS organization_fts USING fts5(name, description, url, tokenize='unicode61');
CREATE VIRTUAL TABLE IF NOT EXISTS service_fts USING fts5(title, summary, url, tokenize='unicode61');
CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_item_fts USING fts5(title, summary, url, tokenize='unicode61');

CREATE TRIGGER IF NOT EXISTS trg_org_fts_ai
AFTER INSERT ON organization BEGIN
  INSERT INTO organization_fts(rowid, name, description, url)
  VALUES (new.rowid, new.name, COALESCE(new.description_de,new.description_en), (SELECT url FROM organization WHERE id=new.id));
END;
CREATE TRIGGER IF NOT EXISTS trg_org_fts_au
AFTER UPDATE ON organization BEGIN
  INSERT INTO organization_fts(organization_fts, rowid, name, description, url)
  VALUES ('delete', old.rowid, old.name, COALESCE(old.description_de,old.description_en), (SELECT url FROM organization WHERE id=old.id));
  INSERT INTO organization_fts(rowid, name, description, url)
  VALUES (new.rowid, new.name, COALESCE(new.description_de,new.description_en), (SELECT url FROM organization WHERE id=new.id));
END;
CREATE TRIGGER IF NOT EXISTS trg_org_fts_ad
AFTER DELETE ON organization BEGIN
  INSERT INTO organization_fts(organization_fts, rowid, name, description, url)
  VALUES ('delete', old.rowid, old.name, COALESCE(old.description_de,old.description_en), (SELECT url FROM organization WHERE id=old.id));
END;

CREATE TRIGGER IF NOT EXISTS trg_service_fts_ai
AFTER INSERT ON service BEGIN
  INSERT INTO service_fts(rowid, title, summary, url)
  VALUES (new.rowid, COALESCE(new.title_de,new.title_en), COALESCE(new.summary_de,new.summary_en), new.url);
END;
CREATE TRIGGER IF NOT EXISTS trg_service_fts_au
AFTER UPDATE ON service BEGIN
  INSERT INTO service_fts(service_fts, rowid, title, summary, url)
  VALUES ('delete', old.rowid, COALESCE(old.title_de,old.title_en), COALESCE(old.summary_de,old.summary_en), old.url);
  INSERT INTO service_fts(rowid, title, summary, url)
  VALUES (new.rowid, COALESCE(new.title_de,new.title_en), COALESCE(new.summary_de,new.summary_en), new.url);
END;
CREATE TRIGGER IF NOT EXISTS trg_service_fts_ad
AFTER DELETE ON service BEGIN
  INSERT INTO service_fts(service_fts, rowid, title, summary, url)
  VALUES ('delete', old.rowid, COALESCE(old.title_de,old.title_en), COALESCE(old.summary_de,old.summary_en), old.url);
END;

CREATE TRIGGER IF NOT EXISTS trg_item_fts_ai
AFTER INSERT ON knowledge_item BEGIN
  INSERT INTO knowledge_item_fts(rowid, title, summary, url)
  VALUES (new.rowid, COALESCE(new.title_de,new.title_en), COALESCE(new.summary_de,new.summary_en), new.url);
END;
CREATE TRIGGER IF NOT EXISTS trg_item_fts_au
AFTER UPDATE ON knowledge_item BEGIN
  INSERT INTO knowledge_item_fts(knowledge_item_fts, rowid, title, summary, url)
  VALUES ('delete', old.rowid, old.name, COALESCE(old.title_de,old.title_en), COALESCE(old.summary_de,old.summary_en), old.url);
  INSERT INTO knowledge_item_fts(rowid, title, summary, url)
  VALUES (new.rowid, COALESCE(new.title_de,new.title_en), COALESCE(new.summary_de,new.summary_en), new.url);
END;
CREATE TRIGGER IF NOT EXISTS trg_item_fts_ad
AFTER DELETE ON knowledge_item BEGIN
  INSERT INTO knowledge_item_fts(knowledge_item_fts, rowid, title, summary, url)
  VALUES ('delete', old.rowid, old.name, COALESCE(old.title_de,old.title_en), COALESCE(old.summary_de,old.summary_en), old.url);
END;

-- Helpful Views
CREATE VIEW IF NOT EXISTS v_service_full AS
SELECT s.*, o.name AS organization_name, o.domain AS organization_domain
FROM service s LEFT JOIN organization o ON o.id = s.organization_id;

CREATE VIEW IF NOT EXISTS v_item_full AS
SELECT i.*, o.name AS organization_name, o.domain AS organization_domain
FROM knowledge_item i LEFT JOIN organization o ON o.id = i.organization_id;
