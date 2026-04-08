import crypto from 'crypto';
import twilio from 'twilio';
import { sql } from '../config/db.js';

// ============================================
// Twilio SMS Configuration
// ============================================
const SMS_CONFIG = {
  accountSid: process.env.TWILIO_ACCOUNT_SID || '',
  authToken: process.env.TWILIO_AUTH_TOKEN || '',
  fromNumber: process.env.TWILIO_PHONE_NUMBER || '',
  instituteName: process.env.INSTITUTE_NAME || 'VNRVJIET',
};

// Initialize Twilio client (lazy - only when needed)
let twilioClient = null;
const getTwilioClient = () => {
  if (!twilioClient && SMS_CONFIG.accountSid && SMS_CONFIG.authToken) {
    twilioClient = twilio(SMS_CONFIG.accountSid, SMS_CONFIG.authToken);
  }
  return twilioClient;
};

/**
 * Validate and clean mobile number for Twilio
 * Returns E.164 format (+91XXXXXXXXXX for India)
 * @param {string} mobile - Raw mobile number
 * @returns {string|null} - Cleaned E.164 number or null
 */
export const validateMobile = (mobile) => {
  if (!mobile) return null;
  
  // Remove spaces, dashes, special characters
  let cleaned = mobile.replace(/[\s\-\(\)\.\+]/g, '');
  
  // Remove country code prefix (91)
  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    cleaned = cleaned.substring(2);
  }
  if (cleaned.length === 13 && cleaned.startsWith('+91')) {
    cleaned = cleaned.substring(3);
  }
  
  // Must be exactly 10 digits
  if (cleaned.length !== 10) return null;
  
  // Must start with 6, 7, 8, or 9
  if (!/^[6-9]/.test(cleaned)) return null;
  
  // Must be all digits
  if (!/^\d{10}$/.test(cleaned)) return null;
  
  return cleaned;
};

/**
 * Format SMS message for a student based on number of dues
 * @param {string} name - Student name
 * @param {Array} dues - Array of due objects
 * @returns {string} - Formatted SMS message
 */
export const formatSmsMessage = (name, dues) => {
  const firstName = name.split(' ')[0];
  
  if (dues.length === 1) {
    const due = dues[0];
    const amount = parseFloat(due.current_amount) - parseFloat(due.amount_paid || 0);
    return `Dear ${firstName}, You have an outstanding payment of Rs.${amount.toFixed(0)} for ${due.type_name} due by ${due.due_clear_by_date}. Please clear your dues at the earliest. - ${SMS_CONFIG.instituteName}`;
  }
  
  // Multiple dues
  const totalAmount = dues.reduce((sum, d) => {
    return sum + (parseFloat(d.current_amount) - parseFloat(d.amount_paid || 0));
  }, 0);
  
  const details = dues.map(d => {
    const amt = parseFloat(d.current_amount) - parseFloat(d.amount_paid || 0);
    return `${d.type_name}: Rs.${amt.toFixed(0)}`;
  }).join(', ');
  
  return `Dear ${firstName}, You have ${dues.length} pending dues totaling Rs.${totalAmount.toFixed(0)}. Details: ${details}. Please clear at the earliest. - ${SMS_CONFIG.instituteName}`;
};

/**
 * Send SMS via Twilio API
 * @param {string} mobile - 10-digit mobile number
 * @param {string} message - SMS message text
 * @returns {Object} - { success: boolean, response: object }
 */
export const sendSms = async (mobile, message) => {
  try {
    if (!SMS_CONFIG.accountSid || !SMS_CONFIG.authToken || !SMS_CONFIG.fromNumber) {
      console.error('❌ Twilio credentials not configured');
      return { success: false, error: 'SMS API credentials not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER.' };
    }

    const cleanMobile = validateMobile(mobile);
    if (!cleanMobile) {
      console.error(`❌ Invalid mobile number: ${mobile}`);
      return { success: false, error: `Invalid mobile number: ${mobile}` };
    }

    // Format to E.164 for Twilio (+91 for India)
    const e164Number = `+91${cleanMobile}`;

    console.log(`📱 Sending SMS via Twilio to ${e164Number}...`);
    console.log(`   Message (${message.length} chars): ${message.substring(0, 80)}...`);

    const client = getTwilioClient();
    if (!client) {
      return { success: false, error: 'Failed to initialize Twilio client' };
    }

    const twilioMessage = await client.messages.create({
      body: message,
      from: SMS_CONFIG.fromNumber,
      to: e164Number,
    });

    console.log(`✅ SMS sent successfully to ${e164Number} | SID: ${twilioMessage.sid}`);
    return { 
      success: true, 
      response: {
        sid: twilioMessage.sid,
        status: twilioMessage.status,
        to: twilioMessage.to,
        dateCreated: twilioMessage.dateCreated,
      }
    };
  } catch (error) {
    console.error(`❌ Twilio SMS error for ${mobile}:`, error.message);
    
    if (error.code) {
      console.error(`   Twilio Error Code: ${error.code}`);
      console.error(`   More Info: ${error.moreInfo || 'N/A'}`);
    }
    
    return { 
      success: false, 
      error: error.message,
      response: {
        code: error.code,
        moreInfo: error.moreInfo,
      }
    };
  }
};

/**
 * Get Twilio account balance
 * @returns {Object} - { success: boolean, balance: string }
 */
export const getSmsBalance = async () => {
  try {
    if (!SMS_CONFIG.accountSid || !SMS_CONFIG.authToken) {
      return { success: false, error: 'Twilio credentials not configured' };
    }

    const client = getTwilioClient();
    if (!client) {
      return { success: false, error: 'Failed to initialize Twilio client' };
    }

    const balance = await client.balance.fetch();
    return { 
      success: true, 
      balance: `${balance.currency} ${balance.balance}` 
    };
  } catch (error) {
    console.error('❌ Balance check error:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Log SMS notification to database (one entry per due)
 * @param {string} rollNumber - Student roll number
 * @param {Array} dueIds - Array of due IDs included in SMS
 * @param {string} phone - Phone number used
 * @param {string} message - SMS text
 * @param {string} status - 'sent' or 'failed'
 * @param {Object} providerResponse - Raw API response
 * @param {string} batchId - Batch identifier grouping dues in same SMS
 */
export const logNotification = async (rollNumber, dueIds, phone, message, status, providerResponse, batchId) => {
  try {
    for (const dueId of dueIds) {
      await sql`
        INSERT INTO notification_log (
          student_roll_number, due_id, phone_number, message,
          status, provider_response, batch_id, sent_at
        ) VALUES (
          ${rollNumber}, ${dueId}, ${phone}, ${message},
          ${status}, ${JSON.stringify(providerResponse || {})}, ${batchId}, CURRENT_TIMESTAMP
        )
      `;
    }
    console.log(`📊 Logged ${dueIds.length} notification entries for ${rollNumber} (batch: ${batchId})`);
  } catch (error) {
    console.error(`❌ Error logging notification for ${rollNumber}:`, error.message);
  }
};

/**
 * Send SMS reminder for a single student with all their pending dues
 * @param {Object} studentData - { name, roll_number, mobile, dues: [...] }
 * @returns {Object} - { success, message, batchId }
 */
export const sendStudentReminder = async (studentData) => {
  const { name, roll_number, mobile, dues } = studentData;
  const batchId = `BATCH-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  
  const cleanMobile = validateMobile(mobile);
  if (!cleanMobile) {
    const dueIds = dues.map(d => d.due_id);
    await logNotification(roll_number, dueIds, mobile || 'INVALID', 'N/A', 'failed', { error: 'Invalid mobile' }, batchId);
    return { success: false, message: `Invalid mobile number for ${roll_number}` };
  }

  const message = formatSmsMessage(name, dues);
  const dueIds = dues.map(d => d.due_id);
  
  const result = await sendSms(cleanMobile, message);
  
  await logNotification(
    roll_number,
    dueIds,
    cleanMobile,
    message,
    result.success ? 'sent' : 'failed',
    result.response || { error: result.error },
    batchId
  );

  return {
    success: result.success,
    message: result.success 
      ? `SMS sent to ${name} (${cleanMobile}) for ${dues.length} due(s)`
      : `Failed to send SMS to ${name}: ${result.error}`,
    batchId
  };
};

/**
 * Get students with pending dues who need SMS reminders (3-day rule)
 * @returns {Array} - Array of student objects with grouped dues
 */
export const getStudentsNeedingReminder = async () => {
  const result = await sql`
    WITH latest_notifications AS (
      SELECT due_id, MAX(sent_at) as last_sent
      FROM notification_log
      WHERE status = 'sent'
      GROUP BY due_id
    )
    SELECT
      s.name,
      s.roll_number,
      s.mobile,
      s.branch,
      s.section,
      json_agg(json_build_object(
        'due_id', sd.id,
        'current_amount', sd.current_amount,
        'amount_paid', sd.amount_paid,
        'type_name', dt.type_name,
        'due_clear_by_date', TO_CHAR(sd.due_clear_by_date, 'DD-MM-YYYY'),
        'last_sent', ln.last_sent
      )) as dues
    FROM students s
    INNER JOIN student_dues sd ON s.roll_number = sd.student_roll_number
    INNER JOIN due_types dt ON sd.due_type_id = dt.id
    LEFT JOIN latest_notifications ln ON sd.id = ln.due_id
    WHERE sd.is_cleared = FALSE
      AND sd.is_payable = TRUE
      AND COALESCE(sd.permission_granted, FALSE) = FALSE
      AND s.mobile IS NOT NULL
      AND s.mobile != ''
      -- Temporarily disabled 3-day rule for testing
      -- AND (ln.last_sent IS NULL OR EXTRACT(EPOCH FROM (NOW() - ln.last_sent)) / 86400 >= 3)
    GROUP BY s.name, s.roll_number, s.mobile, s.branch, s.section
    ORDER BY s.roll_number
  `;
  return result;
};

/**
 * Get all students with active payable dues (no 3-day filter)
 * @returns {Array} - Array of student objects with grouped dues
 */
export const getAllStudentsWithActiveDues = async () => {
  const result = await sql`
    SELECT
      s.name,
      s.roll_number,
      s.mobile,
      s.branch,
      s.section,
      json_agg(json_build_object(
        'due_id', sd.id,
        'current_amount', sd.current_amount,
        'amount_paid', sd.amount_paid,
        'type_name', dt.type_name,
        'due_clear_by_date', TO_CHAR(sd.due_clear_by_date, 'DD-MM-YYYY'),
        'is_payable', sd.is_payable
      ) ORDER BY sd.due_clear_by_date ASC) as dues,
      (
        SELECT MAX(nl.sent_at)
        FROM notification_log nl
        WHERE nl.student_roll_number = s.roll_number
          AND nl.status = 'sent'
      ) as last_sms_sent,
      (
        SELECT COUNT(DISTINCT nl.batch_id)
        FROM notification_log nl
        WHERE nl.student_roll_number = s.roll_number
          AND nl.status = 'sent'
      ) as sms_count
    FROM students s
    INNER JOIN student_dues sd ON s.roll_number = sd.student_roll_number
    INNER JOIN due_types dt ON sd.due_type_id = dt.id
    WHERE sd.is_cleared = FALSE
      AND sd.is_payable = TRUE
      AND COALESCE(sd.permission_granted, FALSE) = FALSE
    GROUP BY s.student_id, s.name, s.roll_number, s.mobile, s.branch, s.section
    ORDER BY s.roll_number
  `;
  return result;
};

/**
 * Get SMS statistics for last N days
 * @param {number} days - Number of days to look back
 * @returns {Object} - Stats object
 */
export const getSmsStats = async (days = 7) => {
  const result = await sql`
    SELECT
      COUNT(*) FILTER (WHERE status = 'sent') as total_sent,
      COUNT(*) FILTER (WHERE status = 'failed') as total_failed,
      COUNT(DISTINCT student_roll_number) FILTER (WHERE status = 'sent') as unique_students,
      COUNT(DISTINCT batch_id) FILTER (WHERE status = 'sent') as total_batches
    FROM notification_log
    WHERE sent_at >= NOW() - MAKE_INTERVAL(days => ${days})
  `;
  return result[0];
};
