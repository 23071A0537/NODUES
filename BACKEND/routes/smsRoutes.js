import express from 'express';
import {
    getActiveDues,
    getBalance,
    getNotificationLog,
    getStats,
    getStudentsNeedingReminderEndpoint,
    sendBulkReminders,
    sendReminder,
    sendTestSms,
} from '../controllers/smsController.js';
import { authenticateRole, authenticateToken } from '../middleware/auth.js';

const route = express.Router();

// All SMS routes require operator authentication
route.use(authenticateToken);
route.use(authenticateRole(['operator', 'admin']));

// Dashboard data
route.get('/active-dues', getActiveDues);
route.get('/students-needing-reminder', getStudentsNeedingReminderEndpoint);
route.get('/stats', getStats);
route.get('/balance', getBalance);
route.get('/notification-log', getNotificationLog);

// SMS actions
route.post('/send-reminder', sendReminder);
route.post('/send-bulk-reminders', sendBulkReminders);
route.post('/test-sms', sendTestSms);

export default route;
