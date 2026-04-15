import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { sql } from "../config/db.js";
import { clearSession } from "../middleware/sessionTimeout.js";
import {
    getTokenClearCookieOptions,
    getTokenCookieOptions,
} from "../utils/authCookie.js";

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '30m'; // Token expires in 30 minutes
const COOKIE_MAX_AGE = 30 * 60 * 1000; // 30 minutes in milliseconds

export const loginUser = async (req, res) => {
  try {
    const { email, rollNumber, employeeCode, password, loginType } = req.body;

    // Validate input
    if ((!email && !rollNumber && !employeeCode) || !password || !loginType) {
      return res.status(400).json({ 
        success: false, 
        message: loginType === 'student'
          ? "Roll number, password, and login type are required"
          : loginType === 'faculty'
            ? "Employee ID, password, and login type are required"
            : "Email, password, and login type are required"
      });
    }

    let user = null;
    let role = null;

    if (loginType === 'student') {
      // Check in students table by roll number
      const students = await sql`
        SELECT s.*, r.role 
        FROM students s
        JOIN roles r ON s.role_id = r.id
        WHERE s.roll_number = ${rollNumber}
        LIMIT 1
      `;

      if (students.length === 0) {
        return res.status(401).json({ 
          success: false, 
          message: "Invalid roll number or password" 
        });
      }

      user = students[0];
      role = user.role;

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ 
          success: false, 
          message: "Invalid roll number or password" 
        });
      }

      // Check if account is active
      if (user.active === false) {
        return res.status(403).json({
          success: false,
          message: "Your account has been deactivated. Please contact the administrator."
        });
      }

      // Generate JWT token
      const token = jwt.sign(
        {
          user_id: user.student_id,
          email: user.email,
          role: role,
          roll_number: user.roll_number,
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      // Set token as httpOnly cookie
      res.cookie('token', token, getTokenCookieOptions(COOKIE_MAX_AGE));

      // Return student data (without token in response body)
      return res.status(200).json({
        success: true,
        data: {
          user_id: user.student_id,
          username: user.name,
          email: user.email,
          role: role,
          roll_number: user.roll_number,
        }
      });

    } else if (loginType === 'teacher') {
      // Check in users table (admin, hod, operator)
      const users = await sql`
        SELECT u.*, r.role, d.name as department_name, s.name as section_name
        FROM users u
        JOIN roles r ON u.role_id = r.id
        LEFT JOIN departments d ON u.department_id = d.id
        LEFT JOIN sections s ON u.section_id = s.id
        WHERE u.email = ${email}
        LIMIT 1
      `;

      if (users.length > 0) {
        user = users[0];
        role = user.role;

        // Check if user account is active
        if (user.active === false) {
          return res.status(403).json({ 
            success: false, 
            message: "Your account has been deactivated. Please contact the administrator." 
          });
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
          return res.status(401).json({ 
            success: false, 
            message: "Invalid email or password" 
          });
        }

        // Generate JWT token
        const token = jwt.sign(
          {
            user_id: user.user_id,
            email: user.email,
            role: role,
            department_id: user.department_id,
            section_id: user.section_id,
            operator_type: user.operator_type,
            access_level: user.access_level,
            active: user.active,
          },
          JWT_SECRET,
          { expiresIn: JWT_EXPIRES_IN }
        );

        // Set token as httpOnly cookie
        res.cookie('token', token, getTokenCookieOptions(COOKIE_MAX_AGE));

        // Return user data (without token in response body)
        return res.status(200).json({
          success: true,
          data: {
            user_id: user.user_id,
            username: user.username,
            email: user.email,
            role: role,
            department_id: user.department_id,
            section_id: user.section_id,
            department_name: user.department_name,
            section_name: user.section_name,
            operator_type: user.operator_type,
            access_level: user.access_level,
            active: user.active,
          }
        });
      }

      // Check in faculty table
      const faculty = await sql`
        SELECT f.*, r.role, d.name as department_name, s.name as section_name
        FROM faculty f
        JOIN roles r ON f.role_id = r.id
        LEFT JOIN departments d ON f.department_id = d.id
        LEFT JOIN sections s ON f.section_id = s.id
        WHERE f.email = ${email}
        LIMIT 1
      `;

      if (faculty.length > 0) {
        user = faculty[0];
        role = user.role;

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
          return res.status(401).json({ 
            success: false, 
            message: "Invalid email or password" 
          });
        }

        // Check if account is active
        if (user.active === false) {
          return res.status(403).json({
            success: false,
            message: "Your account has been deactivated. Please contact the administrator."
          });
        }

        // Generate JWT token
        const token = jwt.sign(
          {
            user_id: user.faculty_id,
            email: user.email,
            role: role,
            employee_code: user.employee_code,
          },
          JWT_SECRET,
          { expiresIn: JWT_EXPIRES_IN }
        );

        // Set token as httpOnly cookie
        res.cookie('token', token, getTokenCookieOptions(COOKIE_MAX_AGE));

        // Return faculty data (without token in response body)
        return res.status(200).json({
          success: true,
          data: {
            user_id: user.faculty_id,
            username: user.name,
            email: user.email,
            role: role,
            employee_code: user.employee_code,
            department: user.department_name,
            section: user.section_name,
          }
        });
      }

      // No user found
      return res.status(401).json({ 
        success: false, 
        message: "Invalid email or password" 
      });

    } else if (loginType === 'faculty') {
      // Faculty login: authenticate by employee_code from faculty table
      const code = (employeeCode || '').trim().toUpperCase();
      if (!code) {
        return res.status(400).json({ success: false, message: "Employee ID is required" });
      }

      const facultyRows = await sql`
        SELECT f.*, r.role, d.name as department_name, s.name as section_name
        FROM faculty f
        JOIN roles r ON f.role_id = r.id
        LEFT JOIN departments d ON f.department_id = d.id
        LEFT JOIN sections s ON f.section_id = s.id
        WHERE f.employee_code = ${code}
        LIMIT 1
      `;

      if (facultyRows.length === 0) {
        return res.status(401).json({ success: false, message: "Invalid Employee ID or password" });
      }

      user = facultyRows[0];

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ success: false, message: "Invalid Employee ID or password" });
      }

      // Check if account is active
      if (user.active === false) {
        return res.status(403).json({
          success: false,
          message: "Your account has been deactivated. Please contact the administrator."
        });
      }

      const token = jwt.sign(
        {
          user_id: user.faculty_id,
          email: user.email,
          role: 'faculty',
          employee_code: user.employee_code,
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      res.cookie('token', token, getTokenCookieOptions(COOKIE_MAX_AGE));

      return res.status(200).json({
        success: true,
        data: {
          user_id: user.faculty_id,
          username: user.name,
          email: user.email || '',
          role: 'faculty',
          employee_code: user.employee_code,
          department: user.department_name || '',
          section: user.section_name || '',
          designation: Array.isArray(user.designation) ? user.designation[0] || '' : (user.designation || ''),
        }
      });
    }

    return res.status(400).json({ 
      success: false, 
      message: "Invalid login type" 
    });

  } catch (error) {
    console.error("Login error:", error);
    console.error("Error stack:", error.stack);
    return res.status(500).json({ 
      success: false, 
      message: "Internal server error",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userEmail = req.user?.email; // Assuming middleware sets req.user

    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters long",
      });
    }

    // For now, we'll use email from request body if req.user is not available
    // In production, use proper JWT middleware
    const email = userEmail || req.body.email;

    if (!email) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // Find user in users, faculty, or students table
    let user = null;
    let tableName = null;
    let idField = null;

    // Check users table
    const users = await sql`
      SELECT * FROM users WHERE email = ${email} LIMIT 1
    `;

    if (users.length > 0) {
      user = users[0];
      tableName = "users";
      idField = "user_id";
    } else {
      // Check faculty table
      const faculty = await sql`
        SELECT * FROM faculty WHERE email = ${email} LIMIT 1
      `;

      if (faculty.length > 0) {
        user = faculty[0];
        tableName = "faculty";
        idField = "faculty_id";
      } else {
        // Check students table
        const students = await sql`
          SELECT * FROM students WHERE email = ${email} LIMIT 1
        `;

        if (students.length > 0) {
          user = students[0];
          tableName = "students";
          idField = "student_id";
        }
      }
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(
      currentPassword,
      user.password
    );

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password in the appropriate table
    if (tableName === "users") {
      await sql`
        UPDATE users 
        SET password = ${hashedPassword}
        WHERE user_id = ${user[idField]}
      `;
    } else if (tableName === "faculty") {
      await sql`
        UPDATE faculty 
        SET password = ${hashedPassword}
        WHERE faculty_id = ${user[idField]}
      `;
    } else if (tableName === "students") {
      await sql`
        UPDATE students 
        SET password = ${hashedPassword}
        WHERE student_id = ${user[idField]}
      `;
    }

    return res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Change password error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Logout user - clear cookie and session
 */
export const logoutUser = async (req, res) => {
  try {
    // Clear session if user is authenticated
    if (req.user) {
      clearSession(req.user.user_id, req.user.role);
    }

    // Clear cookie
    res.clearCookie('token', getTokenClearCookieOptions());

    return res.status(200).json({
      success: true,
      message: "Logged out successfully"
    });
  } catch (error) {
    console.error("Logout error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Refresh session - extends the session by updating the cookie
 */
export const refreshSession = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated"
      });
    }

    // Generate new token with same payload (strip iat/exp from old token)
    const { iat, exp, ...payload } = req.user;
    const token = jwt.sign(
      payload,
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // Set new cookie
    res.cookie('token', token, getTokenCookieOptions(COOKIE_MAX_AGE));

    return res.status(200).json({
      success: true,
      message: "Session refreshed successfully",
      data: {
        user_id: req.user.user_id,
        email: req.user.email,
        role: req.user.role
      }
    });
  } catch (error) {
    console.error("Refresh session error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};