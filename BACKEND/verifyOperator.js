import bcrypt from 'bcrypt';
import { sql } from './config/db.js';

async function verifyOperator() {
  try {
    console.log('Checking CSE operator user...\n');
    
    const users = await sql`
      SELECT u.user_id, u.username, u.email, u.password, r.role, d.name as department
      FROM users u
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.username = 'cse_opr' OR u.email = 'cseopr@vnrvjiet'
    `;
    
    if (users.length === 0) {
      console.log('❌ No operator user found!');
      process.exit(1);
    }
    
    const user = users[0];
    console.log('✓ User found in database:');
    console.log(`  - User ID: ${user.user_id}`);
    console.log(`  - Username: ${user.username}`);
    console.log(`  - Email: ${user.email}`);
    console.log(`  - Role: ${user.role}`);
    console.log(`  - Department: ${user.department}`);
    console.log(`  - Password hash: ${user.password.substring(0, 20)}...`);
    
    // Test password
    console.log('\nTesting password "cse123"...');
    const isValid = await bcrypt.compare('cse123', user.password);
    console.log(isValid ? '✓ Password is correct' : '❌ Password is INCORRECT');
    
    // Test hashing
    console.log('\nGenerating new hash for "cse123"...');
    const newHash = await bcrypt.hash('cse123', 10);
    console.log(`New hash: ${newHash.substring(0, 20)}...`);
    const newTest = await bcrypt.compare('cse123', newHash);
    console.log(newTest ? '✓ New hash works' : '❌ New hash failed');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

verifyOperator();
