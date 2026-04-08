import { sql } from "../config/db.js";
import { deleteFromGoogleDrive, extractFileIdFromUrl, isDriveConfigured, uploadToGoogleDrive } from "../services/googleDriveService.js";
import { transaction } from "../utils/database.js";
import {
    buildNoDuesStatusRows,
    fetchActiveIssuerNamesForStudent,
    fetchStudentByRoll,
    renderNoDuesFormPdf,
} from "../utils/noDuesForm.js";

// Helper function to get operator's department/section info
const getOperatorInfo = async (userId) => {
  const result = await sql`
    SELECT 
      u.user_id,
      u.department_id,
      u.section_id,
      u.operator_type,
      u.access_level,
      d.name as department_name,
      s.name as section_name
    FROM users u
    LEFT JOIN departments d ON u.department_id = d.id
    LEFT JOIN sections s ON u.section_id = s.id
    WHERE u.user_id = ${userId}
    LIMIT 1
  `;
  
  return result.length > 0 ? result[0] : null;
};

// GET /api/operator/dashboard/stats
export const getDashboardStats = async (req, res) => {
  try {
    const userId = req.user?.user_id; // From auth middleware
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: "Unauthorized" 
      });
    }

    const operatorInfo = await getOperatorInfo(userId);
    
    if (!operatorInfo) {
      return res.status(404).json({ 
        success: false, 
        message: "Operator not found" 
      });
    }

    const { department_id, section_id, access_level, operator_type } = operatorInfo;
    
    // Determine if this operator handles faculty or students
    const isForFaculty = access_level === 'all_faculty';

    let stats;
    
    if (department_id) {
      // Department operator
      if (isForFaculty) {
        // Count faculty in department
        const facultyCount = await sql`
          SELECT COUNT(*) as count
          FROM faculty
          WHERE department_id = ${department_id}
        `;
        
        stats = {
          studentsUnderControl: parseInt(facultyCount[0].count)
        };
      } else {
        // Count students in department
        const studentCount = await sql`
          SELECT COUNT(*) as count
          FROM students
          WHERE department_id = ${department_id}
        `;
        
        stats = {
          studentsUnderControl: parseInt(studentCount[0].count)
        };
      }
      
      // Get dues statistics for department
      const duesStats = isForFaculty ? await sql`
        SELECT 
          COUNT(*) as total_dues,
          COUNT(CASE WHEN is_payable = true THEN 1 END) as total_payable,
          COUNT(CASE WHEN is_payable = false THEN 1 END) as total_non_payable,
          COALESCE(SUM(CASE WHEN is_payable = true THEN current_amount ELSE 0 END), 0) as total_amount
        FROM faculty_due
        WHERE added_by_department_id = ${department_id}
          AND is_cleared = false
      ` : await sql`
        SELECT
          COUNT(*) as total_dues,
          COUNT(CASE WHEN is_payable = true THEN 1 END) as total_payable,
          COUNT(CASE WHEN is_payable = false THEN 1 END) as total_non_payable,
          COALESCE(SUM(CASE WHEN is_payable = true THEN calculate_outstanding_amount(principal_amount, interest_rate, is_compounded, due_clear_by_date, amount_paid) ELSE 0 END), 0) as total_amount
        FROM student_dues
        WHERE added_by_department_id = ${department_id}
          AND is_cleared = false
      `;
      
      Object.assign(stats, {
        totalDues: parseInt(duesStats[0].total_dues),
        totalPayableDues: parseInt(duesStats[0].total_payable),
        totalNonPayableDues: parseInt(duesStats[0].total_non_payable),
        totalDuesAmount: parseFloat(duesStats[0].total_amount)
      });
      
    } else if (section_id) {
      // Section operator (e.g., SCHOLARSHIP, ACADEMIC)
      // These operators manage cross-department administrative duties
      if (isForFaculty) {
        // Count all faculty
        const facultyCount = await sql`
          SELECT COUNT(*) as count
          FROM faculty
        `;
        
        stats = {
          studentsUnderControl: parseInt(facultyCount[0].count)
        };
      } else {
        // Count all students (section operators like SCHOLARSHIP serve all students)
        const studentCount = await sql`
          SELECT COUNT(*) as count
          FROM students
        `;
        
        stats = {
          studentsUnderControl: parseInt(studentCount[0].count)
        };
      }
      
      // Get dues statistics for section
      const duesStats = isForFaculty ? await sql`
        SELECT 
          COUNT(*) as total_dues,
          COUNT(CASE WHEN is_payable = true THEN 1 END) as total_payable,
          COUNT(CASE WHEN is_payable = false THEN 1 END) as total_non_payable,
          COALESCE(SUM(CASE WHEN is_payable = true THEN current_amount ELSE 0 END), 0) as total_amount
        FROM faculty_due
        WHERE added_by_section_id = ${section_id}
          AND is_cleared = false
      ` : await sql`
        SELECT
          COUNT(*) as total_dues,
          COUNT(CASE WHEN is_payable = true THEN 1 END) as total_payable,
          COUNT(CASE WHEN is_payable = false THEN 1 END) as total_non_payable,
          COALESCE(SUM(CASE WHEN is_payable = true THEN calculate_outstanding_amount(principal_amount, interest_rate, is_compounded, due_clear_by_date, amount_paid) ELSE 0 END), 0) as total_amount
        FROM student_dues
        WHERE added_by_section_id = ${section_id}
          AND is_cleared = false
      `;
      
      Object.assign(stats, {
        totalDues: parseInt(duesStats[0].total_dues),
        totalPayableDues: parseInt(duesStats[0].total_payable),
        totalNonPayableDues: parseInt(duesStats[0].total_non_payable),
        totalDuesAmount: parseFloat(duesStats[0].total_amount)
      });
    }

    return res.status(200).json({ success: true, data: stats });
    
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Internal server error" 
    });
  }
};

// GET /api/operator/dashboard/monthly-data
export const getMonthlyData = async (req, res) => {
  try {
    const userId = req.user?.user_id;
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: "Unauthorized" 
      });
    }

    const operatorInfo = await getOperatorInfo(userId);
    
    if (!operatorInfo) {
      return res.status(404).json({ 
        success: false, 
        message: "Operator not found" 
      });
    }

    const { department_id, section_id } = operatorInfo;
    
    // Get last 6 months data
    const monthlyData = [];
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      const monthName = monthDate.toLocaleString('en-US', { month: 'short', year: '2-digit' });
      
      let whereClause = sql``;
      if (department_id) {
        whereClause = sql`added_by_department_id = ${department_id}`;
      } else if (section_id) {
        whereClause = sql`added_by_section_id = ${section_id}`;
      }
      
      // Active dues at end of month
      const activeDues = await sql`
        SELECT 
          COUNT(CASE WHEN is_payable = true THEN 1 END) as active_payable,
          COUNT(CASE WHEN is_payable = false THEN 1 END) as active_non_payable
        FROM student_dues
        WHERE ${whereClause}
          AND created_at <= ${monthEnd}
          AND (is_cleared = false OR updated_at > ${monthEnd})
      `;
      
      // Cleared dues during that month (includes permission-granted dues paid by students)
      const clearedDues = await sql`
        SELECT 
          COUNT(CASE WHEN is_payable = true THEN 1 END) as cleared_payable,
          COUNT(CASE WHEN is_payable = false THEN 1 END) as cleared_non_payable
        FROM student_dues
        WHERE ${whereClause}
          AND updated_at >= ${monthDate}
          AND updated_at <= ${monthEnd}
          AND is_cleared = true
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

// GET /api/operator/dashboard/academic-year-data
export const getAcademicYearData = async (req, res) => {
  try {
    const userId = req.user?.user_id;
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: "Unauthorized" 
      });
    }

    const operatorInfo = await getOperatorInfo(userId);
    
    if (!operatorInfo) {
      return res.status(404).json({ 
        success: false, 
        message: "Operator not found" 
      });
    }

    const { department_id, section_id } = operatorInfo;
    
    let whereClause = sql``;
    if (department_id) {
      whereClause = sql`sd.added_by_department_id = ${department_id}`;
    } else if (section_id) {
      whereClause = sql`sd.added_by_section_id = ${section_id}`;
    }
    
    // Get dues grouped by academic year (only years with active dues)
    const yearData = await sql`
      SELECT
        CONCAT(ay.beginning_year, '-', ay.ending_year) as year,
        COUNT(CASE WHEN sd.is_payable = true AND sd.is_cleared = false THEN 1 END) as active_payable,
        COUNT(CASE WHEN sd.is_payable = false AND sd.is_cleared = false THEN 1 END) as active_non_payable
      FROM student_dues sd
      JOIN students s ON sd.student_roll_number = s.roll_number
      JOIN academic_year ay ON s.academic_year_id = ay.id
      WHERE ${whereClause}
        AND sd.is_cleared = false
      GROUP BY ay.id, ay.beginning_year, ay.ending_year
      HAVING COUNT(CASE WHEN sd.is_cleared = false THEN 1 END) > 0
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

// GET /api/operator/due-types
export const getDueTypes = async (req, res) => {
  try {
    const dueTypes = await sql`
      SELECT id, type_name, description, is_for_student, requires_permission
      FROM due_types
      ORDER BY type_name ASC
    `;

    return res.status(200).json({ success: true, data: dueTypes });
    
  } catch (error) {
    console.error("Error fetching due types:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Internal server error" 
    });
  }
};

// POST /api/operator/dues
export const addDue = async (req, res) => {
  try {
    const userId = req.user?.user_id;
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: "Unauthorized" 
      });
    }

    const operatorInfo = await getOperatorInfo(userId);
    
    if (!operatorInfo) {
      return res.status(404).json({ 
        success: false, 
        message: "Operator not found" 
      });
    }

    const {
      roll_number,
      due_type_id,
      is_payable,
      amount,
      due_description,
      needs_original,
      needs_pdf,
      due_date,
      is_compounded,
      interest_rate,
      proof_link
    } = req.body;

    // Validation
    if (!roll_number || !due_type_id || is_payable === undefined || !due_date) {
      return res.status(400).json({ 
        success: false, 
        message: "Missing required fields" 
      });
    }

    if (is_payable && !amount) {
      return res.status(400).json({ 
        success: false, 
        message: "Amount is required for payable dues" 
      });
    }

    // Validate interest rate for compounded dues
    if (is_payable && is_compounded && (interest_rate === undefined || interest_rate === null || interest_rate === '')) {
      return res.status(400).json({ 
        success: false, 
        message: "Interest rate is required for payable dues with compound interest" 
      });
    }

    // Validate interest rate is a valid number
    if (interest_rate !== undefined && interest_rate !== null && interest_rate !== '') {
      const rate = parseFloat(interest_rate);
      if (isNaN(rate) || rate < 0 || rate > 1) {
        return res.status(400).json({ 
          success: false, 
          message: "Interest rate must be a decimal between 0 and 1 (e.g., 0.001 for 0.1% daily)" 
        });
      }
    }

    // Check if student/faculty exists
    const { access_level } = operatorInfo;
    const isForFaculty = access_level === 'all_faculty';
    
    if (isForFaculty) {
      // Check faculty
      const faculty = await sql`
        SELECT * FROM faculty WHERE employee_code = ${roll_number} LIMIT 1
      `;
      
      if (faculty.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: "Faculty not found" 
        });
      }
    } else {
      // Check student
      const student = await sql`
        SELECT * FROM students WHERE roll_number = ${roll_number} LIMIT 1
      `;
      
      if (student.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: "Student not found" 
        });
      }
    }

    // Insert due into appropriate table based on isForFaculty
    const result = isForFaculty ? await sql`
      INSERT INTO faculty_due (
        employee_code,
        added_by_user_id,
        added_by_department_id,
        added_by_section_id,
        due_type_id,
        is_payable,
        principal_amount,
        current_amount,
        due_description,
        due_clear_by_date,
        is_compounded,
        interest_rate,
        needs_original,
        needs_pdf,
        proof_drive_link
      ) VALUES (
        ${roll_number},
        ${userId},
        ${operatorInfo.department_id},
        ${operatorInfo.section_id},
        ${due_type_id},
        ${is_payable},
        ${is_payable ? amount : null},
        ${is_payable ? amount : null},
        ${due_description || null},
        ${due_date},
        ${is_payable ? (is_compounded || false) : null},
        ${is_payable && is_compounded ? interest_rate : null},
        ${needs_original || null},
        ${needs_pdf || null},
        ${proof_link || null}
      )
      RETURNING *
    ` : await sql`
      INSERT INTO student_dues (
        student_roll_number,
        added_by_user_id,
        added_by_department_id,
        added_by_section_id,
        due_type_id,
        is_payable,
        principal_amount,
        current_amount,
        due_description,
        due_clear_by_date,
        is_compounded,
        interest_rate,
        needs_original,
        needs_pdf,
        proof_drive_link
      ) VALUES (
        ${roll_number},
        ${userId},
        ${operatorInfo.department_id},
        ${operatorInfo.section_id},
        ${due_type_id},
        ${is_payable},
        ${is_payable ? amount : null},
        ${is_payable ? amount : null},
        ${due_description || null},
        ${due_date},
        ${is_payable ? (is_compounded || false) : null},
        ${is_payable && is_compounded ? interest_rate : null},
        ${needs_original || null},
        ${needs_pdf || null},
        ${proof_link || null}
      )
      RETURNING *
    `;

    return res.status(201).json({ 
      success: true, 
      data: result[0],
      message: "Due added successfully" 
    });
    
  } catch (error) {
    console.error("Error adding due:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Internal server error" 
    });
  }
};

// GET /api/operator/lookup-person/:code
export const lookupPerson = async (req, res) => {
  try {
    const userId = req.user?.user_id;
    const { code } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Code is required",
      });
    }

    const operatorInfo = await getOperatorInfo(userId);
    if (!operatorInfo) {
      return res.status(404).json({
        success: false,
        message: "Operator not found",
      });
    }

    const isForFaculty = operatorInfo.access_level === "all_faculty";

    if (isForFaculty) {
      const faculty = await sql`
        SELECT
          f.name,
          f.employee_code,
          d.name as department_name
        FROM faculty f
        LEFT JOIN departments d ON f.department_id = d.id
        WHERE f.employee_code = ${code}
        LIMIT 1
      `;

      if (faculty.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Faculty not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: faculty[0],
      });
    }

    const student = await sql`
      SELECT
        s.name,
        s.roll_number,
        s.branch,
        s.section,
        d.name as department_name
      FROM students s
      LEFT JOIN departments d ON s.department_id = d.id
      WHERE s.roll_number = ${code}
      LIMIT 1
    `;

    if (student.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: student[0],
    });
  } catch (error) {
    console.error("Error looking up person:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// POST /api/operator/dues/bulk-upload
export const bulkUploadDues = async (req, res) => {
  try {
    const userId = req.user?.user_id;
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: "Unauthorized" 
      });
    }

    const operatorInfo = await getOperatorInfo(userId);
    
    if (!operatorInfo) {
      return res.status(404).json({ 
        success: false, 
        message: "Operator not found" 
      });
    }

    const { dues } = req.body;

    if (!Array.isArray(dues) || dues.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid data format" 
      });
    }

    const successCount = 0;
    const failedCount = 0;
    const errors = [];
    
    // Check if this is for faculty or students
    const isForFaculty = operatorInfo.access_level === 'all_faculty';

    // Use transaction
    await transaction(async (sql) => {
      let success = 0;
      let failed = 0;
      
      for (let i = 0; i < dues.length; i++) {
        try {
          const due = dues[i];
          const rollNumber = due['Roll Number'] || due['Employee Code'];
          const dueTypeId = parseInt(due['Due Type ID']);
          
          // Handle human-readable Payment Type
          const paymentType = (due['Payment Type'] || '').toString().toLowerCase();
          const isPayable = paymentType === 'payable' || paymentType === '1' || parseInt(due['Is Payable (1=Yes, 0=No)']) === 1;
          
          const amount = due['Amount'] ? parseFloat(due['Amount']) : null;
          const description = due['Due Description'] || null;
          const dueDate = due['Due Date (YYYY-MM-DD)'];
          
          // Handle human-readable Interest Compounded
          const interestCompounded = (due['Interest Compounded'] || '').toString().toLowerCase();
          let isCompounded = null;
          if (isPayable) {
            if (interestCompounded === 'yes' || interestCompounded === '1') {
              isCompounded = true;
            } else if (interestCompounded === 'no' || interestCompounded === '0') {
              isCompounded = false;
            } else if (due['Is Compounded (1=Yes, 0=No, NULL for non-payable)']) {
              isCompounded = parseInt(due['Is Compounded (1=Yes, 0=No, NULL for non-payable)']) === 1;
            }
          }
          
          // Handle Interest Rate
          let interestRate = null;
          if (isPayable && isCompounded) {
            interestRate = due['Interest Rate (decimal)'] || due['Interest Rate'] || null;
            if (interestRate) {
              interestRate = parseFloat(interestRate);
              if (isNaN(interestRate) || interestRate < 0 || interestRate > 1) {
                throw new Error(`Invalid interest rate: ${interestRate}. Must be between 0 and 1 (e.g., 0.001 for 0.1%)`);
              }
            } else {
              throw new Error('Interest rate is required for compounded dues');
            }
          }
          
          // Handle human-readable Document Type
          const documentType = (due['Document Type'] || '').toString().toLowerCase();
          let needsOriginal = null;
          let needsPdf = null;
          
          if (documentType === 'original') {
            needsOriginal = true;
            needsPdf = false;
          } else if (documentType === 'pdf') {
            needsOriginal = false;
            needsPdf = true;
          } else {
            // Fallback to old format
            if (due['Needs Original (1=Yes, 0=No, NULL if not documentation)']) {
              needsOriginal = parseInt(due['Needs Original (1=Yes, 0=No, NULL if not documentation)']) === 1;
            }
            if (due['Needs PDF (1=Yes, 0=No, NULL if not documentation)']) {
              needsPdf = parseInt(due['Needs PDF (1=Yes, 0=No, NULL if not documentation)']) === 1;
            }
          }
          
          const proofLink = due['Proof Link'] || null;

          // Insert into appropriate table based on isForFaculty
          if (isForFaculty) {
            await sql`
              INSERT INTO faculty_due (
                employee_code,
                added_by_user_id,
                added_by_department_id,
                added_by_section_id,
                due_type_id,
                is_payable,
                principal_amount,
                current_amount,
                due_description,
                due_clear_by_date,
                is_compounded,
                interest_rate,
                needs_original,
                needs_pdf,
                proof_drive_link
              ) VALUES (
                ${rollNumber},
                ${userId},
                ${operatorInfo.department_id},
                ${operatorInfo.section_id},
                ${dueTypeId},
                ${isPayable},
                ${isPayable ? amount : null},
                ${isPayable ? amount : null},
                ${description},
                ${dueDate},
                ${isCompounded},
                ${interestRate},
                ${needsOriginal},
                ${needsPdf},
                ${proofLink}
              )
            `;
          } else {
            await sql`
              INSERT INTO student_dues (
                student_roll_number,
                added_by_user_id,
                added_by_department_id,
                added_by_section_id,
                due_type_id,
                is_payable,
                principal_amount,
                current_amount,
                due_description,
                due_clear_by_date,
                is_compounded,
                interest_rate,
                needs_original,
                needs_pdf,
                proof_drive_link
              ) VALUES (
                ${rollNumber},
                ${userId},
                ${operatorInfo.department_id},
                ${operatorInfo.section_id},
                ${dueTypeId},
                ${isPayable},
                ${isPayable ? amount : null},
                ${isPayable ? amount : null},
                ${description},
                ${dueDate},
                ${isCompounded},
                ${interestRate},
                ${needsOriginal},
                ${needsPdf},
                ${proofLink}
              )
            `;
          }
          
          success++;
        } catch (error) {
          failed++;
          errors.push({ row: i + 2, error: error.message }); // +2 because of header and 0-based index
        }
      }

      return { success, failed };
    }).then(({ success, failed }) => {
      return res.status(200).json({ 
        success: true, 
        data: {
          successCount: success,
          failedCount: failed,
          errors: errors.slice(0, 10) // Return first 10 errors only
        },
        message: `Successfully uploaded ${success} dues, ${failed} failed` 
      });
    });
    
  } catch (error) {
    console.error("Error in bulk upload:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Bulk upload failed, all changes rolled back" 
    });
  }
};

// GET /api/operator/dues/active
export const getActiveDues = async (req, res) => {
  try {
    const userId = req.user?.user_id;
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: "Unauthorized" 
      });
    }

    const operatorInfo = await getOperatorInfo(userId);
    
    if (!operatorInfo) {
      return res.status(404).json({ 
        success: false, 
        message: "Operator not found" 
      });
    }

    const { department_id, section_id } = operatorInfo;
    
    let whereClause = sql``;
    if (department_id) {
      whereClause = sql`sd.added_by_department_id = ${department_id}`;
    } else if (section_id) {
      whereClause = sql`sd.added_by_section_id = ${section_id}`;
    }
    
    const activeDues = await sql`
      SELECT
        sd.id,
        sd.student_roll_number,
        sd.due_type_id,
        sd.added_by_department_id,
        sd.added_by_section_id,
        sd.principal_amount,
        calculate_compounded_amount(sd.principal_amount, sd.interest_rate, sd.is_compounded, sd.due_clear_by_date) as current_amount,
        sd.amount_paid,
        sd.is_payable,
        sd.is_compounded,
        sd.interest_rate,
        sd.is_cleared,
        sd.permission_granted,
        sd.due_clear_by_date,
        sd.due_description,
        sd.proof_drive_link,
        sd.overall_status,
        sd.remarks,
        sd.needs_original,
        sd.needs_pdf,
        sd.created_at,
        sd.updated_at,
        dt.type_name as due_type,
        dt.requires_permission,
        s.name as student_name
      FROM student_dues sd
      JOIN due_types dt ON sd.due_type_id = dt.id
      LEFT JOIN students s ON sd.student_roll_number = s.roll_number
      WHERE ${whereClause}
        AND sd.is_cleared = FALSE
      ORDER BY sd.created_at DESC
    `;

    return res.status(200).json({ success: true, data: activeDues });
    
  } catch (error) {
    console.error("Error fetching active dues:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Internal server error" 
    });
  }
};

// GET /api/operator/dues/cleared
export const getClearedDues = async (req, res) => {
  try {
    const userId = req.user?.user_id;
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: "Unauthorized" 
      });
    }

    const operatorInfo = await getOperatorInfo(userId);
    
    if (!operatorInfo) {
      return res.status(404).json({ 
        success: false, 
        message: "Operator not found" 
      });
    }

    const { department_id, section_id } = operatorInfo;
    
    let whereClause = sql``;
    if (department_id) {
      whereClause = sql`sd.added_by_department_id = ${department_id}`;
    } else if (section_id) {
      whereClause = sql`sd.added_by_section_id = ${section_id}`;
    }
    
    const clearedDues = await sql`
      SELECT 
        sd.*,
        dt.type_name as due_type,
        s.name as student_name,
        u.username as cleared_by,
        sd.updated_at as cleared_at
      FROM student_dues sd
      JOIN due_types dt ON sd.due_type_id = dt.id
      LEFT JOIN students s ON sd.student_roll_number = s.roll_number
      LEFT JOIN users u ON sd.cleared_by_user_id = u.user_id
      WHERE ${whereClause}
        AND sd.is_cleared = TRUE
      ORDER BY sd.updated_at DESC
    `;

    return res.status(200).json({ success: true, data: clearedDues });
    
  } catch (error) {
    console.error("Error fetching cleared dues:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Internal server error" 
    });
  }
};

// PUT /api/operator/dues/:id/clear
export const clearDue = async (req, res) => {
  try {
    const userId = req.user?.user_id;
    const { id } = req.params;
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: "Unauthorized" 
      });
    }

    const operatorInfo = await getOperatorInfo(userId);
    
    if (!operatorInfo) {
      return res.status(404).json({ 
        success: false, 
        message: "Operator not found" 
      });
    }
    
    // Check if this is for faculty or students
    const isForFaculty = operatorInfo.access_level === 'all_faculty';

    // Check if due exists and is non-payable
    const due = isForFaculty
      ? await sql`SELECT * FROM faculty_due WHERE id = ${id} LIMIT 1`
      : await sql`SELECT * FROM student_dues WHERE id = ${id} LIMIT 1`;

    if (due.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Due not found" 
      });
    }

    if (due[0].is_payable) {
      return res.status(400).json({ 
        success: false, 
        message: "Cannot clear payable dues through this endpoint" 
      });
    }

    if (due[0].overall_status) {
      return res.status(400).json({ 
        success: false, 
        message: "Due is already cleared" 
      });
    }

    // Update the due in appropriate table
    const result = isForFaculty
      ? await sql`
          UPDATE faculty_due
          SET 
            is_cleared = true,
            permission_granted = true,
            overall_status = true,
            cleared_by_user_id = ${userId},
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ${id}
          RETURNING *
        `
      : await sql`
          UPDATE student_dues
          SET 
            is_cleared = true,
            permission_granted = true,
            overall_status = true,
            cleared_by_user_id = ${userId},
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ${id}
          RETURNING *
        `;

    return res.status(200).json({ 
      success: true, 
      data: result[0],
      message: "Due cleared successfully" 
    });
    
  } catch (error) {
    console.error("Error clearing due:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Internal server error" 
    });
  }
};

/**
 * Get pending document approvals
 */
export const getPendingApprovals = async (req, res) => {
  try {
    const userId = req.user?.user_id;
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: "Unauthorized" 
      });
    }

    const operatorInfo = await getOperatorInfo(userId);
    
    if (!operatorInfo) {
      return res.status(404).json({ 
        success: false, 
        message: "Operator not found" 
      });
    }

    const { department_id, section_id, operator_type } = operatorInfo;
    
    // Build filter based on operator type
    let filterCondition = sql``;
    
    if (operator_type === 'department' && department_id) {
      filterCondition = sql`AND sd.added_by_department_id = ${department_id}`;
    } else if (operator_type === 'section' && section_id) {
      filterCondition = sql`AND sd.added_by_section_id = ${section_id}`;
    }

    // Get all dues with uploaded documents pending approval
    const result = await sql`
      SELECT 
        sd.id,
        sd.student_roll_number,
        s.name as student_name,
        s.branch,
        s.section,
        s.email as student_email,
        s.mobile as student_mobile,
        sd.due_type_id,
        dt.type_name,
        dt.description as type_description,
        sd.is_payable,
        sd.needs_original,
        sd.needs_pdf,
        sd.due_clear_by_date,
        sd.due_description,
        sd.proof_drive_link,
        sd.overall_status,
        sd.remarks,
        sd.created_at,
        sd.updated_at,
        CASE 
          WHEN sd.added_by_department_id IS NOT NULL THEN d.name
          ELSE sec.name
        END as added_by_entity
      FROM student_dues sd
      JOIN students s ON sd.student_roll_number = s.roll_number
      JOIN due_types dt ON sd.due_type_id = dt.id
      LEFT JOIN departments d ON sd.added_by_department_id = d.id
      LEFT JOIN sections sec ON sd.added_by_section_id = sec.id
      WHERE sd.is_payable = FALSE
        AND (sd.needs_original = TRUE OR sd.needs_pdf = TRUE)
        AND sd.proof_drive_link IS NOT NULL
        AND sd.overall_status = FALSE
        AND sd.is_cleared = FALSE
        ${filterCondition}
      ORDER BY sd.updated_at DESC
    `;

    return res.status(200).json({ 
      success: true, 
      data: result,
      count: result.length
    });
    
  } catch (error) {
    console.error("Error fetching pending approvals:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Internal server error" 
    });
  }
};

/**
 * Approve uploaded document
 */
export const approveDocument = async (req, res) => {
  try {
    const userId = req.user?.user_id;
    const { dueId } = req.params;
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: "Unauthorized" 
      });
    }

    if (!dueId) {
      return res.status(400).json({ 
        success: false, 
        message: "Due ID is required" 
      });
    }

    // Verify operator has access to this due
    const operatorInfo = await getOperatorInfo(userId);
    
    if (!operatorInfo) {
      return res.status(404).json({ 
        success: false, 
        message: "Operator not found" 
      });
    }

    const { department_id, section_id, operator_type, access_level } = operatorInfo;
    const isForFaculty = access_level === 'all_faculty';

    // Build filter based on operator type
    let filterCondition = sql``;
    
    if (operator_type === 'department' && department_id) {
      filterCondition = isForFaculty
        ? sql`AND fd.added_by_department_id = ${department_id}`
        : sql`AND sd.added_by_department_id = ${department_id}`;
    } else if (operator_type === 'section' && section_id) {
      filterCondition = isForFaculty
        ? sql`AND fd.added_by_section_id = ${section_id}`
        : sql`AND sd.added_by_section_id = ${section_id}`;
    }

    // Check if due exists and operator has access
    const dueCheck = isForFaculty
      ? await sql`
          SELECT id, proof_drive_link, overall_status, is_cleared
          FROM faculty_due fd
          WHERE id = ${dueId}
            ${filterCondition}
        `
      : await sql`
          SELECT id, proof_drive_link, overall_status, is_cleared
          FROM student_dues sd
          WHERE id = ${dueId}
            ${filterCondition}
        `;

    if (dueCheck.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Due not found or access denied" 
      });
    }

    const due = dueCheck[0];

    if (!due.proof_drive_link) {
      return res.status(400).json({ 
        success: false, 
        message: "No document has been uploaded for this due" 
      });
    }

    if (due.is_cleared) {
      return res.status(400).json({ 
        success: false, 
        message: "This due is already cleared" 
      });
    }

    // Approve the document and clear the due in appropriate table
    const result = isForFaculty
      ? await sql`
          UPDATE faculty_due
          SET 
            is_cleared = TRUE,
            overall_status = TRUE,
            cleared_by_user_id = ${userId},
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ${dueId}
          RETURNING *
        `
      : await sql`
          UPDATE student_dues
          SET 
            is_cleared = TRUE,
            overall_status = TRUE,
            cleared_by_user_id = ${userId},
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ${dueId}
          RETURNING *
        `;

    return res.status(200).json({ 
      success: true, 
      data: result[0],
      message: "Document approved and due cleared successfully" 
    });
    
  } catch (error) {
    console.error("Error approving document:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Internal server error" 
    });
  }
};

/**
 * Reject uploaded document
 */
export const rejectDocument = async (req, res) => {
  try {
    const userId = req.user?.user_id;
    const { dueId } = req.params;
    const { rejection_reason } = req.body;
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: "Unauthorized" 
      });
    }

    if (!dueId) {
      return res.status(400).json({ 
        success: false, 
        message: "Due ID is required" 
      });
    }

    if (!rejection_reason || rejection_reason.trim() === '') {
      return res.status(400).json({ 
        success: false, 
        message: "Rejection reason is required" 
      });
    }

    // Verify operator has access to this due
    const operatorInfo = await getOperatorInfo(userId);
    
    if (!operatorInfo) {
      return res.status(404).json({ 
        success: false, 
        message: "Operator not found" 
      });
    }

    const { department_id, section_id, operator_type, access_level } = operatorInfo;
    const isForFaculty = access_level === 'all_faculty';

    // Build filter based on operator type
    let filterCondition = sql``;
    
    if (operator_type === 'department' && department_id) {
      filterCondition = isForFaculty
        ? sql`AND fd.added_by_department_id = ${department_id}`
        : sql`AND sd.added_by_department_id = ${department_id}`;
    } else if (operator_type === 'section' && section_id) {
      filterCondition = isForFaculty
        ? sql`AND fd.added_by_section_id = ${section_id}`
        : sql`AND sd.added_by_section_id = ${section_id}`;
    }

    // Check if due exists and operator has access from appropriate table
    const dueCheck = isForFaculty
      ? await sql`
          SELECT id, proof_drive_link, overall_status, is_cleared
          FROM faculty_due fd
          WHERE id = ${dueId}
            ${filterCondition}
        `
      : await sql`
          SELECT id, proof_drive_link, overall_status, is_cleared
          FROM student_dues sd
          WHERE id = ${dueId}
            ${filterCondition}
        `;

    if (dueCheck.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Due not found or access denied" 
      });
    }

    const due = dueCheck[0];

    if (!due.proof_drive_link) {
      return res.status(400).json({ 
        success: false, 
        message: "No document has been uploaded for this due" 
      });
    }

    if (due.is_cleared) {
      return res.status(400).json({ 
        success: false, 
        message: "This due is already cleared" 
      });
    }

    // Delete the file from Google Drive before clearing the link
    if (due.proof_drive_link) {
      const fileId = extractFileIdFromUrl(due.proof_drive_link);
      if (fileId) {
        try {
          const deleted = await deleteFromGoogleDrive(fileId);
          if (deleted) {
            console.log(`✓ Deleted rejected document from Google Drive: ${fileId}`);
          } else {
            console.warn(`⚠ Could not delete file from Google Drive: ${fileId}`);
          }
        } catch (deleteError) {
          console.error("Error deleting file from Google Drive:", deleteError.message);
          // Continue with rejection even if Drive delete fails
        }
      }
    }

    // Reject the document - clear the proof link so student/faculty can upload again
    const result = isForFaculty
      ? await sql`
          UPDATE faculty_due
          SET 
            remarks = ${rejection_reason},
            proof_drive_link = NULL,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ${dueId}
          RETURNING *
        `
      : await sql`
          UPDATE student_dues
          SET 
            remarks = ${rejection_reason},
            proof_drive_link = NULL,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ${dueId}
          RETURNING *
        `;

    return res.status(200).json({ 
      success: true, 
      data: result[0],
      message: "Document rejected. Student can upload again." 
    });
    
  } catch (error) {
    console.error("Error rejecting document:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Internal server error" 
    });
  }
};

// GET /api/operator/check-student-dues/:rollNumber
export const checkStudentDues = async (req, res) => {
  try {
    const userId = req.user?.user_id;
    const { rollNumber } = req.params;
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: "Unauthorized" 
      });
    }

    if (!rollNumber) {
      return res.status(400).json({ 
        success: false, 
        message: "Roll number is required" 
      });
    }

    const operatorInfo = await getOperatorInfo(userId);
    
    if (!operatorInfo) {
      return res.status(404).json({ 
        success: false, 
        message: "Operator not found" 
      });
    }

    // Check if student exists
    const student = await sql`
      SELECT 
        s.student_id,
        s.name,
        s.roll_number,
        s.email,
        s.branch,
        s.section,
        d.name as department_name
      FROM students s
      LEFT JOIN departments d ON s.department_id = d.id
      WHERE s.roll_number = ${rollNumber}
      LIMIT 1
    `;

    if (student.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Student not found" 
      });
    }

    // Get active dues
    const activeDues = await sql`
      SELECT
        sd.id,
        sd.due_type_id,
        sd.is_payable,
        calculate_compounded_amount(sd.principal_amount, sd.interest_rate, sd.is_compounded, sd.due_clear_by_date) as current_amount,
        sd.amount_paid,
        sd.permission_granted,
        sd.due_clear_by_date,
        sd.due_description,
        sd.overall_status,
        sd.is_cleared,
        dt.type_name as due_type,
        dt.requires_permission
      FROM student_dues sd
      JOIN due_types dt ON sd.due_type_id = dt.id
      WHERE sd.student_roll_number = ${rollNumber}
        AND sd.overall_status = false
      ORDER BY sd.due_clear_by_date ASC
    `;

    // Get cleared dues (includes permission-granted dues paid by students)
    const clearedDues = await sql`
      SELECT
        sd.id,
        sd.due_type_id,
        sd.is_payable,
        calculate_compounded_amount(sd.principal_amount, sd.interest_rate, sd.is_compounded, sd.due_clear_by_date) as current_amount,
        sd.amount_paid,
        sd.permission_granted,
        sd.due_clear_by_date,
        sd.due_description,
        sd.overall_status,
        sd.is_cleared,
        sd.updated_at as cleared_at,
        dt.type_name as due_type,
        dt.requires_permission
      FROM student_dues sd
      JOIN due_types dt ON sd.due_type_id = dt.id
      WHERE sd.student_roll_number = ${rollNumber}
        AND sd.overall_status = true
      ORDER BY sd.updated_at DESC
    `;

    const activeIssuerNames = await fetchActiveIssuerNamesForStudent(rollNumber);
    const noDuesForm = buildNoDuesStatusRows(activeIssuerNames);

    // Calculate summary
    const hasActiveDues = activeDues.length > 0;
    const totalActiveAmount = activeDues.reduce((sum, due) => {
      return sum + (due.is_payable ? parseFloat(due.current_amount || 0) - parseFloat(due.amount_paid || 0) : 0);
    }, 0);

    return res.status(200).json({ 
      success: true, 
      data: {
        student: student[0],
        activeDues,
        clearedDues,
        noDuesForm,
        summary: {
          hasActiveDues,
          totalActiveDues: activeDues.length,
          totalClearedDues: clearedDues.length,
          totalActiveAmount
        }
      }
    });
    
  } catch (error) {
    console.error("Error checking student dues:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Internal server error" 
    });
  }
};

// GET /api/operator/check-student-dues/:rollNumber/no-dues-form
export const getNoDuesFormPdfForStudent = async (req, res) => {
  try {
    const userId = req.user?.user_id;
    const { rollNumber } = req.params;
    const { table = "template" } = req.query;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!rollNumber) {
      return res.status(400).json({
        success: false,
        message: "Roll number is required",
      });
    }

    const student = await fetchStudentByRoll(rollNumber);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    const activeIssuerNames = await fetchActiveIssuerNamesForStudent(rollNumber);
    const noDuesForm = buildNoDuesStatusRows(activeIssuerNames);
    const isExtra = String(table).toLowerCase() === "extra";

    const rows = isExtra ? noDuesForm.extraRows : noDuesForm.templateRows;
    const tableTitle = isExtra
      ? "Additional Departments/Sections (Not in Form)"
      : null;
    const filename = `No_Dues_Form_${student.roll_number}_${isExtra ? "extra" : "main"}.pdf`;

    renderNoDuesFormPdf({
      res,
      student,
      rows,
      tableTitle,
      filename,
      includeMentorNote: !isExtra,
    });
  } catch (error) {
    console.error("Error generating no dues form PDF:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate PDF",
    });
  }
};

// POST /api/operator/dues/:id/grant-permission
export const grantPermission = async (req, res) => {
  try {
    console.log("=== Grant Permission Request ===");
    console.log("User ID:", req.user?.user_id);
    console.log("Due ID:", req.params.id);
    console.log("Body:", req.body);
    
    const userId = req.user?.user_id;
    const { id } = req.params;
    const { supporting_document_link } = req.body;
    
    if (!userId) {
      console.log("No user ID found");
      return res.status(401).json({ 
        success: false, 
        message: "Unauthorized" 
      });
    }

    // Validate supporting document link
    if (!supporting_document_link || !supporting_document_link.trim()) {
      console.log("No supporting document link provided");
      return res.status(400).json({ 
        success: false, 
        message: "Supporting document link is required to grant permission" 
      });
    }

    console.log("Fetching operator info...");
    const operatorInfo = await getOperatorInfo(userId);
    console.log("Operator info:", operatorInfo);
    
    if (!operatorInfo) {
      return res.status(404).json({ 
        success: false, 
        message: "Operator not found" 
      });
    }

    const { department_id, section_id, operator_type, access_level } = operatorInfo;
    const isForFaculty = access_level === 'all_faculty';
    
    // Build filter based on operator type
    let filterCondition = sql``;
    
    if (operator_type === 'department' && department_id) {
      filterCondition = sql`AND sd.added_by_department_id = ${department_id}`;
    } else if (operator_type === 'section' && section_id) {
      filterCondition = sql`AND sd.added_by_section_id = ${section_id}`;
    }

    // Check if due exists and operator has access from appropriate table
    let dueCheckQuery;
    
    if (isForFaculty) {
      dueCheckQuery = operator_type === 'department' && department_id
        ? sql`
            SELECT fd.*, dt.requires_permission, dt.type_name
            FROM faculty_due fd
            JOIN due_types dt ON fd.due_type_id = dt.id
            WHERE fd.id = ${id}
              AND fd.added_by_department_id = ${department_id}
          `
        : operator_type === 'section' && section_id
        ? sql`
            SELECT fd.*, dt.requires_permission, dt.type_name
            FROM faculty_due fd
            JOIN due_types dt ON fd.due_type_id = dt.id
            WHERE fd.id = ${id}
              AND fd.added_by_section_id = ${section_id}
          `
        : sql`
            SELECT fd.*, dt.requires_permission, dt.type_name
            FROM faculty_due fd
            JOIN due_types dt ON fd.due_type_id = dt.id
            WHERE fd.id = ${id}
          `;
    } else {
      dueCheckQuery = operator_type === 'department' && department_id
        ? sql`
            SELECT sd.*, dt.requires_permission, dt.type_name
            FROM student_dues sd
            JOIN due_types dt ON sd.due_type_id = dt.id
            WHERE sd.id = ${id}
              AND sd.added_by_department_id = ${department_id}
          `
        : operator_type === 'section' && section_id
        ? sql`
            SELECT sd.*, dt.requires_permission, dt.type_name
            FROM student_dues sd
            JOIN due_types dt ON sd.due_type_id = dt.id
            WHERE sd.id = ${id}
              AND sd.added_by_section_id = ${section_id}
          `
        : sql`
            SELECT sd.*, dt.requires_permission, dt.type_name
            FROM student_dues sd
            JOIN due_types dt ON sd.due_type_id = dt.id
            WHERE sd.id = ${id}
          `;
    }
    
    console.log("Executing due check query...");
    const dueCheck = await dueCheckQuery;
    console.log("Due check result:", dueCheck);

    if (dueCheck.length === 0) {
      console.log("Due not found or access denied");
      return res.status(404).json({ 
        success: false, 
        message: "Due not found or access denied" 
      });
    }

    const due = dueCheck[0];
    console.log("Due details:", {
      requires_permission: due.requires_permission,
      permission_granted: due.permission_granted
    });

    if (!due.requires_permission) {
      console.log("Due type doesn't require permission");
      return res.status(400).json({ 
        success: false, 
        message: "This due type does not require permission" 
      });
    }

    if (due.permission_granted) {
      console.log("Permission already granted");
      return res.status(400).json({ 
        success: false, 
        message: "Permission already granted for this due" 
      });
    }

    // Grant permission and save supporting document link in appropriate table
    console.log("Updating due with permission grant...");
    const result = isForFaculty
      ? await sql`
          UPDATE faculty_due
          SET 
            permission_granted = TRUE,
            overall_status = TRUE,
            supporting_document_link = ${supporting_document_link.trim()},
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ${id}
          RETURNING *
        `
      : await sql`
          UPDATE student_dues
          SET 
            permission_granted = TRUE,
            overall_status = TRUE,
            supporting_document_link = ${supporting_document_link.trim()},
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ${id}
          RETURNING *
        `;
    console.log("Update successful:", result[0]);

    return res.status(200).json({ 
      success: true, 
      data: result[0],
      message: "Permission granted successfully" 
    });
    
  } catch (error) {
    console.error("Error granting permission:", error);
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    return res.status(500).json({ 
      success: false, 
      message: "Internal server error",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Upload permission document directly to Google Drive
 * POST /api/operator/dues/:id/upload-permission-document
 */
export const uploadPermissionDocument = async (req, res) => {
  try {
    const userId = req.user?.user_id;
    const { id } = req.params; // due ID

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded. Please select a file." });
    }

    // Check if Google Drive is configured
    if (!isDriveConfigured()) {
      return res.status(503).json({
        error: "File upload service not configured. Please contact administrator.",
        details: "Google Drive API credentials are missing or incomplete."
      });
    }

    // Get operator info
    const operatorInfo = await getOperatorInfo(userId);
    if (!operatorInfo) {
      return res.status(403).json({ error: "Operator information not found" });
    }

    const { access_level } = operatorInfo;
    const isForFaculty = access_level === 'all_faculty';

    // Verify due ownership and status
    let dueResult;
    if (isForFaculty) {
      dueResult = await sql`
        SELECT 
          fd.id, 
          fd.employee_code,
          fd.permission_granted,
          fd.is_cleared,
          dt.requires_permission
        FROM faculty_due fd
        JOIN due_types dt ON fd.due_type_id = dt.id
        WHERE fd.id = ${id}
      `;
    } else {
      dueResult = await sql`
        SELECT 
          sd.id, 
          sd.student_roll_number,
          sd.permission_granted,
          sd.is_cleared,
          dt.requires_permission
        FROM student_dues sd
        JOIN due_types dt ON sd.due_type_id = dt.id
        WHERE sd.id = ${id}
      `;
    }

    if (dueResult.length === 0) {
      return res.status(404).json({ error: "Due not found" });
    }

    const due = dueResult[0];

    // Verify due requires permission
    if (!due.requires_permission) {
      return res.status(400).json({
        error: "This due does not require permission"
      });
    }

    if (due.permission_granted) {
      return res.status(400).json({
        error: "Permission already granted for this due"
      });
    }

    if (due.is_cleared) {
      return res.status(400).json({
        error: "This due is already cleared"
      });
    }

    // Upload file to Google Drive
    const identifier = isForFaculty ? due.employee_code : due.student_roll_number;
    const uploadResult = await uploadToGoogleDrive(
      req.file,
      id,
      identifier,
      'permission' // upload type: permission documents folder
    );

    console.log("Permission document uploaded to Google Drive:", {
      dueId: id,
      identifier,
      fileName: uploadResult.fileName,
      fileId: uploadResult.fileId,
      webViewLink: uploadResult.webViewLink
    });

    // Update the database: set permission_granted = TRUE and store the Drive link
    const tableName = isForFaculty ? 'faculty_due' : 'student_dues';
    if (isForFaculty) {
      await sql`
        UPDATE faculty_due
        SET permission_granted = TRUE,
            supporting_document_link = ${uploadResult.webViewLink},
            overall_status = TRUE,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
      `;
    } else {
      await sql`
        UPDATE student_dues
        SET permission_granted = TRUE,
            supporting_document_link = ${uploadResult.webViewLink},
            overall_status = TRUE,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
      `;
    }

    console.log(`Permission granted and document link saved for due ${id} in ${tableName}`);

    // Return the upload result
    return res.status(200).json({
      success: true,
      message: "Document uploaded and permission granted successfully",
      fileId: uploadResult.fileId,
      fileName: uploadResult.fileName,
      webViewLink: uploadResult.webViewLink,
      webContentLink: uploadResult.webContentLink,
      permissionGranted: true
    });

  } catch (error) {
    console.error("Error uploading permission document:", error);
    return res.status(500).json({
      error: "Failed to upload document",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
