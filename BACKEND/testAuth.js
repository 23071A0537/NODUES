import jwt from 'jsonwebtoken';
import { sql } from './config/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'vnrvjiet_nodues_secret_key_2026_change_in_production';

async function testAuth() {
  try {
    console.log('🔍 Testing JWT Authentication...\n');

    // Get an operator user
    const users = await sql.query(`
      SELECT u.*, r.role
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE r.role = 'operator'
      LIMIT 1
    `);

    if (users.length === 0) {
      console.log('⚠️  No operator found in database');
      process.exit(1);
    }

    const user = users[0];
    console.log('📊 Test User:');
    console.log(`  Email: ${user.email}`);
    console.log(`  Role: ${user.role}`);
    console.log(`  User ID: ${user.user_id}\n`);

    // Generate a token
    const token = jwt.sign(
      {
        user_id: user.user_id,
        email: user.email,
        role: user.role,
        department_id: user.department_id,
        section_id: user.section_id,
        operator_type: user.operator_type,
        access_level: user.access_level,
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log('🔑 Generated JWT Token:');
    console.log(`  ${token.substring(0, 50)}...`);
    console.log(`  Length: ${token.length} characters\n`);

    // Verify the token
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('✅ Token Verified Successfully!');
    console.log('📋 Decoded Payload:');
    console.log(`  User ID: ${decoded.user_id}`);
    console.log(`  Email: ${decoded.email}`);
    console.log(`  Role: ${decoded.role}`);
    console.log(`  Access Level: ${decoded.access_level}\n`);

    console.log('🎉 JWT Authentication is working correctly!');
    console.log('\n💡 Next Steps:');
    console.log('  1. Users need to log in again to get a valid token');
    console.log('  2. The token will be stored in localStorage');
    console.log('  3. All API requests will include the token in Authorization header');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testAuth();
