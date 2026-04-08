import bcrypt from "bcrypt";
import { sql } from "../config/db.js";

/**
 * Reset all student passwords to default password: pass123
 * 
 * WARNING: This will change passwords for ALL students in the database!
 * Only use this in development/testing environments.
 * 
 * Usage: node BACKEND/scripts/resetAllStudentPasswords.js
 */

const DEFAULT_PASSWORD = "pass123";

const resetAllStudentPasswords = async () => {
  try {
    console.log("🔐 Starting student password reset...\n");
    console.log("⚠️  WARNING: This will reset ALL student passwords to 'pass123'");
    console.log("───────────────────────────────────────────────────────\n");

    // Hash the default password
    console.log("1️⃣  Hashing default password...");
    const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);
    console.log(`   ✓ Password hashed successfully`);
    console.log(`   Hash: ${hashedPassword.substring(0, 20)}...\n`);

    // Get count of students before update
    const beforeCount = await sql`
      SELECT COUNT(*) as count FROM students
    `;
    const totalStudents = parseInt(beforeCount[0].count);
    console.log(`2️⃣  Found ${totalStudents} students in database\n`);

    if (totalStudents === 0) {
      console.log("❌ No students found in database. Nothing to update.");
      process.exit(0);
    }

    // Get some sample student data before update
    console.log("3️⃣  Sample students (before update):");
    const sampleBefore = await sql`
      SELECT student_id, name, roll_number, email, branch, section
      FROM students
      ORDER BY created_at DESC
      LIMIT 5
    `;
    sampleBefore.forEach((student, idx) => {
      console.log(`   ${idx + 1}. ${student.roll_number} - ${student.name} (${student.branch}-${student.section})`);
    });
    console.log();

    // Update all student passwords
    console.log("4️⃣  Updating all student passwords...");
    const updateResult = await sql`
      UPDATE students
      SET password = ${hashedPassword}
      RETURNING student_id, roll_number, name
    `;

    console.log(`   ✓ Successfully updated ${updateResult.length} student passwords\n`);

    // Verify the update
    console.log("5️⃣  Verifying password update...");
    const testStudent = updateResult[0];
    const verifyResult = await sql`
      SELECT password FROM students
      WHERE student_id = ${testStudent.student_id}
      LIMIT 1
    `;

    const isValid = await bcrypt.compare(DEFAULT_PASSWORD, verifyResult[0].password);
    
    if (isValid) {
      console.log(`   ✓ Verification successful!`);
      console.log(`   Test student: ${testStudent.roll_number} - ${testStudent.name}`);
      console.log(`   Password can be authenticated with: ${DEFAULT_PASSWORD}\n`);
    } else {
      console.log(`   ❌ Verification failed! Password might not have been updated correctly.\n`);
    }

    // Display summary
    console.log("═══════════════════════════════════════════════════════");
    console.log("✅ PASSWORD RESET COMPLETE");
    console.log("═══════════════════════════════════════════════════════");
    console.log(`📊 Total students updated: ${updateResult.length}`);
    console.log(`🔑 New password for all students: ${DEFAULT_PASSWORD}`);
    console.log();
    console.log("📋 Updated students:");
    updateResult.slice(0, 10).forEach((student, idx) => {
      console.log(`   ${idx + 1}. ${student.roll_number} - ${student.name}`);
    });
    if (updateResult.length > 10) {
      console.log(`   ... and ${updateResult.length - 10} more students`);
    }
    console.log();
    console.log("💡 Students can now login with:");
    console.log(`   Username: [their roll number]`);
    console.log(`   Password: ${DEFAULT_PASSWORD}`);
    console.log("═══════════════════════════════════════════════════════\n");

    process.exit(0);

  } catch (error) {
    console.error("❌ Error resetting student passwords:", error);
    console.error("\nError details:", {
      message: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
};

// Run the script
resetAllStudentPasswords();
