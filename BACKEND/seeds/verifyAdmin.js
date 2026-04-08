import bcrypt from 'bcrypt';
import { sql } from '../config/db.js';

(async () => {
  try {
    console.log('Checking for admin user...');
    const users = await sql`SELECT * FROM users WHERE email = 'admin_1@vnrvjiet.in'`;
    
    console.log('User found:', users.length > 0);
    if (users.length > 0) {
      console.log('Email:', users[0].email);
      console.log('Username:', users[0].username);
      console.log('Has password:', !!users[0].password);
      
      const passwordMatch = await bcrypt.compare('admin123', users[0].password);
      console.log('Password "admin123" matches:', passwordMatch);
      
      // Also check the role
      const roleResult = await sql`SELECT * FROM roles WHERE id = ${users[0].role_id}`;
      if (roleResult.length > 0) {
        console.log('Role:', roleResult[0].role);
      }
    } else {
      console.log('No admin user found. Run addAdminUser.js first.');
    }
    process.exit(0);
  } catch(err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();
