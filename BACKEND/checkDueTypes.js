import { sql } from './config/db.js';

async function checkDueTypes() {
  try {
    console.log('🔍 Checking due_types table...\n');

    // Check if table exists and has data
    const result = await sql.query(`
      SELECT id, type_name, description, is_for_student, requires_permission
      FROM due_types
      ORDER BY type_name ASC
    `);

    if (result.length === 0) {
      console.log('⚠️  No due types found in database!');
      console.log('\nAdding sample due types...\n');
      
      const sampleDueTypes = [
        { type_name: 'Library Fine', description: 'Fine for late book return or library damage', is_for_student: 1, requires_permission: false },
        { type_name: 'Lab Equipment Damage', description: 'Damage to lab equipment', is_for_student: 1, requires_permission: true },
        { type_name: 'Hostel Dues', description: 'Hostel fees and charges', is_for_student: 1, requires_permission: false },
        { type_name: 'Course Material', description: 'Course material and study materials', is_for_student: 1, requires_permission: false },
        { type_name: 'Documentation', description: 'Missing or incomplete documentation', is_for_student: 1, requires_permission: false },
      ];

      for (const due of sampleDueTypes) {
        await sql.query(`
          INSERT INTO due_types (type_name, description, is_for_student, requires_permission)
          VALUES ($1, $2, $3, $4)
        `, [due.type_name, due.description, due.is_for_student, due.requires_permission]);
        console.log(`✓ Added: ${due.type_name}`);
      }

      console.log('\n✅ Sample due types added successfully!');
    } else {
      console.log('📊 Due Types in Database:');
      console.log('═══════════════════════════════════════════════');
      result.forEach((dt) => {
        console.log(`  ID: ${dt.id}`);
        console.log(`  Name: ${dt.type_name}`);
        console.log(`  Description: ${dt.description}`);
        console.log(`  For Students: ${dt.is_for_student === 1 ? 'Yes' : 'No'}`);
        console.log(`  Requires Permission: ${dt.requires_permission ? 'Yes' : 'No'}`);
        console.log('');
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkDueTypes();
