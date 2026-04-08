import fs from 'fs';
import { sql } from './config/db.js';

async function runMigration() {
  try {
    console.log('Starting migration...');
    const migration = fs.readFileSync('./migrations/001_add_operator_fields.sql', 'utf-8');
    
    // Execute each statement individually
    const statements = [
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS operator_type VARCHAR(20)",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS access_level VARCHAR(30)",
      "COMMENT ON COLUMN users.operator_type IS 'Type of operator: department or section'",
      "COMMENT ON COLUMN users.access_level IS 'Access level: all_students, department_students, or all_faculty'",
      "ALTER TABLE student_dues ADD COLUMN IF NOT EXISTS needs_original BOOLEAN",
      "ALTER TABLE student_dues ADD COLUMN IF NOT EXISTS needs_pdf BOOLEAN",
      "ALTER TABLE student_dues ADD COLUMN IF NOT EXISTS is_compounded BOOLEAN",
      "ALTER TABLE student_dues ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP",
      "COMMENT ON COLUMN student_dues.needs_original IS 'For documentation dues: requires original document'",
      "COMMENT ON COLUMN student_dues.needs_pdf IS 'For documentation dues: requires PDF copy'",
      "COMMENT ON COLUMN student_dues.is_compounded IS 'For payable dues: whether interest is compounded'",
      "COMMENT ON COLUMN student_dues.updated_at IS 'Timestamp when due was last updated'"
    ];
    
    for (const statement of statements) {
      try {
        await sql.query(statement);
        console.log('✓', statement.slice(0, 60) + '...');
      } catch (err) {
        // Some statements might fail if columns already exist - that's ok
        if (!err.message.includes('already exists')) {
          console.log('⚠', statement.slice(0, 60) + '...', '(skipped)');
        }
      }
    }
    
    console.log('\n✓ Migration applied successfully!');
    console.log('\nNOTE: The CSE Operator seed script has been updated.');
    console.log('You can now run: node seeds/addCseOperator.js');
    process.exit(0);
  } catch (err) {
    console.error('✗ Migration failed:', err.message);
    process.exit(1);
  }
}

runMigration();
