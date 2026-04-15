-- Migration 011: Add Alumni Form Submission Tracking
-- Description: Track whether student submitted alumni form details
-- Date: April 14, 2026

ALTER TABLE alumni_dues
    ADD COLUMN IF NOT EXISTS is_form_submitted BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;

-- Backfill existing prefilled alumni rows as submitted when LinkedIn link is already present.
UPDATE alumni_dues
SET
    is_form_submitted = TRUE,
    submitted_at = COALESCE(submitted_at, updated_at, created_at)
WHERE COALESCE(BTRIM(linkedin_profile_link), '') <> ''
  AND is_form_submitted = FALSE;

CREATE INDEX IF NOT EXISTS idx_alumni_dues_form_submission
    ON alumni_dues (added_by_section_id, academic_year_id, is_form_submitted);

COMMENT ON COLUMN alumni_dues.is_form_submitted IS 'TRUE when student has submitted alumni form details';
COMMENT ON COLUMN alumni_dues.submitted_at IS 'Timestamp when student submitted alumni form details';
