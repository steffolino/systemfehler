-- Migration: Add updatedAt column to Organization table if missing
ALTER TABLE Organization ADD COLUMN updatedAt TEXT NOT NULL DEFAULT (datetime('now'));
