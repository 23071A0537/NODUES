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

/**
 * Get student's active dues
 * Query params: status (payable|all), limit, offset
 */
export const getDues = async (req, res) => {
  try {
    const studentId = req.user.user_id;
    const { status = 'payable', limit = 50, offset = 0 } = req.query;

    // Get student's roll number
    const studentResult = await sql`
      SELECT roll_number FROM students WHERE student_id = ${studentId}
    `;

    if (studentResult.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const rollNumber = studentResult[0].roll_number;

    // Build query based on status filter - return all dues, frontend will filter  
    let payableFilter = status === 'payable' 
      ? sql`AND sd.is_payable = TRUE` 
      : sql``;

    const result = await sql`
      SELECT 
        sd.id,
        sd.due_type_id,
        dt.type_name,
        dt.description as type_description,
        dt.requires_permission,
        sd.is_payable,
        sd.principal_amount,
        sd.amount_paid,
        sd.is_compounded,
        sd.interest_rate,
        sd.permission_granted,
        sd.supporting_document_link,
        sd.proof_drive_link,
        sd.due_clear_by_date,
        sd.is_cleared,
        sd.overall_status,
        sd.due_description,
        sd.remarks,
        sd.needs_original,
        sd.needs_pdf,
        sd.created_at,
        sd.updated_at,
        CASE 
          WHEN sd.added_by_department_id IS NOT NULL THEN d.name
          ELSE s.name
        END as added_by_entity
      FROM student_dues sd
      JOIN due_types dt ON sd.due_type_id = dt.id
      LEFT JOIN departments d ON sd.added_by_department_id = d.id
      LEFT JOIN sections s ON sd.added_by_section_id = s.id
      WHERE sd.student_roll_number = ${rollNumber} AND sd.is_cleared = FALSE
        ${payableFilter}
      ORDER BY sd.due_clear_by_date ASC, sd.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
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
      FROM student_dues sd
      WHERE sd.student_roll_number = ${rollNumber} AND sd.is_cleared = FALSE
        ${payableFilter}
    `;

    // Calculate aggregated totals using interest calculation
    const allDuesForTotals = await sql`
      SELECT 
        sd.principal_amount,
        sd.amount_paid,
        sd.is_compounded,
        sd.interest_rate,
        sd.created_at,
        sd.is_payable,
        sd.permission_granted
      FROM student_dues sd
      WHERE sd.student_roll_number = ${rollNumber} AND sd.is_cleared = FALSE
        ${payableFilter}
    `;
    
    const totalsCalc = calculateTotalOutstanding(allDuesForTotals);
    const payableDues = allDuesForTotals.filter(d => d.is_payable || d.permission_granted);
    const payableCalc = calculateTotalOutstanding(payableDues);

    res.json({
      dues: duesWithStatus,
      pagination: {
        total: parseInt(countResult[0].total),
        limit: parseInt(limit),
        offset: parseInt(offset)
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
      dateFilter = sql`AND sd.updated_at >= ${start_date}`;
    }
    if (end_date) {
      dateFilter = sql`${dateFilter} AND sd.updated_at <= ${end_date}`;
    }
    if (due_type_id) {
      typeFilter = sql`AND sd.due_type_id = ${due_type_id}`;
    }

    const result = await sql`
      SELECT 
        sd.id,
        sd.due_type_id,
        dt.type_name,
        dt.description as type_description,
        sd.is_payable,
        sd.current_amount,
        sd.principal_amount,
        sd.amount_paid,
        sd.is_compounded,
        sd.interest_rate,
        sd.permission_granted,
        sd.supporting_document_link,
        sd.due_clear_by_date,
        sd.is_cleared,
        sd.due_description,
        sd.remarks,
        sd.proof_drive_link,
        sd.created_at,
        sd.updated_at,
        CASE 
          WHEN sd.added_by_department_id IS NOT NULL THEN d.name
          ELSE s.name
        END as added_by_entity,
        u.username as cleared_by_username,
        (
          SELECT json_agg(json_build_object(
            'id', dp.id,
            'paid_amount', dp.paid_amount,
            'payment_reference', dp.payment_reference,
            'payment_method', dp.payment_method,
            'payment_status', dp.payment_status,
            'paid_at', dp.paid_at
          ) ORDER BY dp.paid_at DESC)
          FROM due_payments dp
          WHERE dp.due_id = sd.id
        ) as payments
      FROM student_dues sd
      JOIN due_types dt ON sd.due_type_id = dt.id
      LEFT JOIN departments d ON sd.added_by_department_id = d.id
      LEFT JOIN sections s ON sd.added_by_section_id = s.id
      LEFT JOIN users u ON sd.cleared_by_user_id = u.user_id
      WHERE sd.student_roll_number = ${rollNumber} AND sd.overall_status = TRUE
        ${dateFilter}
        ${typeFilter}
      ORDER BY sd.updated_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    // Get total count
    const countResult = await sql`
      SELECT COUNT(*) as total
      FROM student_dues sd
      WHERE sd.student_roll_number = ${rollNumber} AND sd.overall_status = TRUE
        ${dateFilter}
        ${typeFilter}
    `;

    res.json({
      history: result,
      pagination: {
        total: parseInt(countResult[0].total),
        limit: parseInt(limit),
        offset: parseInt(offset)
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

    // Get student's roll number
    const studentResult = await sql`
      SELECT roll_number FROM students WHERE student_id = ${studentId}
    `;

    if (studentResult.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const rollNumber = studentResult[0].roll_number;

    const result = await sql`
      SELECT 
        sd.*,
        dt.type_name,
        dt.description as type_description,
        CASE 
          WHEN sd.added_by_department_id IS NOT NULL THEN d.name
          ELSE s.name
        END as added_by_entity,
        u.username as added_by_username,
        cleared_u.username as cleared_by_username,
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
          WHERE dp.due_id = sd.id
        ) as payments
      FROM student_dues sd
      JOIN due_types dt ON sd.due_type_id = dt.id
      LEFT JOIN departments d ON sd.added_by_department_id = d.id
      LEFT JOIN sections s ON sd.added_by_section_id = s.id
      LEFT JOIN users u ON sd.added_by_user_id = u.user_id
      LEFT JOIN users cleared_u ON sd.cleared_by_user_id = cleared_u.user_id
      WHERE sd.id = ${dueId} AND sd.student_roll_number = ${rollNumber}
    `;

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
        sd.id,
        sd.principal_amount,
        sd.amount_paid,
        sd.is_compounded,
        sd.interest_rate,
        sd.created_at,
        sd.is_payable,
        sd.permission_granted,
        sd.is_cleared,
        sd.due_type_id,
        dt.type_name
      FROM student_dues sd
      JOIN due_types dt ON sd.due_type_id = dt.id
      WHERE sd.id = ANY(${due_ids}) 
        AND sd.student_roll_number = ${student.roll_number}
    `;

    if (validationResult.length !== due_ids.length) {
      return res.status(400).json({ 
        error: 'Some dues not found or access denied',
        found: validationResult.length,
        requested: due_ids.length
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
      due_ids: due_ids,
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
        sd.student_roll_number
      FROM due_payments dp
      JOIN student_dues sd ON dp.due_id = sd.id
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

    // Get student and due details
    const result = await sql`
      SELECT 
        s.name as student_name,
        s.roll_number,
        s.branch,
        s.section,
        s.email,
        s.mobile,
        sd.*,
        dt.type_name,
        dt.description as type_description,
        CASE 
          WHEN sd.added_by_department_id IS NOT NULL THEN d.name
          ELSE sec.name
        END as added_by_entity
      FROM students s
      JOIN student_dues sd ON s.roll_number = sd.student_roll_number
      JOIN due_types dt ON sd.due_type_id = dt.id
      LEFT JOIN departments d ON sd.added_by_department_id = d.id
      LEFT JOIN sections sec ON sd.added_by_section_id = sec.id
      WHERE s.student_id = ${studentId} AND sd.id = ${dueId}
    `;

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
    res.setHeader('Content-Disposition', `attachment; filename=No_dues_${data.roll_number}_${dueId}.pdf`);
    
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
    doc.text(`Certificate No: VNRVJIET/ND/${new Date().getFullYear()}/${dueId}`, { align: 'left' });
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
      `Generated on: ${new Date().toLocaleString('en-IN')} | Document ID: ND-${dueId}-${Date.now()}`,
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

    // Get payment and due details
    const result = await sql`
      SELECT 
        s.name as student_name,
        s.roll_number,
        s.branch,
        s.section,
        s.email,
        sd.*,
        dt.type_name,
        CASE 
          WHEN sd.added_by_department_id IS NOT NULL THEN d.name
          ELSE sec.name
        END as added_by_entity,
        (
          SELECT json_agg(json_build_object(
            'paid_amount', dp.paid_amount,
            'payment_reference', dp.payment_reference,
            'payment_method', dp.payment_method,
            'payment_status', dp.payment_status,
            'paid_at', dp.paid_at
          ) ORDER BY dp.paid_at DESC)
          FROM due_payments dp
          WHERE dp.due_id = sd.id AND dp.payment_status = 'SUCCESS'
        ) as payments
      FROM students s
      JOIN student_dues sd ON s.roll_number = sd.student_roll_number
      JOIN due_types dt ON sd.due_type_id = dt.id
      LEFT JOIN departments d ON sd.added_by_department_id = d.id
      LEFT JOIN sections sec ON sd.added_by_section_id = sec.id
      WHERE s.student_id = ${studentId} AND sd.id = ${dueId}
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
    res.setHeader('Content-Disposition', `attachment; filename=Receipt_${data.roll_number}_${dueId}.pdf`);
    
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
    doc.text(`Receipt No: VNRVJIET/REC/${new Date().getFullYear()}/${dueId}/${Date.now().toString().slice(-6)}`, { align: 'left' });
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
      `Generated on: ${new Date().toLocaleString('en-IN')} | Receipt ID: REC-${dueId}-${Date.now()}`,
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
    const dueResult = await sql`
      SELECT 
        id, 
        is_payable, 
        needs_original, 
        needs_pdf, 
        is_cleared,
        proof_drive_link
      FROM student_dues
      WHERE id = ${dueId} AND student_roll_number = ${rollNumber}
    `;

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

    // Upload file to Google Drive
    // Filename will be: {due_id}_{student_roll_number}.{extension}
    const uploadResult = await uploadToGoogleDrive(
      req.file,
      dueId,
      rollNumber,
      'document' // upload type: document submissions folder
    );

    // Update the due with Google Drive link - clears remarks field (previous rejection reason)
    const updateResult = await sql`
      UPDATE student_dues
      SET 
        proof_drive_link = ${uploadResult.webViewLink},
        remarks = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${dueId} AND student_roll_number = ${rollNumber}
      RETURNING *
    `;

    res.json({
      success: true,
      message: 'Document uploaded successfully to Google Drive. Awaiting operator approval.',
      due: updateResult[0],
      upload: {
        fileName: uploadResult.fileName,
        fileId: uploadResult.fileId,
        fileLink: uploadResult.webViewLink
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
      SELECT 
        sd.id,
        sd.due_type_id,
        dt.type_name,
        dt.description as type_description,
        sd.is_payable,
        sd.needs_original,
        sd.needs_pdf,
        sd.due_clear_by_date,
        sd.is_cleared,
        sd.overall_status,
        sd.due_description,
        sd.proof_drive_link,
        sd.remarks,
        sd.created_at,
        sd.updated_at,
        CASE 
          WHEN sd.added_by_department_id IS NOT NULL THEN d.name
          ELSE s.name
        END as issuing_department
      FROM student_dues sd
      JOIN due_types dt ON sd.due_type_id = dt.id
      LEFT JOIN departments d ON sd.added_by_department_id = d.id
      LEFT JOIN sections s ON sd.added_by_section_id = s.id
      WHERE sd.student_roll_number = ${rollNumber}
        AND sd.is_payable = FALSE
        AND (sd.needs_original = TRUE OR sd.needs_pdf = TRUE)
        AND sd.is_cleared = FALSE
      ORDER BY 
        CASE 
          WHEN sd.proof_drive_link IS NULL THEN 0
          WHEN sd.overall_status = 'Pending Approval' THEN 1
          ELSE 2
        END,
        sd.due_clear_by_date ASC
    `;

    // Categorize dues
    const pending_upload = result.filter(d => !d.proof_drive_link);
    const pending_approval = result.filter(d => d.proof_drive_link && d.overall_status === 'Pending Approval');
    const rejected = result.filter(d => d.proof_drive_link && d.overall_status === 'Rejected');

    res.json({
      pending_upload,
      pending_approval,
      rejected,
      total: result.length
    });
  } catch (error) {
    console.error('Error fetching pending uploads:', error);
    res.status(500).json({ error: 'Failed to fetch pending uploads' });
  }
};
