-- Add multilingual JSONB title column to entries table
ALTER TABLE entries ADD COLUMN title JSONB;
