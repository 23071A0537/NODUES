-- Migration 008: Add active status to students and faculty tables
-- This allows admins to deactivate accounts without deleting records

ALTER TABLE students ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;
UPDATE students SET active = TRUE WHERE active IS NULL;

ALTER TABLE faculty ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;
UPDATE faculty SET active = TRUE WHERE active IS NULL;
