import { sql } from './config/db.js';

async function runMigration005() {
  try {
    console.log('========================================');
    console.log('Running Migration 005: Add Faculty Due Table');
    console.log('========================================\n');

    // Create faculty_due table
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS faculty_due (
          id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          employee_code VARCHAR(20) NOT NULL,
          added_by_user_id UUID NOT NULL,
          added_by_department_id INTEGER,
          added_by_section_id INTEGER,
          due_type_id INTEGER NOT NULL,
          is_payable BOOLEAN NOT NULL,
          current_amount NUMERIC(10,2),
          amount_paid NUMERIC(10,2) DEFAULT 0,
          permission_granted BOOLEAN DEFAULT FALSE,
          supporting_document_link TEXT,
          cleared_by_user_id UUID,
          due_clear_by_date DATE NOT NULL,
          is_cleared BOOLEAN DEFAULT FALSE,
          overall_status BOOLEAN DEFAULT FALSE,
          due_description TEXT,
          remarks TEXT,
          proof_drive_link TEXT,
          is_compounded BOOLEAN,
          needs_original BOOLEAN,
          needs_pdf BOOLEAN,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT chk_faculty_amount_logic CHECK (
            (is_payable = TRUE AND current_amount IS NOT NULL)
            OR
            (is_payable = FALSE AND current_amount IS NULL)
          ),
          CONSTRAINT chk_faculty_amount_paid CHECK (
            amount_paid <= COALESCE(current_amount, 0)
          ),
          CONSTRAINT chk_faculty_due_source CHECK (
            (added_by_department_id IS NOT NULL AND added_by_section_id IS NULL)
            OR
            (added_by_department_id IS NULL AND added_by_section_id IS NOT NULL)
          ),
          CONSTRAINT chk_faculty_document_type CHECK (
            (needs_original IS NULL AND needs_pdf IS NULL)
            OR
            (needs_original = TRUE AND needs_pdf = FALSE)
            OR
            (needs_original = FALSE AND needs_pdf = TRUE)
          ),
          CONSTRAINT chk_faculty_compounded_payable CHECK (
            (is_payable = FALSE AND is_compounded IS NULL)
            OR
            (is_payable = TRUE AND is_compounded IS NOT NULL)
          ),
          CONSTRAINT chk_faculty_overall_status CHECK (
            overall_status = (COALESCE(is_cleared, FALSE) OR COALESCE(permission_granted, FALSE))
          ),
          CONSTRAINT fk_faculty_due_faculty
            FOREIGN KEY (employee_code)
            REFERENCES faculty (employee_code)
            ON DELETE CASCADE,
          CONSTRAINT fk_faculty_due_user
            FOREIGN KEY (added_by_user_id)
            REFERENCES users (user_id)
            ON DELETE RESTRICT,
          CONSTRAINT fk_faculty_due_due_type
            FOREIGN KEY (due_type_id)
            REFERENCES due_types (id)
            ON DELETE RESTRICT,
          CONSTRAINT fk_faculty_due_department
            FOREIGN KEY (added_by_department_id)
            REFERENCES departments (id)
            ON DELETE RESTRICT,
          CONSTRAINT fk_faculty_due_section
            FOREIGN KEY (added_by_section_id)
            REFERENCES sections (id)
            ON DELETE RESTRICT,
          CONSTRAINT fk_faculty_due_cleared_by
            FOREIGN KEY (cleared_by_user_id)
            REFERENCES users (user_id)
            ON DELETE SET NULL
        )
      `;
      console.log('✅ Created faculty_due table');
    } catch (err) {
      if (err.message?.includes('already exists')) {
        console.log('⏭️  faculty_due table already exists');
      } else {
        throw err;
      }
    }

    // Create indexes on faculty_due
    const facultyDueIndexes = [
      { name: 'idx_faculty_due_employee', def: 'faculty_due (employee_code)' },
      { name: 'idx_faculty_due_user', def: 'faculty_due (added_by_user_id)' },
      { name: 'idx_faculty_due_type', def: 'faculty_due (due_type_id)' },
      { name: 'idx_faculty_due_cleared', def: 'faculty_due (is_cleared)' },
      { name: 'idx_faculty_due_overall_status', def: 'faculty_due (overall_status)' },
      { name: 'idx_faculty_due_payable', def: 'faculty_due (is_payable)' },
      { name: 'idx_faculty_due_department', def: 'faculty_due (added_by_department_id)' },
      { name: 'idx_faculty_due_section', def: 'faculty_due (added_by_section_id)' },
      { name: 'idx_faculty_due_created', def: 'faculty_due (created_at)' },
      { name: 'idx_faculty_due_deadline', def: 'faculty_due (due_clear_by_date)' },
    ];

    for (const idx of facultyDueIndexes) {
      try {
        await sql.unsafe(`CREATE INDEX IF NOT EXISTS ${idx.name} ON ${idx.def}`);
        console.log(`✅ Created index: ${idx.name}`);
      } catch (err) {
        if (err.message?.includes('already exists')) {
          console.log(`⏭️  Index ${idx.name} already exists`);
        } else {
          console.error(`❌ Index ${idx.name}: ${err.message}`);
        }
      }
    }

    // Create partial index for documentation queries
    try {
      await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_faculty_due_documentation ON faculty_due (needs_original, needs_pdf) WHERE is_payable = FALSE`);
      console.log('✅ Created index: idx_faculty_due_documentation');
    } catch (err) {
      if (err.message?.includes('already exists')) {
        console.log('⏭️  Index idx_faculty_due_documentation already exists');
      } else {
        console.error(`❌ Index idx_faculty_due_documentation: ${err.message}`);
      }
    }

    // Create or replace trigger function
    try {
      await sql.unsafe(`
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
      `);
      console.log('✅ Created/Updated trigger function: update_updated_at_column');
    } catch (err) {
      console.error(`❌ Trigger function: ${err.message}`);
    }

    // Drop trigger if exists and create new one
    try {
      await sql.unsafe(`DROP TRIGGER IF EXISTS set_updated_at ON faculty_due`);
      await sql.unsafe(`
        CREATE TRIGGER set_updated_at
        BEFORE UPDATE ON faculty_due
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column()
      `);
      console.log('✅ Created trigger: set_updated_at on faculty_due');
    } catch (err) {
      console.error(`❌ Trigger: ${err.message}`);
    }

    // Create faculty_due_payments table
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS faculty_due_payments (
          id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          faculty_due_id INTEGER NOT NULL,
          paid_amount NUMERIC(10,2) NOT NULL CHECK (paid_amount > 0),
          payment_reference VARCHAR(100) NOT NULL UNIQUE,
          payment_method VARCHAR(30) NOT NULL,
          payment_status payment_status_enum NOT NULL,
          gateway_response JSONB,
          paid_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_faculty_due_payments_due
            FOREIGN KEY (faculty_due_id)
            REFERENCES faculty_due (id)
            ON DELETE CASCADE
        )
      `;
      console.log('✅ Created faculty_due_payments table');
    } catch (err) {
      if (err.message?.includes('already exists')) {
        console.log('⏭️  faculty_due_payments table already exists');
      } else {
        throw err;
      }
    }

    // Create indexes on faculty_due_payments
    const paymentsIndexes = [
      { name: 'idx_faculty_due_payments_due', def: 'faculty_due_payments (faculty_due_id)' },
      { name: 'idx_faculty_due_payments_status', def: 'faculty_due_payments (payment_status)' },
      { name: 'idx_faculty_due_payments_date', def: 'faculty_due_payments (paid_at)' },
    ];

    for (const idx of paymentsIndexes) {
      try {
        await sql.unsafe(`CREATE INDEX IF NOT EXISTS ${idx.name} ON ${idx.def}`);
        console.log(`✅ Created index: ${idx.name}`);
      } catch (err) {
        if (err.message?.includes('already exists')) {
          console.log(`⏭️  Index ${idx.name} already exists`);
        } else {
          console.error(`❌ Index ${idx.name}: ${err.message}`);
        }
      }
    }

    // Add comments
    try {
      await sql.unsafe(`COMMENT ON TABLE faculty_due IS 'Stores all dues assigned to faculty members'`);
      await sql.unsafe(`COMMENT ON COLUMN faculty_due.employee_code IS 'Faculty employee code from faculty table'`);
      await sql.unsafe(`COMMENT ON COLUMN faculty_due.is_payable IS 'TRUE if due requires payment, FALSE for non-payable documentation dues'`);
      await sql.unsafe(`COMMENT ON TABLE faculty_due_payments IS 'Payment transaction records for faculty dues'`);
      console.log('✅ Added table/column comments');
    } catch (err) {
      console.log(`⚠️  Comments: ${err.message}`);
    }
    console.log('\n📋 Verification:');

    // Verify faculty_due table was created
    const facultyDueTable = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'faculty_due'
      ORDER BY ordinal_position
    `;

    if (facultyDueTable.length > 0) {
      console.log(`✓ faculty_due table created with ${facultyDueTable.length} columns`);
      console.log('\n  Key Columns:');
      const keyColumns = ['id', 'employee_code', 'due_type_id', 'is_payable', 'current_amount', 'is_cleared', 'overall_status'];
      facultyDueTable
        .filter(col => keyColumns.includes(col.column_name))
        .forEach(col => {
          console.log(`    - ${col.column_name} (${col.data_type})`);
        });
    } else {
      console.log('❌ faculty_due table was not created');
    }

    // Verify faculty_due_payments table was created
    const facultyPaymentsTable = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'faculty_due_payments'
      ORDER BY ordinal_position
    `;

    if (facultyPaymentsTable.length > 0) {
      console.log(`\n✓ faculty_due_payments table created with ${facultyPaymentsTable.length} columns`);
    }

    // Check indexes
    const indexes = await sql`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'faculty_due'
    `;

    if (indexes.length > 0) {
      console.log(`\n✓ ${indexes.length} indexes created on faculty_due table`);
      console.log('  Indexes:');
      indexes.forEach(idx => {
        console.log(`    - ${idx.indexname}`);
      });
    }

    // Check constraints
    const constraints = await sql`
      SELECT conname, contype
      FROM pg_constraint
      WHERE conrelid = 'faculty_due'::regclass
    `;

    if (constraints.length > 0) {
      console.log(`\n✓ ${constraints.length} constraints created`);
      const checkConstraints = constraints.filter(c => c.contype === 'c').length;
      const foreignKeys = constraints.filter(c => c.contype === 'f').length;
      console.log(`    - ${checkConstraints} check constraints`);
      console.log(`    - ${foreignKeys} foreign key constraints`);
    }

    // Check trigger
    const triggers = await sql`
      SELECT tgname
      FROM pg_trigger
      WHERE tgrelid = 'faculty_due'::regclass AND tgisinternal = false
    `;

    if (triggers.length > 0) {
      console.log(`\n✓ Triggers created:`);
      triggers.forEach(trg => {
        console.log(`    - ${trg.tgname}`);
      });
    }

    // Check if any faculty exist
    const facultyCount = await sql`
      SELECT COUNT(*) as count FROM faculty
    `;

    console.log(`\n📊 Current Statistics:`);
    console.log(`  - Total Faculty: ${facultyCount[0].count}`);

    // Check faculty_due count
    const facultyDueCount = await sql`
      SELECT COUNT(*) as count FROM faculty_due
    `;
    console.log(`  - Total Faculty Dues: ${facultyDueCount[0].count}`);

    // Show table comments
    const comments = await sql`
      SELECT 
        obj_description('faculty_due'::regclass) as table_comment
    `;

    if (comments[0].table_comment) {
      console.log(`\n📝 Table Description: ${comments[0].table_comment}`);
    }

    console.log('\n========================================');
    console.log('✅ Migration 005 Complete!');
    console.log('========================================');
    console.log('\n💡 Next Steps:');
    console.log('  1. Update adminController.js to query faculty_due table');
    console.log('  2. Update operatorController.js to use faculty_due for faculty');
    console.log('  3. Test adding faculty dues through HR operator');
    console.log('  4. Verify admin dashboard shows faculty statistics\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('Error details:', error);
    console.error('\n📋 Rollback Instructions:');
    console.error('  To rollback this migration, run:');
    console.error('  DROP TABLE IF EXISTS faculty_due_payments CASCADE;');
    console.error('  DROP TABLE IF EXISTS faculty_due CASCADE;\n');
    process.exit(1);
  }
}

runMigration005();
