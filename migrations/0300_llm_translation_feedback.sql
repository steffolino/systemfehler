PRAGMA foreign_keys = ON;

-- Lookup: Varianten für Output-Stile (erweiterbar)
CREATE TABLE IF NOT EXISTS translation_variant (
  code TEXT PRIMARY KEY,                -- 'translate', 'simple', 'leicht', 'summary'
  label TEXT NOT NULL,                  -- Menschlich lesbar
  notes TEXT
);

-- Lookup: Modelle (für Reproduzierbarkeit/Kosten)
CREATE TABLE IF NOT EXISTS llm_model (
  code TEXT PRIMARY KEY,                -- z.B. 'gpt-5o-2025-06'
  provider TEXT NOT NULL,               -- 'openai','azure','anthropic',...
  name TEXT NOT NULL,                   -- Marketing-/API-Name
  version TEXT,                         -- interne Versionierung
  context_window INTEGER,               -- Tokens
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Optional: Prompt-Templates (für konsistente Steuerung)
CREATE TABLE IF NOT EXISTS prompt_template (
  id TEXT PRIMARY KEY,
  purpose TEXT NOT NULL,                -- 'translate','simple','leicht','summary'
  template TEXT NOT NULL,               -- Prompt-Text mit Platzhaltern
  metadata TEXT,                        -- JSON (Temperatur, Guidelines,...)
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TRIGGER IF NOT EXISTS trg_prompt_template_u
AFTER UPDATE ON prompt_template
FOR EACH ROW BEGIN
  UPDATE prompt_template SET updatedAt = datetime('now') WHERE id = NEW.id;
END;

-- Kern: eine gespeicherte LLM-Generierung (übersetzt/vereinfacht/zusammengefasst)
-- Hinweis: entity(id) existiert bereits (Basistabelle); wir referenzieren die betroffene Entität + Feld.
CREATE TABLE IF NOT EXISTS llm_generation (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,             -- z.B. 'summary_de' oder 'description_de'
  source_language TEXT,                 -- 'de','en',...
  target_language TEXT,                 -- 'de','en',...
  variant_code TEXT NOT NULL REFERENCES translation_variant(code),
  source_hash TEXT NOT NULL,            -- Hash des Quelltextes (app-seitig berechnet, z.B. SHA-256)
  output_text TEXT NOT NULL,
  model_code TEXT REFERENCES llm_model(code),
  prompt_id TEXT REFERENCES prompt_template(id),
  tokens_in INTEGER,
  tokens_out INTEGER,
  cost_cents INTEGER,
  quality_score REAL,                   -- optionale Heuristik (z.B. LLM-eigenes Score)
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (entity_id, field_name, target_language, variant_code, source_hash) -- Cache-Schlüssel
);
CREATE TRIGGER IF NOT EXISTS trg_llm_generation_u
AFTER UPDATE ON llm_generation
FOR EACH ROW BEGIN
  UPDATE llm_generation SET updatedAt = datetime('now') WHERE id = NEW.id;
END;

-- Nutzer-Feedback zu LLM-Ausgaben (wie bei ChatGPT)
CREATE TABLE IF NOT EXISTS llm_feedback (
  id TEXT PRIMARY KEY,
  generation_id TEXT NOT NULL REFERENCES llm_generation(id) ON DELETE CASCADE,
  user_ref TEXT,                        -- optional: externe User-ID/Session
  rating INTEGER NOT NULL,              -- z.B. 1..5 oder -1/1; hier 1..5 empfohlen
  is_helpful INTEGER,                   -- 0/1 (schneller Toggle)
  reasons TEXT,                         -- JSON-Array: ['too_formal','wrong_terms','grammar',...]
  comment TEXT,
  suggested_edit TEXT,                  -- vorgeschlagene Korrektur vom User
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Schneller Zugriff auf "aktuelle" Übersetzung: wenn Quelltext gleich bleibt (source_hash),
-- gibt es genau eine gültige Zeile (UNIQUE oben). Bei Quelltext-Änderung entsteht neuer Hash -> neue Zeile.
-- Optionales Convenience-View für FE/APIs:
CREATE VIEW IF NOT EXISTS v_llm_latest AS
SELECT g.*
FROM llm_generation g
JOIN (
  SELECT entity_id, field_name, target_language, variant_code, source_hash, MAX(createdAt) AS mx
  FROM llm_generation
  GROUP BY entity_id, field_name, target_language, variant_code, source_hash
) x ON x.entity_id = g.entity_id
    AND x.field_name = g.field_name
    AND x.target_language = g.target_language
    AND x.variant_code = g.variant_code
    AND x.source_hash = g.source_hash
    AND x.mx = g.createdAt;

-- Sinnvolle Defaults für Varianten
INSERT OR IGNORE INTO translation_variant (code, label, notes) VALUES
('translate','Übersetzung','Standard-Übersetzung in Zielsprache'),
('simple','Einfache Sprache','Ziel: B1/B2, kurze Sätze'),
('leicht','Leichte Sprache','Regelwerk Leichte Sprache'),
('summary','Kurzfassung','Knappes Abstract in Zielsprache');
