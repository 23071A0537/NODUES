import { sql } from './config/db.js';

async function checkStudentDistribution() {
  try {
    console.log('🔍 Checking Student Distribution...\n');

    // Check operator info
    const operators = await sql.query(`
      SELECT u.user_id, u.username, u.email, u.department_id, u.section_id, u.access_level,
             d.name as department_name, s.name as section_name
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN sections s ON u.section_id = s.id
      JOIN roles r ON u.role_id = r.id
      WHERE r.role = 'operator'
    `);

    console.log('📊 Operators in Database:');
    operators.forEach(op => {
      console.log(`  • ${op.username} (${op.email})`);
      console.log(`    Department: ${op.department_name || 'NULL'} (ID: ${op.department_id})`);
      console.log(`    Section: ${op.section_name || 'NULL'} (ID: ${op.section_id})`);
      console.log(`    Access Level: ${op.access_level || 'NULL'}`);
      console.log('');
    });

    // Check departments
    const departments = await sql.query(`
      SELECT d.id, d.name, COUNT(s.student_id) as student_count
      FROM departments d
      LEFT JOIN students s ON s.department_id = d.id
      GROUP BY d.id, d.name
      ORDER BY d.name
    `);

    console.log('📚 Departments and Student Count:');
    departments.forEach(dept => {
      console.log(`  • ${dept.name}: ${dept.student_count} students (Dept ID: ${dept.id})`);
    });

    // Check all students
    console.log('\n👥 All Students in Database:');
    const students = await sql.query(`
      SELECT s.student_id, s.name, s.roll_number, s.department_id, d.name as department_name
      FROM students s
      LEFT JOIN departments d ON s.department_id = d.id
      ORDER BY s.roll_number
    `);
    
    console.log(`Total Students: ${students.length}\n`);
    students.forEach(student => {
      console.log(`  • ${student.roll_number} - ${student.name} (${student.department_name || 'No Dept'}) - Dept ID: ${student.department_id}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkStudentDistribution();
