-- Central keywords table
CREATE TABLE IF NOT EXISTS Keyword (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword TEXT NOT NULL UNIQUE
);

-- Generic linking table for keywords and entries
CREATE TABLE IF NOT EXISTS EntryKeyword (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_type TEXT NOT NULL, -- e.g., 'Benefit', 'Tool', 'AidOffer'
  entry_id TEXT NOT NULL,   -- id of the entry in its table
  keyword_id INTEGER NOT NULL,
  FOREIGN KEY (keyword_id) REFERENCES Keyword(id)
);

-- Example index for fast search
CREATE INDEX IF NOT EXISTS idx_entrykeyword_entry ON EntryKeyword(entry_type, entry_id);
CREATE INDEX IF NOT EXISTS idx_entrykeyword_keyword ON EntryKeyword(keyword_id);
