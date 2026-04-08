import { sql } from './config/db.js';

async function updateOperatorAccess() {
  try {
    console.log('🔧 Updating operator access level...\n');

    // Update all operators to have all_students access
    const result = await sql.query(`
      UPDATE users
      SET access_level = 'all_students'
      WHERE user_id IN (
        SELECT u.user_id 
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE r.role = 'operator'
      )
      RETURNING user_id, username, email, access_level
    `);

    console.log('✅ Updated operators:');
    result.forEach(op => {
      console.log(`  • ${op.username} (${op.email})`);
      console.log(`    New Access Level: ${op.access_level}\n`);
    });

    console.log('🎉 All operators now have access to all students!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

updateOperatorAccess();
