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

const isDepartmentStudentOperator = (operatorInfo) => {
  return (
    operatorInfo?.operator_type === "department" &&
    Boolean(operatorInfo?.department_id) &&
    operatorInfo?.access_level !== "all_faculty"
  );
};

const isAlumniSectionOperator = (operatorInfo) => {
  const sectionName = String(operatorInfo?.section_name || "").trim();
  return (
    Boolean(operatorInfo?.section_id) &&
    operatorInfo?.access_level !== "all_faculty" &&
    /alumni|alumini/i.test(sectionName)
  );
};

const normalizeYesNoField = (value) => {
  const normalized = String(value || "")
    .trim()
    .toUpperCase();

  if (["Y", "YES", "TRUE", "1"].includes(normalized)) {
    return "Y";
  }

  if (["N", "NO", "FALSE", "0"].includes(normalized)) {
    return "N";
  }

  return null;
};

const isValidHttpUrl = (value) => {
  if (!value) {
    return true;
  }

  try {
    const url = new URL(String(value).trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

const resolveAlumniDueTypeId = async () => {
  const alumniType = await sql`
    SELECT id
    FROM due_types
    WHERE is_for_student = 1
      AND LOWER(type_name) LIKE '%alumni%'
    ORDER BY id ASC
    LIMIT 1
  `;

  if (alumniType[0]?.id) {
    return alumniType[0].id;
  }

  const documentationTypeId = await resolveDocumentationDueTypeId();
  if (documentationTypeId) {
    return documentationTypeId;
  }

  return resolveNonDocumentationDueTypeId();
};

const resolveDocumentationDueTypeId = async () => {
  const result = await sql`
    SELECT id
    FROM due_types
    WHERE is_for_student = 1
      AND LOWER(type_name) LIKE '%documentation%'
    ORDER BY id ASC
    LIMIT 1
  `;

  return result[0]?.id ?? null;
};

const resolveNonDocumentationDueTypeId = async () => {
  const result = await sql`
    SELECT id
    FROM due_types
    WHERE is_for_student = 1
      AND LOWER(type_name) NOT LIKE '%documentation%'
    ORDER BY id ASC
    LIMIT 1
  `;

  return result[0]?.id ?? null;
};

const normalizeDepartmentDueType = (value = "") => {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-");
};

const isNonDocumentationDepartmentDue = (value = "") => {
  return normalizeDepartmentDueType(value) === "non-documentation";
};

const getNextDepartmentDueSerialNo = async () => {
  await sql`
    CREATE SEQUENCE IF NOT EXISTS department_dues_serial_no_seq
    START WITH 1
    INCREMENT BY 1
  `;

  await sql`
    SELECT setval(
      'department_dues_serial_no_seq',
      GREATEST(
        COALESCE((SELECT MAX(serial_no) FROM department_dues), 0),
        COALESCE((SELECT last_value FROM department_dues_serial_no_seq), 0),
        1
      ),
      true
    )
  `;

  const nextSerial = await sql`
    SELECT nextval('department_dues_serial_no_seq') as serial_no
  `;

  return parseInt(nextSerial[0].serial_no, 10);
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

    const useAlumniDuesTable = isAlumniSectionOperator(operatorInfo);

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
      const useDepartmentDuesTable = isDepartmentStudentOperator(operatorInfo);
      const duesStats = isForFaculty ? await sql`
        SELECT 
          COUNT(*) as total_dues,
          COUNT(CASE WHEN is_payable = true THEN 1 END) as total_payable,
          COUNT(CASE WHEN is_payable = false THEN 1 END) as total_non_payable,
          COALESCE(SUM(CASE WHEN is_payable = true THEN current_amount ELSE 0 END), 0) as total_amount
        FROM faculty_due
        WHERE added_by_department_id = ${department_id}
          AND is_cleared = false
      ` : useDepartmentDuesTable ? await sql`
        SELECT
          COUNT(*) as total_dues,
          COUNT(CASE WHEN is_payable = true THEN 1 END) as total_payable,
          COUNT(CASE WHEN is_payable = false THEN 1 END) as total_non_payable,
          COALESCE(SUM(CASE WHEN is_payable = true THEN calculate_outstanding_amount(principal_amount, interest_rate, is_compounded, due_clear_by_date, amount_paid) ELSE 0 END), 0) as total_amount
        FROM department_dues
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
      ` : useAlumniDuesTable ? await sql`
        SELECT
          COUNT(*) as total_dues,
          COUNT(CASE WHEN is_payable = true THEN 1 END) as total_payable,
          COUNT(CASE WHEN is_payable = false THEN 1 END) as total_non_payable,
          COALESCE(SUM(CASE WHEN is_payable = true THEN calculate_outstanding_amount(principal_amount, interest_rate, is_compounded, due_clear_by_date, amount_paid) ELSE 0 END), 0) as total_amount
        FROM alumni_dues
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
    const useDepartmentDuesTable = isDepartmentStudentOperator(operatorInfo);
    const useAlumniDuesTable = isAlumniSectionOperator(operatorInfo);
    
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
      const activeDues = useDepartmentDuesTable ? await sql`
        SELECT 
          COUNT(CASE WHEN is_payable = true THEN 1 END) as active_payable,
          COUNT(CASE WHEN is_payable = false THEN 1 END) as active_non_payable
        FROM department_dues
        WHERE ${whereClause}
          AND created_at <= ${monthEnd}
          AND (is_cleared = false OR updated_at > ${monthEnd})
      ` : useAlumniDuesTable ? await sql`
        SELECT 
          COUNT(CASE WHEN is_payable = true THEN 1 END) as active_payable,
          COUNT(CASE WHEN is_payable = false THEN 1 END) as active_non_payable
        FROM alumni_dues
        WHERE ${whereClause}
          AND created_at <= ${monthEnd}
          AND (is_cleared = false OR updated_at > ${monthEnd})
      ` : await sql`
        SELECT 
          COUNT(CASE WHEN is_payable = true THEN 1 END) as active_payable,
          COUNT(CASE WHEN is_payable = false THEN 1 END) as active_non_payable
        FROM student_dues
        WHERE ${whereClause}
          AND created_at <= ${monthEnd}
          AND (is_cleared = false OR updated_at > ${monthEnd})
      `;
      
      // Cleared dues during that month (includes permission-granted dues paid by students)
      const clearedDues = useDepartmentDuesTable ? await sql`
        SELECT 
          COUNT(CASE WHEN is_payable = true THEN 1 END) as cleared_payable,
          COUNT(CASE WHEN is_payable = false THEN 1 END) as cleared_non_payable
        FROM department_dues
        WHERE ${whereClause}
          AND updated_at >= ${monthDate}
          AND updated_at <= ${monthEnd}
          AND is_cleared = true
      ` : useAlumniDuesTable ? await sql`
        SELECT 
          COUNT(CASE WHEN is_payable = true THEN 1 END) as cleared_payable,
          COUNT(CASE WHEN is_payable = false THEN 1 END) as cleared_non_payable
        FROM alumni_dues
        WHERE ${whereClause}
          AND updated_at >= ${monthDate}
          AND updated_at <= ${monthEnd}
          AND is_cleared = true
      ` : await sql`
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
    const useDepartmentDuesTable = isDepartmentStudentOperator(operatorInfo);
    const useAlumniDuesTable = isAlumniSectionOperator(operatorInfo);
    
    let whereClause = sql``;
    if (department_id) {
      whereClause = sql`sd.added_by_department_id = ${department_id}`;
    } else if (section_id) {
      whereClause = sql`sd.added_by_section_id = ${section_id}`;
    }

    const alumniWhereClause = section_id
      ? sql`ad.added_by_section_id = ${section_id}`
      : sql`FALSE`;

    // Get dues grouped by academic year (only years with active dues)
    const yearData = useDepartmentDuesTable ? await sql`
      SELECT
        CONCAT(ay.beginning_year, '-', ay.ending_year) as year,
        COUNT(CASE WHEN sd.is_payable = true AND sd.is_cleared = false THEN 1 END) as active_payable,
        COUNT(CASE WHEN sd.is_payable = false AND sd.is_cleared = false THEN 1 END) as active_non_payable
      FROM department_dues sd
      JOIN students s ON sd.student_roll_number = s.roll_number
      JOIN academic_year ay ON s.academic_year_id = ay.id
      WHERE ${whereClause}
        AND sd.is_cleared = false
      GROUP BY ay.id, ay.beginning_year, ay.ending_year
      HAVING COUNT(CASE WHEN sd.is_cleared = false THEN 1 END) > 0
      ORDER BY ay.beginning_year DESC
    ` : useAlumniDuesTable ? await sql`
      SELECT
        CONCAT(ay.beginning_year, '-', ay.ending_year) as year,
        COUNT(CASE WHEN ad.is_payable = true AND ad.is_cleared = false THEN 1 END) as active_payable,
        COUNT(CASE WHEN ad.is_payable = false AND ad.is_cleared = false THEN 1 END) as active_non_payable
      FROM alumni_dues ad
      JOIN academic_year ay ON ad.academic_year_id = ay.id
      WHERE ${alumniWhereClause}
        AND ad.is_cleared = false
      GROUP BY ay.id, ay.beginning_year, ay.ending_year
      HAVING COUNT(CASE WHEN ad.is_cleared = false THEN 1 END) > 0
      ORDER BY ay.beginning_year DESC
    ` : await sql`
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

// GET /api/operator/academic-years
export const getAcademicYearsForOperator = async (req, res) => {
  try {
    const academicYears = await sql`
      SELECT
        id,
        beginning_year,
        ending_year,
        CONCAT(beginning_year, '-', ending_year) as label
      FROM academic_year
      ORDER BY beginning_year DESC
    `;

    return res.status(200).json({ success: true, data: academicYears });
  } catch (error) {
    console.error("Error fetching academic years for operator:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// POST /api/operator/dues/alumni/bulk-create
export const createAlumniDuesForAcademicYear = async (req, res) => {
  try {
    const userId = req.user?.user_id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const operatorInfo = await getOperatorInfo(userId);

    if (!operatorInfo) {
      return res.status(404).json({
        success: false,
        message: "Operator not found",
      });
    }

    if (!isAlumniSectionOperator(operatorInfo)) {
      return res.status(403).json({
        success: false,
        message: "Only Alumni section operators can use this action",
      });
    }

    const { academic_year_id } = req.body;

    const parsedAcademicYearId = Number.parseInt(academic_year_id, 10);
    if (!parsedAcademicYearId || Number.isNaN(parsedAcademicYearId)) {
      return res.status(400).json({
        success: false,
        message: "academic_year_id is required",
      });
    }

    const academicYear = await sql`
      SELECT id, beginning_year, ending_year
      FROM academic_year
      WHERE id = ${parsedAcademicYearId}
      LIMIT 1
    `;

    if (academicYear.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Academic year not found",
      });
    }

    const dueTypeId = await resolveAlumniDueTypeId();
    if (!dueTypeId) {
      return res.status(400).json({
        success: false,
        message:
          "Could not resolve a student due type for Alumni dues. Please configure due_types first.",
      });
    }

    const academicYearLabel = `${academicYear[0].beginning_year}-${academicYear[0].ending_year}`;
    const campaignKey = `ALUMNI_BULK_AY_${parsedAcademicYearId}`;
    const dueDate = `${academicYear[0].ending_year}-12-31`;
    const dueDescription = `ALUMINI FORM DUE (${academicYearLabel}) - Please submit Alumni form details from student portal`;

    const totalStudentsResult = await sql`
      SELECT COUNT(*) as count
      FROM students
      WHERE academic_year_id = ${parsedAcademicYearId}
    `;
    const totalStudents = parseInt(totalStudentsResult[0]?.count || 0, 10);

    if (totalStudents === 0) {
      return res.status(200).json({
        success: true,
        data: {
          academic_year_id: parsedAcademicYearId,
          academic_year_label: academicYearLabel,
          total_students: 0,
          created_count: 0,
          skipped_count: 0,
          campaign_key: campaignKey,
        },
        message: "No students found for the selected academic year",
      });
    }

    const insertedDues = await sql`
      INSERT INTO alumni_dues (
        student_roll_number,
        added_by_user_id,
        added_by_section_id,
        due_type_id,
        academic_year_id,
        due_clear_by_date,
        is_payable,
        principal_amount,
        current_amount,
        amount_paid,
        permission_granted,
        overall_status,
        due_description,
        remarks,
        status_of_registration_with_alumni_portal,
        linkedin_profile_link,
        placement_status,
        proof_of_placement,
        planning_for_higher_education,
        proof_of_higher_education,
        campaign_key,
        is_form_submitted,
        submitted_at
      )
      SELECT
        s.roll_number,
        ${userId},
        ${operatorInfo.section_id},
        ${dueTypeId},
        ${parsedAcademicYearId},
        ${dueDate},
        FALSE,
        NULL,
        NULL,
        0,
        FALSE,
        FALSE,
        ${dueDescription},
        NULL,
        'N',
        '',
        'N',
        NULL,
        'N',
        NULL,
        ${campaignKey},
        FALSE,
        NULL
      FROM students s
      WHERE s.academic_year_id = ${parsedAcademicYearId}
        AND NOT EXISTS (
          SELECT 1
          FROM alumni_dues ad
          WHERE ad.student_roll_number = s.roll_number
            AND ad.added_by_section_id = ${operatorInfo.section_id}
            AND ad.is_cleared = FALSE
        )
      ON CONFLICT (student_roll_number, added_by_section_id)
      WHERE is_cleared = FALSE
      DO NOTHING
      RETURNING id
    `;

    const createdCount = insertedDues.length;
    const skippedCount = totalStudents - createdCount;

    return res.status(201).json({
      success: true,
      data: {
        academic_year_id: parsedAcademicYearId,
        academic_year_label: academicYearLabel,
        total_students: totalStudents,
        created_count: createdCount,
        skipped_count: skippedCount,
        campaign_key: campaignKey,
        due_type_id: dueTypeId,
      },
      message: `Created ${createdCount} Alumni dues for ${academicYearLabel}. Skipped ${skippedCount} students who already have an active Alumni due.`,
    });
  } catch (error) {
    console.error("Error creating Alumni dues for academic year:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// GET /api/operator/dues/alumni/export-data
export const getAlumniDuesExportData = async (req, res) => {
  try {
    const userId = req.user?.user_id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const operatorInfo = await getOperatorInfo(userId);

    if (!operatorInfo) {
      return res.status(404).json({
        success: false,
        message: 'Operator not found',
      });
    }

    if (!isAlumniSectionOperator(operatorInfo)) {
      return res.status(403).json({
        success: false,
        message: 'Only Alumni section operators can export this data',
      });
    }

    const {
      academic_year_id,
      form_status,
      roll_number,
      registration_status,
      placement_status,
      higher_education_status,
    } = req.query;

    const parsedAcademicYearId = academic_year_id
      ? Number.parseInt(academic_year_id, 10)
      : null;

    const normalizedFormStatus = String(form_status || "all")
      .trim()
      .toLowerCase();

    if (!["all", "submitted", "pending"].includes(normalizedFormStatus)) {
      return res.status(400).json({
        success: false,
        message: "form_status must be one of: all, submitted, pending",
      });
    }

    const normalizedRegistrationStatus = registration_status
      ? normalizeYesNoField(registration_status)
      : null;
    const normalizedPlacementStatus = placement_status
      ? normalizeYesNoField(placement_status)
      : null;
    const normalizedHigherEducationStatus = higher_education_status
      ? normalizeYesNoField(higher_education_status)
      : null;

    if (registration_status && !normalizedRegistrationStatus) {
      return res.status(400).json({
        success: false,
        message: "registration_status must be Y or N",
      });
    }

    if (placement_status && !normalizedPlacementStatus) {
      return res.status(400).json({
        success: false,
        message: "placement_status must be Y or N",
      });
    }

    if (higher_education_status && !normalizedHigherEducationStatus) {
      return res.status(400).json({
        success: false,
        message: "higher_education_status must be Y or N",
      });
    }

    const normalizedRollNumber = String(roll_number || "")
      .trim()
      .toUpperCase();

    if (academic_year_id && (!parsedAcademicYearId || Number.isNaN(parsedAcademicYearId))) {
      return res.status(400).json({
        success: false,
        message: 'academic_year_id must be a valid number',
      });
    }

    const rows = await sql`
      SELECT
        ad.id,
        ad.student_roll_number,
        s.name as student_name,
        s.email as student_email,
        s.mobile as student_mobile,
        s.branch,
        s.section,
        CONCAT(ay.beginning_year, '-', ay.ending_year) as academic_year,
        ad.due_clear_by_date,
        ad.is_form_submitted,
        ad.submitted_at,
        ad.is_cleared,
        ad.status_of_registration_with_alumni_portal,
        ad.linkedin_profile_link,
        ad.placement_status,
        ad.proof_of_placement,
        ad.planning_for_higher_education,
        ad.proof_of_higher_education,
        ad.campaign_key,
        ad.created_at,
        ad.updated_at
      FROM alumni_dues ad
      LEFT JOIN students s ON ad.student_roll_number = s.roll_number
      LEFT JOIN academic_year ay ON ad.academic_year_id = ay.id
      WHERE ad.added_by_section_id = ${operatorInfo.section_id}
        ${parsedAcademicYearId ? sql`AND ad.academic_year_id = ${parsedAcademicYearId}` : sql``}
        ${normalizedRollNumber ? sql`AND ad.student_roll_number ILIKE ${`%${normalizedRollNumber}%`}` : sql``}
        ${normalizedFormStatus === "submitted" ? sql`AND ad.is_form_submitted = TRUE` : sql``}
        ${normalizedFormStatus === "pending" ? sql`AND ad.is_form_submitted = FALSE` : sql``}
        ${normalizedRegistrationStatus ? sql`AND ad.status_of_registration_with_alumni_portal = ${normalizedRegistrationStatus}` : sql``}
        ${normalizedPlacementStatus ? sql`AND ad.placement_status = ${normalizedPlacementStatus}` : sql``}
        ${normalizedHigherEducationStatus ? sql`AND ad.planning_for_higher_education = ${normalizedHigherEducationStatus}` : sql``}
      ORDER BY ad.created_at DESC, ad.student_roll_number ASC
    `;

    const submittedCount = rows.filter((row) => row.is_form_submitted).length;

    return res.status(200).json({
      success: true,
      data: rows,
      summary: {
        total_records: rows.length,
        submitted_records: submittedCount,
        pending_records: rows.length - submittedCount,
        applied_filters: {
          academic_year_id: parsedAcademicYearId,
          form_status: normalizedFormStatus,
          roll_number: normalizedRollNumber || null,
          registration_status: normalizedRegistrationStatus,
          placement_status: normalizedPlacementStatus,
          higher_education_status: normalizedHigherEducationStatus,
        },
      },
    });
  } catch (error) {
    console.error('Error exporting alumni dues data:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// POST /api/operator/dues/alumni/reopen-forms
export const reopenAlumniFormsForStudents = async (req, res) => {
  try {
    const userId = req.user?.user_id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const operatorInfo = await getOperatorInfo(userId);

    if (!operatorInfo) {
      return res.status(404).json({
        success: false,
        message: "Operator not found",
      });
    }

    if (!isAlumniSectionOperator(operatorInfo)) {
      return res.status(403).json({
        success: false,
        message: "Only Alumni section operators can use this action",
      });
    }

    const { roll_numbers } = req.body;

    const rawRollNumbers = Array.isArray(roll_numbers)
      ? roll_numbers
      : typeof roll_numbers === "string"
        ? roll_numbers.split(/[\s,;\n\r\t]+/)
        : [];

    const normalizedRollNumbers = [
      ...new Set(
        rawRollNumbers
          .map((value) => String(value || "").trim().toUpperCase())
          .filter((value) => value.length > 0),
      ),
    ];

    if (normalizedRollNumbers.length === 0) {
      return res.status(400).json({
        success: false,
        message: "roll_numbers is required",
      });
    }

    if (normalizedRollNumbers.length > 2000) {
      return res.status(400).json({
        success: false,
        message: "Maximum 2000 roll numbers allowed per request",
      });
    }

    const updatedRows = await sql`
      WITH latest_due AS (
        SELECT DISTINCT ON (ad.student_roll_number)
          ad.id,
          ad.student_roll_number
        FROM alumni_dues ad
        WHERE ad.added_by_section_id = ${operatorInfo.section_id}
          AND ad.student_roll_number = ANY(${normalizedRollNumbers})
        ORDER BY
          ad.student_roll_number,
          CASE WHEN ad.is_cleared = FALSE THEN 0 ELSE 1 END,
          ad.created_at DESC,
          ad.id DESC
      )
      UPDATE alumni_dues ad
      SET
        status_of_registration_with_alumni_portal = 'N',
        linkedin_profile_link = '',
        placement_status = 'N',
        proof_of_placement = NULL,
        planning_for_higher_education = 'N',
        proof_of_higher_education = NULL,
        is_form_submitted = FALSE,
        submitted_at = NULL,
        permission_granted = FALSE,
        overall_status = FALSE,
        is_cleared = FALSE,
        cleared_by_user_id = NULL,
        remarks = NULL,
        updated_at = CURRENT_TIMESTAMP
      FROM latest_due
      WHERE ad.id = latest_due.id
      RETURNING ad.student_roll_number
    `;

    const reopenedRollNumbers = [
      ...new Set(updatedRows.map((row) => row.student_roll_number)),
    ];

    const reopenedSet = new Set(reopenedRollNumbers);
    const notFoundRollNumbers = normalizedRollNumbers.filter(
      (roll) => !reopenedSet.has(roll),
    );

    return res.status(200).json({
      success: true,
      data: {
        requested_count: normalizedRollNumbers.length,
        reopened_count: reopenedRollNumbers.length,
        reopened_roll_numbers: reopenedRollNumbers,
        not_found_roll_numbers: notFoundRollNumbers,
      },
      message: `Alumni form reopened for ${reopenedRollNumbers.length} student(s).`,
    });
  } catch (error) {
    console.error("Error reopening alumni forms:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
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
      proof_link,
      incident_date,
      student_name,
      program,
      branch,
      year,
      semester,
      section_name,
      location_type,
      location_name,
      room_no,
      course_activity_usage_context,
      staff_reporting_name,
      staff_employee_id,
      staff_designation,
      item_equipment,
      issue_type,
      approx_value,
      form_remarks,
      documentation_type,
      documentation_type_other
    } = req.body;

    const isDepartmentStudentFlow = isDepartmentStudentOperator(operatorInfo);

    // Validation for section/faculty legacy flow
    if (!isDepartmentStudentFlow && (!roll_number || !due_type_id || is_payable === undefined || !due_date)) {
      return res.status(400).json({ 
        success: false, 
        message: "Missing required fields" 
      });
    }

    if (!isDepartmentStudentFlow && is_payable && !amount) {
      return res.status(400).json({ 
        success: false, 
        message: "Amount is required for payable dues" 
      });
    }

    // Validate interest rate for compounded dues
    if (!isDepartmentStudentFlow && is_payable && is_compounded && (interest_rate === undefined || interest_rate === null || interest_rate === '')) {
      return res.status(400).json({ 
        success: false, 
        message: "Interest rate is required for payable dues with compound interest" 
      });
    }

    // Validate interest rate is a valid number
    if (!isDepartmentStudentFlow && interest_rate !== undefined && interest_rate !== null && interest_rate !== '') {
      const rate = parseFloat(interest_rate);
      if (isNaN(rate) || rate < 0 || rate > 1) {
        return res.status(400).json({ 
          success: false, 
          message: "Interest rate must be a decimal between 0 and 1 (e.g., 0.001 for 0.1% daily)" 
        });
      }
    }

    if (isDepartmentStudentFlow) {
      const requiredDepartmentFields = [
        { label: "roll_number", value: roll_number },
        { label: "incident_date", value: incident_date },
        { label: "student_name", value: student_name },
        { label: "program", value: program },
        { label: "branch", value: branch },
        { label: "year", value: year },
        { label: "semester", value: semester },
        { label: "section_name", value: section_name },
        { label: "location_type", value: location_type },
        { label: "location_name", value: location_name },
        { label: "room_no", value: room_no },
        { label: "course_activity_usage_context", value: course_activity_usage_context },
        { label: "staff_reporting_name", value: staff_reporting_name },
        { label: "staff_employee_id", value: staff_employee_id },
        { label: "staff_designation", value: staff_designation },
        { label: "item_equipment", value: item_equipment },
        { label: "issue_type", value: issue_type },
        { label: "form_remarks", value: form_remarks },
        { label: "documentation_type", value: documentation_type }
      ];

      const missingField = requiredDepartmentFields.find((field) => {
        if (field.value === undefined || field.value === null) {
          return true;
        }
        if (typeof field.value === "string") {
          return field.value.trim() === "";
        }
        return false;
      });

      if (missingField) {
        return res.status(400).json({
          success: false,
          message: `Missing required field: ${missingField.label}`,
        });
      }

      const allowedYears = new Set(["1", "2", "3", "4"]);
      const allowedSemesters = new Set(["1", "2"]);
      const normalizedYear = String(year).trim();
      const normalizedSemester = String(semester).trim();

      if (!allowedYears.has(normalizedYear)) {
        return res.status(400).json({
          success: false,
          message: "year must be one of 1, 2, 3, 4",
        });
      }

      if (!allowedSemesters.has(normalizedSemester)) {
        return res.status(400).json({
          success: false,
          message: "semester must be one of 1, 2",
        });
      }

      const rawDocumentationType = String(documentation_type).trim();
      if (rawDocumentationType.length === 0) {
        return res.status(400).json({
          success: false,
          message: "documentation_type is required",
        });
      }

      const isOtherDocumentationType = rawDocumentationType.toLowerCase() === "other";
      if (isOtherDocumentationType && (!documentation_type_other || String(documentation_type_other).trim() === "")) {
        return res.status(400).json({
          success: false,
          message: "documentation_type_other is required when documentation_type is Other",
        });
      }

      if (isNonDocumentationDepartmentDue(rawDocumentationType)) {
        if (!approx_value || String(approx_value).trim() === "") {
          return res.status(400).json({
            success: false,
            message: "approx_value is required for non-documentation dues",
          });
        }

        const parsedAmount = Number.parseFloat(String(approx_value).replace(/,/g, "").trim());
        if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
          return res.status(400).json({
            success: false,
            message: "approx_value must be a positive number for non-documentation dues",
          });
        }
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

    if (isDepartmentStudentFlow) {
      const normalizedDocumentationType = String(documentation_type).trim();
      const isNonDocumentationDue = isNonDocumentationDepartmentDue(normalizedDocumentationType);

      let resolvedDueTypeId = due_type_id ? parseInt(due_type_id, 10) : null;

      if (!resolvedDueTypeId || Number.isNaN(resolvedDueTypeId)) {
        resolvedDueTypeId = isNonDocumentationDue
          ? await resolveNonDocumentationDueTypeId()
          : await resolveDocumentationDueTypeId();
      }

      if (!resolvedDueTypeId) {
        return res.status(400).json({
          success: false,
          message: isNonDocumentationDue
            ? "Could not resolve a non-documentation student due type. Please configure a student due type in due_types that does not include 'documentation'."
            : "Could not resolve a documentation due type. Please configure a student due type containing 'documentation' in due_types.",
        });
      }

      const selectedDocumentationType = normalizedDocumentationType;
      const normalizedSectionName = String(section_name).trim().toUpperCase();
      const generatedSerialNo = await getNextDepartmentDueSerialNo();
      const parsedApproxAmount = Number.parseFloat(String(approx_value || "").replace(/,/g, "").trim());
      const payableAmount =
        isNonDocumentationDue && !Number.isNaN(parsedApproxAmount)
          ? parsedApproxAmount
          : null;

      const dueClearByDate = due_date || incident_date;

      const result = await sql`
        INSERT INTO department_dues (
          student_roll_number,
          added_by_user_id,
          added_by_department_id,
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
          proof_drive_link,
          serial_no,
          incident_date,
          student_name_snapshot,
          program_name,
          branch_name,
          academic_year_label,
          semester_label,
          section_label,
          location_type,
          location_name,
          room_no,
          course_activity_usage_context,
          staff_reporting_name,
          staff_employee_id,
          staff_designation,
          item_equipment,
          issue_type,
          approx_value,
          form_remarks,
          documentation_type,
          documentation_type_other
        ) VALUES (
          ${roll_number},
          ${userId},
          ${operatorInfo.department_id},
          ${resolvedDueTypeId},
          ${isNonDocumentationDue},
          ${payableAmount},
          ${payableAmount},
          ${String(course_activity_usage_context).trim()},
          ${dueClearByDate},
          ${isNonDocumentationDue ? false : null},
          ${null},
          ${isNonDocumentationDue ? null : false},
          ${isNonDocumentationDue ? null : true},
          ${proof_link || null},
          ${generatedSerialNo},
          ${incident_date},
          ${String(student_name).trim()},
          ${String(program).trim()},
          ${String(branch).trim()},
          ${String(year).trim()},
          ${String(semester).trim()},
          ${normalizedSectionName},
          ${String(location_type).trim()},
          ${String(location_name).trim()},
          ${String(room_no).trim()},
          ${String(course_activity_usage_context).trim()},
          ${String(staff_reporting_name).trim()},
          ${String(staff_employee_id).trim()},
          ${String(staff_designation).trim()},
          ${String(item_equipment).trim()},
          ${String(issue_type).trim()},
          ${isNonDocumentationDue ? String(approx_value).trim() : "N/A"},
          ${String(form_remarks).trim()},
          ${selectedDocumentationType},
          ${String(documentation_type).trim().toLowerCase() === "other" ? String(documentation_type_other).trim() : null}
        )
        RETURNING *
      `;

      return res.status(201).json({
        success: true,
        data: {
          ...result[0],
          due_unique_id: `DEPT-DUE-${String(result[0].id).padStart(6, "0")}`,
        },
        message: `Department due added successfully. Due ID: DEPT-DUE-${String(result[0].id).padStart(6, "0")}`,
      });
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

// GET /api/operator/lookup-faculty/:employeeCode
export const lookupFacultyByEmployeeCode = async (req, res) => {
  try {
    const userId = req.user?.user_id;
    const { employeeCode } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!employeeCode) {
      return res.status(400).json({
        success: false,
        message: "Employee code is required",
      });
    }

    const operatorInfo = await getOperatorInfo(userId);
    if (!operatorInfo) {
      return res.status(404).json({
        success: false,
        message: "Operator not found",
      });
    }

    const normalizedCode = String(employeeCode).trim().toUpperCase();

    const faculty = await sql`
      SELECT
        f.name,
        f.employee_code,
        f.designation,
        d.name as department_name,
        s.name as section_name
      FROM faculty f
      LEFT JOIN departments d ON f.department_id = d.id
      LEFT JOIN sections s ON f.section_id = s.id
      WHERE f.employee_code = ${normalizedCode}
      LIMIT 1
    `;

    if (faculty.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Faculty not found",
      });
    }

    const designationValue = faculty[0].designation;
    const normalizedDesignation = Array.isArray(designationValue)
      ? designationValue[0] || ""
      : designationValue || "";

    return res.status(200).json({
      success: true,
      data: {
        ...faculty[0],
        designation: normalizedDesignation,
      },
    });
  } catch (error) {
    console.error("Error looking up faculty by employee code:", error);
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

    if (isDepartmentStudentOperator(operatorInfo)) {
      return res.status(400).json({
        success: false,
        message: "Bulk upload is not supported for the department due form. Please use the manual department due form.",
      });
    }

    if (isAlumniSectionOperator(operatorInfo)) {
      return res.status(400).json({
        success: false,
        message: "Bulk upload is not required for alumni form filling. Please use manual due creation.",
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
    const useDepartmentDuesTable = isDepartmentStudentOperator(operatorInfo);
    const useAlumniDuesTable = isAlumniSectionOperator(operatorInfo);
    
    let whereClause = sql``;
    if (department_id) {
      whereClause = sql`sd.added_by_department_id = ${department_id}`;
    } else if (section_id) {
      whereClause = sql`sd.added_by_section_id = ${section_id}`;
    }

    const alumniWhereClause = section_id
      ? sql`ad.added_by_section_id = ${section_id}`
      : sql`FALSE`;
    
    const activeDues = useDepartmentDuesTable ? await sql`
      SELECT
        sd.id,
        CONCAT('DEPT-DUE-', LPAD(COALESCE(sd.serial_no, sd.id)::text, 6, '0')) as due_unique_id,
        sd.student_roll_number,
        sd.due_type_id,
        sd.added_by_department_id,
        sd.added_by_section_id,
        d.name as added_by_department_name,
        sec.name as added_by_section_name,
        COALESCE(d.name, sec.name) as added_by_entity,
        'department' as due_source,
        sd.principal_amount,
        calculate_compounded_amount(sd.principal_amount, sd.interest_rate, sd.is_compounded, sd.due_clear_by_date) as current_amount,
        CASE
          WHEN sd.is_payable = TRUE THEN calculate_outstanding_amount(sd.principal_amount, sd.interest_rate, sd.is_compounded, sd.due_clear_by_date, sd.amount_paid)
          ELSE NULL
        END as outstanding_amount,
        sd.amount_paid,
        sd.is_payable,
        sd.is_compounded,
        sd.interest_rate,
        sd.is_cleared,
        sd.permission_granted,
        sd.due_clear_by_date,
        COALESCE(NULLIF(sd.form_remarks, ''), sd.due_description) as due_description,
        sd.proof_drive_link,
        sd.supporting_document_link,
        sd.overall_status,
        sd.remarks,
        sd.needs_original,
        sd.needs_pdf,
        sd.serial_no,
        sd.incident_date,
        sd.student_name_snapshot,
        sd.program_name,
        sd.branch_name,
        sd.academic_year_label,
        sd.semester_label,
        sd.section_label,
        sd.location_type,
        sd.location_name,
        sd.room_no,
        sd.course_activity_usage_context,
        sd.staff_reporting_name,
        sd.staff_employee_id,
        sd.staff_designation,
        sd.item_equipment,
        sd.issue_type,
        sd.approx_value,
        sd.form_remarks,
        sd.documentation_type,
        sd.documentation_type_other,
        sd.created_at,
        sd.updated_at,
        COALESCE(NULLIF(sd.documentation_type_other, ''), sd.documentation_type, dt.type_name) as due_type,
        dt.requires_permission,
        s.name as student_name
      FROM department_dues sd
      JOIN due_types dt ON sd.due_type_id = dt.id
      LEFT JOIN students s ON sd.student_roll_number = s.roll_number
      LEFT JOIN departments d ON sd.added_by_department_id = d.id
      LEFT JOIN sections sec ON sd.added_by_section_id = sec.id
      WHERE ${whereClause}
        AND sd.is_cleared = FALSE
      ORDER BY sd.created_at DESC
    ` : useAlumniDuesTable ? await sql`
      SELECT
        ad.id,
        CONCAT('ALM-DUE-', LPAD(ad.id::text, 6, '0')) as due_unique_id,
        ad.student_roll_number,
        ad.due_type_id,
        NULL::INTEGER as added_by_department_id,
        ad.added_by_section_id,
        NULL::VARCHAR as added_by_department_name,
        sec.name as added_by_section_name,
        sec.name as added_by_entity,
        'alumni' as due_source,
        ad.principal_amount,
        calculate_compounded_amount(ad.principal_amount, ad.interest_rate, ad.is_compounded, ad.due_clear_by_date) as current_amount,
        CASE
          WHEN ad.is_payable = TRUE THEN calculate_outstanding_amount(ad.principal_amount, ad.interest_rate, ad.is_compounded, ad.due_clear_by_date, ad.amount_paid)
          ELSE NULL
        END as outstanding_amount,
        ad.amount_paid,
        ad.is_payable,
        ad.is_compounded,
        ad.interest_rate,
        ad.is_cleared,
        ad.permission_granted,
        ad.due_clear_by_date,
        ad.due_description,
        ad.proof_drive_link,
        ad.supporting_document_link,
        ad.overall_status,
        ad.remarks,
        ad.needs_original,
        ad.needs_pdf,
        NULL::INTEGER as serial_no,
        NULL::DATE as incident_date,
        NULL::VARCHAR as student_name_snapshot,
        NULL::VARCHAR as program_name,
        NULL::VARCHAR as branch_name,
        CONCAT(ay.beginning_year, '-', ay.ending_year) as academic_year_label,
        NULL::VARCHAR as semester_label,
        NULL::VARCHAR as section_label,
        NULL::VARCHAR as location_type,
        NULL::VARCHAR as location_name,
        NULL::VARCHAR as room_no,
        NULL::TEXT as course_activity_usage_context,
        NULL::VARCHAR as staff_reporting_name,
        NULL::VARCHAR as staff_employee_id,
        NULL::VARCHAR as staff_designation,
        NULL::TEXT as item_equipment,
        NULL::TEXT as issue_type,
        NULL::VARCHAR as approx_value,
        NULL::TEXT as form_remarks,
        'ALUMINI FORM'::VARCHAR as documentation_type,
        NULL::TEXT as documentation_type_other,
        ad.created_at,
        ad.updated_at,
        'ALUMINI FORM'::VARCHAR as due_type,
        FALSE as requires_permission,
        s.name as student_name,
        ad.academic_year_id,
        ad.is_form_submitted,
        ad.submitted_at,
        ad.status_of_registration_with_alumni_portal,
        ad.linkedin_profile_link,
        ad.placement_status,
        ad.proof_of_placement,
        ad.planning_for_higher_education,
        ad.proof_of_higher_education,
        ad.campaign_key
      FROM alumni_dues ad
      LEFT JOIN students s ON ad.student_roll_number = s.roll_number
      LEFT JOIN sections sec ON ad.added_by_section_id = sec.id
      LEFT JOIN academic_year ay ON ad.academic_year_id = ay.id
      WHERE ${alumniWhereClause}
        AND ad.is_cleared = FALSE
      ORDER BY ad.created_at DESC
    ` : await sql`
      SELECT
        sd.id,
        CONCAT('STD-DUE-', LPAD(sd.id::text, 6, '0')) as due_unique_id,
        sd.student_roll_number,
        sd.due_type_id,
        sd.added_by_department_id,
        sd.added_by_section_id,
        d.name as added_by_department_name,
        sec.name as added_by_section_name,
        COALESCE(d.name, sec.name) as added_by_entity,
        CASE
          WHEN sd.added_by_section_id IS NOT NULL THEN 'section'
          ELSE 'department'
        END as due_source,
        sd.principal_amount,
        calculate_compounded_amount(sd.principal_amount, sd.interest_rate, sd.is_compounded, sd.due_clear_by_date) as current_amount,
        CASE
          WHEN sd.is_payable = TRUE THEN calculate_outstanding_amount(sd.principal_amount, sd.interest_rate, sd.is_compounded, sd.due_clear_by_date, sd.amount_paid)
          ELSE NULL
        END as outstanding_amount,
        sd.amount_paid,
        sd.is_payable,
        sd.is_compounded,
        sd.interest_rate,
        sd.is_cleared,
        sd.permission_granted,
        sd.due_clear_by_date,
        sd.due_description,
        sd.proof_drive_link,
        sd.supporting_document_link,
        sd.overall_status,
        sd.remarks,
        sd.needs_original,
        sd.needs_pdf,
        NULL::INTEGER as serial_no,
        NULL::DATE as incident_date,
        NULL::VARCHAR as student_name_snapshot,
        NULL::VARCHAR as program_name,
        NULL::VARCHAR as branch_name,
        NULL::VARCHAR as academic_year_label,
        NULL::VARCHAR as semester_label,
        NULL::VARCHAR as section_label,
        NULL::VARCHAR as location_type,
        NULL::VARCHAR as location_name,
        NULL::VARCHAR as room_no,
        NULL::TEXT as course_activity_usage_context,
        NULL::VARCHAR as staff_reporting_name,
        NULL::VARCHAR as staff_employee_id,
        NULL::VARCHAR as staff_designation,
        NULL::TEXT as item_equipment,
        NULL::TEXT as issue_type,
        NULL::VARCHAR as approx_value,
        NULL::TEXT as form_remarks,
        NULL::VARCHAR as documentation_type,
        NULL::TEXT as documentation_type_other,
        sd.created_at,
        sd.updated_at,
        dt.type_name as due_type,
        dt.requires_permission,
        s.name as student_name
      FROM student_dues sd
      JOIN due_types dt ON sd.due_type_id = dt.id
      LEFT JOIN students s ON sd.student_roll_number = s.roll_number
      LEFT JOIN departments d ON sd.added_by_department_id = d.id
      LEFT JOIN sections sec ON sd.added_by_section_id = sec.id
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
    const useDepartmentDuesTable = isDepartmentStudentOperator(operatorInfo);
    const useAlumniDuesTable = isAlumniSectionOperator(operatorInfo);
    
    let whereClause = sql``;
    if (department_id) {
      whereClause = sql`sd.added_by_department_id = ${department_id}`;
    } else if (section_id) {
      whereClause = sql`sd.added_by_section_id = ${section_id}`;
    }

    const alumniWhereClause = section_id
      ? sql`ad.added_by_section_id = ${section_id}`
      : sql`FALSE`;
    
    const clearedDues = useDepartmentDuesTable ? await sql`
      SELECT 
        sd.*,
        dt.type_name as due_type,
        s.name as student_name,
        u.username as cleared_by,
        sd.updated_at as cleared_at
      FROM department_dues sd
      JOIN due_types dt ON sd.due_type_id = dt.id
      LEFT JOIN students s ON sd.student_roll_number = s.roll_number
      LEFT JOIN users u ON sd.cleared_by_user_id = u.user_id
      WHERE ${whereClause}
        AND sd.is_cleared = TRUE
      ORDER BY sd.updated_at DESC
    ` : useAlumniDuesTable ? await sql`
      SELECT
        CONCAT('ALM-DUE-', LPAD(ad.id::text, 6, '0')) as due_unique_id,
        'alumni' as due_source,
        ad.*,
        'ALUMINI FORM'::VARCHAR as due_type,
        s.name as student_name,
        u.username as cleared_by,
        ad.updated_at as cleared_at,
        sec.name as added_by_entity,
        CONCAT(ay.beginning_year, '-', ay.ending_year) as academic_year_label
      FROM alumni_dues ad
      LEFT JOIN students s ON ad.student_roll_number = s.roll_number
      LEFT JOIN users u ON ad.cleared_by_user_id = u.user_id
      LEFT JOIN sections sec ON ad.added_by_section_id = sec.id
      LEFT JOIN academic_year ay ON ad.academic_year_id = ay.id
      WHERE ${alumniWhereClause}
        AND ad.is_cleared = TRUE
        AND ad.is_form_submitted = TRUE
      ORDER BY ad.updated_at DESC
    ` : await sql`
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
    const useDepartmentDuesTable = isDepartmentStudentOperator(operatorInfo);

    // Check if due exists and is non-payable
    const due = isForFaculty
      ? await sql`SELECT * FROM faculty_due WHERE id = ${id} LIMIT 1`
      : useDepartmentDuesTable
        ? await sql`SELECT * FROM department_dues WHERE id = ${id} LIMIT 1`
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
      : useDepartmentDuesTable
        ? await sql`
          UPDATE department_dues
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
    const useDepartmentDuesTable = isDepartmentStudentOperator(operatorInfo);
    
    // Build filter based on operator type
    let filterCondition = sql``;
    
    if (operator_type === 'department' && department_id) {
      filterCondition = sql`AND sd.added_by_department_id = ${department_id}`;
    } else if (operator_type === 'section' && section_id) {
      filterCondition = sql`AND sd.added_by_section_id = ${section_id}`;
    }

    // Get all dues with uploaded documents pending approval
    const result = useDepartmentDuesTable ? await sql`
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
        d.name as added_by_entity
      FROM department_dues sd
      JOIN students s ON sd.student_roll_number = s.roll_number
      JOIN due_types dt ON sd.due_type_id = dt.id
      LEFT JOIN departments d ON sd.added_by_department_id = d.id
      WHERE sd.is_payable = FALSE
        AND (sd.needs_original = TRUE OR sd.needs_pdf = TRUE)
        AND sd.proof_drive_link IS NOT NULL
        AND sd.overall_status = FALSE
        AND sd.is_cleared = FALSE
        ${filterCondition}
      ORDER BY sd.updated_at DESC
    ` : await sql`
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
    const useDepartmentDuesTable = isDepartmentStudentOperator(operatorInfo);

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
      : useDepartmentDuesTable
        ? await sql`
          SELECT id, proof_drive_link, overall_status, is_cleared
          FROM department_dues sd
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
      : useDepartmentDuesTable
        ? await sql`
          UPDATE department_dues
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
    const useDepartmentDuesTable = isDepartmentStudentOperator(operatorInfo);

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
      : useDepartmentDuesTable
        ? await sql`
          SELECT id, proof_drive_link, overall_status, is_cleared
          FROM department_dues sd
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
      : useDepartmentDuesTable
        ? await sql`
          UPDATE department_dues
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

// GET /api/operator/students-with-dues
export const getDepartmentStudentsWithDues = async (req, res) => {
  try {
    const userId = req.user?.user_id;
    const {
      rollNumber,
      academicYear,
      startDate,
      endDate,
      page = "1",
      limit = "50",
    } = req.query;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const operatorInfo = await getOperatorInfo(userId);

    if (!operatorInfo) {
      return res.status(404).json({
        success: false,
        message: "Operator not found",
      });
    }

    if (operatorInfo.access_level === "all_faculty") {
      return res.status(403).json({
        success: false,
        message: "This view is available only for student department operators",
      });
    }

    if (!operatorInfo.department_id) {
      return res.status(403).json({
        success: false,
        message: "Department mapping is required for this view",
      });
    }

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const pageLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
    const offset = (pageNumber - 1) * pageLimit;

    const countResult = await sql`
      SELECT COUNT(DISTINCT s.student_id) as count
      FROM students s
      JOIN (
        SELECT id, student_roll_number, created_at, is_cleared
        FROM department_dues
        UNION ALL
        SELECT id, student_roll_number, created_at, is_cleared
        FROM student_dues
        WHERE added_by_section_id IS NOT NULL
        UNION ALL
        SELECT id, student_roll_number, created_at, is_cleared
        FROM alumni_dues
      ) sd ON sd.student_roll_number = s.roll_number
      WHERE s.department_id = ${operatorInfo.department_id}
        AND sd.is_cleared = FALSE
        ${rollNumber ? sql`AND s.roll_number ILIKE ${`%${rollNumber}%`}` : sql``}
        ${academicYear ? sql`AND s.academic_year_id = ${parseInt(academicYear, 10)}` : sql``}
        ${startDate ? sql`AND sd.created_at >= ${startDate}` : sql``}
        ${endDate ? sql`AND sd.created_at <= ${endDate}` : sql``}
    `;

    const totalRecords = parseInt(countResult[0]?.count || 0);
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageLimit));

    const students = await sql`
      SELECT
        s.student_id,
        s.roll_number,
        s.name,
        CONCAT(ay.beginning_year, '-', ay.ending_year) as academic_year,
        s.branch,
        s.section,
        s.mobile,
        COUNT(sd.id) as active_dues_count
      FROM students s
      JOIN academic_year ay ON s.academic_year_id = ay.id
      JOIN (
        SELECT id, student_roll_number, created_at, is_cleared
        FROM department_dues
        UNION ALL
        SELECT id, student_roll_number, created_at, is_cleared
        FROM student_dues
        WHERE added_by_section_id IS NOT NULL
        UNION ALL
        SELECT id, student_roll_number, created_at, is_cleared
        FROM alumni_dues
      ) sd ON sd.student_roll_number = s.roll_number
      WHERE s.department_id = ${operatorInfo.department_id}
        AND sd.is_cleared = FALSE
        ${rollNumber ? sql`AND s.roll_number ILIKE ${`%${rollNumber}%`}` : sql``}
        ${academicYear ? sql`AND s.academic_year_id = ${parseInt(academicYear, 10)}` : sql``}
        ${startDate ? sql`AND sd.created_at >= ${startDate}` : sql``}
        ${endDate ? sql`AND sd.created_at <= ${endDate}` : sql``}
      GROUP BY s.student_id, s.roll_number, s.name, ay.beginning_year, ay.ending_year, s.branch, s.section, s.mobile
      ORDER BY s.roll_number ASC
      LIMIT ${pageLimit} OFFSET ${offset}
    `;

    const studentsWithDues = await Promise.all(
      students.map(async (student) => {
        const dues = await sql`
          SELECT *
          FROM (
            SELECT
              dd.id as due_id,
              dd.is_payable,
              dd.permission_granted,
              dd.amount_paid,
              CASE
                WHEN dd.is_payable = TRUE
                THEN calculate_compounded_amount(dd.principal_amount, dd.interest_rate, dd.is_compounded, dd.due_clear_by_date)
                ELSE NULL
              END as current_amount,
              CASE
                WHEN dd.is_payable = TRUE
                THEN calculate_outstanding_amount(dd.principal_amount, dd.interest_rate, dd.is_compounded, dd.due_clear_by_date, dd.amount_paid)
                ELSE NULL
              END as outstanding_amount,
              dd.created_at as created_date,
              dd.due_clear_by_date as due_date,
              dd.due_description as description,
              dt.type_name as due_type,
              d.name as issuing_entity,
              'department' as issuing_scope
            FROM department_dues dd
            JOIN due_types dt ON dd.due_type_id = dt.id
            LEFT JOIN departments d ON dd.added_by_department_id = d.id
            WHERE dd.student_roll_number = ${student.roll_number}
              AND dd.is_cleared = FALSE

            UNION ALL

            SELECT
              sd.id as due_id,
              sd.is_payable,
              sd.permission_granted,
              sd.amount_paid,
              CASE
                WHEN sd.is_payable = TRUE
                THEN calculate_compounded_amount(sd.principal_amount, sd.interest_rate, sd.is_compounded, sd.due_clear_by_date)
                ELSE NULL
              END as current_amount,
              CASE
                WHEN sd.is_payable = TRUE
                THEN calculate_outstanding_amount(sd.principal_amount, sd.interest_rate, sd.is_compounded, sd.due_clear_by_date, sd.amount_paid)
                ELSE NULL
              END as outstanding_amount,
              sd.created_at as created_date,
              sd.due_clear_by_date as due_date,
              sd.due_description as description,
              dt.type_name as due_type,
              sec.name as issuing_entity,
              'section' as issuing_scope
            FROM student_dues sd
            JOIN due_types dt ON sd.due_type_id = dt.id
            LEFT JOIN sections sec ON sd.added_by_section_id = sec.id
            WHERE sd.student_roll_number = ${student.roll_number}
              AND sd.is_cleared = FALSE
              AND sd.added_by_section_id IS NOT NULL

            UNION ALL

            SELECT
              ad.id as due_id,
              ad.is_payable,
              ad.permission_granted,
              ad.amount_paid,
              CASE
                WHEN ad.is_payable = TRUE
                THEN calculate_compounded_amount(ad.principal_amount, ad.interest_rate, ad.is_compounded, ad.due_clear_by_date)
                ELSE NULL
              END as current_amount,
              CASE
                WHEN ad.is_payable = TRUE
                THEN calculate_outstanding_amount(ad.principal_amount, ad.interest_rate, ad.is_compounded, ad.due_clear_by_date, ad.amount_paid)
                ELSE NULL
              END as outstanding_amount,
              ad.created_at as created_date,
              ad.due_clear_by_date as due_date,
              ad.due_description as description,
              'ALUMINI FORM' as due_type,
              sec.name as issuing_entity,
              'section' as issuing_scope
            FROM alumni_dues ad
            LEFT JOIN sections sec ON ad.added_by_section_id = sec.id
            WHERE ad.student_roll_number = ${student.roll_number}
              AND ad.is_cleared = FALSE
          ) all_dues
          ORDER BY created_date DESC
        `;

        return {
          rollNumber: student.roll_number,
          name: student.name,
          academicYear: student.academic_year,
          branch: student.branch,
          section: student.section,
          mobile: student.mobile,
          activeDuesCount: parseInt(student.active_dues_count),
          dues: dues.map((due) => ({
            dueId: due.due_id,
            dueType: due.due_type,
            issuingEntity: due.issuing_entity,
            issuingScope: due.issuing_scope,
            isPayable: due.is_payable,
            status: due.permission_granted ? "Permission Granted" : "Active",
            currentAmount:
              due.current_amount === null ? null : parseFloat(due.current_amount),
            outstandingAmount:
              due.outstanding_amount === null
                ? null
                : parseFloat(due.outstanding_amount),
            amountPaid: due.amount_paid === null ? 0 : parseFloat(due.amount_paid),
            createdDate: due.created_date,
            dueDate: due.due_date,
            description: due.description,
          })),
        };
      }),
    );

    const totalActiveDuesOnPage = studentsWithDues.reduce(
      (sum, student) => sum + student.activeDuesCount,
      0,
    );

    return res.status(200).json({
      success: true,
      data: {
        students: studentsWithDues,
        summary: {
          departmentId: operatorInfo.department_id,
          departmentName: operatorInfo.department_name,
          totalStudentsWithDues: totalRecords,
          totalActiveDuesOnPage,
        },
        pagination: {
          currentPage: pageNumber,
          totalPages,
          totalRecords,
          recordsPerPage: pageLimit,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching department students with dues:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
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
      SELECT *
      FROM (
        SELECT
          dd.id,
          dd.due_type_id,
          dd.is_payable,
          calculate_compounded_amount(dd.principal_amount, dd.interest_rate, dd.is_compounded, dd.due_clear_by_date) as current_amount,
          dd.amount_paid,
          dd.permission_granted,
          dd.due_clear_by_date,
          dd.due_description,
          dd.overall_status,
          dd.is_cleared,
          dt.type_name as due_type,
          dt.requires_permission
        FROM department_dues dd
        JOIN due_types dt ON dd.due_type_id = dt.id
        WHERE dd.student_roll_number = ${rollNumber}
          AND dd.overall_status = false

        UNION ALL

        SELECT
          ad.id,
          ad.due_type_id,
          ad.is_payable,
          calculate_compounded_amount(ad.principal_amount, ad.interest_rate, ad.is_compounded, ad.due_clear_by_date) as current_amount,
          ad.amount_paid,
          ad.permission_granted,
          ad.due_clear_by_date,
          ad.due_description,
          ad.overall_status,
          ad.is_cleared,
          'ALUMINI FORM' as due_type,
          FALSE as requires_permission
        FROM alumni_dues ad
        WHERE ad.student_roll_number = ${rollNumber}
          AND ad.overall_status = false
      ) all_active_dues
      ORDER BY due_clear_by_date ASC
    `;

    // Get cleared dues (includes permission-granted dues paid by students)
    const clearedDues = await sql`
      SELECT *
      FROM (
        SELECT
          dd.id,
          dd.due_type_id,
          dd.is_payable,
          calculate_compounded_amount(dd.principal_amount, dd.interest_rate, dd.is_compounded, dd.due_clear_by_date) as current_amount,
          dd.amount_paid,
          dd.permission_granted,
          dd.due_clear_by_date,
          dd.due_description,
          dd.overall_status,
          dd.is_cleared,
          dd.updated_at as cleared_at,
          dt.type_name as due_type,
          dt.requires_permission
        FROM department_dues dd
        JOIN due_types dt ON dd.due_type_id = dt.id
        WHERE dd.student_roll_number = ${rollNumber}
          AND dd.overall_status = true

        UNION ALL

        SELECT
          ad.id,
          ad.due_type_id,
          ad.is_payable,
          calculate_compounded_amount(ad.principal_amount, ad.interest_rate, ad.is_compounded, ad.due_clear_by_date) as current_amount,
          ad.amount_paid,
          ad.permission_granted,
          ad.due_clear_by_date,
          ad.due_description,
          ad.overall_status,
          ad.is_cleared,
          ad.updated_at as cleared_at,
          'ALUMINI FORM' as due_type,
          FALSE as requires_permission
        FROM alumni_dues ad
        WHERE ad.student_roll_number = ${rollNumber}
          AND ad.overall_status = true
      ) all_cleared_dues
      ORDER BY cleared_at DESC
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
    const useDepartmentDuesTable = isDepartmentStudentOperator(operatorInfo);
    
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
    } else if (useDepartmentDuesTable) {
      dueCheckQuery = sql`
        SELECT sd.*, dt.requires_permission, dt.type_name
        FROM department_dues sd
        JOIN due_types dt ON sd.due_type_id = dt.id
        WHERE sd.id = ${id}
          AND sd.added_by_department_id = ${department_id}
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
      : useDepartmentDuesTable
        ? await sql`
          UPDATE department_dues
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
    const useDepartmentDuesTable = isDepartmentStudentOperator(operatorInfo);

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
    } else if (useDepartmentDuesTable) {
      dueResult = await sql`
        SELECT 
          sd.id, 
          sd.student_roll_number,
          sd.permission_granted,
          sd.is_cleared,
          dt.requires_permission
        FROM department_dues sd
        JOIN due_types dt ON sd.due_type_id = dt.id
        WHERE sd.id = ${id}
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
    const tableName = isForFaculty
      ? 'faculty_due'
      : useDepartmentDuesTable
        ? 'department_dues'
        : 'student_dues';
    if (isForFaculty) {
      await sql`
        UPDATE faculty_due
        SET permission_granted = TRUE,
            supporting_document_link = ${uploadResult.webViewLink},
            overall_status = TRUE,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
      `;
    } else if (useDepartmentDuesTable) {
      await sql`
        UPDATE department_dues
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
