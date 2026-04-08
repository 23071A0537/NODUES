-- ============================================
-- MIGRATION: Add document requirement columns to student_dues
-- Date: January 31, 2026
-- ============================================
-- This migration adds support for tracking:
-- 1. Interest compounding on payable dues
-- 2. Original document requirements for non-payable dues
-- 3. PDF document requirements for non-payable dues

ALTER TABLE student_dues 
ADD COLUMN IF NOT EXISTS is_compounded BOOLEAN;

ALTER TABLE student_dues 
ADD COLUMN IF NOT EXISTS needs_original BOOLEAN;

ALTER TABLE student_dues 
ADD COLUMN IF NOT EXISTS needs_pdf BOOLEAN;

-- ============================================
-- Column Descriptions
-- ============================================
COMMENT ON COLUMN student_dues.is_compounded IS 'Whether interest will be compounded (only for payable dues)';
COMMENT ON COLUMN student_dues.needs_original IS 'Whether original document is required (only for non-payable documentation dues)';
COMMENT ON COLUMN student_dues.needs_pdf IS 'Whether PDF document is required (only for non-payable documentation dues)';

-- ============================================
-- Constraint: Only one document type at a time
-- ============================================
ALTER TABLE student_dues
ADD CONSTRAINT chk_document_type CHECK (
    -- Either both null (not a documentation due), or exactly one is true
    (needs_original IS NULL AND needs_pdf IS NULL)
    OR
    (needs_original = TRUE AND needs_pdf = FALSE)
    OR
    (needs_original = FALSE AND needs_pdf = TRUE)
);

-- ============================================
-- Constraint: is_compounded only for payable dues
-- ============================================
ALTER TABLE student_dues
ADD CONSTRAINT chk_compounded_payable CHECK (
    (is_payable = FALSE AND is_compounded IS NULL)
    OR
    (is_payable = TRUE AND is_compounded IS NOT NULL)
);

-- ============================================
-- Index for filtering non-payable documentation dues
-- ============================================
CREATE INDEX IF NOT EXISTS idx_student_dues_documentation 
ON student_dues (needs_original, needs_pdf) 
WHERE is_payable = FALSE;
