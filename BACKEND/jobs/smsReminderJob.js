import cron from 'node-cron';
import { getStudentsNeedingReminder, sendStudentReminder } from '../services/smsService.js';

/**
 * SMS Reminder Cron Job
 * Runs daily at 10 AM, checks 3-day rule, sends consolidated SMS per student
 */

let isRunning = false;

/**
 * Execute the SMS reminder process
 * @returns {Object} - Summary of the run
 */
export const runSmsReminders = async () => {
  if (isRunning) {
    console.log('⚠️ SMS reminder job already running, skipping...');
    return { 
      skipped: true, 
      message: 'Already running',
      smsSent: 0,
      smsFailed: 0,
      studentsFound: 0
    };
  }

  isRunning = true;
  const startTime = Date.now();
  
  console.log('📤 ==========================================');
  console.log('📤 SMS Reminder Job Started');
  console.log(`📤 Time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
  console.log('📤 ==========================================');

  const summary = {
    startedAt: new Date().toISOString(),
    studentsFound: 0,
    smsSent: 0,
    smsFailed: 0,
    errors: [],
  };

  try {
    // 1. Get students needing reminders (3-day rule)
    const students = await getStudentsNeedingReminder();
    summary.studentsFound = students.length;
    
    console.log(`📊 Found ${students.length} student(s) needing SMS reminders`);

    if (students.length === 0) {
      console.log('✅ No students need SMS reminders at this time');
      isRunning = false;
      return summary;
    }

    // 2. Filter for unique phone numbers (send only once per number)
    const uniqueStudents = [];
    const seenPhones = new Set();
    
    for (const student of students) {
      if (!student.mobile || seenPhones.has(student.mobile)) {
        console.log(`⏭️ Skipping ${student.roll_number} - duplicate/missing mobile: ${student.mobile || 'N/A'}`);
        continue;
      }
      seenPhones.add(student.mobile);
      uniqueStudents.push(student);
    }
    
    console.log(`📊 After filtering unique phones: ${uniqueStudents.length} SMS to send`);
    summary.studentsFound = uniqueStudents.length;

    // 3. Send SMS to each student with delay
    for (let i = 0; i < uniqueStudents.length; i++) {
      const student = uniqueStudents[i];
      const dues = typeof student.dues === 'string' ? JSON.parse(student.dues) : student.dues;
      
      console.log(`\n📱 [${i + 1}/${uniqueStudents.length}] Processing ${student.name} (${student.roll_number})`);
      console.log(`   📋 Dues: ${dues.length} | Mobile: ${student.mobile}`);

      try {
        const result = await sendStudentReminder({
          name: student.name,
          roll_number: student.roll_number,
          mobile: student.mobile,
          dues: dues,
        });

        if (result.success) {
          summary.smsSent++;
          console.log(`   ✅ ${result.message}`);
        } else {
          summary.smsFailed++;
          summary.errors.push({ rollNumber: student.roll_number, error: result.message });
          console.log(`   ❌ ${result.message}`);
        }
      } catch (error) {
        summary.smsFailed++;
        summary.errors.push({ rollNumber: student.roll_number, error: error.message });
        console.error(`   ❌ Error: ${error.message}`);
      }

      // Add 1-second delay between SMS to avoid rate limiting
      if (i < students.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log('\n📤 ==========================================');
    console.log(`📤 SMS Reminder Job Completed in ${duration}s`);
    console.log(`📤 Sent: ${summary.smsSent} | Failed: ${summary.smsFailed} | Total: ${summary.studentsFound}`);
    console.log('📤 ==========================================\n');

  } catch (error) {
    console.error('❌ SMS Reminder Job Error:', error.message);
    summary.errors.push({ error: error.message });
  } finally {
    isRunning = false;
  }

  return summary;
};

/**
 * Initialize the cron job scheduler
 * Default: Daily at 10:00 AM IST
 */
export const initSmsCronJob = () => {
  const schedule = process.env.CRON_SCHEDULE || '0 10 * * *';
  
  console.log(`⏰ SMS Reminder cron job scheduled: "${schedule}"`);
  
  const job = cron.schedule(schedule, async () => {
    console.log('\n⏰ Cron trigger: Starting SMS reminder job...');
    await runSmsReminders();
  }, {
    timezone: 'Asia/Kolkata',
  });

  return job;
};
