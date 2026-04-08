import { sql } from "../config/db.js";

// ─── helpers ────────────────────────────────────────────────────────────────

const getHrInfo = async (userId) => {
  const result = await sql`
    SELECT user_id, department_id, section_id
    FROM users
    WHERE user_id = ${userId}
    LIMIT 1
  `;
  return result.length > 0 ? result[0] : null;
};

// ─── GET /api/hr/dashboard/stats ────────────────────────────────────────────
export const getDashboardStats = async (req, res) => {
  try {
    const [facultyCount, activeDuesStats, clearedCount, recentDues] =
      await Promise.all([
        sql`SELECT COUNT(*) AS count FROM faculty`,
        sql`
          SELECT
            COUNT(*)                                                                AS total_active,
            COUNT(CASE WHEN is_payable = TRUE  THEN 1 END)                        AS payable_count,
            COUNT(CASE WHEN is_payable = FALSE THEN 1 END)                        AS non_payable_count,
            COALESCE(SUM(CASE WHEN is_payable = TRUE THEN current_amount ELSE 0 END), 0) AS total_amount
          FROM faculty_due
          WHERE is_cleared = FALSE
        `,
        sql`SELECT COUNT(*) AS count FROM faculty_due WHERE is_cleared = TRUE`,
        sql`
          SELECT
            fd.id,
            fd.employee_code,
            f.name  AS faculty_name,
            dt.type_name AS due_type,
            fd.is_payable,
            fd.current_amount,
            fd.is_cleared,
            fd.created_at
          FROM faculty_due fd
          JOIN faculty    f  ON fd.employee_code = f.employee_code
          JOIN due_types  dt ON fd.due_type_id   = dt.id
          ORDER BY fd.created_at DESC
          LIMIT 10
        `,
      ]);

    return res.status(200).json({
      success: true,
      data: {
        totalFaculty:    parseInt(facultyCount[0].count),
        activeDues:      parseInt(activeDuesStats[0].total_active),
        activePayable:   parseInt(activeDuesStats[0].payable_count),
        activeNonPayable:parseInt(activeDuesStats[0].non_payable_count),
        totalAmount:     parseFloat(activeDuesStats[0].total_amount),
        clearedDues:     parseInt(clearedCount[0].count),
        recentDues,
      },
    });
  } catch (error) {
    console.error("Error fetching HR dashboard stats:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// ─── GET /api/hr/faculty ────────────────────────────────────────────────────
export const getFacultyList = async (req, res) => {
  try {
    const faculty = await sql`
      SELECT
        f.faculty_id,
        f.employee_code,
        f.name,
        f.email,
        f.designation,
        f.staff_type,
        d.name AS department_name,
        s.name AS section_name
      FROM faculty f
      LEFT JOIN departments d ON f.department_id = d.id
      LEFT JOIN sections    s ON f.section_id    = s.id
      ORDER BY f.name ASC
    `;
    return res.status(200).json({ success: true, data: faculty });
  } catch (error) {
    console.error("Error fetching faculty list:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// ─── GET /api/hr/due-types ──────────────────────────────────────────────────
export const getDueTypes = async (req, res) => {
  try {
    const dueTypes = await sql`
      SELECT id, type_name, description, requires_permission
      FROM due_types
      ORDER BY type_name ASC
    `;
    return res.status(200).json({ success: true, data: dueTypes });
  } catch (error) {
    console.error("Error fetching due types:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// ─── POST /api/hr/dues ──────────────────────────────────────────────────────
export const addFacultyDue = async (req, res) => {
  try {
    const userId = req.user?.user_id;
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const hrInfo = await getHrInfo(userId);

    const {
      employee_code,
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
    } = req.body;

    if (!employee_code || !due_type_id || is_payable === undefined || !due_date)
      return res.status(400).json({
        success: false,
        message: "Required fields: employee_code, due_type_id, is_payable, due_date",
      });

    if (is_payable && !amount)
      return res
        .status(400)
        .json({ success: false, message: "Amount is required for payable dues" });

    if (is_payable && is_compounded && !interest_rate)
      return res.status(400).json({
        success: false,
        message: "Interest rate is required for compound dues",
      });

    if (interest_rate !== undefined && interest_rate !== null && interest_rate !== "") {
      const rate = parseFloat(interest_rate);
      if (isNaN(rate) || rate < 0 || rate > 1)
        return res.status(400).json({
          success: false,
          message: "Interest rate must be a decimal between 0 and 1 (e.g. 0.001 = 0.1%/day)",
        });
    }

    // Verify faculty exists
    const faculty = await sql`
      SELECT employee_code FROM faculty WHERE employee_code = ${employee_code.toUpperCase()} LIMIT 1
    `;
    if (faculty.length === 0)
      return res
        .status(404)
        .json({ success: false, message: "Faculty member not found with that employee code" });

    const result = await sql`
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
        ${employee_code.toUpperCase()},
        ${userId},
        ${hrInfo?.department_id ?? null},
        ${hrInfo?.section_id ?? null},
        ${parseInt(due_type_id)},
        ${is_payable},
        ${is_payable ? parseFloat(amount) : null},
        ${is_payable ? parseFloat(amount) : null},
        ${due_description?.trim() || null},
        ${due_date},
        ${is_payable ? (is_compounded ?? false) : null},
        ${is_payable && is_compounded ? parseFloat(interest_rate) : null},
        ${!is_payable ? (needs_original ?? null) : null},
        ${!is_payable ? (needs_pdf ?? null) : null},
        ${proof_link?.trim() || null}
      )
      RETURNING *
    `;

    return res.status(201).json({
      success: true,
      data: result[0],
      message: "Faculty due added successfully",
    });
  } catch (error) {
    console.error("Error adding faculty due:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// ─── POST /api/hr/dues/bulk ─────────────────────────────────────────────────
export const bulkAddFacultyDues = async (req, res) => {
  try {
    const userId = req.user?.user_id;
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const hrInfo = await getHrInfo(userId);
    const { dues } = req.body;

    if (!Array.isArray(dues) || dues.length === 0)
      return res
        .status(400)
        .json({ success: false, message: "Invalid or empty dues array" });

    let successCount = 0;
    const errors = [];

    for (let i = 0; i < dues.length; i++) {
      try {
        const due = dues[i];
        const empCode = (due["Employee Code"] || "").toString().toUpperCase().trim();
        const dueTypeId = parseInt(due["Due Type ID"]);
        const paymentType = (due["Payment Type"] || "").toString().toLowerCase();
        const isPayable = paymentType === "payable" || paymentType === "1";
        const amount = due["Amount"] ? parseFloat(due["Amount"]) : null;
        const description = due["Due Description"] || null;
        const dueDate = due["Due Date (YYYY-MM-DD)"];
        const interestCompounded = (due["Interest Compounded"] || "").toLowerCase();
        const isCompounded = isPayable
          ? interestCompounded === "yes" || interestCompounded === "1"
          : null;
        const interestRate =
          isPayable && isCompounded
            ? parseFloat(due["Interest Rate (decimal)"] || 0)
            : null;
        const docType = (due["Document Type"] || "").toLowerCase();
        const needsOriginal = !isPayable && docType === "original" ? true : null;
        const needsPdf = !isPayable && docType === "pdf" ? true : null;
        const proofLink = due["Proof Link"] || null;

        if (!empCode || isNaN(dueTypeId) || !dueDate) {
          errors.push({ row: i + 2, error: "Missing Employee Code, Due Type ID, or Due Date" });
          continue;
        }

        if (isPayable && !amount) {
          errors.push({ row: i + 2, error: "Amount required for payable due" });
          continue;
        }

        const facultyCheck = await sql`
          SELECT employee_code FROM faculty WHERE employee_code = ${empCode} LIMIT 1
        `;
        if (facultyCheck.length === 0) {
          errors.push({ row: i + 2, error: `Faculty not found: ${empCode}` });
          continue;
        }

        await sql`
          INSERT INTO faculty_due (
            employee_code, added_by_user_id, added_by_department_id, added_by_section_id,
            due_type_id, is_payable, principal_amount, current_amount,
            due_description, due_clear_by_date, is_compounded, interest_rate,
            needs_original, needs_pdf, proof_drive_link
          ) VALUES (
            ${empCode}, ${userId},
            ${hrInfo?.department_id ?? null}, ${hrInfo?.section_id ?? null},
            ${dueTypeId}, ${isPayable},
            ${isPayable ? amount : null}, ${isPayable ? amount : null},
            ${description}, ${dueDate},
            ${isPayable ? isCompounded : null},
            ${isPayable && isCompounded ? interestRate : null},
            ${!isPayable ? needsOriginal : null}, ${!isPayable ? needsPdf : null},
            ${proofLink}
          )
        `;
        successCount++;
      } catch (rowErr) {
        errors.push({ row: i + 2, error: rowErr.message });
      }
    }

    return res.status(200).json({
      success: true,
      message: `Bulk upload complete: ${successCount} added, ${errors.length} failed`,
      successCount,
      failedCount: errors.length,
      errors,
    });
  } catch (error) {
    console.error("Error in bulk faculty due upload:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// ─── GET /api/hr/dues/active ─────────────────────────────────────────────────
export const getActiveFacultyDues = async (req, res) => {
  try {
    const dues = await sql`
      SELECT
        fd.*,
        f.name            AS faculty_name,
        f.email           AS faculty_email,
        f.designation     AS faculty_designation,
        f.staff_type,
        d.name            AS department_name,
        s.name            AS section_name,
        dt.type_name      AS due_type,
        dt.requires_permission,
        u.username        AS added_by_name
      FROM faculty_due fd
      JOIN faculty    f  ON fd.employee_code    = f.employee_code
      LEFT JOIN departments d ON f.department_id = d.id
      LEFT JOIN sections    s ON f.section_id    = s.id
      JOIN due_types  dt ON fd.due_type_id       = dt.id
      LEFT JOIN users u  ON fd.added_by_user_id  = u.user_id
      WHERE fd.is_cleared = FALSE
      ORDER BY fd.created_at DESC
    `;
    return res.status(200).json({ success: true, data: dues });
  } catch (error) {
    console.error("Error fetching active faculty dues:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// ─── GET /api/hr/dues/cleared ────────────────────────────────────────────────
export const getClearedFacultyDues = async (req, res) => {
  try {
    const dues = await sql`
      SELECT
        fd.*,
        f.name            AS faculty_name,
        f.email           AS faculty_email,
        f.designation     AS faculty_designation,
        d.name            AS department_name,
        s.name            AS section_name,
        dt.type_name      AS due_type,
        u.username        AS added_by_name,
        cu.username       AS cleared_by_name
      FROM faculty_due fd
      JOIN faculty    f  ON fd.employee_code     = f.employee_code
      LEFT JOIN departments d ON f.department_id = d.id
      LEFT JOIN sections    s ON f.section_id    = s.id
      JOIN due_types  dt ON fd.due_type_id        = dt.id
      LEFT JOIN users u  ON fd.added_by_user_id   = u.user_id
      LEFT JOIN users cu ON fd.cleared_by_user_id = cu.user_id
      WHERE fd.is_cleared = TRUE
      ORDER BY fd.updated_at DESC
    `;
    return res.status(200).json({ success: true, data: dues });
  } catch (error) {
    console.error("Error fetching cleared faculty dues:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// ─── PUT /api/hr/dues/:id/clear ──────────────────────────────────────────────
export const clearFacultyDue = async (req, res) => {
  try {
    const userId = req.user?.user_id;
    const { id } = req.params;
    const { remarks } = req.body;

    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const existing = await sql`
      SELECT id FROM faculty_due WHERE id = ${id} AND is_cleared = FALSE LIMIT 1
    `;
    if (existing.length === 0)
      return res
        .status(404)
        .json({ success: false, message: "Active due not found with that ID" });

    const result = await sql`
      UPDATE faculty_due
      SET
        is_cleared          = TRUE,
        overall_status      = TRUE,
        cleared_by_user_id  = ${userId},
        remarks             = ${remarks?.trim() || null},
        updated_at          = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `;

    return res.status(200).json({
      success: true,
      data: result[0],
      message: "Faculty due cleared successfully",
    });
  } catch (error) {
    console.error("Error clearing faculty due:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// ─── GET /api/hr/check/:employeeCode ─────────────────────────────────────────
export const checkFacultyDues = async (req, res) => {
  try {
    const { employeeCode } = req.params;
    const code = employeeCode.toUpperCase().trim();

    const faculty = await sql`
      SELECT
        f.faculty_id, f.employee_code, f.name, f.email,
        f.designation, f.staff_type,
        d.name AS department_name,
        s.name AS section_name
      FROM faculty f
      LEFT JOIN departments d ON f.department_id = d.id
      LEFT JOIN sections    s ON f.section_id    = s.id
      WHERE f.employee_code = ${code}
      LIMIT 1
    `;

    if (faculty.length === 0)
      return res
        .status(404)
        .json({ success: false, message: "Faculty member not found" });

    const dues = await sql`
      SELECT
        fd.*,
        dt.type_name     AS due_type,
        dt.requires_permission,
        u.username       AS added_by_name,
        cu.username      AS cleared_by_name
      FROM faculty_due fd
      JOIN due_types dt ON fd.due_type_id        = dt.id
      LEFT JOIN users u  ON fd.added_by_user_id  = u.user_id
      LEFT JOIN users cu ON fd.cleared_by_user_id = cu.user_id
      WHERE fd.employee_code = ${code}
      ORDER BY
        CASE WHEN fd.is_cleared = FALSE THEN 0 ELSE 1 END,
        fd.created_at DESC
    `;

    return res.status(200).json({
      success: true,
      data: {
        faculty:     faculty[0],
        dues,
        activeDues:  dues.filter((d) => !d.is_cleared).length,
        clearedDues: dues.filter((d) => d.is_cleared).length,
      },
    });
  } catch (error) {
    console.error("Error checking faculty dues:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};
