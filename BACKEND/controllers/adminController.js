import { sql } from "../config/db.js";

// Add a new academic year to the database
export const addAcademicYear = async (req, res) => {
  try {
    // Extract and normalize input
    const { beginningYear: byRaw, endingYear: eyRaw } = req.body;

    // Presence check
    // 400 Bad Request if missing
    if (byRaw === undefined || eyRaw === undefined) {
      return res.status(400).json({ message: "Both beginningYear and endingYear are required." });
    }

    // Convert to numbers
    const beginningYear = Number(byRaw);
    const endingYear = Number(eyRaw);

    // Type / integer checks
    if (!Number.isInteger(beginningYear) || !Number.isInteger(endingYear)) {
      return res.status(400).json({ message: "beginningYear and endingYear must be integers." });
    }

    // 4-digit year checks (1000–9999)
    if (beginningYear < 1000 || beginningYear > 9999 || endingYear < 1000 || endingYear > 9999) {
      return res.status(400).json({ message: "Both beginningYear and endingYear must be 4-digit years." });
    }

    // Business rule: endingYear must be exactly 4 years after beginningYear
    if (endingYear !== beginningYear + 4) {
      return res.status(400).json({ message: "endingYear must be exactly 4 years after beginningYear." });
    }

    // Uniqueness check: look for any existing academic year with same beginning or same ending
    const existing = await sql`
      SELECT * FROM academic_year
      WHERE beginning_year = ${beginningYear} OR ending_year = ${endingYear}
      LIMIT 1
    `;

    // Handle different return shapes (array vs object with rows)
    const existingCount =
      Array.isArray(existing) ? existing.length : (existing?.rows?.length ?? 0);

    if (existingCount > 0) {
      return res.status(400).json({ message: "Academic year already exists." });
    }

    // Insert and return the created row
    const inserted = await sql`
      INSERT INTO academic_year (beginning_year, ending_year)
      VALUES (${beginningYear}, ${endingYear})
      RETURNING *
    `;

    const created =
      Array.isArray(inserted) ? inserted[0] : (inserted?.rows?.[0] ?? null);
    //201 if successfully created
    return res.status(201).json({ success: true, data: created });
  } catch (error) {
    console.error("Error adding academic year:", error);
    //500 for server error
    return res.status(500).json({ message: "Internal server error.(adding academic year)" });
  }
};


// Fetch academic years from database
export const getAcademicYears = async (req, res) => {
    try {
        const academicYears = await sql`
            SELECT id, beginning_year, ending_year
            FROM academic_year
            ORDER BY beginning_year DESC
        `
        // 200 for successful retrieval
        return res.status(200).json({success: true, data: academicYears});
    } catch (error) {
        console.error("Error fetching academic years:", error);
        return res.status(500).json({message: "Internal server error.(Fetching academic years)"});
    }
}

export const deleteAcademicYear = async(req, res) => {
    const { id } = req.params;

    try {
        const result = await sql`
            DELETE FROM academic_year
            WHERE id = ${id}
            RETURNING *
        `;
        return res.status(200).json({success: true, data: result});
        
    } catch (error) {
        return res.status(500).json({message: "Internal server error.(Deleting academic year)"});
    }
}

// Department/Section Management
export const addDepartment = async (req, res) => {
    try {
        const { name } = req.body;
        
        if (!name || !name.trim()) {
            return res.status(400).json({ message: "Department name is required" });
        }

        // Check if department already exists
        const existing = await sql`
            SELECT * FROM departments WHERE LOWER(name) = LOWER(${name.trim()})
        `;

        if (existing.length > 0) {
            return res.status(400).json({ message: "Department already exists" });
        }

        const result = await sql`
            INSERT INTO departments (name)
            VALUES (${name.trim()})
            RETURNING *
        `;

        return res.status(201).json({ success: true, data: result[0] });
    } catch (error) {
        console.error("Error adding department:", error);
        return res.status(500).json({ message: "Internal server error (adding department)" });
    }
};

export const addSection = async (req, res) => {
    try {
        const { name } = req.body;
        
        if (!name || !name.trim()) {
            return res.status(400).json({ message: "Section name is required" });
        }

        const existing = await sql`
            SELECT * FROM sections WHERE LOWER(name) = LOWER(${name.trim()})
        `;

        if (existing.length > 0) {
            return res.status(400).json({ message: "Section already exists" });
        }

        const result = await sql`
            INSERT INTO sections (name)
            VALUES (${name.trim()})
            RETURNING *
        `;

        return res.status(201).json({ success: true, data: result[0] });
    } catch (error) {
        console.error("Error adding section:", error);
        return res.status(500).json({ message: "Internal server error (adding section)" });
    }
};

export const getDepartments = async (req, res) => {
    try {
        const departments = await sql`
            SELECT * FROM departments ORDER BY name ASC
        `;
        return res.status(200).json({ success: true, data: departments });
    } catch (error) {
        console.error("Error fetching departments:", error);
        return res.status(500).json({ message: "Internal server error (fetching departments)" });
    }
};

export const getSections = async (req, res) => {
    try {
        const sections = await sql`
            SELECT * FROM sections ORDER BY name ASC
        `;
        return res.status(200).json({ success: true, data: sections });
    } catch (error) {
        console.error("Error fetching sections:", error);
        return res.status(500).json({ message: "Internal server error (fetching sections)" });
    }
};

export const deleteDepartment = async (req, res) => {
    const { id } = req.params;

    try {
        // This will cascade delete all related records due to foreign key constraints
        const result = await sql`
            DELETE FROM departments WHERE id = ${id} RETURNING *
        `;

        if (result.length === 0) {
            return res.status(404).json({ message: "Department not found" });
        }

        return res.status(200).json({ success: true, data: result[0] });
    } catch (error) {
        console.error("Error deleting department:", error);
        return res.status(500).json({ message: "Internal server error (deleting department)" });
    }
};

export const deleteSection = async (req, res) => {
    const { id } = req.params;

    try {
        const result = await sql`
            DELETE FROM sections WHERE id = ${id} RETURNING *
        `;

        if (result.length === 0) {
            return res.status(404).json({ message: "Section not found" });
        }

        return res.status(200).json({ success: true, data: result[0] });
    } catch (error) {
        console.error("Error deleting section:", error);
        return res.status(500).json({ message: "Internal server error (deleting section)" });
    }
};

// Dashboard Stats
export const getDashboardStats = async (req, res) => {
    try {
        const [departments, sections, users, academicYears, students, faculty] = await Promise.all([
            sql`SELECT COUNT(*) as count FROM departments`,
            sql`SELECT COUNT(*) as count FROM sections`,
            sql`SELECT COUNT(*) as count FROM users`,
            sql`SELECT COUNT(*) as count FROM academic_year`,
            sql`SELECT COUNT(*) as count FROM students`,
            sql`SELECT COUNT(*) as count FROM faculty`,
        ]);

        // Get student dues stats with dynamic interest calculation
        const studentDuesStats = await sql`
            SELECT 
                COUNT(CASE WHEN sd.is_cleared = FALSE THEN 1 END) as active_student_dues,
                COUNT(CASE WHEN sd.is_cleared = TRUE THEN 1 END) as cleared_student_dues,
                COALESCE(SUM(CASE WHEN sd.is_cleared = FALSE AND sd.is_payable = TRUE THEN 
                    calculate_outstanding_amount(sd.principal_amount, sd.interest_rate, sd.is_compounded, sd.due_clear_by_date::timestamptz, sd.amount_paid)
                ELSE 0 END), 0) as student_dues_amount
            FROM student_dues sd
            WHERE sd.student_roll_number IN (SELECT roll_number FROM students)
        `;

        // Get faculty dues stats from dedicated faculty_due table
        // Note: If faculty_due table has same structure, we can use the function. Otherwise keep current_amount for now.
        const facultyDuesStats = await sql`
            SELECT 
                COUNT(CASE WHEN fd.is_cleared = FALSE THEN 1 END) as active_faculty_dues,
                COUNT(CASE WHEN fd.is_cleared = TRUE THEN 1 END) as cleared_faculty_dues,
                COALESCE(SUM(CASE WHEN fd.is_cleared = FALSE AND fd.is_payable = TRUE THEN fd.current_amount ELSE 0 END), 0) as faculty_dues_amount
            FROM faculty_due fd
        `;

        return res.status(200).json({
            success: true,
            data: {
                totalDepartments: parseInt(departments[0].count),
                totalSections: parseInt(sections[0].count),
                totalUsers: parseInt(users[0].count),
                totalAcademicYears: parseInt(academicYears[0].count),
                totalStudents: parseInt(students[0].count),
                totalFaculty: parseInt(faculty[0].count),
                activeStudentDues: parseInt(studentDuesStats[0].active_student_dues) || 0,
                clearedStudentDues: parseInt(studentDuesStats[0].cleared_student_dues) || 0,
                studentDuesAmount: parseFloat(studentDuesStats[0].student_dues_amount) || 0,
                activeFacultyDues: parseInt(facultyDuesStats[0].active_faculty_dues) || 0,
                clearedFacultyDues: parseInt(facultyDuesStats[0].cleared_faculty_dues) || 0,
                facultyDuesAmount: parseFloat(facultyDuesStats[0].faculty_dues_amount) || 0,
            },
        });
    } catch (error) {
        console.error("Error fetching dashboard stats:", error);
        return res.status(500).json({ message: "Internal server error (fetching stats)" });
    }
};

export const getDepartmentDues = async (req, res) => {
    try {
        // Get department dues (only active/uncleared dues) with dynamic interest
        const deptDues = await sql`
            SELECT 
                d.name,
                'department' as type,
                COUNT(CASE WHEN sd.is_payable = false AND sd.is_cleared = false THEN 1 END) as non_payable_dues,
                COUNT(CASE WHEN sd.is_payable = true AND sd.is_cleared = false THEN 1 END) as payable_dues,
                COALESCE(SUM(CASE WHEN sd.is_payable = true AND sd.is_cleared = false THEN 
                    calculate_outstanding_amount(sd.principal_amount, sd.interest_rate, sd.is_compounded, sd.due_clear_by_date::timestamptz, sd.amount_paid)
                ELSE 0 END), 0) as total_amount
            FROM departments d
            LEFT JOIN student_dues sd ON sd.added_by_department_id = d.id
            GROUP BY d.id, d.name
        `;

        // Get section dues (only active/uncleared dues) with dynamic interest
        const sectionDues = await sql`
            SELECT 
                s.name,
                'section' as type,
                COUNT(CASE WHEN sd.is_payable = false AND sd.is_cleared = false THEN 1 END) as non_payable_dues,
                COUNT(CASE WHEN sd.is_payable = true AND sd.is_cleared = false THEN 1 END) as payable_dues,
                COALESCE(SUM(CASE WHEN sd.is_payable = true AND sd.is_cleared = false THEN 
                    calculate_outstanding_amount(sd.principal_amount, sd.interest_rate, sd.is_compounded, sd.due_clear_by_date::timestamptz, sd.amount_paid)
                ELSE 0 END), 0) as total_amount
            FROM sections s
            LEFT JOIN student_dues sd ON sd.added_by_section_id = s.id
            GROUP BY s.id, s.name
        `;

        // Convert snake_case to camelCase
        const combinedDues = [...deptDues, ...sectionDues].map(due => ({
            name: due.name,
            type: due.type,
            nonPayableDues: parseInt(due.non_payable_dues) || 0,
            payableDues: parseInt(due.payable_dues) || 0,
            totalAmount: parseFloat(due.total_amount) || 0
        }));
        
        return res.status(200).json({ success: true, data: combinedDues });
    } catch (error) {
        console.error("Error fetching department dues:", error);
        return res.status(500).json({ message: "Internal server error (fetching department dues)" });
    }
};


export const getDepartmentAnalytics = async (req, res) => {
    try {
        // Get department-wise dues breakdown
        const deptAnalytics = await sql`
            SELECT 
                d.name as department,
                COUNT(CASE WHEN sd.is_payable = false AND sd.is_cleared = false THEN 1 END) as active_non_payable,
                COUNT(CASE WHEN sd.is_payable = true AND sd.is_cleared = false THEN 1 END) as active_payable,
                COUNT(CASE WHEN sd.is_payable = false AND sd.is_cleared = true THEN 1 END) as cleared_non_payable,
                COUNT(CASE WHEN sd.is_payable = true AND sd.is_cleared = true THEN 1 END) as cleared_payable
            FROM departments d
            LEFT JOIN student_dues sd ON sd.added_by_department_id = d.id
            GROUP BY d.id, d.name
            ORDER BY d.name
        `;

        const analytics = deptAnalytics.map(dept => ({
            department: dept.department,
            activeNonPayable: parseInt(dept.active_non_payable) || 0,
            activePayable: parseInt(dept.active_payable) || 0,
            clearedNonPayable: parseInt(dept.cleared_non_payable) || 0,
            clearedPayable: parseInt(dept.cleared_payable) || 0
        }));

        return res.status(200).json({ success: true, data: analytics });
    } catch (error) {
        console.error("Error fetching department analytics:", error);
        return res.status(500).json({ message: "Internal server error (fetching analytics)" });
    }
};

export const getOverallStats = async (req, res) => {
    try {
        const stats = await sql`
            SELECT 
                COUNT(CASE WHEN is_payable = false AND is_cleared = false THEN 1 END) as active_non_payable,
                COUNT(CASE WHEN is_payable = true AND is_cleared = false THEN 1 END) as active_payable,
                COUNT(CASE WHEN is_payable = false AND is_cleared = true THEN 1 END) as cleared_non_payable,
                COUNT(CASE WHEN is_payable = true AND is_cleared = true THEN 1 END) as cleared_payable,
                COALESCE(SUM(CASE WHEN is_payable = true AND is_cleared = false THEN 
                    calculate_outstanding_amount(principal_amount, interest_rate, is_compounded, due_clear_by_date::timestamptz, amount_paid)
                ELSE 0 END), 0) as total_pending_amount
            FROM student_dues
        `;

        return res.status(200).json({
            success: true,
            data: {
                activeNonPayable: parseInt(stats[0].active_non_payable) || 0,
                activePayable: parseInt(stats[0].active_payable) || 0,
                clearedNonPayable: parseInt(stats[0].cleared_non_payable) || 0,
                clearedPayable: parseInt(stats[0].cleared_payable) || 0,
                totalPendingAmount: parseFloat(stats[0].total_pending_amount) || 0
            }
        });
    } catch (error) {
        console.error("Error fetching overall stats:", error);
        return res.status(500).json({ message: "Internal server error (fetching overall stats)" });
    }
};

// GET /api/admin/dashboard/monthly-data
export const getMonthlyData = async (req, res) => {
  try {
    // Get last 6 months data (global - all departments)
    const monthlyData = [];
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      const monthName = monthDate.toLocaleString('en-US', { month: 'short', year: '2-digit' });
      
      // Active dues at end of month (global)
      const activeDues = await sql`
        SELECT 
          COUNT(CASE WHEN is_payable = true THEN 1 END) as active_payable,
          COUNT(CASE WHEN is_payable = false THEN 1 END) as active_non_payable
        FROM student_dues
        WHERE created_at <= ${monthEnd}
          AND (overall_status = false)
      `;
      
      // Cleared dues during that month (global)
      const clearedDues = await sql`
        SELECT 
          COUNT(CASE WHEN is_payable = true THEN 1 END) as cleared_payable,
          COUNT(CASE WHEN is_payable = false THEN 1 END) as cleared_non_payable
        FROM student_dues
        WHERE updated_at >= ${monthDate}
          AND updated_at <= ${monthEnd}
          AND overall_status = true
      `;
      
      monthlyData.push({
        month: monthName,
        activePayable: parseInt(activeDues[0]?.active_payable || 0),
        activeNonPayable: parseInt(activeDues[0]?.active_non_payable || 0),
        clearedPayable: parseInt(clearedDues[0]?.cleared_payable || 0),
        clearedNonPayable: parseInt(clearedDues[0]?.cleared_non_payable || 0)
      });
    }

    return res.status(200).json({ success: true, data: monthlyData });
    
  } catch (error) {
    console.error("Error fetching monthly data:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Internal server error" 
    });
  }
};

// GET /api/admin/dashboard/academic-year-data
export const getAcademicYearData = async (req, res) => {
  try {
    // Get dues grouped by academic year (global - all departments)
    const yearData = await sql`
      SELECT 
        CONCAT(ay.beginning_year, '-', ay.ending_year) as year,
        COUNT(CASE WHEN sd.is_payable = true AND sd.overall_status = false THEN 1 END) as active_payable,
        COUNT(CASE WHEN sd.is_payable = false AND sd.overall_status = false THEN 1 END) as active_non_payable
      FROM student_dues sd
      JOIN students s ON sd.student_roll_number = s.roll_number
      JOIN academic_year ay ON s.academic_year_id = ay.id
      WHERE sd.overall_status = false
      GROUP BY ay.id, ay.beginning_year, ay.ending_year
      HAVING COUNT(CASE WHEN sd.overall_status = false THEN 1 END) > 0
      ORDER BY ay.beginning_year DESC
    `;

    const formattedData = yearData.map(row => ({
      year: row.year,
      activePayable: parseInt(row.active_payable),
      activeNonPayable: parseInt(row.active_non_payable)
    }));

    return res.status(200).json({ success: true, data: formattedData });
    
  } catch (error) {
    console.error("Error fetching academic year data:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Internal server error" 
    });
  }
};

// GET /api/admin/dashboard/faculty-dues-by-department
export const getFacultyDuesByDepartment = async (req, res) => {
  try {
    const facultyDues = await sql`
      SELECT 
        d.name as department,
        COUNT(CASE WHEN fd.is_payable = true AND fd.is_cleared = false THEN 1 END) as active_payable,
        COUNT(CASE WHEN fd.is_payable = false AND fd.is_cleared = false THEN 1 END) as active_non_payable,
        COUNT(CASE WHEN fd.is_cleared = true THEN 1 END) as cleared_dues,
        COALESCE(SUM(CASE WHEN fd.is_payable = true AND fd.is_cleared = false THEN fd.current_amount ELSE 0 END), 0) as total_amount
      FROM faculty f
      LEFT JOIN departments d ON f.department_id = d.id
      LEFT JOIN faculty_due fd ON fd.employee_code = f.employee_code
      WHERE d.id IS NOT NULL
      GROUP BY d.id, d.name
      ORDER BY d.name
    `;

    const formattedData = facultyDues.map(row => ({
      department: row.department,
      activePayable: parseInt(row.active_payable) || 0,
      activeNonPayable: parseInt(row.active_non_payable) || 0,
      clearedDues: parseInt(row.cleared_dues) || 0,
      totalAmount: parseFloat(row.total_amount) || 0
    }));

    return res.status(200).json({ success: true, data: formattedData });
  } catch (error) {
    console.error("Error fetching faculty dues by department:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Internal server error" 
    });
  }
};

// GET /api/admin/dashboard/student-vs-faculty-dues
export const getStudentVsFacultyDues = async (req, res) => {
  try {
    // Get student dues totals with dynamic interest
    const studentDues = await sql`
      SELECT 
        COUNT(CASE WHEN sd.is_cleared = false THEN 1 END) as active_dues,
        COALESCE(SUM(CASE WHEN sd.is_cleared = false AND sd.is_payable = true THEN 
            calculate_outstanding_amount(sd.principal_amount, sd.interest_rate, sd.is_compounded, sd.due_clear_by_date::timestamptz, sd.amount_paid)
        ELSE 0 END), 0) as total_amount
      FROM student_dues sd
      WHERE sd.student_roll_number IN (SELECT roll_number FROM students)
    `;

    // Get faculty dues totals from dedicated faculty_due table
    const facultyDues = await sql`
      SELECT 
        COUNT(CASE WHEN fd.is_cleared = false THEN 1 END) as active_dues,
        COALESCE(SUM(CASE WHEN fd.is_cleared = false AND fd.is_payable = true THEN fd.current_amount ELSE 0 END), 0) as total_amount
      FROM faculty_due fd
    `;

    const data = {
      studentDues: {
        count: parseInt(studentDues[0].active_dues) || 0,
        amount: parseFloat(studentDues[0].total_amount) || 0
      },
      facultyDues: {
        count: parseInt(facultyDues[0].active_dues) || 0,
        amount: parseFloat(facultyDues[0].total_amount) || 0
      }
    };

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Error fetching student vs faculty dues:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Internal server error" 
    });
  }
};

export const addUser = async (req, res) => {
  try {
    const { 
      username, 
      email, 
      password, 
      role, 
      department_id, 
      section_id,
      operator_type,
      access_level 
    } = req.body;

    // Validation
    if (!username || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: "Username, email, password, and role are required",
      });
    }

    // Operator-specific validation
    if (role === 'operator') {
      if (!operator_type || !access_level) {
        return res.status(400).json({
          success: false,
          message: "Operator type and access level are required for operator role",
        });
      }
      
      if (!['department', 'section'].includes(operator_type)) {
        return res.status(400).json({
          success: false,
          message: "Invalid operator type. Must be 'department' or 'section'",
        });
      }
      
      const validAccessLevels = ['all_students', 'department_students', 'all_faculty'];
      if (!validAccessLevels.includes(access_level)) {
        return res.status(400).json({
          success: false,
          message: "Invalid access level",
        });
      }
    }

    // Check if user already exists
    const existingUser = await sql`
      SELECT * FROM users WHERE email = ${email}
    `;

    if (existingUser.length > 0) {
      return res.status(400).json({
        success: false,
        message: "User with this email already exists",
      });
    }

    // Get role_id
    let roleResult = await sql`SELECT id FROM roles WHERE role = ${role}`;
    
    if (roleResult.length === 0) {
      // Create role if it doesn't exist
      await sql`INSERT INTO roles (role) VALUES (${role}) ON CONFLICT (role) DO NOTHING`;
      roleResult = await sql`SELECT id FROM roles WHERE role = ${role}`;
    }
    
    const roleId = roleResult[0].id;

    // Hash password
    const hashedPassword = await sql`SELECT crypt(${password}, gen_salt('bf'))`;

    // Insert user
    const newUser = await sql`
      INSERT INTO users (
        username, 
        email, 
        password, 
        role_id, 
        department_id, 
        section_id,
        operator_type,
        access_level
      )
      VALUES (
        ${username},
        ${email},
        ${hashedPassword[0].crypt},
        ${roleId},
        ${department_id || null},
        ${section_id || null},
        ${role === 'operator' ? operator_type : null},
        ${role === 'operator' ? access_level : null}
      )
      RETURNING user_id, username, email
    `;

    res.status(201).json({
      success: true,
      message: "User created successfully",
      data: newUser[0],
    });
  } catch (error) {
    console.error("Error adding user:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add user",
      error: error.message,
    });
  }
};

export const addStudentUsers = async (req, res) => {
  try {
    const { students, academic_year_id } = req.body;

    if (!students || !Array.isArray(students) || students.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Students array is required",
      });
    }

    if (!academic_year_id) {
      return res.status(400).json({
        success: false,
        message: "Academic year ID is required",
      });
    }

    // Ensure student role exists, create if not
    let roleResult = await sql`SELECT id FROM roles WHERE role = 'student'`;
    if (roleResult.length === 0) {
      // Create student role if it doesn't exist
      await sql`INSERT INTO roles (role) VALUES ('student') ON CONFLICT (role) DO NOTHING`;
      roleResult = await sql`SELECT id FROM roles WHERE role = 'student'`;
    }
    const studentRoleId = roleResult[0].id;

    // Process students in bulk (Neon serverless doesn't support traditional transactions)
    // We'll insert one by one and track successes/failures
    const results = {
      success: [],
      failed: [],
    };

    for (const student of students) {
      try {
        // Auto-create department if it doesn't exist
        let departmentId = null;
        if (student.branch) {
          const deptResult = await sql`
            SELECT id FROM departments WHERE name = ${student.branch}
          `;
          if (deptResult.length > 0) {
            departmentId = deptResult[0].id;
          } else {
            // Create department if it doesn't exist
            const newDept = await sql`
              INSERT INTO departments (name) 
              VALUES (${student.branch}) 
              ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
              RETURNING id
            `;
            departmentId = newDept[0].id;
          }
        }

        // Don't auto-create sections for students
        // Section in student Excel is just a text field (like "A", "B"), not a reference to sections table
        let sectionId = null;

        // Generate default password from roll number (last 6 characters or full roll number)
        const defaultPassword = student.roll_number.slice(-6) || student.roll_number;
        
        // Hash password
        const hashedPassword = await sql`SELECT crypt(${defaultPassword}, gen_salt('bf'))`;

        // Insert student
        await sql`
          INSERT INTO students (
            name, roll_number, branch, section, email, mobile,
            father_name, father_mobile, academic_year_id, role_id,
            department_id, section_id, password
          ) VALUES (
            ${student.name},
            ${student.roll_number},
            ${student.branch},
            ${student.section},
            ${student.email},
            ${student.mobile || null},
            ${student.father_name || null},
            ${student.father_mobile || null},
            ${academic_year_id},
            ${studentRoleId},
            ${departmentId},
            ${sectionId},
            ${hashedPassword[0].crypt}
          )
        `;
        
        results.success.push(student.roll_number);
      } catch (error) {
        console.error(`Failed to add student ${student.roll_number}:`, error.message);
        results.failed.push({
          roll_number: student.roll_number,
          error: error.message,
        });
      }
    }

    // Return results with details about successes and failures
    if (results.failed.length > 0) {
      res.status(207).json({
        success: true,
        message: `Added ${results.success.length} students, ${results.failed.length} failed`,
        count: results.success.length,
        successful: results.success,
        failed: results.failed,
      });
    } else {
      res.status(201).json({
        success: true,
        message: `Successfully added ${results.success.length} students`,
        count: results.success.length,
      });
    }
  } catch (error) {
    console.error("Error adding students:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add students",
      error: error.message,
    });
  }
};

export const addFacultyUsers = async (req, res) => {
  try {
    const { faculty, staff_type } = req.body;

    if (!faculty || !Array.isArray(faculty) || faculty.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Faculty array is required",
      });
    }

    if (!staff_type || !['teaching', 'non-teaching'].includes(staff_type)) {
      return res.status(400).json({
        success: false,
        message: "Valid staff type is required (teaching or non-teaching)",
      });
    }

    // Get operator role ID (faculty members are operators in the system)
    let roleResult = await sql`SELECT id FROM roles WHERE role = 'operator'`;
    if (roleResult.length === 0) {
      // Create operator role if it doesn't exist
      await sql`INSERT INTO roles (role) VALUES ('operator') ON CONFLICT (role) DO NOTHING`;
      roleResult = await sql`SELECT id FROM roles WHERE role = 'operator'`;
    }
    const facultyRoleId = roleResult[0].id;

    // Process faculty in bulk (Neon serverless doesn't support traditional transactions)
    const results = {
      success: [],
      failed: [],
    };

    for (const fac of faculty) {
      try {
        // Get department ID if provided, create if doesn't exist
        let departmentId = null;
        if (fac.department) {
          const deptResult = await sql`
            SELECT id FROM departments WHERE name = ${fac.department}
          `;
          if (deptResult.length > 0) {
            departmentId = deptResult[0].id;
          } else {
            const newDept = await sql`
              INSERT INTO departments (name) 
              VALUES (${fac.department}) 
              ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
              RETURNING id
            `;
            departmentId = newDept[0].id;
          }
        }

        // Get section ID if provided, create if doesn't exist
        let sectionId = null;
        if (fac.section) {
          const sectionResult = await sql`
            SELECT id FROM sections WHERE name = ${fac.section}
          `;
          if (sectionResult.length > 0) {
            sectionId = sectionResult[0].id;
          } else {
            const newSection = await sql`
              INSERT INTO sections (name) 
              VALUES (${fac.section}) 
              ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
              RETURNING id
            `;
            sectionId = newSection[0].id;
          }
        }

        // Generate default password from employee code (last 6 characters)
        const defaultPassword = fac.employee_code?.slice(-6) || fac.employee_code || 'faculty123';

        // Hash password
        const hashedPassword = await sql`SELECT crypt(${defaultPassword}, gen_salt('bf'))`;

        // Insert faculty
        await sql`
          INSERT INTO faculty (
            employee_code, name, department_id, section_id,
            designation, email, mobile, role_id, staff_type, password
          ) VALUES (
            ${fac.employee_code},
            ${fac.name},
            ${departmentId},
            ${sectionId},
            ${fac.designation ? [fac.designation] : null},
            ${fac.email || null},
            ${fac.mobile || null},
            ${facultyRoleId},
            ${staff_type},
            ${hashedPassword[0].crypt}
          )
        `;

        results.success.push(fac.employee_code);
      } catch (error) {
        console.error(`Failed to add faculty ${fac.employee_code}:`, error.message);
        results.failed.push({
          employee_code: fac.employee_code,
          error: error.message,
        });
      }
    }

    // Return results with details about successes and failures
    if (results.failed.length > 0) {
      res.status(207).json({
        success: true,
        message: `Added ${results.success.length} faculty, ${results.failed.length} failed`,
        count: results.success.length,
        successful: results.success,
        failed: results.failed,
      });
    } else {
      res.status(201).json({
        success: true,
        message: `Successfully added ${results.success.length} faculty members`,
        count: results.success.length,
      });
    }
  } catch (error) {
    console.error("Error adding faculty:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add faculty",
      error: error.message,
    });
  }
}

export const getDashBoardStats = (req, res) => {}

export const getAllUsers = async (req, res) => {
  try {
    const users = await sql`
      SELECT 
        u.user_id,
        u.username,
        u.email,
        r.role,
        d.name as department_name,
        s.name as section_name,
        u.active,
        u.created_at
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN sections s ON u.section_id = s.id
      ORDER BY u.created_at DESC
    `;

    res.status(200).json({
      success: true,
      data: users,
      count: users.length,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch users",
      error: error.message,
    });
  }
};

export const getAllStudents = async (req, res) => {
  try {
    const students = await sql`
      SELECT 
        s.student_id,
        s.name,
        s.roll_number,
        s.branch,
        s.section,
        s.email,
        s.mobile,
        s.father_name,
        s.father_mobile,
        s.active,
        CONCAT(ay.beginning_year, '-', ay.ending_year) as academic_year
      FROM students s
      LEFT JOIN academic_year ay ON s.academic_year_id = ay.id
      ORDER BY s.created_at DESC
    `;

    res.status(200).json({
      success: true,
      data: students,
      count: students.length,
    });
  } catch (error) {
    console.error("Error fetching students:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch students",
      error: error.message,
    });
  }
};

export const getAllFaculties = async (req, res) => {
  try {
    const faculties = await sql`
      SELECT 
        f.faculty_id,
        f.employee_code,
        f.name,
        d.name as department,
        s.name as section,
        f.department_id,
        f.section_id,
        f.designation,
        f.email,
        f.mobile,
        f.staff_type,
        f.active,
        r.role as assigned_role
      FROM faculty f
      LEFT JOIN departments d ON f.department_id = d.id
      LEFT JOIN sections s ON f.section_id = s.id
      LEFT JOIN users u ON f.email = u.email
      LEFT JOIN roles r ON u.role_id = r.id
      ORDER BY f.created_at DESC
    `;

    res.status(200).json({
      success: true,
      data: faculties,
      count: faculties.length,
    });
  } catch (error) {
    console.error("Error fetching faculty:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch faculty",
      error: error.message,
    });
  }
};

export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, role, department_id, section_id } = req.body;

    // Validation
    if (!username || !email || !role) {
      return res.status(400).json({
        success: false,
        message: "Username, email, and role are required",
      });
    }

    // Check if user exists
    const existingUser = await sql`
      SELECT * FROM users WHERE user_id = ${id}
    `;

    if (existingUser.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Get role_id
    let roleResult = await sql`SELECT id FROM roles WHERE role = ${role}`;
    
    if (roleResult.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid role",
      });
    }
    
    const roleId = roleResult[0].id;

    // Update user
    const updated = await sql`
      UPDATE users
      SET 
        username = ${username},
        email = ${email},
        role_id = ${roleId},
        department_id = ${department_id || null},
        section_id = ${section_id || null}
      WHERE user_id = ${id}
      RETURNING *
    `;

    res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: updated[0],
    });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update user",
      error: error.message,
    });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user exists
    const existingUser = await sql`
      SELECT * FROM users WHERE user_id = ${id}
    `;

    if (existingUser.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Delete user
    await sql`
      DELETE FROM users WHERE user_id = ${id}
    `;

    res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete user",
      error: error.message,
    });
  }
};

export const changeUserPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    // Validation
    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      });
    }

    // Check if user exists
    const existingUser = await sql`
      SELECT * FROM users WHERE user_id = ${id}
    `;

    if (existingUser.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Hash new password
    const hashedPassword = await sql`SELECT crypt(${password}, gen_salt('bf'))`;

    // Update password
    await sql`
      UPDATE users
      SET 
        password = ${hashedPassword[0].crypt}
      WHERE user_id = ${id}
    `;

    res.status(200).json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    console.error("Error updating user password:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update password",
      error: error.message,
    });
  }
};

export const updateStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      roll_number,
      email,
      mobile,
      father_name,
      father_mobile,
      branch,
      section,
      academic_year_id,
    } = req.body;

    // Validation
    if (!name || !roll_number || !email) {
      return res.status(400).json({
        success: false,
        message: "Name, roll number, and email are required",
      });
    }

    // Check if student exists
    const existingStudent = await sql`
      SELECT * FROM students WHERE student_id = ${id}
    `;

    if (existingStudent.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    // Update student
    const updated = await sql`
      UPDATE students
      SET 
        name = ${name},
        roll_number = ${roll_number},
        email = ${email},
        mobile = ${mobile || null},
        father_name = ${father_name || null},
        father_mobile = ${father_mobile || null},
        branch = ${branch || existingStudent[0].branch},
        section = ${section || existingStudent[0].section},
        academic_year_id = ${academic_year_id || existingStudent[0].academic_year_id}
      WHERE student_id = ${id}
      RETURNING *
    `;

    res.status(200).json({
      success: true,
      message: "Student updated successfully",
      data: updated[0],
    });
  } catch (error) {
    console.error("Error updating student:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update student",
      error: error.message,
    });
  }
};

export const changeStudentPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    // Validation
    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      });
    }

    // Check if student exists
    const existingStudent = await sql`
      SELECT * FROM students WHERE student_id = ${id}
    `;

    if (existingStudent.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    // Hash new password
    const hashedPassword = await sql`SELECT crypt(${password}, gen_salt('bf'))`;

    // Update password
    await sql`
      UPDATE students
      SET 
        password = ${hashedPassword[0].crypt}
      WHERE student_id = ${id}
    `;

    res.status(200).json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    console.error("Error updating password:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update password",
      error: error.message,
    });
  }
};

export const updateFaculty = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      employee_code,
      email,
      mobile,
      designation,
      staff_type,
      department_id,
      section_id,
    } = req.body;

    // Validation
    if (!name || !employee_code || !email) {
      return res.status(400).json({
        success: false,
        message: "Name, employee code, and email are required",
      });
    }

    // Check if faculty exists
    const existingFaculty = await sql`
      SELECT * FROM faculty WHERE faculty_id = ${id}
    `;

    if (existingFaculty.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Faculty not found",
      });
    }

    // Update faculty
    const updated = await sql`
      UPDATE faculty
      SET 
        name = ${name},
        employee_code = ${employee_code},
        email = ${email},
        mobile = ${mobile || null},
        designation = ${designation || null},
        staff_type = ${staff_type || existingFaculty[0].staff_type},
        department_id = ${department_id || null},
        section_id = ${section_id || null}
      WHERE faculty_id = ${id}
      RETURNING *
    `;

    res.status(200).json({
      success: true,
      message: "Faculty updated successfully",
      data: updated[0],
    });
  } catch (error) {
    console.error("Error updating faculty:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update faculty",
      error: error.message,
    });
  }
};

export const changeFacultyPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    // Validation
    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      });
    }

    // Check if faculty exists
    const existingFaculty = await sql`
      SELECT * FROM faculty WHERE faculty_id = ${id}
    `;

    if (existingFaculty.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Faculty not found",
      });
    }

    // Hash new password
    const hashedPassword = await sql`SELECT crypt(${password}, gen_salt('bf'))`;

    // Update password
    await sql`
      UPDATE faculty
      SET 
        password = ${hashedPassword[0].crypt}
      WHERE faculty_id = ${id}
    `;

    res.status(200).json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    console.error("Error updating password:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update password",
      error: error.message,
    });
  }
};

export const assignFacultyRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, operator_type, access_level } = req.body;

    // Validation
    if (role === undefined) {
      return res.status(400).json({
        success: false,
        message: "Role is required",
      });
    }

    // Validate role
    const validRoles = ['admin', 'operator', 'hod', ''];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role. Must be admin, operator, hod, or empty string",
      });
    }

    // Operator-specific validation
    if (role === 'operator') {
      if (!operator_type || !access_level) {
        return res.status(400).json({
          success: false,
          message: "Operator type and access level are required for operator role",
        });
      }
      
      if (!['department', 'section'].includes(operator_type)) {
        return res.status(400).json({
          success: false,
          message: "Invalid operator type. Must be 'department' or 'section'",
        });
      }
      
      const validAccessLevels = ['all_students', 'department_students', 'all_faculty'];
      if (!validAccessLevels.includes(access_level)) {
        return res.status(400).json({
          success: false,
          message: "Invalid access level",
        });
      }
    }

    // Get faculty details
    const faculty = await sql`
      SELECT 
        f.*,
        d.id as dept_id,
        s.id as sect_id
      FROM faculty f
      LEFT JOIN departments d ON f.department_id = d.id
      LEFT JOIN sections s ON f.section_id = s.id
      WHERE f.faculty_id = ${id}
    `;

    if (faculty.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Faculty not found",
      });
    }

    const facultyData = faculty[0];

    // If role is being assigned (not empty), add/update in users table
    if (role) {
      // Get role_id
      let roleResult = await sql`SELECT id FROM roles WHERE role = ${role}`;
      
      if (roleResult.length === 0) {
        // Create role if it doesn't exist
        await sql`INSERT INTO roles (role) VALUES (${role}) ON CONFLICT (role) DO NOTHING`;
        roleResult = await sql`SELECT id FROM roles WHERE role = ${role}`;
      }
      
      const roleId = roleResult[0].id;

      // Check if user already exists
      const existingUser = await sql`
        SELECT * FROM users WHERE email = ${facultyData.email}
      `;

      if (existingUser.length > 0) {
        // Update existing user
        await sql`
          UPDATE users
          SET 
            role_id = ${roleId},
            department_id = ${facultyData.department_id || null},
            section_id = ${facultyData.section_id || null},
            operator_type = ${role === 'operator' ? operator_type : null},
            access_level = ${role === 'operator' ? access_level : null}
          WHERE email = ${facultyData.email}
        `;
      } else {
        // Insert new user
        await sql`
          INSERT INTO users (
            username, 
            email, 
            password, 
            role_id, 
            department_id, 
            section_id,
            operator_type,
            access_level
          ) VALUES (
            ${facultyData.name},
            ${facultyData.email},
            ${facultyData.password},
            ${roleId},
            ${facultyData.department_id || null},
            ${facultyData.section_id || null},
            ${role === 'operator' ? operator_type : null},
            ${role === 'operator' ? access_level : null}
          )
        `;
      }
    } else {
      // If role is empty, remove from users table
      await sql`
        DELETE FROM users WHERE email = ${facultyData.email}
      `;
    }

    res.status(200).json({
      success: true,
      message: role 
        ? `Role assigned successfully and user added to users table`
        : "Role removed successfully and user removed from users table",
    });
  } catch (error) {
    console.error("Error assigning role:", error);
    res.status(500).json({
      success: false,
      message: "Failed to assign role",
      error: error.message,
    });
  }
};

// Toggle user active/inactive status
export const toggleUserActiveStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { active } = req.body;

    // Validate input
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    if (typeof active !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: "Active status must be a boolean",
      });
    }

    // Check if user exists
    const userExists = await sql`
      SELECT user_id, username, email, active
      FROM users
      WHERE user_id = ${userId}
      LIMIT 1
    `;

    if (userExists.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const user = userExists[0];

    // Prevent deactivating yourself if you're an admin
    if (req.user && req.user.user_id === userId && active === false) {
      return res.status(400).json({
        success: false,
        message: "You cannot deactivate your own account",
      });
    }

    // Update active status
    await sql`
      UPDATE users
      SET active = ${active}
      WHERE user_id = ${userId}
    `;

    res.status(200).json({
      success: true,
      message: `User ${user.username} has been ${active ? 'activated' : 'deactivated'} successfully`,
      data: {
        user_id: userId,
        username: user.username,
        email: user.email,
        active: active,
      },
    });
  } catch (error) {
    console.error("Error toggling user active status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update user status",
      error: error.message,
    });
  }
};

// Toggle student active/inactive status
export const toggleStudentActiveStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;

    if (!id) {
      return res.status(400).json({ success: false, message: "Student ID is required" });
    }

    if (typeof active !== 'boolean') {
      return res.status(400).json({ success: false, message: "Active status must be a boolean" });
    }

    const studentExists = await sql`
      SELECT student_id, name, roll_number, active
      FROM students
      WHERE student_id = ${id}
      LIMIT 1
    `;

    if (studentExists.length === 0) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }

    const student = studentExists[0];

    await sql`
      UPDATE students
      SET active = ${active}
      WHERE student_id = ${id}
    `;

    res.status(200).json({
      success: true,
      message: `Student ${student.name} has been ${active ? 'activated' : 'deactivated'} successfully`,
      data: { student_id: id, name: student.name, roll_number: student.roll_number, active },
    });
  } catch (error) {
    console.error("Error toggling student active status:", error);
    res.status(500).json({ success: false, message: "Failed to update student status", error: error.message });
  }
};

// Toggle faculty active/inactive status
export const toggleFacultyActiveStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;

    if (!id) {
      return res.status(400).json({ success: false, message: "Faculty ID is required" });
    }

    if (typeof active !== 'boolean') {
      return res.status(400).json({ success: false, message: "Active status must be a boolean" });
    }

    const facultyExists = await sql`
      SELECT faculty_id, name, employee_code, active
      FROM faculty
      WHERE faculty_id = ${id}
      LIMIT 1
    `;

    if (facultyExists.length === 0) {
      return res.status(404).json({ success: false, message: "Faculty not found" });
    }

    const faculty = facultyExists[0];

    await sql`
      UPDATE faculty
      SET active = ${active}
      WHERE faculty_id = ${id}
    `;

    res.status(200).json({
      success: true,
      message: `Faculty ${faculty.name} has been ${active ? 'activated' : 'deactivated'} successfully`,
      data: { faculty_id: id, name: faculty.name, employee_code: faculty.employee_code, active },
    });
  } catch (error) {
    console.error("Error toggling faculty active status:", error);
    res.status(500).json({ success: false, message: "Failed to update faculty status", error: error.message });
  }
};
