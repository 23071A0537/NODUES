import bcrypt from "bcrypt";
import { sql } from "../config/db.js";

/**
 * Reset all faculty passwords to: pass123
 *
 * Usage (from BACKEND/ folder):
 *   node scripts/resetAllFacultyPasswords.js
 *
 * Usage (from project root):
 *   node BACKEND/scripts/resetAllFacultyPasswords.js
 *
 * Optional custom password:
 *   node scripts/resetAllFacultyPasswords.js myNewPassword
 */

const DEFAULT_PASSWORD = process.argv[2] || "pass123";

const resetAllFacultyPasswords = async () => {
  try {
    console.log("Starting faculty password reset...\n");
    console.log(`WARNING: This will reset ALL faculty passwords to '${DEFAULT_PASSWORD}'`);
    console.log("---------------------------------------------------------------\n");

    console.log("1) Hashing password...");
    const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);
    console.log("   OK: Password hashed\n");

    console.log("2) Counting faculty records...");
    const beforeCount = await sql`
      SELECT COUNT(*)::int AS count FROM faculty
    `;
    const totalFaculty = beforeCount[0]?.count || 0;
    console.log(`   Found ${totalFaculty} faculty record(s)\n`);

    if (totalFaculty === 0) {
      console.log("No faculty records found. Nothing to update.");
      process.exit(0);
    }

    console.log("3) Updating all faculty passwords...");
    const updated = await sql`
      UPDATE faculty
      SET password = ${hashedPassword}
      RETURNING faculty_id, employee_code, name
    `;
    console.log(`   OK: Updated ${updated.length} faculty password(s)\n`);

    console.log("4) Verifying with one sample user...");
    const sample = updated[0];
    const verify = await sql`
      SELECT password
      FROM faculty
      WHERE faculty_id = ${sample.faculty_id}
      LIMIT 1
    `;

    const isValid = await bcrypt.compare(DEFAULT_PASSWORD, verify[0].password);
    if (!isValid) {
      console.log("   ERROR: Verification failed");
      process.exit(1);
    }

    console.log("   OK: Verification successful\n");
    console.log("===============================================================");
    console.log("PASSWORD RESET COMPLETE");
    console.log("===============================================================");
    console.log(`Total faculty updated: ${updated.length}`);
    console.log(`New password: ${DEFAULT_PASSWORD}`);
    console.log("\nSample updated faculty:");

    updated.slice(0, 10).forEach((fac, idx) => {
      console.log(`  ${idx + 1}. ${fac.employee_code} - ${fac.name}`);
    });

    if (updated.length > 10) {
      console.log(`  ... and ${updated.length - 10} more`);
    }

    console.log("\nFaculty login after reset:");
    console.log("  Employee ID: [their employee_code]");
    console.log(`  Password: ${DEFAULT_PASSWORD}`);
    console.log("===============================================================\n");

    process.exit(0);
  } catch (error) {
    console.error("Error resetting faculty passwords:", error.message);
    process.exit(1);
  }
};

resetAllFacultyPasswords();
