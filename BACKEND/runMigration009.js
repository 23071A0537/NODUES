import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { sql } from './config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const splitSqlStatements = (sqlText) => {
  const statements = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inDollarQuote = false;
  let dollarTag = '';

  for (let i = 0; i < sqlText.length; i++) {
    const char = sqlText[i];
    const next = sqlText[i + 1];

    if (inDollarQuote) {
      if (sqlText.startsWith(dollarTag, i)) {
        current += dollarTag;
        i += dollarTag.length - 1;
        inDollarQuote = false;
        dollarTag = '';
        continue;
      }

      current += char;
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote && char === '$') {
      const rest = sqlText.slice(i);
      const match = rest.match(/^(?:\$[A-Za-z_][A-Za-z0-9_]*\$|\$\$)/);

      if (match) {
        dollarTag = match[0];
        inDollarQuote = true;
        current += dollarTag;
        i += dollarTag.length - 1;
        continue;
      }
    }

    if (!inDoubleQuote && char === "'") {
      if (inSingleQuote && next === "'") {
        current += "''";
        i += 1;
        continue;
      }

      inSingleQuote = !inSingleQuote;
      current += char;
      continue;
    }

    if (!inSingleQuote && char === '"') {
      inDoubleQuote = !inDoubleQuote;
      current += char;
      continue;
    }

    if (char === ';' && !inSingleQuote && !inDoubleQuote) {
      const trimmed = current.trim();
      if (trimmed.length > 0) {
        statements.push(trimmed);
      }
      current = '';
      continue;
    }

    current += char;
  }

  const trailing = current.trim();
  if (trailing.length > 0) {
    statements.push(trailing);
  }

  return statements;
};

async function runMigration009() {
  try {
    console.log('========================================');
    console.log('Running Migration 009: Department Dues Table');
    console.log('========================================\n');

    const migrationPath = path.join(__dirname, 'migrations', '009_add_department_dues_table.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf-8');

    // Remove full-line SQL comments before splitting into statements.
    const sanitizedSql = migrationSql
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n');

    const statements = splitSqlStatements(sanitizedSql);

    for (const statement of statements) {
      try {
        await sql.query(statement);
        console.log(`✓ ${statement.slice(0, 80)}...`);
      } catch (err) {
        if (err.message.includes('already exists') || err.message.includes('duplicate')) {
          console.log(`- Skipping existing object: ${statement.slice(0, 80)}...`);
        } else {
          throw err;
        }
      }
    }

    console.log('\n✓ Migration 009 completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('\n✗ Migration 009 failed:', err.message);
    process.exit(1);
  }
}

runMigration009();
