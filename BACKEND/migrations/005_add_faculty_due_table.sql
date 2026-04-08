-- Migration 005: Add Faculty Due Table
-- Description: Create dedicated table for faculty dues with same structure as student_dues
-- Date: February 16, 2026
-- Author: System Migration

-- ============================================
-- FACULTY DUES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS faculty_due (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    employee_code VARCHAR(20) NOT NULL,
    added_by_user_id UUID NOT NULL,
    added_by_department_id INTEGER,
    added_by_section_id INTEGER,
    due_type_id INTEGER NOT NULL,
    is_payable BOOLEAN NOT NULL,
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
    needs_original BOOLEAN,
    needs_pdf BOOLEAN,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    -- ============================================
    -- CONSTRAINTS
    -- ============================================
    
    -- Amount Logic: Payable dues must have amount, non-payable should not
    CONSTRAINT chk_faculty_amount_logic CHECK (
        (is_payable = TRUE AND current_amount IS NOT NULL)
        OR
        (is_payable = FALSE AND current_amount IS NULL)
    ),
    
    -- Amount Paid cannot exceed Current Amount
    CONSTRAINT chk_faculty_amount_paid CHECK (
        amount_paid <= COALESCE(current_amount, 0)
    ),
    
    -- Due must be from either department or section, not both
    CONSTRAINT chk_faculty_due_source CHECK (
        (added_by_department_id IS NOT NULL AND added_by_section_id IS NULL)
        OR
        (added_by_department_id IS NULL AND added_by_section_id IS NOT NULL)
    ),
    
    -- Document Type: Either original OR pdf, or neither
    CONSTRAINT chk_faculty_document_type CHECK (
        (needs_original IS NULL AND needs_pdf IS NULL)
        OR
        (needs_original = TRUE AND needs_pdf = FALSE)
        OR
        (needs_original = FALSE AND needs_pdf = TRUE)
    ),
    
    -- Compounding only for payable dues
    CONSTRAINT chk_faculty_compounded_payable CHECK (
        (is_payable = FALSE AND is_compounded IS NULL)
        OR
        (is_payable = TRUE AND is_compounded IS NOT NULL)
    ),
    
    -- Overall Status Logic: Cleared if either is_cleared OR permission_granted
    CONSTRAINT chk_faculty_overall_status CHECK (
        overall_status = (COALESCE(is_cleared, FALSE) OR COALESCE(permission_granted, FALSE))
    ),
    
    -- ============================================
    -- FOREIGN KEYS
    -- ============================================
    
    -- Faculty Reference
    CONSTRAINT fk_faculty_due_faculty
        FOREIGN KEY (employee_code)
        REFERENCES faculty (employee_code)
        ON DELETE CASCADE,
    
    -- User who added the due
    CONSTRAINT fk_faculty_due_user
        FOREIGN KEY (added_by_user_id)
        REFERENCES users (user_id)
        ON DELETE RESTRICT,
    
    -- Due Type Reference
    CONSTRAINT fk_faculty_due_due_type
        FOREIGN KEY (due_type_id)
        REFERENCES due_types (id)
        ON DELETE RESTRICT,
    
    -- Department Reference
    CONSTRAINT fk_faculty_due_department
        FOREIGN KEY (added_by_department_id)
        REFERENCES departments (id)
        ON DELETE RESTRICT,
    
    -- Section Reference
    CONSTRAINT fk_faculty_due_section
        FOREIGN KEY (added_by_section_id)
        REFERENCES sections (id)
        ON DELETE RESTRICT,
    
    -- User who cleared the due
    CONSTRAINT fk_faculty_due_cleared_by
        FOREIGN KEY (cleared_by_user_id)
        REFERENCES users (user_id)
        ON DELETE SET NULL
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Index on employee_code for fast faculty lookups
CREATE INDEX IF NOT EXISTS idx_faculty_due_employee ON faculty_due (employee_code);

-- Index on added_by_user_id for tracking who added dues
CREATE INDEX IF NOT EXISTS idx_faculty_due_user ON faculty_due (added_by_user_id);

-- Index on due_type_id for filtering by due type
CREATE INDEX IF NOT EXISTS idx_faculty_due_type ON faculty_due (due_type_id);

-- Index on is_cleared for filtering active vs cleared dues
CREATE INDEX IF NOT EXISTS idx_faculty_due_cleared ON faculty_due (is_cleared);

-- Index on overall_status for dashboard queries
CREATE INDEX IF NOT EXISTS idx_faculty_due_overall_status ON faculty_due (overall_status);

-- Compound index on is_payable for filtering payable/non-payable dues
CREATE INDEX IF NOT EXISTS idx_faculty_due_payable ON faculty_due (is_payable);

-- Index on department for department-wise queries
CREATE INDEX IF NOT EXISTS idx_faculty_due_department ON faculty_due (added_by_department_id);

-- Index on section for section-wise queries
CREATE INDEX IF NOT EXISTS idx_faculty_due_section ON faculty_due (added_by_section_id);

-- Compound index for documentation queries (non-payable dues)
CREATE INDEX IF NOT EXISTS idx_faculty_due_documentation 
    ON faculty_due (needs_original, needs_pdf) 
    WHERE is_payable = FALSE;

-- Index on created_at for time-based queries
CREATE INDEX IF NOT EXISTS idx_faculty_due_created ON faculty_due (created_at);

-- Index on due_clear_by_date for deadline tracking
CREATE INDEX IF NOT EXISTS idx_faculty_due_deadline ON faculty_due (due_clear_by_date);

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================

-- Create trigger function for updated_at if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for faculty_due table
DROP TRIGGER IF EXISTS set_updated_at ON faculty_due;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON faculty_due
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- FACULTY DUE PAYMENTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS faculty_due_payments (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    faculty_due_id INTEGER NOT NULL,
    paid_amount NUMERIC(10,2) NOT NULL CHECK (paid_amount > 0),
    payment_reference VARCHAR(100) NOT NULL UNIQUE,
    payment_method VARCHAR(30) NOT NULL,
    payment_status payment_status_enum NOT NULL,
    gateway_response JSONB,
    paid_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Key to faculty_due table
    CONSTRAINT fk_faculty_due_payments_due
        FOREIGN KEY (faculty_due_id)
        REFERENCES faculty_due (id)
        ON DELETE CASCADE
);

-- Index for faculty_due_payments
CREATE INDEX IF NOT EXISTS idx_faculty_due_payments_due ON faculty_due_payments (faculty_due_id);
CREATE INDEX IF NOT EXISTS idx_faculty_due_payments_status ON faculty_due_payments (payment_status);
CREATE INDEX IF NOT EXISTS idx_faculty_due_payments_date ON faculty_due_payments (paid_at);

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE faculty_due IS 'Stores all dues assigned to faculty members';
COMMENT ON COLUMN faculty_due.employee_code IS 'Faculty employee code from faculty table';
COMMENT ON COLUMN faculty_due.added_by_user_id IS 'User (typically HR operator) who added this due';
COMMENT ON COLUMN faculty_due.is_payable IS 'TRUE if due requires payment, FALSE for non-payable documentation dues';
COMMENT ON COLUMN faculty_due.current_amount IS 'Current outstanding amount (NULL for non-payable dues)';
COMMENT ON COLUMN faculty_due.amount_paid IS 'Total amount paid so far';
COMMENT ON COLUMN faculty_due.permission_granted IS 'TRUE if permission letter granted to clear without payment';
COMMENT ON COLUMN faculty_due.is_cleared IS 'TRUE if due is fully cleared (payment or permission)';
COMMENT ON COLUMN faculty_due.overall_status IS 'TRUE if cleared OR permission granted';
COMMENT ON COLUMN faculty_due.is_compounded IS 'TRUE if interest compounds on this payable due';
COMMENT ON COLUMN faculty_due.needs_original IS 'TRUE if original physical document required';
COMMENT ON COLUMN faculty_due.needs_pdf IS 'TRUE if PDF document required';
COMMENT ON COLUMN faculty_due.updated_at IS 'Automatically updated timestamp on any row modification';

COMMENT ON TABLE faculty_due_payments IS 'Payment transaction records for faculty dues';
COMMENT ON COLUMN faculty_due_payments.faculty_due_id IS 'Reference to the faculty due being paid';
COMMENT ON COLUMN faculty_due_payments.payment_reference IS 'Unique payment gateway reference/transaction ID';
COMMENT ON COLUMN faculty_due_payments.gateway_response IS 'Full JSON response from payment gateway';

