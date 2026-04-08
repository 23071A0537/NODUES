import { sql } from './config/db.js';

async function fixOperatorType() {
  try {
    console.log('🔧 Fixing CSE operator type...\n');

    const result = await sql`
      UPDATE users 
      SET operator_type = 'department' 
      WHERE username = 'cse_opr_1'
      RETURNING username, operator_type, department_id
    `;

    console.log('✓ Updated CSE operator:', result);
    
    // Verify
    const operators = await sql`
      SELECT 
        u.username, 
        u.operator_type,
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

    console.log('\n📊 All Operators After Update:\n');
    operators.forEach(op => {
      console.log(`• ${op.username}`);
      console.log(`  Type: ${op.operator_type || 'NULL'}`);
      console.log(`  Department: ${op.dept_name || 'NULL'} (ID: ${op.department_id || 'NULL'})`);
      console.log(`  Section: ${op.section_name || 'NULL'} (ID: ${op.section_id || 'NULL'})`);
      console.log('');
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixOperatorType();
