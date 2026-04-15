-- Migration 009: Add Department Dues Table
-- Description: Dedicated table for department operator dues with mandatory incident/documentation fields
-- Date: April 9, 2026

CREATE TABLE IF NOT EXISTS department_dues (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    student_roll_number VARCHAR(20) NOT NULL,
    added_by_user_id UUID NOT NULL,
    added_by_department_id INTEGER NOT NULL,
    added_by_section_id INTEGER,
    due_type_id INTEGER NOT NULL,
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
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    -- Mandatory department due form fields
    serial_no INTEGER NOT NULL,
    incident_date DATE NOT NULL,
    student_name_snapshot VARCHAR(255) NOT NULL,
    program_name VARCHAR(120) NOT NULL,
    branch_name VARCHAR(120) NOT NULL,
    academic_year_label VARCHAR(40) NOT NULL,
    semester_label VARCHAR(20) NOT NULL,
    section_label VARCHAR(40) NOT NULL,
    location_type VARCHAR(120) NOT NULL,
    location_name VARCHAR(255) NOT NULL,
    room_no VARCHAR(50) NOT NULL,
    course_activity_usage_context TEXT NOT NULL,
    staff_reporting_name VARCHAR(255) NOT NULL,
    staff_employee_id VARCHAR(80) NOT NULL,
    staff_designation VARCHAR(120) NOT NULL,
    item_equipment TEXT NOT NULL,
    issue_type TEXT NOT NULL,
    approx_value VARCHAR(120) NOT NULL,
    form_remarks TEXT NOT NULL,
    documentation_type VARCHAR(120) NOT NULL,
    documentation_type_other TEXT,

    CONSTRAINT chk_department_due_source CHECK (
        added_by_department_id IS NOT NULL
        AND added_by_section_id IS NULL
    ),

    CONSTRAINT chk_department_amount_logic CHECK (
        (is_payable = TRUE AND principal_amount IS NOT NULL AND current_amount IS NOT NULL)
        OR
        (is_payable = FALSE AND principal_amount IS NULL AND current_amount IS NULL)
    ),

    CONSTRAINT chk_department_amount_paid CHECK (
        amount_paid <= COALESCE(current_amount, 0)
    ),

    CONSTRAINT chk_department_document_type_flags CHECK (
        (needs_original IS NULL AND needs_pdf IS NULL)
        OR
        (needs_original = TRUE AND needs_pdf = FALSE)
        OR
        (needs_original = FALSE AND needs_pdf = TRUE)
    ),

    CONSTRAINT chk_department_compounded_payable CHECK (
        (is_payable = FALSE AND is_compounded IS NULL AND interest_rate IS NULL)
        OR
        (is_payable = TRUE AND is_compounded = FALSE AND interest_rate IS NULL)
        OR
        (is_payable = TRUE AND is_compounded = TRUE AND interest_rate IS NOT NULL)
    ),

    CONSTRAINT chk_department_overall_status CHECK (
        overall_status = (COALESCE(is_cleared, FALSE) OR COALESCE(permission_granted, FALSE))
    ),

    CONSTRAINT chk_department_documentation_other CHECK (
        (LOWER(documentation_type) <> 'other' AND documentation_type_other IS NULL)
        OR
        (LOWER(documentation_type) = 'other' AND documentation_type_other IS NOT NULL AND BTRIM(documentation_type_other) <> '')
    ),

    CONSTRAINT fk_department_dues_student
        FOREIGN KEY (student_roll_number)
        REFERENCES students (roll_number)
        ON DELETE CASCADE,

    CONSTRAINT fk_department_dues_user
        FOREIGN KEY (added_by_user_id)
        REFERENCES users (user_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_department_dues_due_type
        FOREIGN KEY (due_type_id)
        REFERENCES due_types (id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_department_dues_department
        FOREIGN KEY (added_by_department_id)
        REFERENCES departments (id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_department_dues_section
        FOREIGN KEY (added_by_section_id)
        REFERENCES sections (id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_department_dues_cleared_by
        FOREIGN KEY (cleared_by_user_id)
        REFERENCES users (user_id)
        ON DELETE SET NULL
);

CREATE SEQUENCE IF NOT EXISTS department_dues_serial_no_seq
    START WITH 1
    INCREMENT BY 1;

SELECT setval(
    'department_dues_serial_no_seq',
    GREATEST(
        COALESCE((SELECT MAX(serial_no) FROM department_dues), 0),
        1
    ),
    TRUE
);

ALTER TABLE department_dues
    ALTER COLUMN serial_no SET DEFAULT nextval('department_dues_serial_no_seq');

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'uq_department_dues_serial_no'
          AND conrelid = 'department_dues'::regclass
    ) THEN
        ALTER TABLE department_dues
            ADD CONSTRAINT uq_department_dues_serial_no UNIQUE (serial_no);
    END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_department_dues_student_roll
    ON department_dues (student_roll_number);

CREATE INDEX IF NOT EXISTS idx_department_dues_department
    ON department_dues (added_by_department_id);

CREATE INDEX IF NOT EXISTS idx_department_dues_clear_status
    ON department_dues (is_cleared);

CREATE INDEX IF NOT EXISTS idx_department_dues_due_type
    ON department_dues (due_type_id);

CREATE INDEX IF NOT EXISTS idx_department_dues_created_at
    ON department_dues (created_at);

CREATE INDEX IF NOT EXISTS idx_department_dues_department_summary
    ON department_dues (added_by_department_id, is_cleared, is_payable);

CREATE INDEX IF NOT EXISTS idx_department_dues_documentation_type
    ON department_dues (documentation_type);

CREATE INDEX IF NOT EXISTS idx_department_dues_pending_approval
    ON department_dues (added_by_department_id, updated_at)
    WHERE is_cleared = FALSE AND proof_drive_link IS NOT NULL;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS set_updated_at ON department_dues;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON department_dues
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE department_dues IS 'Dedicated dues table for department operators with mandatory issue-reporting form fields';
COMMENT ON COLUMN department_dues.documentation_type IS 'Documentation category selected by operator (hybrid dropdown + other)';
COMMENT ON COLUMN department_dues.documentation_type_other IS 'Custom documentation type text when dropdown value is Other';
COMMENT ON COLUMN department_dues.form_remarks IS 'Mandatory remarks entered in department due form';
