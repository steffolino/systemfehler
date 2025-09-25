PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE form (
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
COMMIT;
