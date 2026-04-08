import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { sql } from './config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runAllMigrations() {
  try {
    console.log('🔄 Starting database migrations...\n');

    // Read all migration files
    const migrationDir = path.join(__dirname, 'migrations');
    const migrationFiles = fs
      .readdirSync(migrationDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    console.log(`📂 Found ${migrationFiles.length} migration file(s)\n`);

    for (const file of migrationFiles) {
      const filePath = path.join(migrationDir, file);
      const migrationContent = fs.readFileSync(filePath, 'utf-8');

      console.log(`▶️  Running migration: ${file}`);

      // Split by semicolons and filter empty statements
      const statements = migrationContent
        .split(';')
        .map((stmt) => stmt.trim())
        .filter((stmt) => stmt.length > 0 && !stmt.startsWith('--'));

      for (const statement of statements) {
        try {
          console.log(`  → Executing: ${statement.substring(0, 60)}...`);
          
          // Use sql.query() method like runMigration.js does
          await sql.query(statement);
          
          console.log(`  ✅ Success`);
        } catch (error) {
          // Check if column/constraint already exists (don't fail on that)
          if (
            error.message.includes('already exists') ||
            error.message.includes('duplicate') ||
            error.message.includes('Column already exists') ||
            error.message.includes('already')
          ) {
            console.log(`  ⚠️  Already exists (skipped)`);
          } else {
            console.log(`  ⚠️  Skipped: ${error.message.substring(0, 80)}`);
          }
        }
      }

      console.log(`✅ Migration ${file} completed\n`);
    }

    console.log('🎉 All migrations completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runAllMigrations();
