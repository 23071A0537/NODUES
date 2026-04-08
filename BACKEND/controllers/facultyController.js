import { sql } from "../config/db.js";

// ─────────────────────────────────────────────────────────────────────────────
// LEGACY: Used by operator/FacultyDues page via /api/faculty/dues
// (only accessible via authenticateFacultyDues middleware)
// ─────────────────────────────────────────────────────────────────────────────
export const getFacultyDues = async (req, res) => {
  try {
    // req.faculty is set by authenticateFacultyDues middleware
    const employeeCode = req.faculty?.employee_code || req.user?.employee_code;

    if (!employeeCode) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const dues = await sql`
      SELECT
        fd.*,
        dt.type_name as due_type
      FROM faculty_due fd
      JOIN due_types dt ON fd.due_type_id = dt.id
      WHERE fd.employee_code = ${employeeCode}
      ORDER BY
        CASE WHEN fd.is_cleared = false THEN 0 ELSE 1 END,
        fd.created_at DESC
    `;

    return res.status(200).json({ success: true, data: dues });
  } catch (error) {
    console.error("Error fetching faculty dues:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SELF-SERVICE: Faculty portal endpoints (authenticateRole(['faculty']))
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/faculty/dashboard/stats
export const getDashboardStats = async (req, res) => {
  try {
    const empCode = req.user.employee_code;

    const stats = await sql`
      SELECT
        COUNT(*) FILTER (WHERE is_cleared = false)               AS active_dues,
        COUNT(*) FILTER (WHERE is_cleared = false AND is_payable = true)  AS payable_dues,
        COUNT(*) FILTER (WHERE is_cleared = false AND is_payable = false) AS non_payable_dues,
        COALESCE(SUM(current_amount) FILTER (WHERE is_cleared = false AND is_payable = true), 0) AS total_outstanding,
        COUNT(*) FILTER (WHERE is_cleared = true)                AS cleared_dues
      FROM faculty_due
      WHERE employee_code = ${empCode}
    `;

    const recentDues = await sql`
      SELECT
        fd.id,
        dt.type_name  AS due_type_name,
        fd.due_description,
        fd.is_payable,
        fd.current_amount,
        fd.is_cleared,
        fd.due_clear_by_date,
        fd.created_at
      FROM faculty_due fd
      JOIN due_types dt ON fd.due_type_id = dt.id
      WHERE fd.employee_code = ${empCode}
      ORDER BY fd.created_at DESC
      LIMIT 5
    `;

    return res.status(200).json({
      success: true,
      data: {
        activeDues:       Number(stats[0].active_dues),
        payableDues:      Number(stats[0].payable_dues),
        nonPayableDues:   Number(stats[0].non_payable_dues),
        totalOutstanding: Number(stats[0].total_outstanding),
        clearedDues:      Number(stats[0].cleared_dues),
        recentDues,
      },
    });
  } catch (error) {
    console.error("Error fetching faculty dashboard stats:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// GET /api/faculty/dues
export const getMyActiveDues = async (req, res) => {
  try {
    const empCode = req.user.employee_code;

    const dues = await sql`
      SELECT
        fd.*,
        dt.type_name AS due_type_name
      FROM faculty_due fd
      JOIN due_types dt ON fd.due_type_id = dt.id
      WHERE fd.employee_code = ${empCode}
        AND fd.is_cleared = false
      ORDER BY fd.due_clear_by_date ASC NULLS LAST, fd.created_at DESC
    `;

    return res.status(200).json({ success: true, data: dues });
  } catch (error) {
    console.error("Error fetching active faculty dues:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// GET /api/faculty/dues/cleared
export const getClearedDues = async (req, res) => {
  try {
    const empCode = req.user.employee_code;

    const dues = await sql`
      SELECT
        fd.*,
        dt.type_name   AS due_type_name,
        u.username     AS cleared_by
      FROM faculty_due fd
      JOIN due_types dt ON fd.due_type_id = dt.id
      LEFT JOIN users u ON fd.cleared_by_user_id = u.user_id
      WHERE fd.employee_code = ${empCode}
        AND fd.is_cleared = true
      ORDER BY fd.updated_at DESC
    `;

    return res.status(200).json({ success: true, data: dues });
  } catch (error) {
    console.error("Error fetching cleared faculty dues:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// GET /api/faculty/pending-uploads
export const getPendingUploads = async (req, res) => {
  try {
    const empCode = req.user.employee_code;

    const dues = await sql`
      SELECT
        fd.id,
        dt.type_name   AS due_type_name,
        fd.is_payable,
        fd.current_amount,
        fd.due_description,
        fd.needs_original,
        fd.needs_pdf,
        fd.proof_drive_link,
        fd.due_clear_by_date,
        fd.created_at
      FROM faculty_due fd
      JOIN due_types dt ON fd.due_type_id = dt.id
      WHERE fd.employee_code = ${empCode}
        AND fd.is_cleared = false
        AND (fd.needs_original = true OR fd.needs_pdf = true)
      ORDER BY fd.created_at DESC
    `;

    const pending_upload   = dues.filter((d) => !d.proof_drive_link);
    const pending_approval = dues.filter((d) =>  d.proof_drive_link);

    return res.status(200).json({
      success: true,
      data: { all: dues, pending_upload, pending_approval },
    });
  } catch (error) {
    console.error("Error fetching pending uploads:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// POST /api/faculty/dues/:id/upload-document
export const uploadDocument = async (req, res) => {
  try {
    const empCode  = req.user.employee_code;
    const dueId    = Number(req.params.id);
    const { proof_drive_link } = req.body;

    if (!proof_drive_link || !proof_drive_link.trim()) {
      return res.status(400).json({ success: false, message: "Document link is required" });
    }

    // Verify the due belongs to this faculty member and is not already cleared
    const due = await sql`
      SELECT id, is_cleared FROM faculty_due
      WHERE id = ${dueId} AND employee_code = ${empCode}
      LIMIT 1
    `;

    if (due.length === 0) {
      return res.status(404).json({ success: false, message: "Due not found" });
    }
    if (due[0].is_cleared) {
      return res.status(400).json({ success: false, message: "This due is already cleared" });
    }

    await sql`
      UPDATE faculty_due
      SET proof_drive_link = ${proof_drive_link.trim()},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${dueId} AND employee_code = ${empCode}
    `;

    return res.status(200).json({ success: true, message: "Document link submitted successfully" });
  } catch (error) {
    console.error("Error uploading document:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

