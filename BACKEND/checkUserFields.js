import { sql } from './config/db.js';

async function checkUserFields() {
  try {
    const users = await sql.query('SELECT * FROM users LIMIT 1');
    if (users.length > 0) {
      console.log('User table fields:');
      console.log(Object.keys(users[0]).join(', '));
      console.log('\nSample user data:');
      console.log(JSON.stringify(users[0], null, 2));
    }
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkUserFields();
