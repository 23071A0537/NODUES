-- Migration 010: Add Alumni Dues Table
-- Description: Dedicated table for Alumni bulk dues with alumni form fields
-- Date: April 14, 2026

CREATE TABLE IF NOT EXISTS alumni_dues (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    student_roll_number VARCHAR(20) NOT NULL,
    added_by_user_id UUID NOT NULL,
    added_by_section_id INTEGER NOT NULL,
    due_type_id INTEGER NOT NULL,
    academic_year_id INTEGER NOT NULL,

    is_payable BOOLEAN NOT NULL DEFAULT FALSE,
    principal_amount NUMERIC(10,2),
    current_amount NUMERIC(10,2),
    amount_paid NUMERIC(10,2) DEFAULT 0,

    permission_granted BOOLEAN DEFAULT FALSE,
    supporting_document_link TEXT,
    cleared_by_user_id UUID,
    due_clear_by_date DATE NOT NULL,
    is_cleared BOOLEAN DEFAULT FALSE,
    overall_status BOOLEAN DEFAULT FALSE,

    due_description TEXT,
    remarks TEXT,
    proof_drive_link TEXT,
    is_compounded BOOLEAN,
    interest_rate NUMERIC(10,6),
    needs_original BOOLEAN,
    needs_pdf BOOLEAN,

    status_of_registration_with_alumni_portal VARCHAR(1) NOT NULL,
    linkedin_profile_link TEXT NOT NULL,
    placement_status VARCHAR(1) NOT NULL,
    proof_of_placement TEXT,
    planning_for_higher_education VARCHAR(1) NOT NULL,
    proof_of_higher_education TEXT,
    campaign_key VARCHAR(120) NOT NULL,

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_alumni_due_source CHECK (
        added_by_section_id IS NOT NULL
    ),

    CONSTRAINT chk_alumni_amount_logic CHECK (
        (is_payable = TRUE AND principal_amount IS NOT NULL AND current_amount IS NOT NULL)
        OR
        (is_payable = FALSE AND principal_amount IS NULL AND current_amount IS NULL)
    ),

    CONSTRAINT chk_alumni_amount_paid CHECK (
        amount_paid <= COALESCE(current_amount, 0)
    ),

    CONSTRAINT chk_alumni_document_type_flags CHECK (
        (needs_original IS NULL AND needs_pdf IS NULL)
        OR
        (needs_original = TRUE AND needs_pdf = FALSE)
        OR
        (needs_original = FALSE AND needs_pdf = TRUE)
    ),

    CONSTRAINT chk_alumni_compounded_payable CHECK (
        (is_payable = FALSE AND is_compounded IS NULL AND interest_rate IS NULL)
        OR
        (is_payable = TRUE AND is_compounded = FALSE AND interest_rate IS NULL)
        OR
        (is_payable = TRUE AND is_compounded = TRUE AND interest_rate IS NOT NULL)
    ),

    CONSTRAINT chk_alumni_overall_status CHECK (
        overall_status = (COALESCE(is_cleared, FALSE) OR COALESCE(permission_granted, FALSE))
    ),

    CONSTRAINT chk_alumni_registration_status CHECK (
        status_of_registration_with_alumni_portal IN ('Y', 'N')
    ),

    CONSTRAINT chk_alumni_placement_status CHECK (
        placement_status IN ('Y', 'N')
    ),

    CONSTRAINT chk_alumni_higher_education_status CHECK (
        planning_for_higher_education IN ('Y', 'N')
    ),

    CONSTRAINT chk_alumni_placement_proof_required CHECK (
        (placement_status = 'N')
        OR
        (placement_status = 'Y' AND proof_of_placement IS NOT NULL AND BTRIM(proof_of_placement) <> '')
    ),

    CONSTRAINT chk_alumni_higher_education_proof_required CHECK (
        (planning_for_higher_education = 'N')
        OR
        (planning_for_higher_education = 'Y' AND proof_of_higher_education IS NOT NULL AND BTRIM(proof_of_higher_education) <> '')
    ),

    CONSTRAINT fk_alumni_dues_student
        FOREIGN KEY (student_roll_number)
        REFERENCES students (roll_number)
        ON DELETE CASCADE,

    CONSTRAINT fk_alumni_dues_user
        FOREIGN KEY (added_by_user_id)
        REFERENCES users (user_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_alumni_dues_due_type
        FOREIGN KEY (due_type_id)
        REFERENCES due_types (id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_alumni_dues_section
        FOREIGN KEY (added_by_section_id)
        REFERENCES sections (id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_alumni_dues_academic_year
        FOREIGN KEY (academic_year_id)
        REFERENCES academic_year (id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_alumni_dues_cleared_by
        FOREIGN KEY (cleared_by_user_id)
        REFERENCES users (user_id)
        ON DELETE SET NULL,

    CONSTRAINT uq_alumni_campaign_student UNIQUE (
        student_roll_number,
        added_by_section_id,
        academic_year_id,
        campaign_key
    )
);

CREATE INDEX IF NOT EXISTS idx_alumni_dues_student_roll
    ON alumni_dues (student_roll_number);

CREATE INDEX IF NOT EXISTS idx_alumni_dues_section
    ON alumni_dues (added_by_section_id);

CREATE INDEX IF NOT EXISTS idx_alumni_dues_academic_year
    ON alumni_dues (academic_year_id);

CREATE INDEX IF NOT EXISTS idx_alumni_dues_clear_status
    ON alumni_dues (is_cleared);

CREATE INDEX IF NOT EXISTS idx_alumni_dues_campaign
    ON alumni_dues (campaign_key);

CREATE INDEX IF NOT EXISTS idx_alumni_dues_student_active
    ON alumni_dues (student_roll_number, is_cleared, due_clear_by_date);

COMMENT ON TABLE alumni_dues IS 'Dedicated Alumni form dues table for section operator bulk campaigns';
COMMENT ON COLUMN alumni_dues.status_of_registration_with_alumni_portal IS 'Y/N status of registration with alumni portal';
COMMENT ON COLUMN alumni_dues.linkedin_profile_link IS 'LinkedIn profile link submitted in alumni form';
COMMENT ON COLUMN alumni_dues.placement_status IS 'Y/N placement status';
COMMENT ON COLUMN alumni_dues.proof_of_placement IS 'Proof URL for placement when placement status is Y';
COMMENT ON COLUMN alumni_dues.planning_for_higher_education IS 'Y/N planning for higher education';
COMMENT ON COLUMN alumni_dues.proof_of_higher_education IS 'Proof URL for higher education when status is Y';
COMMENT ON COLUMN alumni_dues.campaign_key IS 'Bulk creation campaign key to prevent duplicate alumni dues for same run';
