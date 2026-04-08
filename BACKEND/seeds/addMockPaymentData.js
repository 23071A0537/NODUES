import bcrypt from "bcrypt";
import { sql } from "../config/db.js";

/**
 * Add mock payment data to the database for testing
 * 
 * This script:
 * 1. Ensures required roles, departments, sections, due_types exist
 * 2. Creates a test student (if not exists)
 * 3. Creates a test operator (if not exists)
 * 4. Adds sample payable dues for the student
 * 5. Adds a sample successful payment transaction
 * 
 * Usage: node -e "import('./seeds/addMockPaymentData.js').then(m => m.seedMockPaymentData())"
 *   or:  node BACKEND/seeds/addMockPaymentData.js
 */

const MOCK_STUDENT = {
  name: "Test Student",
  roll_number: "21071A0501",
  branch: "CSE",
  section: "A",
  email: "teststudent@vnrvjiet.in",
  mobile: "9876543210",
  father_name: "Test Father",
  father_mobile: "9876543211",
  password: "student123",
};

const MOCK_OPERATOR = {
  username: "cse_operator_mock",
  email: "cse_operator_mock@vnrvjiet.in",
  password: "operator123",
  operator_type: "department",
  access_level: "all_students",
};

const MOCK_DUE_TYPES = [
  { type_name: "Tuition Fee", description: "Semester tuition fee", is_for_student: true, requires_permission: false },
  { type_name: "Library Fine", description: "Fine for overdue library books", is_for_student: true, requires_permission: false },
  { type_name: "Lab Fee", description: "Laboratory usage fee", is_for_student: true, requires_permission: false },
  { type_name: "Hostel Fee", description: "Hostel accommodation charges", is_for_student: true, requires_permission: false },
  { type_name: "Exam Fee", description: "Semester examination fee", is_for_student: true, requires_permission: true },
];

export const seedMockPaymentData = async () => {
  try {
    console.log("🚀 Starting mock payment data seeding...\n");

    // ── 1. Ensure roles exist ──
    console.log("1️⃣  Checking roles...");
    const roles = await sql`SELECT id, role FROM roles`;
    console.log(`   Found ${roles.length} roles: ${roles.map(r => r.role).join(", ")}`);

    const studentRole = roles.find(r => r.role === "student");
    const operatorRole = roles.find(r => r.role === "operator");

    if (!studentRole || !operatorRole) {
      console.error("❌ Required roles (student, operator) not found. Run seeds first.");
      return { success: false, message: "Missing roles" };
    }

    // ── 2. Ensure department exists ──
    console.log("2️⃣  Checking departments...");
    let deptResult = await sql`SELECT id, name FROM departments WHERE name = 'CSE' LIMIT 1`;
    
    if (deptResult.length === 0) {
      console.log("   Creating CSE department...");
      deptResult = await sql`INSERT INTO departments (name) VALUES ('CSE') RETURNING id, name`;
    }
    const department = deptResult[0];
    console.log(`   ✓ Department: ${department.name} (ID: ${department.id})`);

    // ── 3. Ensure academic year exists ──
    console.log("3️⃣  Checking academic year...");
    let ayResult = await sql`SELECT id FROM academic_year LIMIT 1`;
    
    if (ayResult.length === 0) {
      console.log("   Creating academic year 2025-2026...");
      ayResult = await sql`INSERT INTO academic_year (beginning_year, ending_year) VALUES (2025, 2026) RETURNING id`;
    }
    const academicYearId = ayResult[0].id;
    console.log(`   ✓ Academic Year ID: ${academicYearId}`);

    // ── 4. Create or get test student ──
    console.log("4️⃣  Setting up test student...");
    let studentResult = await sql`
      SELECT student_id, roll_number, name, email 
      FROM students WHERE roll_number = ${MOCK_STUDENT.roll_number} LIMIT 1
    `;

    if (studentResult.length === 0) {
      const hashedPassword = await bcrypt.hash(MOCK_STUDENT.password, 10);
      studentResult = await sql`
        INSERT INTO students (
          name, roll_number, branch, section, email, mobile,
          father_name, father_mobile, academic_year_id, role_id,
          password, department_id
        ) VALUES (
          ${MOCK_STUDENT.name}, ${MOCK_STUDENT.roll_number}, ${MOCK_STUDENT.branch},
          ${MOCK_STUDENT.section}, ${MOCK_STUDENT.email}, ${MOCK_STUDENT.mobile},
          ${MOCK_STUDENT.father_name}, ${MOCK_STUDENT.father_mobile}, ${academicYearId},
          ${studentRole.id}, ${hashedPassword}, ${department.id}
        ) RETURNING student_id, roll_number, name, email
      `;
      console.log(`   ✓ Created student: ${studentResult[0].name} (${studentResult[0].roll_number})`);
    } else {
      console.log(`   ✓ Student exists: ${studentResult[0].name} (${studentResult[0].roll_number})`);
    }
    const student = studentResult[0];

    // ── 5. Create or get test operator ──
    console.log("5️⃣  Setting up test operator...");
    let operatorResult = await sql`
      SELECT user_id, username, email 
      FROM users WHERE email = ${MOCK_OPERATOR.email} LIMIT 1
    `;

    if (operatorResult.length === 0) {
      const hashedPassword = await bcrypt.hash(MOCK_OPERATOR.password, 10);
      operatorResult = await sql`
        INSERT INTO users (
          username, email, role_id, department_id, password,
          operator_type, access_level
        ) VALUES (
          ${MOCK_OPERATOR.username}, ${MOCK_OPERATOR.email}, ${operatorRole.id},
          ${department.id}, ${hashedPassword},
          ${MOCK_OPERATOR.operator_type}, ${MOCK_OPERATOR.access_level}
        ) RETURNING user_id, username, email
      `;
      console.log(`   ✓ Created operator: ${operatorResult[0].username}`);
    } else {
      console.log(`   ✓ Operator exists: ${operatorResult[0].username}`);
    }
    const operator = operatorResult[0];

    // ── 6. Create due types ──
    console.log("6️⃣  Setting up due types...");
    const dueTypeIds = [];
    for (const dt of MOCK_DUE_TYPES) {
      let dtResult = await sql`
        SELECT id FROM due_types WHERE type_name = ${dt.type_name} LIMIT 1
      `;
      if (dtResult.length === 0) {
        dtResult = await sql`
          INSERT INTO due_types (type_name, description, is_for_student, requires_permission)
          VALUES (${dt.type_name}, ${dt.description}, ${dt.is_for_student}, ${dt.requires_permission})
          RETURNING id
        `;
        console.log(`   ✓ Created due type: ${dt.type_name}`);
      } else {
        console.log(`   ✓ Due type exists: ${dt.type_name}`);
      }
      dueTypeIds.push({ id: dtResult[0].id, ...dt });
    }

    // ── 7. Add sample payable dues for the student ──
    console.log("7️⃣  Adding sample dues...");
    
    // Check for existing active dues
    const existingDues = await sql`
      SELECT id FROM student_dues 
      WHERE student_roll_number = ${student.roll_number} AND is_cleared = FALSE
    `;

    if (existingDues.length > 0) {
      console.log(`   ⚠️  Student already has ${existingDues.length} active dues. Skipping due creation.`);
    } else {
      const sampleDues = [
        {
          due_type_id: dueTypeIds[0].id, // Tuition Fee
          is_payable: true,
          current_amount: 50000.00,
          amount_paid: 0,
          due_clear_by_date: "2026-03-31",
          due_description: "Tuition fee for Spring 2026 semester",
          is_compounded: false,
        },
        {
          due_type_id: dueTypeIds[1].id, // Library Fine
          is_payable: true,
          current_amount: 500.00,
          amount_paid: 0,
          due_clear_by_date: "2026-02-28",
          due_description: "Overdue fine for 'Data Structures & Algorithms' book",
          is_compounded: false,
        },
        {
          due_type_id: dueTypeIds[2].id, // Lab Fee
          is_payable: true,
          current_amount: 3000.00,
          amount_paid: 0,
          due_clear_by_date: "2026-03-15",
          due_description: "Computer Lab usage fee for Semester 8",
          is_compounded: false,
        },
        {
          due_type_id: dueTypeIds[3].id, // Hostel Fee
          is_payable: true,
          current_amount: 25000.00,
          amount_paid: 10000.00,
          due_clear_by_date: "2026-04-30",
          due_description: "Remaining hostel charges for current year",
          is_compounded: true,
        },
        {
          due_type_id: dueTypeIds[4].id, // Exam Fee (requires permission)
          is_payable: true,
          current_amount: 2000.00,
          amount_paid: 0,
          due_clear_by_date: "2026-03-01",
          due_description: "End semester examination fee",
          is_compounded: false,
        },
      ];

      for (const due of sampleDues) {
        // overall_status must equal (is_cleared OR permission_granted)
        // For new dues: is_cleared=false, permission_granted=false → overall_status=false
        await sql`
          INSERT INTO student_dues (
            student_roll_number, added_by_user_id, added_by_department_id,
            due_type_id, is_payable, current_amount, amount_paid,
            permission_granted, due_clear_by_date, is_cleared, overall_status,
            due_description, is_compounded
          ) VALUES (
            ${student.roll_number}, ${operator.user_id}, ${department.id},
            ${due.due_type_id}, ${due.is_payable}, ${due.current_amount}, ${due.amount_paid},
            ${false}, ${due.due_clear_by_date}, ${false}, ${false},
            ${due.due_description}, ${due.is_compounded}
          )
        `;
      }
      console.log(`   ✓ Created ${sampleDues.length} sample dues`);
    }

    // ── 8. Add a sample completed payment transaction ──
    console.log("8️⃣  Adding a sample completed payment...");

    // Get one payable due to create a mock completed payment
    const payableDue = await sql`
      SELECT id, current_amount, amount_paid
      FROM student_dues 
      WHERE student_roll_number = ${student.roll_number} 
        AND is_payable = TRUE 
        AND is_cleared = FALSE
      ORDER BY current_amount ASC
      LIMIT 1
    `;

    if (payableDue.length > 0) {
      const due = payableDue[0];
      const existingPayment = await sql`
        SELECT id FROM due_payments WHERE due_id = ${due.id} LIMIT 1
      `;

      if (existingPayment.length === 0) {
        const paymentRef = `PAY-MOCK-${Date.now()}-DEMO`;
        const payAmount = parseFloat(due.current_amount) - parseFloat(due.amount_paid);

        // Insert a successful payment record
        await sql`
          INSERT INTO due_payments (
            due_id, paid_amount, payment_reference,
            payment_method, payment_status, gateway_response
          ) VALUES (
            ${due.id}, ${payAmount}, ${paymentRef},
            ${"ONLINE"}, ${"SUCCESS"}, ${JSON.stringify({
              mock: true,
              status: "SUCCESS",
              gateway_transaction_id: `GW-MOCK-${Date.now()}`,
              timestamp: new Date().toISOString(),
              message: "Mock payment completed during seeding",
            })}
          )
        `;

        // Mark the due as cleared
        await sql`
          UPDATE student_dues 
          SET amount_paid = current_amount,
              is_cleared = TRUE,
              overall_status = TRUE,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ${due.id}
        `;

        console.log(`   ✓ Created mock payment: ${paymentRef} (₹${payAmount})`);
        console.log(`   ✓ Marked due #${due.id} as cleared`);
      } else {
        console.log(`   ⚠️  Payment already exists for due #${due.id}`);
      }
    }

    // ── Summary ──
    console.log("\n" + "═".repeat(50));
    console.log("✅ Mock payment data seeding complete!\n");
    console.log("📋 Test Credentials:");
    console.log(`   Student Login:`);
    console.log(`     Email:    ${MOCK_STUDENT.email}`);
    console.log(`     Password: ${MOCK_STUDENT.password}`);
    console.log(`     Roll No:  ${MOCK_STUDENT.roll_number}`);
    console.log(`\n   Operator Login:`);
    console.log(`     Email:    ${MOCK_OPERATOR.email}`);
    console.log(`     Password: ${MOCK_OPERATOR.password}`);
    console.log("═".repeat(50));

    return { success: true, message: "Mock data seeded successfully" };
  } catch (error) {
    console.error("❌ Error seeding mock data:", error);
    return { success: false, message: error.message };
  }
};

// Run directly
seedMockPaymentData().then(() => process.exit(0)).catch(() => process.exit(1));
