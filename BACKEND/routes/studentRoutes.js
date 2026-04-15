import express from 'express';
import { uploadSingleFile } from '../config/multer.js';
import * as studentController from '../controllers/studentController.js';
import { authenticateRole, authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);
router.use(authenticateRole(['student']));

// Get student's dues (with filters)
router.get('/dues', studentController.getDues);

// Get dues history (cleared/paid)
router.get('/dues/history', studentController.getDuesHistory);

// Get single due details
router.get('/dues/:dueId', studentController.getDueDetails);

// Get due form PDF
router.get('/dues/:dueId/form', studentController.getDueFormPDF);

// Get receipt PDF
router.get('/dues/:dueId/receipt', studentController.getReceiptPDF);

// Get no dues form PDF
router.get('/no-dues-form', studentController.getNoDuesFormPdf);

// Create payment session
router.post('/payments', studentController.createPaymentSession);

// Get payment status
router.get('/payments/:paymentId', studentController.getPaymentStatus);

// Document upload for non-payable dues (with file upload middleware)
router.post('/dues/:dueId/upload-document', uploadSingleFile, studentController.uploadDocument);

// Get pending uploads (dues that need documentation)
router.get('/pending-uploads', studentController.getPendingUploads);

// Submit alumni due form details
router.post('/dues/:dueId/alumni-form', studentController.submitAlumniDueForm);

export default router;
