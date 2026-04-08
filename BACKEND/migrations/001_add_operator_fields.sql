-- Migration to add operator-specific fields to users table
-- and additional fields to student_dues table

-- Add operator fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS operator_type VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS access_level VARCHAR(30);

-- Add comment to explain the fields
COMMENT ON COLUMN users.operator_type IS 'Type of operator: department or section';
COMMENT ON COLUMN users.access_level IS 'Access level: all_students, department_students, or all_faculty';

-- Add missing fields to student_dues table
ALTER TABLE student_dues ADD COLUMN IF NOT EXISTS needs_original BOOLEAN;
ALTER TABLE student_dues ADD COLUMN IF NOT EXISTS needs_pdf BOOLEAN;
ALTER TABLE student_dues ADD COLUMN IF NOT EXISTS is_compounded BOOLEAN;
ALTER TABLE student_dues ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

-- Add comments
COMMENT ON COLUMN student_dues.needs_original IS 'For documentation dues: requires original document';
COMMENT ON COLUMN student_dues.needs_pdf IS 'For documentation dues: requires PDF copy';
COMMENT ON COLUMN student_dues.is_compounded IS 'For payable dues: whether interest is compounded';
COMMENT ON COLUMN student_dues.updated_at IS 'Timestamp when due was last updated';

-- Create trigger to update updated_at automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_student_dues_updated_at ON student_dues;

CREATE TRIGGER update_student_dues_updated_at 
    BEFORE UPDATE ON student_dues
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Sample data for due_types table (if not exists)
INSERT INTO due_types (type_name, description, is_for_student, requires_permission) VALUES
    ('Library Fine', 'Fine for late return of library books', 1, FALSE),
    ('Lab Equipment Damage', 'Charges for damaged lab equipment', 1, FALSE),
    ('Tuition Fee', 'Semester tuition fee payment', 1, FALSE),
    ('Hostel Fee', 'Hostel accommodation charges', 1, FALSE),
    ('Documentation Required', 'Submission of required documents', 1, TRUE),
    ('Certificate Issuance', 'Fee for certificate issuance', 1, FALSE),
    ('Examination Fee', 'Examination registration fee', 1, FALSE),
    ('Faculty Training Fee', 'Fee for faculty training programs', 0, FALSE),
    ('Faculty Certification', 'Certification requirements for faculty', 0, TRUE),
    ('Faculty ID Card', 'Faculty ID card issuance', 0, FALSE)
ON CONFLICT DO NOTHING;
