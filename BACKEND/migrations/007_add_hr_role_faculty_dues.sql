-- Migration 007: Add HR Role and Enhance Faculty Dues System
-- Description: Introduces the 'hr' role for HR personnel who manage faculty dues.
--              Also adds missing columns to faculty_due (principal_amount, interest_rate),
--              relaxes the source constraint to support HR users with no dept/section,
--              and creates a view with dynamic interest calculation for faculty dues.
-- Date: March 12, 2026

-- ============================================
-- 1. ADD HR ROLE
-- ============================================
INSERT INTO roles (role) VALUES ('hr') ON CONFLICT DO NOTHING;

-- ============================================
-- 2. ADD MISSING COLUMNS TO faculty_due
--    (principal_amount and interest_rate may not exist from migration 005)
-- ============================================
ALTER TABLE faculty_due
    ADD COLUMN IF NOT EXISTS principal_amount NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS interest_rate NUMERIC(10,6);

-- ============================================
-- 3. RELAX faculty_due SOURCE CONSTRAINT
--    Allows HR users (who may have no dept/section) to add dues.
--    Original constraint required exactly one of dept/section.
--    New constraint also allows both to be NULL (HR-added dues).
-- ============================================
ALTER TABLE faculty_due DROP CONSTRAINT IF EXISTS chk_faculty_due_source;

ALTER TABLE faculty_due ADD CONSTRAINT chk_faculty_due_source CHECK (
    (added_by_department_id IS NOT NULL AND added_by_section_id IS NULL)
    OR
    (added_by_department_id IS NULL AND added_by_section_id IS NOT NULL)
    OR
    (added_by_department_id IS NULL AND added_by_section_id IS NULL)
);

-- ============================================
-- 4. INDEXES FOR new columns
-- ============================================
CREATE INDEX IF NOT EXISTS idx_faculty_due_employee ON faculty_due (employee_code);
CREATE INDEX IF NOT EXISTS idx_faculty_due_is_cleared ON faculty_due (is_cleared);
CREATE INDEX IF NOT EXISTS idx_faculty_due_added_by ON faculty_due (added_by_user_id);

-- ============================================
-- 5. FACULTY DUES VIEW WITH DYNAMIC INTEREST
--    Mirrors student_dues_with_interest view
-- ============================================
CREATE OR REPLACE VIEW faculty_due_with_interest AS
SELECT
    fd.*,
    calculate_compounded_amount(
        fd.principal_amount,
        fd.interest_rate,
        fd.is_compounded,
        fd.due_clear_by_date
    ) AS calculated_current_amount,
    calculate_outstanding_amount(
        fd.principal_amount,
        fd.interest_rate,
        fd.is_compounded,
        fd.due_clear_by_date,
        fd.amount_paid
    ) AS calculated_outstanding,
    CASE
        WHEN CURRENT_TIMESTAMP < fd.due_clear_by_date THEN TRUE
        ELSE FALSE
    END AS is_in_grace_period
FROM faculty_due fd;

GRANT SELECT ON faculty_due_with_interest TO PUBLIC;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON COLUMN faculty_due.principal_amount IS 'Original due amount before compounding';
COMMENT ON COLUMN faculty_due.interest_rate    IS 'Daily compound interest rate (e.g. 0.001 = 0.1%/day)';

-- ============================================
-- HOW TO CREATE AN HR USER
-- ============================================
-- Run this via the admin panel (Add User page) after applying this migration:
--   Username: hr_admin (example)
--   Email:    hr@vnrvjiet.in
--   Role:     hr
--   Password: (set by admin)
--   Department/Section: Optional - if set, it will be recorded on the dues they create.
