import bcrypt from "bcrypt";
import { sql } from "../config/db.js";

/**
 * Add admin user to the database
 * username: admin_1
 * email: admin_1@vnrvjiet.in
 * password: admin123 (hashed with bcrypt)
 * role: admin
 */
export const addAdminUser = async () => {
  try {
    console.log("Starting admin user creation...");

    // Get admin role_id from roles table
    const roleResult = await sql`
      SELECT id FROM roles WHERE role = 'admin' LIMIT 1
    `;

    if (!roleResult || roleResult.length === 0) {
      console.error("Admin role not found in roles table");
      return { success: false, message: "Admin role not found" };
    }

    const adminRoleId = roleResult[0].id;
    console.log(`Found admin role with ID: ${adminRoleId}`);

    // Hash the password using bcrypt
    const plainPassword = "admin123";
    const hashedPassword = await bcrypt.hash(plainPassword, 10);
    console.log(`Password hashed successfully`);

    // Insert the admin user
    const insertResult = await sql`
      INSERT INTO users (username, email, role_id, password)
      VALUES ('admin_1', 'admin_1@vnrvjiet.in', ${adminRoleId}, ${hashedPassword})
      RETURNING user_id, username, email, role_id, created_at
    `;

    if (insertResult && insertResult.length > 0) {
      const newUser = insertResult[0];
      console.log("✓ Admin user created successfully!");
      console.log(`
User Details:
- User ID: ${newUser.user_id}
- Username: ${newUser.username}
- Email: ${newUser.email}
- Role ID: ${newUser.role_id}
- Created At: ${newUser.created_at}
      `);
      return {
        success: true,
        message: "Admin user created successfully",
        data: newUser,
      };
    }
  } catch (error) {
    console.error("Error creating admin user:", error);
    return { success: false, message: error.message };
  }
};

// Run if executed directly
addAdminUser().then((result) => {
  console.log("Script completed:");
  console.log(result);
  process.exit(result.success ? 0 : 1);
}).catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
