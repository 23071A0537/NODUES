import express from 'express';
import {
    exportStudentsWithDues,
    getAcademicYearAnalytics,
    getAcademicYears,
    getDashboardStats,
    getStudentDuesHistory,
    getStudentsWithDues,
    getWholeReport
} from '../controllers/hodController.js';
import { authenticateRole, authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication middleware to all HOD routes
router.use(authenticateToken);
router.use(authenticateRole(['hod']));

// Dashboard endpoints
router.get('/dashboard/stats', getDashboardStats);
router.get('/dashboard/academic-year-analytics', getAcademicYearAnalytics);

// Students with dues endpoints
router.get('/students-with-dues', getStudentsWithDues);
router.get('/students-with-dues/export', exportStudentsWithDues);

// Whole report endpoint
router.get('/whole-report', getWholeReport);

// Student dues history
router.get('/student-dues-history/:rollNumber', getStudentDuesHistory);

// Utility endpoints
router.get('/academic-years', getAcademicYears);

export default router;
