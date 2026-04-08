import bcrypt from "bcrypt";
import { sql } from "../config/db.js";

/**
 * Verify student password after reset
 * Tests if a specific student can authenticate with 'pass123'
 * 
 * Usage: node BACKEND/scripts/verifyStudentPassword.js [roll_number]
 * Example: node BACKEND/scripts/verifyStudentPassword.js 21071A0501
 */

const TEST_PASSWORD = "pass123";

const verifyStudentPassword = async (rollNumber) => {
  try {
    console.log("🔍 Verifying student password...\n");

    // Get roll number from command line or use default
    const targetRollNumber = rollNumber || process.argv[2];

    if (!targetRollNumber) {
      // If no roll number provided, get first student
      console.log("No roll number provided. Testing with first student...\n");
      const firstStudent = await sql`
        SELECT student_id, roll_number, name, email, branch, section, password
        FROM students
        ORDER BY created_at ASC
        LIMIT 1
      `;

      if (firstStudent.length === 0) {
        console.log("❌ No students found in database.");
        process.exit(1);
      }

      const student = firstStudent[0];
      await testStudentLogin(student);
    } else {
      // Test specific student
      console.log(`Searching for student: ${targetRollNumber}\n`);
      const studentResult = await sql`
        SELECT student_id, roll_number, name, email, branch, section, password
        FROM students
        WHERE roll_number = ${targetRollNumber}
        LIMIT 1
      `;

      if (studentResult.length === 0) {
        console.log(`❌ Student with roll number '${targetRollNumber}' not found.`);
        process.exit(1);
      }

      const student = studentResult[0];
      await testStudentLogin(student);
    }

    process.exit(0);

  } catch (error) {
    console.error("❌ Error verifying student password:", error);
    console.error("\nError details:", error.message);
    process.exit(1);
  }
};

async function testStudentLogin(student) {
  console.log("📋 Student Information:");
  console.log(`   Name: ${student.name}`);
  console.log(`   Roll Number: ${student.roll_number}`);
  console.log(`   Email: ${student.email}`);
  console.log(`   Branch: ${student.branch}`);
  console.log(`   Section: ${student.section}`);
  console.log(`   Password Hash: ${student.password.substring(0, 30)}...\n`);

  console.log(`🔐 Testing password: '${TEST_PASSWORD}'...`);

  // Verify password
  const isValid = await bcrypt.compare(TEST_PASSWORD, student.password);

  console.log("\n═══════════════════════════════════════════════════════");
  if (isValid) {
    console.log("✅ PASSWORD VERIFICATION SUCCESSFUL!");
    console.log("═══════════════════════════════════════════════════════");
    console.log(`\n✓ Student can login with:`);
    console.log(`  Username: ${student.roll_number}`);
    console.log(`  Password: ${TEST_PASSWORD}`);
    console.log();
  } else {
    console.log("❌ PASSWORD VERIFICATION FAILED!");
    console.log("═══════════════════════════════════════════════════════");
    console.log(`\n✗ Password '${TEST_PASSWORD}' does NOT match for this student.`);
    console.log(`  This student may not have been updated yet.`);
    console.log(`  Run: node BACKEND/scripts/resetAllStudentPasswords.js`);
    console.log();
  }
}

// Run the verification
verifyStudentPassword();
