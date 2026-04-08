import { sql } from './config/db.js';

async function verifyMigration() {
  try {
    console.log('🔍 Verifying database migration...\n');

    // Check student_dues table columns
    const columns = await sql.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name='student_dues'
      ORDER BY ordinal_position
    `);

    console.log('📊 Student Dues Table Columns:');
    console.log('═══════════════════════════════════════════════');
    columns.forEach(col => {
      const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      console.log(`  ✓ ${col.column_name.padEnd(25)} ${col.data_type.padEnd(15)} ${nullable}`);
    });

    // Check for new columns specifically
    console.log('\n✅ New Columns Added:');
    const newColumns = ['needs_original', 'needs_pdf', 'is_compounded'];
    const columnNames = columns.map(c => c.column_name);
    
    for (const col of newColumns) {
      if (columnNames.includes(col)) {
        const colInfo = columns.find(c => c.column_name === col);
        console.log(`  ✓ ${col} (${colInfo.data_type})`);
      }
    }

    // Check users table
    console.log('\n📊 Users Table - New Columns:');
    console.log('═══════════════════════════════════════════════');
    const usersColumns = await sql.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name='users'
      AND column_name IN ('operator_type', 'access_level')
      ORDER BY column_name
    `);

    usersColumns.forEach(col => {
      console.log(`  ✓ ${col.column_name.padEnd(25)} ${col.data_type}`);
    });

    console.log('\n🎉 Migration verification complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    process.exit(1);
  }
}

verifyMigration();
