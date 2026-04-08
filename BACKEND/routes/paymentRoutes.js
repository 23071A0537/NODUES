import express from 'express';
import * as paymentController from '../controllers/paymentController.js';

const router = express.Router();

// Mock payment gateway callback (no auth required)
router.post('/webhook', paymentController.handleWebhook);

// Mock payment gateway page handler
router.get('/gateway/:sessionId', paymentController.getGatewayPage);

// Process mock payment
router.post('/gateway/:sessionId/process', paymentController.processMockPayment);

export default router;
