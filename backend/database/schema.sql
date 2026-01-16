-- Systemfehler Database Schema
-- Version: 0.1.0
-- Description: PostgreSQL schema for Systemfehler data platform

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create ENUM types
CREATE TYPE domain_type AS ENUM ('benefits', 'aid', 'tools', 'organizations', 'contacts');
CREATE TYPE entry_status AS ENUM ('active', 'discontinued', 'archived', 'under_revision');
CREATE TYPE moderation_action AS ENUM ('create', 'update', 'delete');
CREATE TYPE moderation_status AS ENUM ('pending', 'approved', 'rejected');

-- Core entries table
CREATE TABLE entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    domain domain_type NOT NULL,
    
    -- Multilingual fields
    title_de TEXT,
    title_en TEXT,
    title_easy_de TEXT,
    
    summary_de TEXT,
    summary_en TEXT,
    summary_easy_de TEXT,
    
    content_de TEXT,
    content_en TEXT,
    content_easy_de TEXT,
    
    -- Core fields
    url TEXT NOT NULL,
    topics TEXT[] DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    target_groups TEXT[] DEFAULT '{}',
    
    -- Temporal fields
    valid_from DATE,
    valid_until DATE,
    deadline DATE,
    
    -- Status and tracking
    status entry_status DEFAULT 'active',
    first_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    source_unavailable BOOLEAN DEFAULT FALSE,
    
    -- Metadata (JSONB for flexibility)
    provenance JSONB,
    quality_scores JSONB,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Benefits extension table
CREATE TABLE benefits (
    entry_id UUID PRIMARY KEY REFERENCES entries(id) ON DELETE CASCADE,
    
    -- Multilingual benefit fields
    benefit_amount_de TEXT,
    benefit_amount_en TEXT,
    benefit_amount_easy_de TEXT,
    
    duration TEXT,
    
    eligibility_criteria_de TEXT,
    eligibility_criteria_en TEXT,
    eligibility_criteria_easy_de TEXT,
    
    -- Structured data (JSONB)
    application_steps JSONB DEFAULT '[]',
    required_documents JSONB DEFAULT '[]',
    
    -- Additional fields
    form_link TEXT,
    contact_info JSONB
);

-- Aid extension table
CREATE TABLE aid (
    entry_id UUID PRIMARY KEY REFERENCES entries(id) ON DELETE CASCADE,
    
    -- Aid-specific fields
    aid_type TEXT,
    provider TEXT,
    
    amount_de TEXT,
    amount_en TEXT,
    amount_easy_de TEXT,
    
    eligibility_de TEXT,
    eligibility_en TEXT,
    eligibility_easy_de TEXT,
    
    application_process JSONB DEFAULT '[]',
    required_documents JSONB DEFAULT '[]',
    
    form_link TEXT,
    contact_info JSONB
);

-- Tools extension table
CREATE TABLE tools (
    entry_id UUID PRIMARY KEY REFERENCES entries(id) ON DELETE CASCADE,
    
    tool_type TEXT,
    tool_url TEXT,
    
    instructions_de TEXT,
    instructions_en TEXT,
    instructions_easy_de TEXT,
    
    features JSONB DEFAULT '[]',
    requirements TEXT
);

-- Organizations extension table
CREATE TABLE organizations (
    entry_id UUID PRIMARY KEY REFERENCES entries(id) ON DELETE CASCADE,
    
    organization_type TEXT,
    
    description_de TEXT,
    description_en TEXT,
    description_easy_de TEXT,
    
    services_offered JSONB DEFAULT '[]',
    locations JSONB DEFAULT '[]',
    
    contact_info JSONB,
    operating_hours TEXT,
    accessibility_info TEXT
);

-- Contacts extension table
CREATE TABLE contacts (
    entry_id UUID PRIMARY KEY REFERENCES entries(id) ON DELETE CASCADE,
    
    contact_type TEXT,
    
    name TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    
    description_de TEXT,
    description_en TEXT,
    description_easy_de TEXT,
    
    available_hours TEXT,
    languages_supported TEXT[]
);

-- Moderation queue table
CREATE TABLE moderation_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entry_id UUID REFERENCES entries(id) ON DELETE SET NULL,
    domain domain_type NOT NULL,
    
    action moderation_action NOT NULL,
    status moderation_status DEFAULT 'pending',
    
    -- Data snapshots
    candidate_data JSONB NOT NULL,
    existing_data JSONB,
    diff JSONB,
    
    -- Provenance
    provenance JSONB,
    
    -- Review tracking
    reviewed_by TEXT,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit log table
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    action TEXT NOT NULL,
    user_id TEXT,
    entry_id UUID,
    details JSONB
);

-- Create indexes for performance

-- Entries indexes
CREATE INDEX idx_entries_domain ON entries(domain);
CREATE INDEX idx_entries_status ON entries(status);
CREATE INDEX idx_entries_valid_from ON entries(valid_from);
CREATE INDEX idx_entries_valid_until ON entries(valid_until);
CREATE INDEX idx_entries_topics ON entries USING GIN(topics);
CREATE INDEX idx_entries_tags ON entries USING GIN(tags);
CREATE INDEX idx_entries_target_groups ON entries USING GIN(target_groups);
CREATE INDEX idx_entries_provenance ON entries USING GIN(provenance);
CREATE INDEX idx_entries_quality_scores ON entries USING GIN(quality_scores);

-- Full-text search indexes
CREATE INDEX idx_entries_title_de_fts ON entries USING GIN(to_tsvector('german', COALESCE(title_de, '')));
CREATE INDEX idx_entries_title_en_fts ON entries USING GIN(to_tsvector('english', COALESCE(title_en, '')));
CREATE INDEX idx_entries_summary_de_fts ON entries USING GIN(to_tsvector('german', COALESCE(summary_de, '')));
CREATE INDEX idx_entries_summary_en_fts ON entries USING GIN(to_tsvector('english', COALESCE(summary_en, '')));
CREATE INDEX idx_entries_content_de_fts ON entries USING GIN(to_tsvector('german', COALESCE(content_de, '')));
CREATE INDEX idx_entries_content_en_fts ON entries USING GIN(to_tsvector('english', COALESCE(content_en, '')));

-- Moderation queue indexes
CREATE INDEX idx_moderation_queue_status ON moderation_queue(status);
CREATE INDEX idx_moderation_queue_domain ON moderation_queue(domain);
CREATE INDEX idx_moderation_queue_created_at ON moderation_queue(created_at);
CREATE INDEX idx_moderation_queue_entry_id ON moderation_queue(entry_id);

-- Audit log indexes
CREATE INDEX idx_audit_log_timestamp ON audit_log(timestamp);
CREATE INDEX idx_audit_log_entry_id ON audit_log(entry_id);
CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_entries_updated_at
    BEFORE UPDATE ON entries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create views for common queries

-- View for entries with quality scores
CREATE VIEW entries_with_quality AS
SELECT 
    e.*,
    (e.quality_scores->>'iqs')::numeric AS iqs,
    (e.quality_scores->>'ais')::numeric AS ais
FROM entries e;

-- View for pending moderation items
CREATE VIEW pending_moderation AS
SELECT 
    mq.*,
    e.title_de,
    e.url
FROM moderation_queue mq
LEFT JOIN entries e ON mq.entry_id = e.id
WHERE mq.status = 'pending'
ORDER BY mq.created_at DESC;

-- View for entry statistics by domain
CREATE VIEW entry_statistics AS
SELECT 
    domain,
    COUNT(*) AS total_entries,
    COUNT(*) FILTER (WHERE status = 'active') AS active_entries,
    AVG((quality_scores->>'iqs')::numeric) AS avg_iqs,
    AVG((quality_scores->>'ais')::numeric) AS avg_ais,
    COUNT(*) FILTER (WHERE title_en IS NULL OR title_en = '') AS missing_en_translation,
    COUNT(*) FILTER (WHERE title_easy_de IS NULL OR title_easy_de = '') AS missing_easy_de_translation
FROM entries
GROUP BY domain;

-- Grant permissions (for development)
-- In production, use more restrictive permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO systemfehler;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO systemfehler;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO systemfehler;
