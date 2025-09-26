-- Staging (raw, crawl-near schema)
CREATE TABLE IF NOT EXISTS staging_entry (
  id TEXT PRIMARY KEY,
  category TEXT,
  url TEXT NOT NULL,
  source_domain TEXT NOT NULL,
  fetched_at TEXT,
  lang TEXT,
  title TEXT,
  summary TEXT,
  content TEXT,
  topic TEXT,
  raw_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_staging_domain ON staging_entry(source_domain);

-- Normalized (unified target table "aid_offer" + type columns)
CREATE TABLE IF NOT EXISTS aid_offer (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  source_domain TEXT NOT NULL,
  type TEXT NOT NULL,
  topic TEXT,
  language TEXT DEFAULT 'de',
  title_de TEXT, title_en TEXT,
  summary_de TEXT, summary_en TEXT,
  content_de TEXT, content_en TEXT,
  createdAt TEXT, updatedAt TEXT
);
CREATE INDEX IF NOT EXISTS idx_offer_type ON aid_offer(type);
CREATE INDEX IF NOT EXISTS idx_offer_lang ON aid_offer(language);

-- Translations & "Simple Language" + Cache/Feedback
CREATE TABLE IF NOT EXISTS translation_cache (
  key TEXT PRIMARY KEY,
  source_lang TEXT,
  target_lang TEXT,
  style TEXT,
  source_text TEXT,
  translated_text TEXT,
  llm_model TEXT,
  createdAt TEXT
);
CREATE TABLE IF NOT EXISTS user_feedback (
  id TEXT PRIMARY KEY,
  key TEXT,
  rating INTEGER,
  comment TEXT,
  createdAt TEXT
);

-- Search Document (FTS5 + shadow row)
CREATE TABLE IF NOT EXISTS search_doc (
  id TEXT PRIMARY KEY,
  type TEXT,
  url TEXT,
  language TEXT,
  topic TEXT,
  title TEXT,
  summary TEXT,
  content TEXT,
  updatedAt TEXT
);
CREATE VIRTUAL TABLE IF NOT EXISTS search_doc_fts USING fts5(
  title, summary, content, topic, language, content='search_doc', content_rowid='rowid'
);
CREATE TRIGGER IF NOT EXISTS search_doc_ai AFTER INSERT ON search_doc BEGIN
  INSERT INTO search_doc_fts(rowid,title,summary,content,topic,language)
  VALUES (new.rowid,new.title,new.summary,new.content,new.topic,new.language);
END;
CREATE TRIGGER IF NOT EXISTS search_doc_au AFTER UPDATE ON search_doc BEGIN
  INSERT INTO search_doc_fts(search_doc_fts,rowid,title,summary,content,topic,language)
  VALUES ('delete',old.rowid,old.title,old.summary,old.content,old.topic,old.language);
  INSERT INTO search_doc_fts(rowid,title,summary,content,topic,language)
  VALUES (new.rowid,new.title,new.summary,new.content,new.topic,new.language);
END;
CREATE TRIGGER IF NOT EXISTS search_doc_ad AFTER DELETE ON search_doc BEGIN
  INSERT INTO search_doc_fts(search_doc_fts,rowid,title,summary,content,topic,language)
  VALUES ('delete',old.rowid,old.title,old.summary,old.content,old.topic,old.language);
END;

-- Provenance & Crawl Monitoring
CREATE TABLE IF NOT EXISTS crawl_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_domain TEXT,
  url TEXT,
  status TEXT,
  http_status INTEGER,
  message TEXT,
  ts TEXT
);
CREATE TABLE IF NOT EXISTS crawl_source (
  domain TEXT PRIMARY KEY,
  seed_urls TEXT,
  allow TEXT,
  deny TEXT,
  keywords TEXT,
  active INTEGER DEFAULT 1
);
