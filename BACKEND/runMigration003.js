import { sql } from "./config/db.js";

async function runMigration003() {
  try {
    console.log("Starting Migration 003: SMS Notification System...\n");

    // Create notification_log table
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS notification_log (
          id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          student_roll_number VARCHAR(20) NOT NULL,
          due_id INTEGER NOT NULL,
          phone_number VARCHAR(15) NOT NULL,
          message TEXT NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'pending',
          provider VARCHAR(50) DEFAULT 'FAST2SMS',
          provider_response JSONB,
          batch_id VARCHAR(50),
          sent_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_notification_student
            FOREIGN KEY (student_roll_number)
            REFERENCES students (roll_number)
            ON DELETE CASCADE,
          CONSTRAINT fk_notification_due
            FOREIGN KEY (due_id)
            REFERENCES student_dues (id)
            ON DELETE CASCADE,
          CONSTRAINT chk_notification_status
            CHECK (status IN ('pending', 'sent', 'failed', 'delivered'))
        )
      `;
      console.log("✅ Created notification_log table");
    } catch (err) {
      if (err.message?.includes("already exists")) {
        console.log("⏭️  notification_log table already exists");
      } else {
        throw err;
      }
    }

    // Create indexes
    const indexes = [
      { name: "idx_notification_roll", def: "notification_log (student_roll_number)" },
      { name: "idx_notification_due", def: "notification_log (due_id)" },
      { name: "idx_notification_sent_at", def: "notification_log (sent_at DESC)" },
      { name: "idx_notification_status", def: "notification_log (status)" },
      { name: "idx_notification_batch", def: "notification_log (batch_id)" },
    ];

    for (const idx of indexes) {
      try {
        await sql.query(`CREATE INDEX IF NOT EXISTS ${idx.name} ON ${idx.def}`);
        console.log(`✅ Created index: ${idx.name}`);
      } catch (err) {
        if (err.message?.includes("already exists")) {
          console.log(`⏭️  Index ${idx.name} already exists`);
        } else {
          console.error(`❌ Index ${idx.name}: ${err.message}`);
        }
      }
    }

    // Add comments
    try {
      await sql.query(`COMMENT ON TABLE notification_log IS 'Tracks all SMS notifications sent to students about pending dues'`);
      await sql.query(`COMMENT ON COLUMN notification_log.batch_id IS 'Groups multiple notification entries from same SMS send operation'`);
      await sql.query(`COMMENT ON COLUMN notification_log.provider_response IS 'Raw JSON response from SMS provider (Fast2SMS)'`);
      console.log("✅ Added table/column comments");
    } catch (err) {
      console.log(`⚠️  Comments: ${err.message}`);
    }

    console.log("\n✅ Migration 003 completed successfully!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
    process.exit(1);
  }
}

runMigration003();
