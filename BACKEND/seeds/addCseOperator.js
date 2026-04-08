import bcrypt from "bcrypt";
import { sql } from "../config/db.js";

/**
 * Add CSE operator user to the database
 * username: cse_opr
 * email: cseopr@vnrvjiet
 * password: cse123 (hashed with bcrypt)
 * role: operator
 * department: CSE (Computer Science Engineering)
 */
export const addCseOperator = async () => {
  try {
    console.log("Starting CSE operator user creation...");

    // Get operator role_id from roles table
    const roleResult = await sql`
      SELECT id FROM roles WHERE role = 'operator' LIMIT 1
    `;

    if (!roleResult || roleResult.length === 0) {
      console.error("Operator role not found in roles table");
      return { success: false, message: "Operator role not found" };
    }

    const operatorRoleId = roleResult[0].id;
    console.log(`Found operator role with ID: ${operatorRoleId}`);

    // Get or create CSE department
    let deptResult = await sql`
      SELECT id FROM departments WHERE LOWER(name) = LOWER('CSE') OR LOWER(name) = LOWER('Computer Science Engineering') LIMIT 1
    `;

    let cseDeptId;
    if (!deptResult || deptResult.length === 0) {
      console.log("CSE department not found, creating it...");
      const createDept = await sql`
        INSERT INTO departments (name)
        VALUES ('CSE')
        RETURNING id, name
      `;
      cseDeptId = createDept[0].id;
      console.log(`✓ CSE department created with ID: ${cseDeptId}`);
    } else {
      cseDeptId = deptResult[0].id;
      console.log(`Found CSE department with ID: ${cseDeptId}`);
    }

    // Check if user already exists
    const existingUser = await sql`
      SELECT user_id, username, email FROM users WHERE username = 'cse_opr' OR email = 'cseopr@vnrvjiet'
    `;

    if (existingUser && existingUser.length > 0) {
      console.log("⚠ User already exists:");
      console.log(`- User ID: ${existingUser[0].user_id}`);
      console.log(`- Username: ${existingUser[0].username}`);
      console.log(`- Email: ${existingUser[0].email}`);
      return {
        success: false,
        message: "User already exists",
        data: existingUser[0],
      };
    }

    // Hash the password using bcrypt
    const plainPassword = "cse123";
    const hashedPassword = await bcrypt.hash(plainPassword, 10);
    console.log(`Password hashed successfully`);

    // Insert the operator user
    const insertResult = await sql`
      INSERT INTO users (username, email, role_id, department_id, password)
      VALUES ('cse_opr', 'cseopr@vnrvjiet', ${operatorRoleId}, ${cseDeptId}, ${hashedPassword})
      RETURNING user_id, username, email, role_id, department_id, created_at
    `;

    if (insertResult && insertResult.length > 0) {
      const newUser = insertResult[0];
      console.log("✓ CSE Operator user created successfully!");
      console.log(`
User Details:
- User ID: ${newUser.user_id}
- Username: ${newUser.username}
- Email: ${newUser.email}
- Role ID: ${newUser.role_id}
- Department ID: ${newUser.department_id}
- Created At: ${newUser.created_at}

Login Credentials:
- Username: cse_opr
- Password: cse123
      `);
      return {
        success: true,
        message: "CSE Operator user created successfully",
        data: newUser,
      };
    }
  } catch (error) {
    console.error("Error creating CSE operator user:", error);
    return { success: false, message: error.message };
  }
};

// Run if executed directly
addCseOperator()
  .then((result) => {
    console.log("\n========================================");
    console.log("Script completed:");
    console.log(result.success ? "✓ SUCCESS" : "✗ FAILED");
    console.log(result.message);
    console.log("========================================");
    process.exit(result.success ? 0 : 1);
  })
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
