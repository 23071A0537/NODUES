import PDFDocument from 'pdfkit';
import { v4 as uuidv4 } from 'uuid';
import { sql } from '../config/db.js';
import { isDriveConfigured, uploadToGoogleDrive } from '../services/googleDriveService.js';
import { calculateTotalOutstanding, enrichDuesWithInterest } from '../services/interestCalculationService.js';
import {
    buildNoDuesStatusRows,
    fetchActiveIssuerNamesForStudent,
    fetchStudentById,
    renderNoDuesFormPdf,
} from '../utils/noDuesForm.js';

const normalizeYesNoField = (value) => {
  const normalized = String(value || '')
    .trim()
    .toUpperCase();

  if (['Y', 'YES', 'TRUE', '1'].includes(normalized)) {
    return 'Y';
  }

  if (['N', 'NO', 'FALSE', '0'].includes(normalized)) {
    return 'N';
  }

  return null;
};

const isValidHttpUrl = (value) => {
  if (!value) {
    return true;
  }

  try {
    const url = new URL(String(value).trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

const parseDueIdentifier = (value) => {
  const rawValue = String(value ?? '').trim();

  if (!rawValue) {
    return null;
  }

  const prefixedMatch = rawValue.match(/^(department|alumni)[:_-](\d+)$/i);
  if (prefixedMatch) {
    return {
      source: prefixedMatch[1].toLowerCase(),
      id: parseInt(prefixedMatch[2], 10),
    };
  }

  const numericId = parseInt(rawValue, 10);
  if (Number.isNaN(numericId)) {
    return null;
  }

  return {
    source: null,
    id: numericId,
  };
};

/**
 * Get student's active dues
 * Query params: status (payable|all), limit, offset
 */
export const getDues = async (req, res) => {
  try {
    const studentId = req.user.user_id;
    const { status = 'payable', limit = 50, offset = 0 } = req.query;
    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
    const parsedOffset = Math.max(parseInt(offset, 10) || 0, 0);

    // Get student's roll number
    const studentResult = await sql`
      SELECT roll_number FROM students WHERE student_id = ${studentId}
    `;

    if (studentResult.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const rollNumber = studentResult[0].roll_number;

    const payableFilter = status === 'payable'
      ? sql`AND dues.is_payable = TRUE`
      : sql``;

    const result = await sql`
      SELECT *
      FROM (
        SELECT 
          dd.id,
          dd.due_type_id,
          dt.type_name,
          dt.description as type_description,
          dt.requires_permission,
          dd.is_payable,
          dd.principal_amount,
          dd.amount_paid,
          dd.is_compounded,
          dd.interest_rate,
          dd.permission_granted,
          dd.supporting_document_link,
          dd.proof_drive_link,
          dd.due_clear_by_date,
          dd.is_cleared,
          dd.overall_status,
          dd.due_description,
          dd.remarks,
          dd.needs_original,
          dd.needs_pdf,
          dd.created_at,
          dd.updated_at,
          d.name as added_by_entity,
          FALSE as is_alumni_due,
          FALSE as is_form_submitted,
          NULL::TIMESTAMPTZ as submitted_at,
          NULL::VARCHAR as status_of_registration_with_alumni_portal,
          NULL::TEXT as linkedin_profile_link,
          NULL::VARCHAR as placement_status,
          NULL::TEXT as proof_of_placement,
          NULL::VARCHAR as planning_for_higher_education,
          NULL::TEXT as proof_of_higher_education
        FROM department_dues dd
        JOIN due_types dt ON dd.due_type_id = dt.id
        LEFT JOIN departments d ON dd.added_by_department_id = d.id
        WHERE dd.student_roll_number = ${rollNumber}

        UNION ALL

        SELECT
          ad.id,
          ad.due_type_id,
          'ALUMINI FORM' as type_name,
          'Alumni form submission required' as type_description,
          FALSE as requires_permission,
          FALSE as is_payable,
          ad.principal_amount,
          ad.amount_paid,
          ad.is_compounded,
          ad.interest_rate,
          ad.permission_granted,
          ad.supporting_document_link,
          ad.proof_drive_link,
          ad.due_clear_by_date,
          ad.is_cleared,
          ad.overall_status,
          ad.due_description,
          NULL::TEXT as remarks,
          ad.needs_original,
          ad.needs_pdf,
          ad.created_at,
          ad.updated_at,
          sec.name as added_by_entity,
          TRUE as is_alumni_due,
          ad.is_form_submitted,
          ad.submitted_at,
          ad.status_of_registration_with_alumni_portal,
          ad.linkedin_profile_link,
          ad.placement_status,
          ad.proof_of_placement,
          ad.planning_for_higher_education,
          ad.proof_of_higher_education
        FROM alumni_dues ad
        LEFT JOIN sections sec ON ad.added_by_section_id = sec.id
        WHERE ad.student_roll_number = ${rollNumber}
      ) dues
      WHERE dues.is_cleared = FALSE
        ${payableFilter}
      ORDER BY dues.due_clear_by_date ASC, dues.created_at DESC
      LIMIT ${parsedLimit} OFFSET ${parsedOffset}
    `;

    // Enrich dues with dynamic interest calculations
    const enrichedDues = enrichDuesWithInterest(result);
    
    // Add status badges based on calculated values
    const duesWithStatus = enrichedDues.map(due => {
      let status_badge = 'info';
      const outstanding = parseFloat(due.calculated_outstanding);
      const principal = parseFloat(due.principal_amount || 0);
      
      if (due.is_cleared) {
        status_badge = 'cleared';
      } else if (due.permission_granted && due.is_payable && due.amount_paid > 0 && outstanding > 0) {
        status_badge = 'partial';
      } else if (due.permission_granted && due.is_payable) {
        status_badge = 'scholarship_approved';
      } else if (due.permission_granted && !due.is_payable) {
        status_badge = 'scholarship_approved';
      } else if (due.amount_paid > 0 && outstanding > 0) {
        status_badge = 'partial';
      } else if (due.is_payable) {
        status_badge = 'payable';
      }
      
      return {
        ...due,
        status_badge,
        // For backwards compatibility and display
        current_amount: due.display_amount,
        outstanding_amount: due.calculated_outstanding
      };
    });

    // Get total count
    const countResult = await sql`
      SELECT COUNT(*) as total
      FROM (
        SELECT dd.id, dd.is_payable, dd.is_cleared
        FROM department_dues dd
        WHERE dd.student_roll_number = ${rollNumber}

        UNION ALL

        SELECT ad.id, FALSE as is_payable, ad.is_cleared
        FROM alumni_dues ad
        WHERE ad.student_roll_number = ${rollNumber}
      ) dues
      WHERE dues.is_cleared = FALSE
        ${payableFilter}
    `;

    // Calculate aggregated totals using interest calculation
    const totalsFilter = status === 'payable'
      ? sql`AND due_totals.is_payable = TRUE`
      : sql``;

    const allDuesForTotals = await sql`
      SELECT *
      FROM (
        SELECT 
          dd.principal_amount,
          dd.amount_paid,
          dd.is_compounded,
          dd.interest_rate,
          dd.created_at,
          dd.is_payable,
          dd.permission_granted,
          dd.is_cleared
        FROM department_dues dd
        WHERE dd.student_roll_number = ${rollNumber}

        UNION ALL

        SELECT
          ad.principal_amount,
          ad.amount_paid,
          ad.is_compounded,
          ad.interest_rate,
          ad.created_at,
          FALSE as is_payable,
          ad.permission_granted,
          ad.is_cleared
        FROM alumni_dues ad
        WHERE ad.student_roll_number = ${rollNumber}
      ) due_totals
      WHERE due_totals.is_cleared = FALSE
        ${totalsFilter}
    `;
    
    const totalsCalc = calculateTotalOutstanding(allDuesForTotals);
    const payableDues = allDuesForTotals.filter(d => d.is_payable || d.permission_granted);
    const payableCalc = calculateTotalOutstanding(payableDues);

    res.json({
      dues: duesWithStatus,
      pagination: {
        total: parseInt(countResult[0].total),
        limit: parsedLimit,
        offset: parsedOffset
      },
      totals: {
        total_dues: allDuesForTotals.length,
        total_outstanding: parseFloat(totalsCalc.totalOutstanding),
        payable_total: parseFloat(payableCalc.totalOutstanding),
        total_interest_accrued: parseFloat(totalsCalc.totalInterest)
      }
    });
  } catch (error) {
    console.error('Error fetching dues:', error);
    res.status(500).json({ error: 'Failed to fetch dues' });
  }
};

/**
 * Get student's dues history (cleared/paid)
 */
export const getDuesHistory = async (req, res) => {
  try {
    const studentId = req.user.user_id;
    const { limit = 50, offset = 0, start_date, end_date, due_type_id } = req.query;
    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
    const parsedOffset = Math.max(parseInt(offset, 10) || 0, 0);

    // Get student's roll number
    const studentResult = await sql`
      SELECT roll_number FROM students WHERE student_id = ${studentId}
    `;

    if (studentResult.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const rollNumber = studentResult[0].roll_number;

    // Build filters
    let dateFilter = sql``;
    let typeFilter = sql``;

    if (start_date) {
      dateFilter = sql`${dateFilter} AND due_history.updated_at >= ${start_date}`;
    }
    if (end_date) {
      dateFilter = sql`${dateFilter} AND due_history.updated_at <= ${end_date}`;
    }
    if (due_type_id) {
      const parsedDueTypeId = parseInt(due_type_id, 10);
      if (!Number.isNaN(parsedDueTypeId)) {
        typeFilter = sql`AND due_history.due_type_id = ${parsedDueTypeId}`;
      }
    }

    const result = await sql`
      SELECT
        due_history.*,
        CASE
          WHEN due_history.due_source = 'department' THEN (
            SELECT json_agg(json_build_object(
              'id', dp.id,
              'paid_amount', dp.paid_amount,
              'payment_reference', dp.payment_reference,
              'payment_method', dp.payment_method,
              'payment_status', dp.payment_status,
              'paid_at', dp.paid_at
            ) ORDER BY dp.paid_at DESC)
            FROM due_payments dp
            WHERE dp.due_id = due_history.id
          )
          ELSE NULL
        END as payments
      FROM (
        SELECT
          dd.id,
          dd.due_type_id,
          dt.type_name,
          dt.description as type_description,
          dt.requires_permission,
          dd.is_payable,
          CASE
            WHEN dd.is_payable = TRUE THEN calculate_compounded_amount(dd.principal_amount, dd.interest_rate, dd.is_compounded, dd.due_clear_by_date)
            ELSE 0::NUMERIC
          END as current_amount,
          dd.principal_amount,
          dd.amount_paid,
          dd.is_compounded,
          dd.interest_rate,
          dd.permission_granted,
          dd.supporting_document_link,
          dd.due_clear_by_date,
          dd.is_cleared,
          dd.due_description,
          dd.remarks,
          dd.proof_drive_link,
          dd.needs_original,
          dd.needs_pdf,
          dd.created_at,
          dd.updated_at,
          d.name as added_by_entity,
          cleared_u.username as cleared_by_username,
          FALSE as is_alumni_due,
          FALSE as is_form_submitted,
          NULL::TIMESTAMPTZ as submitted_at,
          NULL::VARCHAR as status_of_registration_with_alumni_portal,
          NULL::TEXT as linkedin_profile_link,
          NULL::VARCHAR as placement_status,
          NULL::TEXT as proof_of_placement,
          NULL::VARCHAR as planning_for_higher_education,
          NULL::TEXT as proof_of_higher_education,
          'department'::TEXT as due_source
        FROM department_dues dd
        JOIN due_types dt ON dd.due_type_id = dt.id
        LEFT JOIN departments d ON dd.added_by_department_id = d.id
        LEFT JOIN users cleared_u ON dd.cleared_by_user_id = cleared_u.user_id
        WHERE dd.student_roll_number = ${rollNumber}
          AND dd.overall_status = TRUE

        UNION ALL

        SELECT
          ad.id,
          ad.due_type_id,
          'ALUMINI FORM' as type_name,
          'Alumni form submission required' as type_description,
          FALSE as requires_permission,
          FALSE as is_payable,
          0::NUMERIC as current_amount,
          ad.principal_amount,
          ad.amount_paid,
          ad.is_compounded,
          ad.interest_rate,
          ad.permission_granted,
          ad.supporting_document_link,
          ad.due_clear_by_date,
          ad.is_cleared,
          ad.due_description,
          ad.remarks,
          ad.proof_drive_link,
          ad.needs_original,
          ad.needs_pdf,
          ad.created_at,
          ad.updated_at,
          sec.name as added_by_entity,
          cleared_u.username as cleared_by_username,
          TRUE as is_alumni_due,
          ad.is_form_submitted,
          ad.submitted_at,
          ad.status_of_registration_with_alumni_portal,
          ad.linkedin_profile_link,
          ad.placement_status,
          ad.proof_of_placement,
          ad.planning_for_higher_education,
          ad.proof_of_higher_education,
          'alumni'::TEXT as due_source
        FROM alumni_dues ad
        LEFT JOIN sections sec ON ad.added_by_section_id = sec.id
        LEFT JOIN users cleared_u ON ad.cleared_by_user_id = cleared_u.user_id
        WHERE ad.student_roll_number = ${rollNumber}
          AND ad.overall_status = TRUE
      ) due_history
      WHERE TRUE
        ${dateFilter}
        ${typeFilter}
      ORDER BY due_history.updated_at DESC
      LIMIT ${parsedLimit} OFFSET ${parsedOffset}
    `;

    // Get total count
    const countResult = await sql`
      SELECT COUNT(*) as total
      FROM (
        SELECT dd.id, dd.due_type_id, dd.updated_at
        FROM department_dues dd
        WHERE dd.student_roll_number = ${rollNumber}
          AND dd.overall_status = TRUE

        UNION ALL

        SELECT ad.id, ad.due_type_id, ad.updated_at
        FROM alumni_dues ad
        WHERE ad.student_roll_number = ${rollNumber}
          AND ad.overall_status = TRUE
      ) due_history
      WHERE TRUE
        ${dateFilter}
        ${typeFilter}
    `;

    res.json({
      history: result,
      pagination: {
        total: parseInt(countResult[0].total),
        limit: parsedLimit,
        offset: parsedOffset
      }
    });
  } catch (error) {
    console.error('Error fetching dues history:', error);
    res.status(500).json({ error: 'Failed to fetch dues history' });
  }
};

/**
 * Get single due details
 */
export const getDueDetails = async (req, res) => {
  try {
    const studentId = req.user.user_id;
    const { dueId } = req.params;
    const parsedDue = parseDueIdentifier(dueId);

    if (!parsedDue) {
      return res.status(400).json({ error: 'Invalid due ID' });
    }

    // Get student's roll number
    const studentResult = await sql`
      SELECT roll_number FROM students WHERE student_id = ${studentId}
    `;

    if (studentResult.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const rollNumber = studentResult[0].roll_number;

    let result = [];

    if (parsedDue.source !== 'alumni') {
      result = await sql`
        SELECT
          dd.*,
          dt.type_name,
          dt.description as type_description,
          dt.requires_permission,
          d.name as added_by_entity,
          added_u.username as added_by_username,
          cleared_u.username as cleared_by_username,
          FALSE as is_alumni_due,
          'department'::TEXT as due_source,
          (
            SELECT json_agg(json_build_object(
              'id', dp.id,
              'paid_amount', dp.paid_amount,
              'payment_reference', dp.payment_reference,
              'payment_method', dp.payment_method,
              'payment_status', dp.payment_status,
              'gateway_response', dp.gateway_response,
              'paid_at', dp.paid_at
            ) ORDER BY dp.paid_at DESC)
            FROM due_payments dp
            WHERE dp.due_id = dd.id
          ) as payments
        FROM department_dues dd
        JOIN due_types dt ON dd.due_type_id = dt.id
        LEFT JOIN departments d ON dd.added_by_department_id = d.id
        LEFT JOIN users added_u ON dd.added_by_user_id = added_u.user_id
        LEFT JOIN users cleared_u ON dd.cleared_by_user_id = cleared_u.user_id
        WHERE dd.id = ${parsedDue.id}
          AND dd.student_roll_number = ${rollNumber}
        LIMIT 1
      `;
    }

    if (result.length === 0 && parsedDue.source !== 'department') {
      result = await sql`
        SELECT
          ad.*,
          'ALUMINI FORM' as type_name,
          'Alumni form submission required' as type_description,
          FALSE as requires_permission,
          sec.name as added_by_entity,
          added_u.username as added_by_username,
          cleared_u.username as cleared_by_username,
          TRUE as is_alumni_due,
          'alumni'::TEXT as due_source,
          NULL::JSON as payments
        FROM alumni_dues ad
        LEFT JOIN sections sec ON ad.added_by_section_id = sec.id
        LEFT JOIN users added_u ON ad.added_by_user_id = added_u.user_id
        LEFT JOIN users cleared_u ON ad.cleared_by_user_id = cleared_u.user_id
        WHERE ad.id = ${parsedDue.id}
          AND ad.student_roll_number = ${rollNumber}
        LIMIT 1
      `;
    }

    if (result.length === 0) {
      return res.status(404).json({ error: 'Due not found or access denied' });
    }

    res.json(result[0]);
  } catch (error) {
    console.error('Error fetching due details:', error);
    res.status(500).json({ error: 'Failed to fetch due details' });
  }
};

/**
 * Create payment session
 */
export const createPaymentSession = async (req, res) => {
  try {
    const studentId = req.user.user_id;
    const { due_ids, return_url } = req.body;

    if (!due_ids || !Array.isArray(due_ids) || due_ids.length === 0) {
      return res.status(400).json({ error: 'Invalid due_ids' });
    }

    const normalizedDueIds = [];
    for (const dueIdentifier of due_ids) {
      const parsedDue = parseDueIdentifier(dueIdentifier);
      if (!parsedDue) {
        return res.status(400).json({ error: 'Invalid due_ids' });
      }

      if (parsedDue.source === 'alumni') {
        return res.status(400).json({ error: 'Alumni dues are not payable' });
      }

      normalizedDueIds.push(parsedDue.id);
    }

    const uniqueDueIds = Array.from(new Set(normalizedDueIds));

    // Get student's roll number
    const studentResult = await sql`
      SELECT roll_number, name, email FROM students WHERE student_id = ${studentId}
    `;

    if (studentResult.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const student = studentResult[0];

    // Validate dues ownership and payability
    const validationResult = await sql`
      SELECT 
        dd.id,
        dd.principal_amount,
        dd.amount_paid,
        dd.is_compounded,
        dd.interest_rate,
        dd.created_at,
        dd.is_payable,
        dd.permission_granted,
        dd.is_cleared,
        dd.overall_status,
        dd.due_type_id,
        dt.type_name
      FROM department_dues dd
      JOIN due_types dt ON dd.due_type_id = dt.id
      WHERE dd.id = ANY(${uniqueDueIds})
        AND dd.student_roll_number = ${student.roll_number}
    `;

    if (validationResult.length !== uniqueDueIds.length) {
      return res.status(400).json({ 
        error: 'Some dues not found or access denied',
        found: validationResult.length,
        requested: uniqueDueIds.length
      });
    }

    // Check if all dues are payable and calculate outstanding with interest
    const duesWithCalc = validationResult.map(due => {
      const calc = enrichDuesWithInterest([due])[0];
      return {
        ...due,
        outstanding: parseFloat(calc.calculated_outstanding)
      };
    });
    
    const invalidDues = duesWithCalc.filter(due => {
      return due.overall_status || 
             !due.is_payable ||
             due.outstanding <= 0;
    });

    if (invalidDues.length > 0) {
      return res.status(400).json({ 
        error: 'Some dues are not payable',
        invalid_dues: invalidDues.map(d => ({ id: d.id, type_name: d.type_name }))
      });
    }

    // Calculate total outstanding with dynamic interest
    const totalAmount = duesWithCalc.reduce((sum, due) => {
      return sum + due.outstanding;
    }, 0);

    // Create payment session ID
    const sessionId = uuidv4();
    
    const session = {
      session_id: sessionId,
      student_id: studentId,
      student_name: student.name,
      student_email: student.email,
      due_ids: uniqueDueIds,
      total_amount: totalAmount,
      return_url: return_url || '/student/dues',
      created_at: new Date()
    };

    // Store session (using global)
    global.paymentSessions = global.paymentSessions || {};
    global.paymentSessions[sessionId] = session;

    // Return payment session details
    res.json({
      payment_id: sessionId,
      redirect_url: `/api/payments/gateway/${sessionId}`,
      total_amount: totalAmount,
      due_items: duesWithCalc.map(due => ({
        id: due.id,
        type_name: due.type_name,
        amount: due.outstanding
      }))
    });
  } catch (error) {
    console.error('Error creating payment session:', error);
    res.status(500).json({ error: 'Failed to create payment session' });
  }
};

/**
 * Get payment status
 */
export const getPaymentStatus = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const studentId = req.user.user_id;

    // Check if this is a session ID
    const session = global.paymentSessions?.[paymentId];
    
    if (session) {
      // Check if student owns this session
      if (session.student_id !== studentId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      return res.json({
        session_id: paymentId,
        status: 'pending',
        total_amount: session.total_amount,
        created_at: session.created_at
      });
    }

    // Check in due_payments table
    const result = await sql`
      SELECT 
        dp.*,
        dd.student_roll_number
      FROM due_payments dp
      JOIN department_dues dd ON dp.due_id = dd.id
      WHERE dp.payment_reference = ${paymentId}
      LIMIT 1
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Verify ownership
    const studentResult = await sql`
      SELECT roll_number FROM students WHERE student_id = ${studentId}
    `;

    if (studentResult[0].roll_number !== result[0].student_roll_number) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(result[0]);
  } catch (error) {
    console.error('Error fetching payment status:', error);
    res.status(500).json({ error: 'Failed to fetch payment status' });
  }
};

/**
 * Generate due form PDF
 */
export const getDueFormPDF = async (req, res) => {
  try {
    const studentId = req.user.user_id;
    const { dueId } = req.params;
    const parsedDue = parseDueIdentifier(dueId);

    if (!parsedDue) {
      return res.status(400).json({ error: 'Invalid due ID' });
    }

    const printableDueId = parsedDue.id;

    let result = [];

    // Get student and due details
    if (parsedDue.source !== 'alumni') {
      result = await sql`
        SELECT
          s.name as student_name,
          s.roll_number,
          s.branch,
          s.section,
          s.email,
          s.mobile,
          dd.*, 
          dt.type_name,
          dt.description as type_description,
          d.name as added_by_entity,
          'department'::TEXT as due_source
        FROM students s
        JOIN department_dues dd ON s.roll_number = dd.student_roll_number
        JOIN due_types dt ON dd.due_type_id = dt.id
        LEFT JOIN departments d ON dd.added_by_department_id = d.id
        WHERE s.student_id = ${studentId}
          AND dd.id = ${parsedDue.id}
        LIMIT 1
      `;
    }

    if (result.length === 0 && parsedDue.source !== 'department') {
      result = await sql`
        SELECT
          s.name as student_name,
          s.roll_number,
          s.branch,
          s.section,
          s.email,
          s.mobile,
          ad.*,
          'ALUMINI FORM' as type_name,
          'Alumni form submission required' as type_description,
          sec.name as added_by_entity,
          'alumni'::TEXT as due_source
        FROM students s
        JOIN alumni_dues ad ON s.roll_number = ad.student_roll_number
        LEFT JOIN sections sec ON ad.added_by_section_id = sec.id
        WHERE s.student_id = ${studentId}
          AND ad.id = ${parsedDue.id}
        LIMIT 1
      `;
    }

    if (result.length === 0) {
      return res.status(404).json({ error: 'Due not found or access denied' });
    }

    const data = result[0];

    // Generate PDF in official VNRVJIET No Dues format
    const doc = new PDFDocument({ 
      margin: 60,
      size: 'A4',
      info: {
        Title: 'No Dues Certificate',
        Author: 'VNRVJIET',
        Subject: 'No Dues Certificate'
      }
    });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=No_dues_${data.roll_number}_${printableDueId}.pdf`);
    
    doc.pipe(res);

    // College Header
    doc.fontSize(18).font('Helvetica-Bold')
       .text('VALLURUPALLI NAGESWARA RAO VIGNANA JYOTHI', { align: 'center' });
    doc.fontSize(16).text('INSTITUTE OF ENGINEERING AND TECHNOLOGY', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica')
       .text('(Autonomous)', { align: 'center' });
    doc.fontSize(9).text('Bachupally, Kukatpally, Hyderabad - 500 090', { align: 'center' });
    
    doc.moveDown(1.5);
    
    // Title
    doc.fontSize(14).font('Helvetica-Bold')
       .text('NO DUES CERTIFICATE', { align: 'center', underline: true });
    
    doc.moveDown(1.5);

    // Certificate Number and Date
    const certDate = new Date().toLocaleDateString('en-IN', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
    doc.fontSize(10).font('Helvetica');
    doc.text(`Certificate No: VNRVJIET/ND/${new Date().getFullYear()}/${printableDueId}`, { align: 'left' });
    doc.text(`Date: ${certDate}`, { align: 'right' });
    doc.moveDown(1.5);

    // Student Details in table format
    doc.fontSize(11).font('Helvetica-Bold');
    doc.text('Student Details:', { underline: true });
    doc.moveDown(0.5);
    
    doc.fontSize(10).font('Helvetica');
    const leftCol = 100;
    const rightCol = 350;
    let yPos = doc.y;
    
    doc.text('Name:', 60, yPos);
    doc.text(data.student_name.toUpperCase(), leftCol, yPos);
    doc.text('Roll Number:', 280, yPos);
    doc.text(data.roll_number, rightCol, yPos);
    
    yPos += 20;
    doc.text('Branch:', 60, yPos);
    doc.text(data.branch, leftCol, yPos);
    doc.text('Section:', 280, yPos);
    doc.text(data.section, rightCol, yPos);
    
    if (data.email) {
      yPos += 20;
      doc.text('Email:', 60, yPos);
      doc.text(data.email, leftCol, yPos);
    }
    
    doc.y = yPos + 30;
    doc.moveDown(1);

    // Due Details
    doc.fontSize(11).font('Helvetica-Bold');
    doc.text('Due Clearance Details:', { underline: true });
    doc.moveDown(0.5);
    
    doc.fontSize(10).font('Helvetica');
    doc.text(`Department/Section: ${data.added_by_entity}`);
    doc.text(`Due Type: ${data.type_name}`);
    if (data.due_description) {
      doc.text(`Description: ${data.due_description}`);
    }
    doc.text(`Due Clearance Date: ${new Date(data.due_clear_by_date).toLocaleDateString('en-IN')}`);
    
    if (data.is_payable) {
      doc.moveDown(0.5);
      doc.fontSize(11).font('Helvetica-Bold').text('Payment Details:');
      doc.fontSize(10).font('Helvetica');
      doc.text(`Total Amount: ₹${parseFloat(data.current_amount).toFixed(2)}`);
      doc.text(`Amount Paid: ₹${parseFloat(data.amount_paid || 0).toFixed(2)}`);
      const outstanding = parseFloat(data.current_amount) - parseFloat(data.amount_paid || 0);
      doc.font('Helvetica-Bold').text(`Outstanding Amount: ₹${outstanding.toFixed(2)}`, {
        underline: outstanding > 0
      });
    } else {
      doc.text(`Document Requirement: ${data.needs_original ? 'Original Document' : data.needs_pdf ? 'PDF Document' : 'As specified'}`);
    }
    
    doc.moveDown(1);
    doc.fontSize(10).font('Helvetica-Bold');
    const statusText = data.is_cleared ? 'CLEARED' : 'PENDING CLEARANCE';
    doc.fillColor(data.is_cleared ? 'green' : 'red')
       .text(`Status: ${statusText}`, { underline: true });
    doc.fillColor('black');
    
    doc.moveDown(2);

    // Certification Statement (only if cleared)
    if (data.is_cleared) {
      doc.fontSize(11).font('Helvetica');
      doc.text('This is to certify that the above-mentioned student has cleared all dues ', { continued: true });
      doc.text(`pertaining to ${data.type_name} from ${data.added_by_entity}.`);
      doc.moveDown(1);
    }

    // Remarks
    if (data.remarks) {
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('Remarks:', { underline: true });
      doc.fontSize(10).font('Helvetica');
      doc.text(data.remarks);
      doc.moveDown(1.5);
    }

    // Signatures
    doc.moveDown(3);
    const signatureY = doc.y;
    
    doc.fontSize(10).font('Helvetica');
    doc.text('_______________________', 60, signatureY);
    doc.text('Student Signature', 70, signatureY + 25);
    doc.text(`(${data.student_name})`, 60, signatureY + 40, { width: 150, align: 'center' });
    
    doc.text('_______________________', 350, signatureY);
    doc.text('Authorized Signatory', 350, signatureY + 25);
    doc.text(`${data.added_by_entity}`, 340, signatureY + 40, { width: 150, align: 'center' });

    // Footer
    doc.fontSize(8).font('Helvetica-Oblique');
    doc.text(
      'This is a computer-generated document. For verification, please contact the respective department.',
      60,
      750,
      { align: 'center', width: 475 }
    );
    
    doc.fontSize(7).text(
      `Generated on: ${new Date().toLocaleString('en-IN')} | Document ID: ND-${printableDueId}-${Date.now()}`,
      60,
      765,
      { align: 'center', width: 475 }
    );

    doc.end();
  } catch (error) {
    console.error('Error generating due form PDF:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
};

/**
 * Generate receipt PDF
 */
export const getReceiptPDF = async (req, res) => {
  try {
    const studentId = req.user.user_id;
    const { dueId } = req.params;
    const parsedDue = parseDueIdentifier(dueId);

    if (!parsedDue) {
      return res.status(400).json({ error: 'Invalid due ID' });
    }

    if (parsedDue.source === 'alumni') {
      return res.status(400).json({ error: 'Receipt is available only for payable department dues' });
    }

    const printableDueId = parsedDue.id;

    // Get payment and due details
    const result = await sql`
      SELECT 
        s.name as student_name,
        s.roll_number,
        s.branch,
        s.section,
        s.email,
        dd.*,
        dt.type_name,
        d.name as added_by_entity,
        (
          SELECT json_agg(json_build_object(
            'paid_amount', dp.paid_amount,
            'payment_reference', dp.payment_reference,
            'payment_method', dp.payment_method,
            'payment_status', dp.payment_status,
            'paid_at', dp.paid_at
          ) ORDER BY dp.paid_at DESC)
          FROM due_payments dp
          WHERE dp.due_id = dd.id AND dp.payment_status = 'SUCCESS'
        ) as payments
      FROM students s
      JOIN department_dues dd ON s.roll_number = dd.student_roll_number
      JOIN due_types dt ON dd.due_type_id = dt.id
      LEFT JOIN departments d ON dd.added_by_department_id = d.id
      WHERE s.student_id = ${studentId}
        AND dd.id = ${parsedDue.id}
      LIMIT 1
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'Due not found or access denied' });
    }

    const data = result[0];

    if (!data.payments || data.payments.length === 0) {
      return res.status(404).json({ error: 'No successful payments found for this due' });
    }

    // Generate professional payment receipt PDF
    const doc = new PDFDocument({ 
      margin: 60,
      size: 'A4',
      info: {
        Title: 'Payment Receipt',
        Author: 'VNRVJIET',
        Subject: 'Payment Receipt'
      }
    });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Receipt_${data.roll_number}_${printableDueId}.pdf`);
    
    doc.pipe(res);

    // College Header
    doc.fontSize(18).font('Helvetica-Bold')
       .text('VALLURUPALLI NAGESWARA RAO VIGNANA JYOTHI', { align: 'center' });
    doc.fontSize(16).text('INSTITUTE OF ENGINEERING AND TECHNOLOGY', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica')
       .text('(Autonomous)', { align: 'center' });
    doc.fontSize(9).text('Bachupally, Kukatpally, Hyderabad - 500 090', { align: 'center' });
    
    doc.moveDown(1.5);
    
    // Receipt Title
    doc.fontSize(14).font('Helvetica-Bold')
       .text('PAYMENT RECEIPT', { align: 'center', underline: true });
    
    doc.moveDown(1);

    // Receipt Number and Date
    const receiptDate = new Date().toLocaleDateString('en-IN', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
    doc.fontSize(10).font('Helvetica');
    doc.text(`Receipt No: VNRVJIET/REC/${new Date().getFullYear()}/${printableDueId}/${Date.now().toString().slice(-6)}`, { align: 'left' });
    doc.text(`Date: ${receiptDate}`, { align: 'right' });
    doc.moveDown(1.5);

    // Student Details
    doc.fontSize(11).font('Helvetica-Bold');
    doc.text('Received from:', { underline: true });
    doc.moveDown(0.5);
    
    doc.fontSize(10).font('Helvetica');
    doc.text(`Name: ${data.student_name.toUpperCase()}`);
    doc.text(`Roll Number: ${data.roll_number}`);
    doc.text(`Branch: ${data.branch} | Section: ${data.section}`);
    if (data.email) doc.text(`Email: ${data.email}`);
    
    doc.moveDown(1.5);

    // Payment Details Box
    doc.fontSize(11).font('Helvetica-Bold');
    doc.text('Payment Details:', { underline: true });
    doc.moveDown(0.5);
    
    doc.fontSize(10).font('Helvetica');
    doc.text(`Towards: ${data.type_name}`);
    doc.text(`Department/Section: ${data.added_by_entity}`);
    if (data.due_description) {
      doc.text(`Description: ${data.due_description}`);
    }
    doc.moveDown(1);

    // Amount Summary
    doc.rect(60, doc.y, 475, 80).stroke();
    const boxY = doc.y + 10;
    
    doc.fontSize(10).font('Helvetica');
    doc.text('Total Due Amount:', 70, boxY);
    doc.text(`₹ ${parseFloat(data.current_amount).toFixed(2)}`, 400, boxY, { width: 125, align: 'right' });
    
    doc.text('Total Amount Paid:', 70, boxY + 25);
    doc.fontSize(12).font('Helvetica-Bold');
    doc.text(`₹ ${parseFloat(data.amount_paid).toFixed(2)}`, 400, boxY + 23, { width: 125, align: 'right' });
    
    const outstanding = parseFloat(data.current_amount) - parseFloat(data.amount_paid);
    doc.fontSize(10).font('Helvetica');
    doc.text('Outstanding Balance:', 70, boxY + 50);
    doc.fillColor(outstanding > 0 ? 'red' : 'green');
    doc.text(`₹ ${outstanding.toFixed(2)}`, 400, boxY + 50, { width: 125, align: 'right' });
    doc.fillColor('black');
    
    doc.moveDown(5);

    // Transaction Details
    doc.fontSize(11).font('Helvetica-Bold');
    doc.text('Transaction History:', { underline: true });
    doc.moveDown(0.5);
    
    doc.fontSize(9).font('Helvetica');
    
    // Table header
    const tableTop = doc.y;
    doc.rect(60, tableTop, 475, 20).fillAndStroke('#f0f0f0', '#000');
    doc.fillColor('black').font('Helvetica-Bold');
    doc.text('S.No', 70, tableTop + 5, { width: 40 });
    doc.text('Date & Time', 115, tableTop + 5, { width: 120 });
    doc.text('Reference No', 240, tableTop + 5, { width: 120 });
    doc.text('Method', 365, tableTop + 5, { width: 80 });
    doc.text('Amount (₹)', 450, tableTop + 5, { width: 75, align: 'right' });
    
    doc.font('Helvetica');
    let currentY = tableTop + 25;
    
    data.payments.forEach((payment, index) => {
      if (currentY > 700) {
        doc.addPage();
        currentY = 60;
      }
      
      doc.rect(60, currentY, 475, 25).stroke();
      doc.text(`${index + 1}`, 70, currentY + 5, { width: 40 });
      doc.text(
        new Date(payment.paid_at).toLocaleString('en-IN', { 
          day: '2-digit', 
          month: 'short', 
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }), 
        115, currentY + 5, { width: 120 }
      );
      doc.text(payment.payment_reference, 240, currentY + 5, { width: 120 });
      doc.text(payment.payment_method, 365, currentY + 5, { width: 80 });
      doc.font('Helvetica-Bold');
      doc.text(parseFloat(payment.paid_amount).toFixed(2), 450, currentY + 5, { width: 75, align: 'right' });
      doc.font('Helvetica');
      
      currentY += 25;
    });
    
    doc.moveDown(2);
    
    // Amount in words
    const amountInWords = numberToWords(parseFloat(data.amount_paid));
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text(`Amount in Words: ${amountInWords} Only`, { underline: true });
    
    doc.moveDown(2);

    // Signature
    const signY = doc.y + 30;
    doc.fontSize(10).font('Helvetica');
    doc.text('_______________________', 370, signY);
    doc.text('Authorized Signatory', 380, signY + 25);
    doc.text(`${data.added_by_entity}`, 360, signY + 40, { width: 150, align: 'center' });

    // Footer
    doc.fontSize(8).font('Helvetica-Oblique');
    doc.text(
      'This is a computer-generated receipt and does not require a physical signature. For verification, please contact the accounts department.',
      60,
      750,
      { align: 'center', width: 475 }
    );
    
    doc.fontSize(7).text(
      `Generated on: ${new Date().toLocaleString('en-IN')} | Receipt ID: REC-${printableDueId}-${Date.now()}`,
      60,
      765,
      { align: 'center', width: 475 }
    );

    doc.end();
  } catch (error) {
    console.error('Error generating receipt PDF:', error);
    res.status(500).json({ error: 'Failed to generate receipt' });
  }
};

/**
 * Generate no dues form PDF for student
 */
export const getNoDuesFormPdf = async (req, res) => {
  try {
    const studentId = req.user.user_id;
    const { table = 'template' } = req.query;

    const student = await fetchStudentById(studentId);
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const activeIssuerNames = await fetchActiveIssuerNamesForStudent(
      student.roll_number,
    );
    const noDuesForm = buildNoDuesStatusRows(activeIssuerNames);
    const isExtra = String(table).toLowerCase() === 'extra';

    const rows = isExtra ? noDuesForm.extraRows : noDuesForm.templateRows;
    const tableTitle = isExtra
      ? 'Additional Departments/Sections (Not in Form)'
      : null;
    const filename = `No_Dues_Form_${student.roll_number}_${isExtra ? 'extra' : 'main'}.pdf`;

    renderNoDuesFormPdf({
      res,
      student,
      rows,
      tableTitle,
      filename,
      includeMentorNote: !isExtra,
    });
  } catch (error) {
    console.error('Error generating no dues form PDF:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
};

/**
 * Submit alumni form details for a student-assigned alumni due
 */
export const submitAlumniDueForm = async (req, res) => {
  try {
    const studentId = req.user.user_id;
    const { dueId } = req.params;
    const parsedDue = parseDueIdentifier(dueId);

    if (!parsedDue) {
      return res.status(400).json({ error: 'Invalid due ID' });
    }

    if (parsedDue.source === 'department') {
      return res.status(400).json({ error: 'Alumni form submission is only allowed for alumni dues' });
    }

    const {
      registration_with_alumni_portal,
      linkedin_profile_link,
      placement_status,
      proof_of_placement,
      planning_higher_education,
      proof_of_higher_education,
    } = req.body;

    const studentResult = await sql`
      SELECT roll_number
      FROM students
      WHERE student_id = ${studentId}
    `;

    if (studentResult.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const rollNumber = studentResult[0].roll_number;

    const dueResult = await sql`
      SELECT id, is_form_submitted, is_cleared
      FROM alumni_dues
      WHERE id = ${parsedDue.id}
        AND student_roll_number = ${rollNumber}
      LIMIT 1
    `;

    if (dueResult.length === 0) {
      return res.status(404).json({ error: 'Alumni due not found or access denied' });
    }

    if (dueResult[0].is_form_submitted || dueResult[0].is_cleared) {
      return res.status(400).json({ error: 'Alumni form is already submitted for this due' });
    }

    const registrationStatus = normalizeYesNoField(registration_with_alumni_portal);
    const placementStatus = normalizeYesNoField(placement_status);
    const higherEducationStatus = normalizeYesNoField(planning_higher_education);

    if (!registrationStatus) {
      return res.status(400).json({
        error: 'Status of Registration with Alumni Portal must be Y or N',
      });
    }

    if (!placementStatus) {
      return res.status(400).json({ error: 'Placement Status must be Y or N' });
    }

    if (!higherEducationStatus) {
      return res.status(400).json({
        error: 'Planning for Higher Education must be Y or N',
      });
    }

    const linkedinLink = String(linkedin_profile_link || '').trim();
    const proofOfPlacement = String(proof_of_placement || '').trim();
    const proofOfHigherEducation = String(proof_of_higher_education || '').trim();

    if (!linkedinLink) {
      return res.status(400).json({ error: 'LinkedIn Profile Link is required' });
    }

    if (!isValidHttpUrl(linkedinLink)) {
      return res.status(400).json({ error: 'LinkedIn Profile Link must be a valid URL' });
    }

    if (placementStatus === 'Y' && !proofOfPlacement) {
      return res.status(400).json({
        error: 'Proof of Placement is required when Placement Status is Y',
      });
    }

    if (proofOfPlacement && !isValidHttpUrl(proofOfPlacement)) {
      return res.status(400).json({ error: 'Proof of Placement must be a valid URL' });
    }

    if (higherEducationStatus === 'Y' && !proofOfHigherEducation) {
      return res.status(400).json({
        error: 'Proof of Higher Education is required when Planning for Higher Education is Y',
      });
    }

    if (proofOfHigherEducation && !isValidHttpUrl(proofOfHigherEducation)) {
      return res.status(400).json({
        error: 'Proof of Higher Education must be a valid URL',
      });
    }

    const updated = await sql`
      UPDATE alumni_dues
      SET
        status_of_registration_with_alumni_portal = ${registrationStatus},
        linkedin_profile_link = ${linkedinLink},
        placement_status = ${placementStatus},
        proof_of_placement = ${proofOfPlacement || null},
        planning_for_higher_education = ${higherEducationStatus},
        proof_of_higher_education = ${proofOfHigherEducation || null},
        is_form_submitted = TRUE,
        submitted_at = CURRENT_TIMESTAMP,
        permission_granted = TRUE,
        overall_status = TRUE,
        is_cleared = TRUE,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${parsedDue.id}
        AND student_roll_number = ${rollNumber}
      RETURNING *
    `;

    return res.status(200).json({
      success: true,
      message: 'Alumni form submitted successfully',
      data: updated[0],
    });
  } catch (error) {
    console.error('Error submitting alumni due form:', error);
    return res.status(500).json({ error: 'Failed to submit alumni due form' });
  }
};

// Helper function to convert number to words (Indian numbering system)
function numberToWords(num) {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  
  if (num === 0) return 'Zero';
  
  const [rupees, paise] = num.toFixed(2).split('.');
  const rupeesNum = parseInt(rupees);
  const paiseNum = parseInt(paise);
  
  let words = '';
  
  // Crores
  if (rupeesNum >= 10000000) {
    words += convertThreeDigits(Math.floor(rupeesNum / 10000000)) + ' Crore ';
  }
  
  // Lakhs
  const lakhs = Math.floor((rupeesNum % 10000000) / 100000);
  if (lakhs > 0) {
    words += convertTwoDigits(lakhs) + ' Lakh ';
  }
  
  // Thousands
  const thousands = Math.floor((rupeesNum % 100000) / 1000);
  if (thousands > 0) {
    words += convertTwoDigits(thousands) + ' Thousand ';
  }
  
  // Hundreds
  const hundreds = Math.floor((rupeesNum % 1000) / 100);
  if (hundreds > 0) {
    words += ones[hundreds] + ' Hundred ';
  }
  
  // Tens and ones
  const remainder = rupeesNum % 100;
  if (remainder > 0) {
    if (remainder < 10) {
      words += ones[remainder];
    } else if (remainder < 20) {
      words += teens[remainder - 10];
    } else {
      words += tens[Math.floor(remainder / 10)];
      if (remainder % 10 > 0) {
        words += ' ' + ones[remainder % 10];
      }
    }
  }
  
  words += ' Rupees';
  
  if (paiseNum > 0) {
    words += ' and ' + convertTwoDigits(paiseNum) + ' Paise';
  }
  
  return words.trim();
}

function convertTwoDigits(num) {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  
  if (num < 10) return ones[num];
  if (num < 20) return teens[num - 10];
  return tens[Math.floor(num / 10)] + (num % 10 > 0 ? ' ' + ones[num % 10] : '');
}

function convertThreeDigits(num) {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  let words = '';
  
  const hundreds = Math.floor(num / 100);
  if (hundreds > 0) {
    words += ones[hundreds] + ' Hundred ';
  }
  
  const remainder = num % 100;
  if (remainder > 0) {
    words += convertTwoDigits(remainder);
  }
  
  return words.trim();
}

const normalizeDocumentTypeLabel = (value = '') =>
  value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');

const COPY_DOCUMENT_TYPE_ALIASES = {
  internship: ['internship', 'intership', 'internship letter'],
  offer: ['offer', 'offer letter']
};

const classifyCopyDocumentUploadType = (documentTypeLabel = '') => {
  const normalizedLabel = normalizeDocumentTypeLabel(documentTypeLabel);

  if (!normalizedLabel) {
    return 'other-document';
  }

  const hasInternshipAlias = COPY_DOCUMENT_TYPE_ALIASES.internship.some(
    (alias) => normalizedLabel === alias || normalizedLabel.includes(alias)
  );

  if (hasInternshipAlias) {
    return 'internship-document';
  }

  const hasOfferAlias = COPY_DOCUMENT_TYPE_ALIASES.offer.some(
    (alias) => normalizedLabel === alias || normalizedLabel.includes(alias)
  );

  if (hasOfferAlias) {
    return 'offer-document';
  }

  return 'other-document';
};

/**
 * Upload document for non-payable dues
 */
/**
 * Upload document for non-payable due
 * Now handles direct file upload to Google Drive
 */
export const uploadDocument = async (req, res) => {
  try {
    const studentId = req.user.user_id;
    const { dueId } = req.params;
    const parsedDue = parseDueIdentifier(dueId);

    if (!parsedDue) {
      return res.status(400).json({ error: 'Invalid due ID' });
    }

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded. Please select a file.' });
    }

    // Check if Google Drive is configured
    if (!isDriveConfigured()) {
      return res.status(503).json({ 
        error: 'File upload service not configured. Please contact administrator.',
        details: 'Google Drive API credentials are missing or incomplete.'
      });
    }

    // Get student's roll number
    const studentResult = await sql`
      SELECT roll_number FROM students WHERE student_id = ${studentId}
    `;

    if (studentResult.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const rollNumber = studentResult[0].roll_number;

    // Verify due ownership and that it requires documentation
    let dueResult = [];

    if (parsedDue.source !== 'alumni') {
      dueResult = await sql`
        SELECT
          dd.id,
          dd.is_payable,
          dd.needs_original,
          dd.needs_pdf,
          dd.is_cleared,
          dd.proof_drive_link,
          dd.due_description,
          dt.type_name AS due_type_name,
          'department'::TEXT as due_source
        FROM department_dues dd
        JOIN due_types dt ON dd.due_type_id = dt.id
        WHERE dd.id = ${parsedDue.id}
          AND dd.student_roll_number = ${rollNumber}
        LIMIT 1
      `;
    }

    if (dueResult.length === 0 && parsedDue.source !== 'department') {
      dueResult = await sql`
        SELECT
          ad.id,
          ad.is_payable,
          ad.needs_original,
          ad.needs_pdf,
          ad.is_cleared,
          ad.proof_drive_link,
          ad.due_description,
          'ALUMINI FORM' as due_type_name,
          'alumni'::TEXT as due_source
        FROM alumni_dues ad
        WHERE ad.id = ${parsedDue.id}
          AND ad.student_roll_number = ${rollNumber}
        LIMIT 1
      `;
    }

    if (dueResult.length === 0) {
      return res.status(404).json({ error: 'Due not found or access denied' });
    }

    const due = dueResult[0];

    // Check if due requires documentation
    if (due.is_payable) {
      return res.status(400).json({ 
        error: 'This is a payable due. Please use payment gateway instead.' 
      });
    }

    if (!due.needs_original && !due.needs_pdf) {
      return res.status(400).json({ 
        error: 'This due does not require document upload' 
      });
    }

    if (due.is_cleared) {
      return res.status(400).json({ 
        error: 'This due is already cleared' 
      });
    }

    const requestedDocumentType =
      req.body?.documentType ||
      req.body?.document_type ||
      req.body?.documentTypeName ||
      '';

    // For copy uploads (PDF), route by document type with internship/offer/other fallback.
    const resolvedDocumentType =
      requestedDocumentType || due.due_description || due.due_type_name || '';
    const driveUploadType = due.needs_pdf
      ? classifyCopyDocumentUploadType(resolvedDocumentType)
      : 'document';

    // Upload file to Google Drive
    // Filename will be: {due_id}_{student_roll_number}.{extension}
    const uploadResult = await uploadToGoogleDrive(
      req.file,
      parsedDue.id,
      rollNumber,
      driveUploadType
    );

    // Update the due with Google Drive link - clears remarks field (previous rejection reason)
    const updateResult = due.due_source === 'department'
      ? await sql`
          UPDATE department_dues
          SET 
            proof_drive_link = ${uploadResult.webViewLink},
            remarks = NULL,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ${parsedDue.id}
            AND student_roll_number = ${rollNumber}
          RETURNING *
        `
      : await sql`
          UPDATE alumni_dues
          SET 
            proof_drive_link = ${uploadResult.webViewLink},
            remarks = NULL,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ${parsedDue.id}
            AND student_roll_number = ${rollNumber}
          RETURNING *
        `;

    res.json({
      success: true,
      message: 'Document uploaded successfully to Google Drive. Awaiting operator approval.',
      due: updateResult[0],
      due_source: due.due_source,
      upload: {
        fileName: uploadResult.fileName,
        fileId: uploadResult.fileId,
        fileLink: uploadResult.webViewLink,
        uploadType: uploadResult.uploadType,
        documentTypeUsed: resolvedDocumentType || null
      }
    });
  } catch (error) {
    console.error('Error uploading document:', error);
    res.status(500).json({ 
      error: 'Failed to upload document',
      details: error.message 
    });
  }
};

/**
 * Get pending uploads (dues that need documentation)
 */
export const getPendingUploads = async (req, res) => {
  try {
    const studentId = req.user.user_id;

    // Get student's roll number
    const studentResult = await sql`
      SELECT roll_number FROM students WHERE student_id = ${studentId}
    `;

    if (studentResult.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const rollNumber = studentResult[0].roll_number;

    // Get all non-payable dues that need documentation and are not cleared
    const result = await sql`
      SELECT *
      FROM (
        SELECT
          dd.id,
          dd.due_type_id,
          dt.type_name,
          dt.description as type_description,
          dd.is_payable,
          dd.needs_original,
          dd.needs_pdf,
          dd.due_clear_by_date,
          dd.is_cleared,
          dd.overall_status,
          dd.due_description,
          dd.proof_drive_link,
          dd.remarks,
          dd.created_at,
          dd.updated_at,
          d.name as issuing_department,
          'department'::TEXT as due_source
        FROM department_dues dd
        JOIN due_types dt ON dd.due_type_id = dt.id
        LEFT JOIN departments d ON dd.added_by_department_id = d.id
        WHERE dd.student_roll_number = ${rollNumber}
          AND dd.is_payable = FALSE
          AND (dd.needs_original = TRUE OR dd.needs_pdf = TRUE)
          AND dd.is_cleared = FALSE

        UNION ALL

        SELECT
          ad.id,
          ad.due_type_id,
          'ALUMINI FORM' as type_name,
          'Alumni form submission required' as type_description,
          FALSE as is_payable,
          ad.needs_original,
          ad.needs_pdf,
          ad.due_clear_by_date,
          ad.is_cleared,
          ad.overall_status,
          ad.due_description,
          ad.proof_drive_link,
          ad.remarks,
          ad.created_at,
          ad.updated_at,
          sec.name as issuing_department,
          'alumni'::TEXT as due_source
        FROM alumni_dues ad
        LEFT JOIN sections sec ON ad.added_by_section_id = sec.id
        WHERE ad.student_roll_number = ${rollNumber}
          AND ad.is_payable = FALSE
          AND (ad.needs_original = TRUE OR ad.needs_pdf = TRUE)
          AND ad.is_cleared = FALSE
      ) pending_due_uploads
      ORDER BY pending_due_uploads.due_clear_by_date ASC, pending_due_uploads.updated_at DESC
    `;

    // Categorize dues using proof link / remarks state.
    const uploads = result.map((due) => {
      const status = due.proof_drive_link
        ? 'pending_approval'
        : due.remarks
          ? 'rejected'
          : 'pending_upload';

      return {
        ...due,
        status,
        rejection_reason: due.remarks || null,
      };
    });

    const pending_upload = uploads.filter((due) => due.status === 'pending_upload');
    const pending_approval = uploads.filter((due) => due.status === 'pending_approval');
    const rejected = uploads.filter((due) => due.status === 'rejected');

    res.json({
      uploads,
      pending_upload,
      pending_approval,
      rejected,
      total: uploads.length
    });
  } catch (error) {
    console.error('Error fetching pending uploads:', error);
    res.status(500).json({ error: 'Failed to fetch pending uploads' });
  }
};
