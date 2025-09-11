CREATE TABLE IF NOT EXISTS Benefit (
  id TEXT PRIMARY KEY,
  url TEXT,
  title_de TEXT NOT NULL,
  title_en TEXT NOT NULL,
  summary_de TEXT NOT NULL,
  summary_en TEXT NOT NULL,
  topic TEXT,         -- store as comma-separated or JSON string
  language TEXT,      -- store as comma-separated or JSON string
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime(s'now'))
);

CREATE TABLE IF NOT EXISTS Tool (
  id TEXT PRIMARY KEY,
  title_de TEXT NOT NULL,
  title_en TEXT NOT NULL,
  summary_de TEXT NOT NULL,
  summary_en TEXT NOT NULL,
  url TEXT NOT NULL,
  category TEXT,
  language TEXT,      -- store as comma-separated or JSON string
  topic TEXT,         -- store as comma-separated or JSON string
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS AidOffer (
  id TEXT PRIMARY KEY,
  title_de TEXT NOT NULL,
  title_en TEXT NOT NULL,
  summary_de TEXT NOT NULL,
  summary_en TEXT NOT NULL,
  organization TEXT,
  contact TEXT,
  region TEXT,
  language TEXT,      -- store as comma-separated or JSON string
  topic TEXT,         -- store as comma-separated or JSON string
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS RelatedLink (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  title TEXT,
  relation TEXT,
  proposedAsEntry INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  benefitId TEXT,
  toolId TEXT,
  aidOfferId TEXT,
  FOREIGN KEY (benefitId) REFERENCES Benefit(id),
  FOREIGN KEY (toolId) REFERENCES Tool(id),
  FOREIGN KEY (aidOfferId) REFERENCES AidOffer(id)
);

CREATE TABLE IF NOT EXISTS entry_popularity (
  kind TEXT NOT NULL,
  id TEXT NOT NULL,
  popularity REAL DEFAULT 0,
  PRIMARY KEY (kind, id)
);

CREATE TABLE IF NOT EXISTS benefits (
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
