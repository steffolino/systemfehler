
-- D1-compatible schema for Systemfehler

CREATE TABLE IF NOT EXISTS entries (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL,
  title_de TEXT,
  title_en TEXT,
  title_easy_de TEXT,
  summary_de TEXT,
  summary_en TEXT,
  summary_easy_de TEXT,
  content_de TEXT,
  content_en TEXT,
  content_easy_de TEXT,
  url TEXT,
  topics TEXT,
  tags TEXT,
  target_groups TEXT,
  valid_from TEXT,
  valid_until TEXT,
  deadline TEXT,
  status TEXT,
  first_seen TEXT,
  last_seen TEXT,
  source_unavailable TEXT,
  provenance TEXT,
  translations TEXT,
  quality_scores TEXT,
  entry_json TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_entries_domain ON entries (domain);
CREATE INDEX IF NOT EXISTS idx_entries_status ON entries (status);

CREATE TABLE IF NOT EXISTS moderation_queue (
  id TEXT PRIMARY KEY,
  entry_id TEXT,
  domain TEXT,
  action TEXT,
  status TEXT,
  candidate_data TEXT,
  existing_data TEXT,
  diff TEXT,
  provenance TEXT,
  reviewed_by TEXT,
  reviewed_at TEXT,
  created_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_moderation_queue_status ON moderation_queue (status);
CREATE INDEX IF NOT EXISTS idx_moderation_queue_domain ON moderation_queue (domain);
CREATE INDEX IF NOT EXISTS idx_moderation_queue_created_at ON moderation_queue (created_at);

-- Extension tables (flattened, D1-compatible)
CREATE TABLE IF NOT EXISTS benefits (
  entry_id TEXT PRIMARY KEY,
  benefit_amount_de TEXT,
  benefit_amount_en TEXT,
  benefit_amount_easy_de TEXT,
  duration TEXT,
  eligibility_criteria_de TEXT,
  eligibility_criteria_en TEXT,
  eligibility_criteria_easy_de TEXT,
  application_steps TEXT,
  required_documents TEXT,
  form_link TEXT,
  contact_info TEXT
);

CREATE TABLE IF NOT EXISTS aid (
  entry_id TEXT PRIMARY KEY,
  aid_type TEXT,
  provider TEXT,
  amount_de TEXT,
  amount_en TEXT,
  amount_easy_de TEXT,
  eligibility_de TEXT,
  eligibility_en TEXT,
  eligibility_easy_de TEXT,
  application_process TEXT,
  required_documents TEXT,
  form_link TEXT,
  contact_info TEXT
);

CREATE TABLE IF NOT EXISTS tools (
  entry_id TEXT PRIMARY KEY,
  tool_type TEXT,
  tool_url TEXT,
  instructions_de TEXT,
  instructions_en TEXT,
  instructions_easy_de TEXT,
  features TEXT,
  requirements TEXT
);

CREATE TABLE IF NOT EXISTS organizations (
  entry_id TEXT PRIMARY KEY,
  organization_type TEXT,
  description_de TEXT,
  description_en TEXT,
  description_easy_de TEXT,
  services_offered TEXT,
  locations TEXT,
  contact_info TEXT,
  operating_hours TEXT,
  accessibility_info TEXT
);

CREATE TABLE IF NOT EXISTS contacts (
  entry_id TEXT PRIMARY KEY,
  contact_type TEXT,
  name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  description_de TEXT,
  description_en TEXT,
  description_easy_de TEXT,
  available_hours TEXT,
  languages_supported TEXT
);

-- Audit log (flattened)
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  timestamp TEXT,
  action TEXT,
  user_id TEXT,
  entry_id TEXT,
  details TEXT
);
