import { sql } from '../config/db.js';
import { runSmsReminders } from '../jobs/smsReminderJob.js';
import {
    getAllStudentsWithActiveDues,
    getSmsBalance,
    getSmsStats,
    getStudentsNeedingReminder,
    sendSms,
    sendStudentReminder,
    validateMobile
} from '../services/smsService.js';

/**
 * GET /api/sms/active-dues
 * Get all students with pending payable dues (grouped by student)
 */
export const getActiveDues = async (req, res) => {
  try {
    const students = await getAllStudentsWithActiveDues();
    
    // Parse dues JSON if needed
    const formatted = students.map(s => ({
      ...s,
      dues: typeof s.dues === 'string' ? JSON.parse(s.dues) : s.dues,
      total_amount: (typeof s.dues === 'string' ? JSON.parse(s.dues) : s.dues)
        .reduce((sum, d) => sum + (parseFloat(d.current_amount) - parseFloat(d.amount_paid || 0)), 0),
    }));

    return res.status(200).json({
      success: true,
      data: formatted,
      count: formatted.length,
    });
  } catch (error) {
    console.error('❌ Error fetching active dues:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch active dues' });
  }
};

/**
 * GET /api/sms/students-needing-reminder
 * Get students who need SMS reminders (3-day rule applied)
 */
export const getStudentsNeedingReminderEndpoint = async (req, res) => {
  try {
    const students = await getStudentsNeedingReminder();
    
    const formatted = students.map(s => ({
      ...s,
      dues: typeof s.dues === 'string' ? JSON.parse(s.dues) : s.dues,
    }));

    return res.status(200).json({
      success: true,
      data: formatted,
      count: formatted.length,
    });
  } catch (error) {
    console.error('❌ Error fetching students needing reminder:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch reminder list' });
  }
};

/**
 * POST /api/sms/send-reminder
 * Send SMS reminder to a specific student (manual trigger)
 * Body: { rollNumber: string }
 */
export const sendReminder = async (req, res) => {
  try {
    const { rollNumber } = req.body;

    if (!rollNumber) {
      return res.status(400).json({ success: false, message: 'Roll number is required' });
    }

    // Get student info and their active dues
    const studentDues = await sql`
      SELECT
        s.name,
        s.roll_number,
        s.mobile,
        json_agg(json_build_object(
          'due_id', sd.id,
          'current_amount', sd.current_amount,
          'amount_paid', sd.amount_paid,
          'type_name', dt.type_name,
          'due_clear_by_date', TO_CHAR(sd.due_clear_by_date, 'DD-MM-YYYY')
        )) as dues
      FROM students s
      INNER JOIN student_dues sd ON s.roll_number = sd.student_roll_number
      INNER JOIN due_types dt ON sd.due_type_id = dt.id
      WHERE s.roll_number = ${rollNumber}
        AND sd.is_cleared = FALSE
        AND sd.is_payable = TRUE
        AND COALESCE(sd.permission_granted, FALSE) = FALSE
      GROUP BY s.name, s.roll_number, s.mobile
    `;

    if (studentDues.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No active payable dues found for this student',
      });
    }

    const student = studentDues[0];
    const dues = typeof student.dues === 'string' ? JSON.parse(student.dues) : student.dues;

    if (!student.mobile) {
      return res.status(400).json({
        success: false,
        message: `No mobile number on file for ${student.name} (${rollNumber})`,
      });
    }

    const result = await sendStudentReminder({
      name: student.name,
      roll_number: student.roll_number,
      mobile: student.mobile,
      dues: dues,
    });

    return res.status(result.success ? 200 : 500).json({
      success: result.success,
      message: result.message,
      batchId: result.batchId,
    });
  } catch (error) {
    console.error('❌ Error sending reminder:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to send SMS reminder' });
  }
};

/**
 * POST /api/sms/send-bulk-reminders
 * Trigger the cron job manually (sends to all eligible students)
 */
export const sendBulkReminders = async (req, res) => {
  try {
    console.log('📤 Manual bulk SMS trigger by operator');
    const summary = await runSmsReminders();
    
    // Handle "already running" case
    if (summary.skipped) {
      return res.status(200).json({
        success: true,
        message: summary.message || 'SMS job is already running',
        data: summary,
      });
    }
    
    return res.status(200).json({
      success: true,
      message: `Bulk SMS completed. Sent: ${summary.smsSent || 0}, Failed: ${summary.smsFailed || 0}`,
      data: summary,
    });
  } catch (error) {
    console.error('❌ Error in bulk reminders:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to run bulk reminders' });
  }
};

/**
 * GET /api/sms/balance
 * Get Twilio account balance
 */
export const getBalance = async (req, res) => {
  try {
    const result = await getSmsBalance();
    
    if (result.success) {
      return res.status(200).json({ success: true, balance: result.balance });
    }
    return res.status(500).json({ success: false, message: result.error });
  } catch (error) {
    console.error('❌ Error checking balance:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to check SMS balance' });
  }
};

/**
 * GET /api/sms/stats?days=7
 * Get SMS statistics for last N days
 */
export const getStats = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const stats = await getSmsStats(days);

    return res.status(200).json({
      success: true,
      data: {
        totalSent: parseInt(stats.total_sent) || 0,
        totalFailed: parseInt(stats.total_failed) || 0,
        uniqueStudents: parseInt(stats.unique_students) || 0,
        totalBatches: parseInt(stats.total_batches) || 0,
        periodDays: days,
      },
    });
  } catch (error) {
    console.error('❌ Error fetching stats:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch SMS stats' });
  }
};

/**
 * POST /api/sms/test-sms
 * Send a test SMS to verify Twilio integration
 * Body: { mobile: string, name?: string }
 */
export const sendTestSms = async (req, res) => {
  try {
    const { mobile, name = 'Test User' } = req.body;

    if (!mobile) {
      return res.status(400).json({ success: false, message: 'Mobile number is required' });
    }

    const cleanMobile = validateMobile(mobile);
    if (!cleanMobile) {
      return res.status(400).json({ success: false, message: `Invalid mobile number: ${mobile}` });
    }

    const message = `Dear ${name}, This is a test SMS from ${process.env.INSTITUTE_NAME || 'VNRVJIET'} No-Dues System. If you received this, SMS integration is working correctly!`;
    
    const result = await sendSms(cleanMobile, message);

    return res.status(result.success ? 200 : 500).json({
      success: result.success,
      message: result.success ? `Test SMS sent to ${cleanMobile}` : `Failed: ${result.error}`,
      response: result.response,
    });
  } catch (error) {
    console.error('❌ Error sending test SMS:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to send test SMS' });
  }
};

/**
 * GET /api/sms/notification-log?rollNumber=xxx&limit=50
 * Get notification history
 */
export const getNotificationLog = async (req, res) => {
  try {
    const { rollNumber, limit = 50 } = req.query;
    const limitNum = Math.min(parseInt(limit) || 50, 200);

    let logs;
    if (rollNumber) {
      logs = await sql`
        SELECT nl.*, s.name as student_name, dt.type_name as due_type
        FROM notification_log nl
        LEFT JOIN students s ON nl.student_roll_number = s.roll_number
        LEFT JOIN student_dues sd ON nl.due_id = sd.id
        LEFT JOIN due_types dt ON sd.due_type_id = dt.id
        WHERE nl.student_roll_number = ${rollNumber}
        ORDER BY nl.sent_at DESC
        LIMIT ${limitNum}
      `;
    } else {
      logs = await sql`
        SELECT nl.*, s.name as student_name, dt.type_name as due_type
        FROM notification_log nl
        LEFT JOIN students s ON nl.student_roll_number = s.roll_number
        LEFT JOIN student_dues sd ON nl.due_id = sd.id
        LEFT JOIN due_types dt ON sd.due_type_id = dt.id
        ORDER BY nl.sent_at DESC
        LIMIT ${limitNum}
      `;
    }

    return res.status(200).json({ success: true, data: logs, count: logs.length });
  } catch (error) {
    console.error('❌ Error fetching notification log:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch notification log' });
  }
};
