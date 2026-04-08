import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import { sql } from './config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigration004() {
  try {
    console.log('========================================');
    console.log('Running Migration 004: Add User Active Status');
    console.log('========================================\n');

    // Read migration file
    const migrationPath = path.join(__dirname, 'migrations', '004_add_user_active_status.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration file loaded');
    console.log('📊 Executing migration...\n');

    // Execute migration
    await sql.unsafe(migrationSQL);

    console.log('✅ Migration completed successfully!');
    console.log('\n📋 Verification:');

    // Verify the column was added
    const columnCheck = await sql`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'active'
    `;

    if (columnCheck.length > 0) {
      console.log('✓ active column added to users table');
      console.log(`  Type: ${columnCheck[0].data_type}`);
      console.log(`  Default: ${columnCheck[0].column_default}`);
      console.log(`  Nullable: ${columnCheck[0].is_nullable}`);
    }

    // Check index
    const indexCheck = await sql`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'users' AND indexname = 'idx_users_active'
    `;

    if (indexCheck.length > 0) {
      console.log('✓ idx_users_active index created');
    }

    // Count active vs inactive users
    const stats = await sql`
      SELECT 
        active,
        COUNT(*) as count
      FROM users
      GROUP BY active
    `;

    console.log('\n📊 User Status Statistics:');
    stats.forEach(stat => {
      console.log(`  ${stat.active ? 'Active' : 'Inactive'}: ${stat.count} users`);
    });

    console.log('\n========================================');
    console.log('✅ Migration 004 Complete!');
    console.log('========================================');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('Error details:', error);
    process.exit(1);
  }
}

runMigration004();
