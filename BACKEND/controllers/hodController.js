import { sql } from '../config/db.js';

// Get Dashboard Summary Stats
export const getDashboardStats = async (req, res) => {
  try {
    const hodDepartmentId = req.user.department_id;

    // Get all stats in parallel
    const [
      totalStudentsResult,
      totalDuesResult,
      payableDuesResult,
      nonPayableDuesResult,
      totalAmountResult,
      studentsHavingDuesResult
    ] = await Promise.all([
      sql`SELECT COUNT(*) as count FROM students WHERE department_id = ${hodDepartmentId}`,
      sql`SELECT COUNT(*) as count FROM student_dues sd JOIN students s ON sd.student_roll_number = s.roll_number WHERE s.department_id = ${hodDepartmentId} AND sd.is_cleared = FALSE`,
      sql`SELECT COUNT(*) as count FROM student_dues sd JOIN students s ON sd.student_roll_number = s.roll_number WHERE s.department_id = ${hodDepartmentId} AND sd.is_payable = TRUE AND sd.is_cleared = FALSE`,
      sql`SELECT COUNT(*) as count FROM student_dues sd JOIN students s ON sd.student_roll_number = s.roll_number WHERE s.department_id = ${hodDepartmentId} AND sd.is_payable = FALSE AND sd.is_cleared = FALSE`,
      sql`SELECT COALESCE(SUM(calculate_outstanding_amount(sd.principal_amount, sd.interest_rate, sd.is_compounded, sd.due_clear_by_date::timestamptz, sd.amount_paid)), 0) as total FROM student_dues sd JOIN students s ON sd.student_roll_number = s.roll_number WHERE s.department_id = ${hodDepartmentId} AND sd.is_payable = TRUE AND sd.is_cleared = FALSE`,
      sql`SELECT COUNT(DISTINCT s.student_id) as count FROM students s JOIN student_dues sd ON s.roll_number = sd.student_roll_number WHERE s.department_id = ${hodDepartmentId} AND sd.is_cleared = FALSE`
    ]);

    res.json({
      success: true,
      data: {
        totalStudents: parseInt(totalStudentsResult[0].count),
        totalDues: parseInt(totalDuesResult[0].count),
        totalPayableDues: parseInt(payableDuesResult[0].count),
        totalNonPayableDues: parseInt(nonPayableDuesResult[0].count),
        totalDuesAmount: parseFloat(totalAmountResult[0].total),
        studentsHavingDues: parseInt(studentsHavingDuesResult[0].count)
      }
    });
  } catch (error) {
    console.error('Error fetching HOD dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics',
      error: error.message
    });
  }
};

// Get Academic Year Analytics
export const getAcademicYearAnalytics = async (req, res) => {
  try {
    const hodDepartmentId = req.user.department_id;

    const result = await sql`
      SELECT 
        ay.id,
        CONCAT(ay.beginning_year, '-', ay.ending_year) as academic_year,
        COUNT(DISTINCT CASE 
          WHEN sd.is_payable = TRUE AND sd.is_cleared = FALSE 
          THEN s.student_id 
        END) as students_with_payable_dues,
        COUNT(DISTINCT CASE 
          WHEN sd.is_payable = FALSE AND sd.is_cleared = FALSE 
          THEN s.student_id 
        END) as students_with_non_payable_dues
      FROM academic_year ay
      JOIN students s ON s.academic_year_id = ay.id
      LEFT JOIN student_dues sd ON sd.student_roll_number = s.roll_number
      WHERE s.department_id = ${hodDepartmentId}
      GROUP BY ay.id, ay.beginning_year, ay.ending_year
      HAVING COUNT(sd.id) > 0
      ORDER BY ay.beginning_year ASC
    `;

    const data = result.map(row => ({
      academicYear: row.academic_year,
      studentsWithPayableDues: parseInt(row.students_with_payable_dues),
      studentsWithNonPayableDues: parseInt(row.students_with_non_payable_dues)
    }));

    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error fetching academic year analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch academic year analytics',
      error: error.message
    });
  }
};

// Get Students with Active Dues
export const getStudentsWithDues = async (req, res) => {
  try {
    const hodDepartmentId = req.user.department_id;
    const { rollNumber, academicYear, startDate, endDate, page = 1, limit = 50 } = req.query;

    const offset = (page - 1) * limit;

    // Get total count
    const countResult = await sql`
      SELECT COUNT(DISTINCT s.student_id) as count
      FROM students s
      JOIN student_dues sd ON sd.student_roll_number = s.roll_number
      WHERE s.department_id = ${hodDepartmentId}
        AND sd.is_cleared = FALSE
        ${rollNumber ? sql`AND s.roll_number ILIKE ${`%${rollNumber}%`}` : sql``}
        ${academicYear ? sql`AND s.academic_year_id = ${parseInt(academicYear)}` : sql``}
        ${startDate ? sql`AND sd.created_at >= ${startDate}` : sql``}
        ${endDate ? sql`AND sd.created_at <= ${endDate}` : sql``}
    `;
    
    const totalRecords = parseInt(countResult[0].count);
    const totalPages = Math.ceil(totalRecords / limit);

    // Get students with pagination
    const students = await sql`
      SELECT 
        s.student_id,
        s.roll_number,
        s.name,
        CONCAT(ay.beginning_year, '-', ay.ending_year) as academic_year,
        s.branch,
        s.section,
        s.mobile,
        s.father_name,
        s.father_mobile,
        COUNT(sd.id) as active_dues_count
      FROM students s
      JOIN academic_year ay ON s.academic_year_id = ay.id
      JOIN student_dues sd ON sd.student_roll_number = s.roll_number
      WHERE s.department_id = ${hodDepartmentId}
        AND sd.is_cleared = FALSE
        ${rollNumber ? sql`AND s.roll_number ILIKE ${`%${rollNumber}%`}` : sql``}
        ${academicYear ? sql`AND s.academic_year_id = ${parseInt(academicYear)}` : sql``}
        ${startDate ? sql`AND sd.created_at >= ${startDate}` : sql``}
        ${endDate ? sql`AND sd.created_at <= ${endDate}` : sql``}
      GROUP BY s.student_id, s.roll_number, s.name, ay.beginning_year, ay.ending_year, s.branch, s.section, s.mobile, s.father_name, s.father_mobile
      ORDER BY s.roll_number ASC
      LIMIT ${parseInt(limit)} OFFSET ${offset}
    `;

    // Get dues for each student
    const studentsWithDues = await Promise.all(
      students.map(async (student) => {
        const dues = await sql`
          SELECT 
            sd.id as due_id,
            sd.principal_amount,
            sd.is_compounded,
            sd.interest_rate,
            sd.created_at,
            sd.amount_paid,
            calculate_compounded_amount(sd.principal_amount, sd.interest_rate, sd.is_compounded, sd.due_clear_by_date) as amount,
            sd.is_payable,
            CASE 
              WHEN sd.is_cleared = TRUE THEN 'Cleared'
              WHEN sd.permission_granted = TRUE THEN 'Permission Granted'
              ELSE 'Active'
            END as status,
            d.name as issuing_department,
            dt.type_name as due_type,
            sd.created_at as created_date,
            sd.due_clear_by_date as due_date,
            sd.due_description as description
          FROM student_dues sd
          JOIN due_types dt ON sd.due_type_id = dt.id
          LEFT JOIN departments d ON sd.added_by_department_id = d.id
          WHERE sd.student_roll_number = ${student.roll_number}
            AND sd.is_cleared = FALSE
          ORDER BY sd.created_at DESC
        `;
        
        return {
          rollNumber: student.roll_number,
          name: student.name,
          academicYear: student.academic_year,
          branch: student.branch,
          section: student.section,
          mobile: student.mobile,
          fatherName: student.father_name,
          fatherMobile: student.father_mobile,
          activeDuesCount: parseInt(student.active_dues_count),
          dues: dues.map(due => ({
            dueId: due.due_id,
            amount: due.amount,
            isPayable: due.is_payable,
            status: due.status,
            issuingDepartment: due.issuing_department,
            dueType: due.due_type,
            createdDate: due.created_date,
            dueDate: due.due_date,
            description: due.description
          }))
        };
      })
    );

    res.json({
      success: true,
      data: {
        students: studentsWithDues,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalRecords,
          recordsPerPage: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching students with dues:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch students with dues',
      error: error.message
    });
  }
};

// Export Students with Dues as CSV
export const exportStudentsWithDues = async (req, res) => {
  try {
    const hodDepartmentId = req.user.department_id;
    const { rollNumber, academicYear, startDate, endDate } = req.query;

    const students = await sql`
      SELECT DISTINCT
        s.roll_number,
        s.name,
        CONCAT(ay.beginning_year, '-', ay.ending_year) as class,
        s.section,
        s.mobile,
        s.father_name,
        s.father_mobile
      FROM students s
      JOIN academic_year ay ON s.academic_year_id = ay.id
      JOIN student_dues sd ON sd.student_roll_number = s.roll_number
      WHERE s.department_id = ${hodDepartmentId}
        AND sd.is_cleared = FALSE
        ${rollNumber ? sql`AND s.roll_number ILIKE ${`%${rollNumber}%`}` : sql``}
        ${academicYear ? sql`AND s.academic_year_id = ${parseInt(academicYear)}` : sql``}
        ${startDate ? sql`AND sd.created_at >= ${startDate}` : sql``}
        ${endDate ? sql`AND sd.created_at <= ${endDate}` : sql``}
      ORDER BY s.roll_number ASC
    `;

    // Build CSV
    const headers = ['Roll Number', 'Student Name', 'Class', 'Section', 'Phone Number', "Father's Name", "Father's Phone Number"];
    const csvRows = [headers.join(',')];

    students.forEach(row => {
      csvRows.push([
        row.roll_number,
        row.name,
        row.class,
        row.section,
        row.mobile,
        row.father_name,
        row.father_mobile
      ].join(','));
    });

    const csv = csvRows.join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=students-with-dues.csv');
    res.send(csv);
  } catch (error) {
    console.error('Error exporting students:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export students',
      error: error.message
    });
  }
};

// Get Whole Report (All Students)
export const getWholeReport = async (req, res) => {
  try {
    const hodDepartmentId = req.user.department_id;
    const { rollNumber, academicYear, startDate, endDate, page = 1, limit = 50 } = req.query;

    const offset = (page - 1) * limit;

    // Get total count
    const countResult = await sql`
      SELECT COUNT(*) as count
      FROM students s
      WHERE s.department_id = ${hodDepartmentId}
        ${rollNumber ? sql`AND s.roll_number ILIKE ${`%${rollNumber}%`}` : sql``}
        ${academicYear ? sql`AND s.academic_year_id = ${parseInt(academicYear)}` : sql``}
    `;
    
    const totalRecords = parseInt(countResult[0].count);
    const totalPages = Math.ceil(totalRecords / limit);

    // Get all students
    const students = await sql`
      SELECT 
        s.student_id,
        s.roll_number,
        s.name,
        CONCAT(ay.beginning_year, '-', ay.ending_year) as academic_year,
        s.branch,
        s.section,
        s.email,
        s.mobile,
        s.father_name,
        s.father_mobile
      FROM students s
      JOIN academic_year ay ON s.academic_year_id = ay.id
      WHERE s.department_id = ${hodDepartmentId}
        ${rollNumber ? sql`AND s.roll_number ILIKE ${`%${rollNumber}%`}` : sql``}
        ${academicYear ? sql`AND s.academic_year_id = ${parseInt(academicYear)}` : sql``}
      ORDER BY s.roll_number ASC
      LIMIT ${parseInt(limit)} OFFSET ${offset}
    `;

    // Get all dues for each student
    const studentsWithDues = await Promise.all(
      students.map(async (student) => {
        const activeDues = await sql`
          SELECT 
            sd.id as due_id,
            sd.principal_amount,
            calculate_compounded_amount(sd.principal_amount, sd.interest_rate, sd.is_compounded, sd.due_clear_by_date) as amount,
            sd.amount_paid,
            sd.is_payable,
            CASE 
              WHEN sd.is_cleared = TRUE THEN 'Cleared'
              WHEN sd.permission_granted = TRUE THEN 'Permission Granted'
              ELSE 'Active'
            END as status,
            d.name as issuing_department,
            dt.type_name as due_type,
            sd.created_at as created_date,
            sd.due_clear_by_date as due_date,
            sd.due_description as description,
            sd.is_cleared,
            sd.updated_at as cleared_date
          FROM student_dues sd
          JOIN due_types dt ON sd.due_type_id = dt.id
          LEFT JOIN departments d ON sd.added_by_department_id = d.id
          WHERE sd.student_roll_number = ${student.roll_number}
            AND sd.is_cleared = FALSE
            AND sd.permission_granted = FALSE
            ${startDate ? sql`AND sd.created_at >= ${startDate}` : sql``}
            ${endDate ? sql`AND sd.created_at <= ${endDate}` : sql``}
          ORDER BY sd.created_at DESC
        `;

        const clearedDues = await sql`
          SELECT 
            sd.id as due_id,
            sd.principal_amount,
            calculate_compounded_amount(sd.principal_amount, sd.interest_rate, sd.is_compounded, sd.due_clear_by_date) as amount,
            sd.amount_paid,
            sd.is_payable,
            CASE 
              WHEN sd.is_cleared = TRUE THEN 'Cleared'
              WHEN sd.permission_granted = TRUE THEN 'Permission Granted'
              ELSE 'Active'
            END as status,
            d.name as issuing_department,
            dt.type_name as due_type,
            sd.created_at as created_date,
            sd.due_clear_by_date as due_date,
            sd.due_description as description,
            sd.is_cleared,
            sd.updated_at as cleared_date
          FROM student_dues sd
          JOIN due_types dt ON sd.due_type_id = dt.id
          LEFT JOIN departments d ON sd.added_by_department_id = d.id
          WHERE sd.student_roll_number = ${student.roll_number}
            AND (sd.is_cleared = TRUE OR sd.permission_granted = TRUE)
            ${startDate ? sql`AND sd.created_at >= ${startDate}` : sql``}
            ${endDate ? sql`AND sd.created_at <= ${endDate}` : sql``}
          ORDER BY sd.updated_at DESC
        `;

        const formatDues = (dues) => dues.map(due => ({
          dueId: due.due_id,
          amount: due.amount,
          amountPaid: due.amount_paid,
          isPayable: due.is_payable,
          status: due.status,
          issuingDepartment: due.issuing_department,
          dueType: due.due_type,
          createdDate: due.created_date,
          dueDate: due.due_date,
          clearedDate: due.cleared_date,
          description: due.description
        }));

        return {
          rollNumber: student.roll_number,
          name: student.name,
          academicYear: student.academic_year,
          branch: student.branch,
          section: student.section,
          email: student.email,
          mobile: student.mobile,
          fatherName: student.father_name,
          fatherMobile: student.father_mobile,
          activeDues: formatDues(activeDues),
          clearedDues: formatDues(clearedDues),
          totalActiveDues: activeDues.length,
          totalClearedDues: clearedDues.length
        };
      })
    );

    res.json({
      success: true,
      data: {
        students: studentsWithDues,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalRecords,
          recordsPerPage: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching whole report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch whole report',
      error: error.message
    });
  }
};

// Get Student Dues History
export const getStudentDuesHistory = async (req, res) => {
  try {
    const hodDepartmentId = req.user.department_id;
    const { rollNumber } = req.params;

    // Verify student belongs to HOD's department
    const studentCheck = await sql`
      SELECT student_id, name, branch, section 
      FROM students 
      WHERE roll_number = ${rollNumber} 
        AND department_id = ${hodDepartmentId}
    `;

    if (studentCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Student not found in your department'
      });
    }

    const student = studentCheck[0];

    // Get all dues (active and cleared)
    const dues = await sql`
      SELECT 
        sd.id as due_id,
        sd.principal_amount,
        calculate_compounded_amount(sd.principal_amount, sd.interest_rate, sd.is_compounded, sd.due_clear_by_date) as amount,
        sd.amount_paid,
        sd.is_payable,
        CASE 
          WHEN sd.is_cleared = TRUE THEN 'Cleared'
          WHEN sd.permission_granted = TRUE THEN 'Permission Granted'
          ELSE 'Active'
        END as status,
        d.name as issuing_department,
        dt.type_name as due_type,
        sd.created_at as created_date,
        sd.due_clear_by_date as due_date,
        sd.due_description as description,
        sd.is_cleared,
        sd.updated_at as cleared_date
      FROM student_dues sd
      JOIN due_types dt ON sd.due_type_id = dt.id
      LEFT JOIN departments d ON sd.added_by_department_id = d.id
      WHERE sd.student_roll_number = ${rollNumber}
      ORDER BY sd.is_cleared ASC, sd.created_at DESC
    `;

    res.json({
      success: true,
      data: {
        student: {
          rollNumber,
          name: student.name,
          branch: student.branch,
          section: student.section
        },
        dues: dues.map(due => ({
          dueId: due.due_id,
          amount: due.amount,
          amountPaid: due.amount_paid,
          isPayable: due.is_payable,
          status: due.status,
          issuingDepartment: due.issuing_department,
          dueType: due.due_type,
          createdDate: due.created_date,
          dueDate: due.due_date,
          clearedDate: due.cleared_date,
          description: due.description
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching student dues history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch student dues history',
      error: error.message
    });
  }
};

// Get Academic Years
export const getAcademicYears = async (req, res) => {
  try {
    const result = await sql`
      SELECT 
        id,
        CONCAT(beginning_year, '-', ending_year) as label
      FROM academic_year
      ORDER BY beginning_year ASC
    `;

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error fetching academic years:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch academic years',
      error: error.message
    });
  }
};
