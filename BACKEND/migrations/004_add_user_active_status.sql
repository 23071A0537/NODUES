-- Migration 004: Add Active Status to Users
-- Description: Add active column to users table to control account access
-- Date: February 16, 2026

-- Add active column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;

-- Add comment
COMMENT ON COLUMN users.active IS 'Indicates if user account is active and can access the system';

-- Update all existing users to be active by default
UPDATE users SET active = TRUE WHERE active IS NULL;

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_users_active ON users(active);
