import { sql } from './config/db.js';

async function checkOperators() {
  try {
    console.log('🔍 Checking Operators...\n');

    const operators = await sql`
      SELECT 
        u.user_id, 
        u.username, 
        u.email, 
        u.operator_type,
        u.access_level,
        u.department_id,
        u.section_id,
        d.name as dept_name, 
        s.name as section_name
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN sections s ON u.section_id = s.id
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE r.role = 'operator'
    `;

    console.log('📊 Operators in Database:\n');
    operators.forEach(op => {
      console.log(`• ${op.username} (${op.email})`);
      console.log(`  Type: ${op.operator_type || 'NULL'}`);
      console.log(`  Access Level: ${op.access_level || 'NULL'}`);
      console.log(`  Department: ${op.dept_name || 'NULL'} (ID: ${op.department_id || 'NULL'})`);
      console.log(`  Section: ${op.section_name || 'NULL'} (ID: ${op.section_id || 'NULL'})`);
      console.log('');
    });

    console.log(`Total Operators: ${operators.length}\n`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkOperators();
