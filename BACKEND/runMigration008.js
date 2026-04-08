import { sql } from './config/db.js';

async function runMigration008() {
  try {
    console.log('========================================');
    console.log('Running Migration 008: Add active status to students and faculty');
    console.log('========================================\n');

    // Add active column to students
    try {
      await sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE`;
      console.log('✓ Added active column to students table');
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log('- active column already exists on students (skipping)');
      } else {
        throw err;
      }
    }

    // Set any NULLs to TRUE on students
    const { count: studentsUpdated } = await sql`
      UPDATE students SET active = TRUE WHERE active IS NULL
    `;
    console.log(`✓ Set active=TRUE for ${studentsUpdated ?? 0} existing student rows`);

    // Add active column to faculty
    try {
      await sql`ALTER TABLE faculty ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE`;
      console.log('✓ Added active column to faculty table');
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log('- active column already exists on faculty (skipping)');
      } else {
        throw err;
      }
    }

    // Set any NULLs to TRUE on faculty
    const { count: facultyUpdated } = await sql`
      UPDATE faculty SET active = TRUE WHERE active IS NULL
    `;
    console.log(`✓ Set active=TRUE for ${facultyUpdated ?? 0} existing faculty rows`);

    console.log('\n✓ Migration 008 completed successfully!');
    console.log('Admin can now activate/deactivate students and faculty from the dashboard.');
    process.exit(0);
  } catch (err) {
    console.error('\n✗ Migration 008 failed:', err.message);
    process.exit(1);
  }
}

runMigration008();
