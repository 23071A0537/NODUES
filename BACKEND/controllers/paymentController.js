import crypto from 'crypto';
import { sql } from '../config/db.js';
import { calculateOutstandingAmount, processPayment } from '../services/interestCalculationService.js';
import { transaction } from '../utils/database.js';
import { distributeProportionally, isMoneyGreater } from '../utils/financialUtils.js';

/**
 * Mock Payment Gateway Page
 */
export const getGatewayPage = async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Retrieve session
    const session = global.paymentSessions?.[sessionId];

    if (!session) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Payment Gateway - Error</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .error { color: #d32f2f; font-size: 18px; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1 style="text-align: center; color: #d32f2f;">Payment Session Not Found</h1>
            <p class="error">This payment session has expired or is invalid.</p>
            <div style="text-align: center; margin-top: 30px;">
              <a href="/student/dues" style="color: #1976d2;">Return to Dues</a>
            </div>
          </div>
        </body>
        </html>
      `);
    }

    // Render mock gateway page
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Payment Gateway (Mock)</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .container { 
            max-width: 500px; 
            width: 100%;
            background: white; 
            padding: 30px; 
            border-radius: 12px; 
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #f0f0f0;
          }
          .logo {
            font-size: 32px;
            font-weight: bold;
            color: #667eea;
            margin-bottom: 10px;
          }
          .subtitle {
            color: #666;
            font-size: 14px;
          }
          .badge {
            display: inline-block;
            background: #fef3c7;
            color: #92400e;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
            margin-top: 10px;
          }
          .student-info {
            background: #f9fafb;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
          }
          .student-info h3 {
            font-size: 16px;
            color: #374151;
            margin-bottom: 10px;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            font-size: 14px;
            color: #6b7280;
          }
          .info-row strong {
            color: #111827;
          }
          .amount-section {
            background: #ecfdf5;
            border: 2px solid #059669;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
          }
          .amount-label {
            font-size: 14px;
            color: #065f46;
            font-weight: 600;
            margin-bottom: 5px;
          }
          .amount {
            font-size: 36px;
            font-weight: bold;
            color: #059669;
          }
          .due-items {
            margin: 20px 0;
          }
          .due-item {
            padding: 12px;
            background: #f9fafb;
            border-left: 3px solid #667eea;
            margin-bottom: 10px;
            border-radius: 4px;
          }
          .due-item-name {
            font-weight: 600;
            color: #374151;
            font-size: 14px;
          }
          .buttons {
            display: flex;
            gap: 10px;
            margin-top: 30px;
          }
          button {
            flex: 1;
            padding: 16px;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
            touch-action: manipulation;
            min-height: 48px;
          }
          .btn-success {
            background: #059669;
            color: white;
          }
          .btn-success:hover {
            background: #047857;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(5, 150, 105, 0.4);
          }
          .btn-failure {
            background: #dc2626;
            color: white;
          }
          .btn-failure:hover {
            background: #b91c1c;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(220, 38, 38, 0.4);
          }
          button:active {
            transform: translateY(0);
          }
          button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none !important;
          }
          .spinner {
            display: inline-block;
            width: 16px;
            height: 16px;
            border: 2px solid #ffffff;
            border-radius: 50%;
            border-top-color: transparent;
            animation: spin 0.8s linear infinite;
            margin-right: 8px;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          .notice {
            background: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 12px;
            margin: 20px 0;
            border-radius: 4px;
            font-size: 13px;
            color: #92400e;
          }
          @media (max-width: 600px) {
            .container { padding: 20px; }
            .amount { font-size: 28px; }
            .buttons { flex-direction: column; }
            button { width: 100%; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">💳 PayGate</div>
            <div class="subtitle">Secure Payment Gateway</div>
            <span class="badge">TEST MODE</span>
          </div>

          <div class="student-info">
            <h3>Payment Details</h3>
            <div class="info-row">
              <span>Student Name:</span>
              <strong>${session.student_name}</strong>
            </div>
            <div class="info-row">
              <span>Email:</span>
              <strong>${session.student_email}</strong>
            </div>
            <div class="info-row">
              <span>Session ID:</span>
              <strong>${sessionId.substring(0, 8)}...</strong>
            </div>
          </div>

          <div class="amount-section">
            <div class="amount-label">Total Amount to Pay</div>
            <div class="amount">₹${session.total_amount.toFixed(2)}</div>
          </div>

          <div class="due-items">
            <h3 style="font-size: 14px; color: #374151; margin-bottom: 10px;">Items (${session.due_ids.length})</h3>
            ${session.due_ids.map((id, index) => `
              <div class="due-item">
                <div class="due-item-name">Due #${id}</div>
              </div>
            `).join('')}
          </div>

          <div class="notice">
            <strong>⚠️ Test Environment:</strong> This is a mock payment gateway for testing. 
            Click "Simulate Success" to complete payment or "Simulate Failure" to test error handling.
          </div>

          <div class="buttons">
            <button class="btn-success" id="btnSuccess" onclick="processPayment('SUCCESS')">
              ✓ Simulate Success
            </button>
            <button class="btn-failure" id="btnFailure" onclick="processPayment('FAILED')">
              ✗ Simulate Failure
            </button>
          </div>
        </div>

        <script>
          let processing = false;

          async function processPayment(status) {
            if (processing) return;
            processing = true;

            const btnSuccess = document.getElementById('btnSuccess');
            const btnFailure = document.getElementById('btnFailure');

            btnSuccess.disabled = true;
            btnFailure.disabled = true;

            const clickedBtn = status === 'SUCCESS' ? btnSuccess : btnFailure;
            clickedBtn.innerHTML = '<span class="spinner"></span>' + 
              (status === 'SUCCESS' ? 'Processing...' : 'Processing Failure...');

            try {
              const response = await fetch('/api/payments/gateway/${sessionId}/process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
              });

              const result = await response.json();

              if (response.ok) {
                if (status === 'SUCCESS') {
                  clickedBtn.innerHTML = '✓ Payment Successful!';
                  clickedBtn.style.background = '#059669';
                  setTimeout(() => {
                    window.location.href = '${session.return_url}?payment=success&ref=' + result.payment_reference;
                  }, 1500);
                } else {
                  clickedBtn.innerHTML = '✗ Payment Failed';
                  clickedBtn.style.background = '#dc2626';
                  setTimeout(() => {
                    window.location.href = '${session.return_url}?payment=failed&reason=' + encodeURIComponent(result.error || 'Payment declined');
                  }, 1500);
                }
              } else {
                throw new Error(result.error || 'Payment processing failed');
              }
            } catch (error) {
              alert('Error: ' + error.message);
              btnSuccess.disabled = false;
              btnFailure.disabled = false;
              clickedBtn.innerHTML = status === 'SUCCESS' ? '✓ Simulate Success' : '✗ Simulate Failure';
              processing = false;
            }
          }
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Error rendering gateway page:', error);
    res.status(500).send('Internal server error');
  }
};

/**
 * Process mock payment
 */
export const processMockPayment = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { status } = req.body;

    // Retrieve session
    const session = global.paymentSessions?.[sessionId];

    if (!session) {
      return res.status(404).json({ error: 'Payment session not found' });
    }

    const paymentReference = `PAY-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const gatewayResponse = {
      mock: true,
      status: status,
      gateway_transaction_id: `GW-${crypto.randomBytes(8).toString('hex').toUpperCase()}`,
      timestamp: new Date().toISOString(),
      message: status === 'SUCCESS' ? 'Payment processed successfully' : 'Payment declined by issuing bank'
    };

    if (status === 'SUCCESS') {
      // Use transaction for payment processing
      await transaction(async (tx) => {
        // Get dues with all fields needed for interest calculation
        const duesResult = await tx`
          SELECT 
            id, 
            principal_amount, 
            amount_paid, 
            is_cleared,
            is_compounded,
            interest_rate,
            due_clear_by_date,
            created_at,
            is_payable
          FROM department_dues
          WHERE id = ANY(${session.due_ids}) AND student_roll_number = (
            SELECT roll_number FROM students WHERE student_id = ${session.student_id}
          )
          FOR UPDATE  -- Lock rows to prevent concurrent modifications
        `;

        if (duesResult.length !== session.due_ids.length) {
          throw new Error('Some dues not found or access denied');
        }

        // Check if any dues are already cleared
        const alreadyCleared = duesResult.filter(d => d.is_cleared);
        if (alreadyCleared.length > 0) {
          throw new Error('Some dues are already cleared');
        }

        // Calculate outstanding for each due with compound interest
        const duesWithCalculations = duesResult.map(due => {
          const calc = calculateOutstandingAmount(due);
          return {
            ...due,
            calculatedOutstanding: parseFloat(calc.outstanding),
            calculatedCurrent: parseFloat(calc.currentAmount)
          };
        });

        // Calculate total outstanding
        const totalOutstanding = duesWithCalculations.reduce(
          (sum, due) => sum + due.calculatedOutstanding, 
          0
        );

        console.log('[Payment] Total outstanding:', totalOutstanding, 'Session amount:', session.total_amount);

        // Validate payment amount doesn't exceed outstanding
        if (isMoneyGreater(session.total_amount, totalOutstanding + 0.01)) {
          throw new Error(`Payment amount exceeds total outstanding`);
        }

        // Distribute payment proportionally based on outstanding amounts
        const outstandingAmounts = duesWithCalculations.map(d => d.calculatedOutstanding);
        const distributedPayments = distributeProportionally(session.total_amount, outstandingAmounts);

        // Process each due
        for (let i = 0; i < duesWithCalculations.length; i++) {
          const due = duesWithCalculations[i];
          const paymentForThisDue = parseFloat(distributedPayments[i]);

          console.log(`[Payment] Due ${due.id}: principal=${due.principal_amount}, compounded=${due.calculatedCurrent}, outstanding=${due.calculatedOutstanding}, payment=${paymentForThisDue}`);

          // Calculate new state using interest service
          const paymentResult = processPayment(due, paymentForThisDue);

          console.log(`[Payment] Due ${due.id}: newPrincipal=${paymentResult.newPrincipal}, isCleared=${paymentResult.isCleared}`);

          // Insert payment record
          await tx`
            INSERT INTO due_payments (
              due_id, paid_amount, payment_reference, 
              payment_method, payment_status, gateway_response
            ) VALUES (
              ${due.id}, ${paymentForThisDue}, ${paymentReference}, 
              ${'ONLINE'}, ${'SUCCESS'}, ${JSON.stringify(gatewayResponse)}
            )
          `;

          // Update department due with new principal and reset timestamp
          await tx`
            UPDATE department_dues 
            SET principal_amount = ${paymentResult.newPrincipal},
                amount_paid = ${paymentResult.newAmountPaid},
                created_at = ${paymentResult.newCreatedAt},
                is_cleared = ${paymentResult.isCleared},
                overall_status = ${paymentResult.isCleared},
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ${due.id}
          `;
        }
      });

      // Clear session
      delete global.paymentSessions[sessionId];

      res.json({
        success: true,
        payment_reference: paymentReference,
        status: 'SUCCESS',
        message: 'Payment processed successfully',
        amount: session.total_amount,
        dues_updated: session.due_ids.length
      });
    } else {
      // Record failed payment
      for (const dueId of session.due_ids) {
        await sql`
          INSERT INTO due_payments (
            due_id, paid_amount, payment_reference, 
            payment_method, payment_status, gateway_response
          ) VALUES (
            ${dueId}, ${session.total_amount / session.due_ids.length}, ${paymentReference},
            ${'ONLINE'}, ${'FAILED'}, ${JSON.stringify(gatewayResponse)}
          )
        `;
      }

      // Keep session for retry
      res.json({
        success: false,
        payment_reference: paymentReference,
        status: 'FAILED',
        error: 'Payment declined by issuing bank',
        message: 'Your payment could not be processed. Please try again or use a different payment method.'
      });
    }
  } catch (error) {
    console.error('Error processing mock payment:', error);
    res.status(500).json({ error: error.message || 'Payment processing failed' });
  }
};

/**
 * Handle payment webhook (for external gateways)
 */
export const handleWebhook = async (req, res) => {
  try {
    const { payment_reference, status, gateway_transaction_id, signature } = req.body;

    // In production, verify signature here

    // Find payment records
    const paymentResult = await sql`
      SELECT 
        dp.*,
        dd.student_roll_number, 
        dd.principal_amount, 
        dd.amount_paid,
        dd.is_compounded,
        dd.interest_rate,
        dd.due_clear_by_date,
        dd.created_at
      FROM due_payments dp
      JOIN department_dues dd ON dp.due_id = dd.id
      WHERE dp.payment_reference = ${payment_reference}
    `;

    if (paymentResult.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Update payment status
    await sql`
      UPDATE due_payments 
      SET payment_status = ${status},
          gateway_response = gateway_response || ${JSON.stringify({ 
            gateway_transaction_id, 
            webhook_received_at: new Date().toISOString() 
          })}::jsonb
      WHERE payment_reference = ${payment_reference}
    `;

    if (status === 'SUCCESS') {
      // Use transaction for atomicity
      await transaction(async (tx) => {
        // Update department dues with interest-aware logic
        for (const payment of paymentResult) {
          const due = {
            principal_amount: payment.principal_amount,
            amount_paid: payment.amount_paid,
            is_compounded: payment.is_compounded,
            interest_rate: payment.interest_rate,
            created_at: payment.created_at
          };
          
          const paymentProcessed = processPayment(due, payment.paid_amount);

          await tx`
            UPDATE department_dues 
            SET principal_amount = ${paymentProcessed.newPrincipal},
                amount_paid = ${paymentProcessed.newAmountPaid},
                created_at = ${paymentProcessed.newCreatedAt},
                is_cleared = ${paymentProcessed.isCleared},
                overall_status = ${paymentProcessed.isCleared},
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ${payment.due_id}
          `;
        }
      });
    }

    res.json({ success: true, message: 'Webhook processed' });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};
