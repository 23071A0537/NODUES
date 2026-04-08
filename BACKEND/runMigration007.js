import { sql } from './config/db.js';

async function runMigration007() {
  try {
    console.log('========================================');
    console.log('Running Migration 007: HR Role & Faculty Dues Enhancements');
    console.log('========================================\n');

    // 1. Add HR role
    try {
      await sql`INSERT INTO roles (role) VALUES ('hr') ON CONFLICT DO NOTHING`;
      console.log("✓ Ensured 'hr' role exists in roles table");
    } catch (err) {
      console.log('⚠  HR role insert skipped:', err.message);
    }

    // 2. Add missing columns to faculty_due
    try {
      await sql`ALTER TABLE faculty_due ADD COLUMN IF NOT EXISTS principal_amount NUMERIC(10,2)`;
      console.log('✓ Added principal_amount column to faculty_due');
    } catch (err) {
      console.log('- principal_amount already exists (skipping)');
    }

    try {
      await sql`ALTER TABLE faculty_due ADD COLUMN IF NOT EXISTS interest_rate NUMERIC(10,6)`;
      console.log('✓ Added interest_rate column to faculty_due');
    } catch (err) {
      console.log('- interest_rate already exists (skipping)');
    }

    // 3. Relax source constraint (allow HR users with no dept/section)
    try {
      await sql`ALTER TABLE faculty_due DROP CONSTRAINT IF EXISTS chk_faculty_due_source`;
      console.log('✓ Dropped old chk_faculty_due_source constraint');
    } catch (err) {
      console.log('⚠  Drop constraint skipped:', err.message);
    }

    try {
      await sql`
        ALTER TABLE faculty_due ADD CONSTRAINT chk_faculty_due_source CHECK (
          (added_by_department_id IS NOT NULL AND added_by_section_id IS NULL)
          OR
          (added_by_department_id IS NULL AND added_by_section_id IS NOT NULL)
          OR
          (added_by_department_id IS NULL AND added_by_section_id IS NULL)
        )
      `;
      console.log('✓ Re-created chk_faculty_due_source constraint (allows HR/no dept)');
    } catch (err) {
      console.log('⚠  Add constraint skipped:', err.message);
    }

    // 4. Indexes
    try {
      await sql`CREATE INDEX IF NOT EXISTS idx_faculty_due_employee ON faculty_due (employee_code)`;
      console.log('✓ Index idx_faculty_due_employee');
    } catch (err) {
      console.log('⚠  Index idx_faculty_due_employee:', err.message);
    }

    try {
      await sql`CREATE INDEX IF NOT EXISTS idx_faculty_due_is_cleared ON faculty_due (is_cleared)`;
      console.log('✓ Index idx_faculty_due_is_cleared');
    } catch (err) {
      console.log('⚠  Index idx_faculty_due_is_cleared:', err.message);
    }

    try {
      await sql`CREATE INDEX IF NOT EXISTS idx_faculty_due_added_by ON faculty_due (added_by_user_id)`;
      console.log('✓ Index idx_faculty_due_added_by');
    } catch (err) {
      console.log('⚠  Index idx_faculty_due_added_by:', err.message);
    }

    // 5. Faculty dues view with dynamic interest (depends on migration 006 functions)
    try {
      await sql`
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
        FROM faculty_due fd
      `;
      console.log('✓ Created/updated faculty_due_with_interest view');
    } catch (err) {
      console.log('⚠  View creation skipped (migration 006 functions may be missing):', err.message);
    }

    try {
      await sql`GRANT SELECT ON faculty_due_with_interest TO PUBLIC`;
      console.log('✓ Granted SELECT on faculty_due_with_interest');
    } catch (err) {
      console.log('⚠  Grant skipped:', err.message);
    }

    console.log('\n✓ Migration 007 completed successfully!');
    console.log('You can now create HR users via the admin Add User page (role: hr).');
    process.exit(0);
  } catch (err) {
    console.error('\n✗ Migration 007 failed:', err.message);
    process.exit(1);
  }
}

runMigration007();
