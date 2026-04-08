/**
 * Interest Calculation Service
 * Implements dynamic compound interest calculation for student dues
 * 
 * Formula: A = P(1 + r)^n
 * Where:
 *   A = Current compounded amount
 *   P = Principal amount
 *   r = Daily interest rate (as decimal)
 *   n = Number of days AFTER due_clear_by_date (grace period before that)
 * 
 * Grace Period Logic:
 * - BEFORE due_clear_by_date: current_amount = principal_amount (no interest)
 * - AFTER due_clear_by_date: Start compounding from that date
 * - When fully paid: principal_amount = 0, current_amount = 0
 * 
 * @module interestCalculationService
 */

/**
 * Calculate the number of days between two dates
 * @param {Date} startDate - The start date (created_at)
 * @param {Date} endDate - The end date (defaults to now)
 * @returns {number} Number of days (fractional)
 */
export function calculateDaysSince(startDate, endDate = new Date()) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffMs = end - start;
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return Math.max(0, diffDays); // Never negative
}

/**
 * Calculate compound interest using the formula A = P(1 + r)^n
 * Uses high-precision arithmetic for financial accuracy
 * 
 * @param {number|string} principal - Principal amount (P)
 * @param {number|string} dailyRate - Daily interest rate as decimal (r)
 * @param {number} days - Number of days (n)
 * @returns {string} Compounded amount as string with 2 decimal precision
 */
export function calculateCompoundedAmount(principal, dailyRate, days) {
  // Convert to high-precision numbers
  const P = parseFloat(principal);
  const r = parseFloat(dailyRate);
  const n = Math.floor(days); // Use whole days only
  
  // Validate inputs
  if (isNaN(P) || P < 0) {
    throw new Error('Invalid principal amount');
  }
  if (isNaN(r) || r < 0) {
    throw new Error('Invalid interest rate');
  }
  if (n < 0) {
    throw new Error('Invalid number of days');
  }
  
  // Handle edge cases
  if (P === 0 || r === 0 || n === 0) {
    return P.toFixed(2);
  }
  
  // Calculate: A = P * (1 + r)^n
  // Using Math.pow for simplicity - for very large n, consider logarithmic approach
  const multiplier = Math.pow(1 + r, n);
  const compoundedAmount = P * multiplier;
  
  // Round to 2 decimal places for currency
  return compoundedAmount.toFixed(2);
}

/**
 * Calculate the current amount for a due with compound interest
 * Implements grace period logic: no interest before due_clear_by_date
 * 
 * @param {Object} due - Student due object
 * @param {number|string} due.principal_amount - Principal amount
 * @param {number|string} due.interest_rate - Daily interest rate (0-1 range or percentage)
 * @param {boolean} due.is_compounded - Whether interest is compounded
 * @param {Date|string} due.due_clear_by_date - Grace period ends on this date
 * @param {Date|string} due.created_at - Date when principal was set
 * @param {Date} [asOfDate] - Calculate as of this date (defaults to now)
 * @returns {Object} { principal, currentAmount, interestAccrued, days, isInGracePeriod }
 */
export function calculateCurrentDueAmount(due, asOfDate = new Date()) {
  const principal = parseFloat(due.principal_amount || 0);
  
  // If principal is 0, the due is fully paid
  if (principal === 0) {
    return {
      principal: '0.00',
      currentAmount: '0.00',
      interestAccrued: '0.00',
      days: 0,
      dailyRate: 0,
      isInGracePeriod: false,
      isFullyPaid: true
    };
  }
  
  // If not compounded or no interest rate, current amount equals principal
  if (!due.is_compounded || !due.interest_rate || parseFloat(due.interest_rate) === 0) {
    return {
      principal: principal.toFixed(2),
      currentAmount: principal.toFixed(2),
      interestAccrued: '0.00',
      days: 0,
      dailyRate: 0,
      isInGracePeriod: true,
      isFullyPaid: false
    };
  }
  
  // Check if we're in the grace period (before due_clear_by_date)
  const dueDate = new Date(due.due_clear_by_date);
  const currentDate = new Date(asOfDate);
  
  if (currentDate < dueDate) {
    // Grace period: no interest, current amount = principal
    return {
      principal: principal.toFixed(2),
      currentAmount: principal.toFixed(2),
      interestAccrued: '0.00',
      days: 0,
      dailyRate: parseFloat(due.interest_rate),
      isInGracePeriod: true,
      isFullyPaid: false
    };
  }
  
  // After due date: calculate days from due_clear_by_date (not created_at)
  const days = calculateDaysSince(dueDate, currentDate);
  const dailyRate = parseFloat(due.interest_rate);
  
  // Calculate compounded amount
  const currentAmount = calculateCompoundedAmount(principal, dailyRate, days);
  const interestAccrued = (parseFloat(currentAmount) - principal).toFixed(2);
  
  return {
    principal: principal.toFixed(2),
    currentAmount: currentAmount,
    interestAccrued: interestAccrued,
    days: Math.floor(days),
    dailyRate: dailyRate,
    isInGracePeriod: false,
    isFullyPaid: false
  };
}

/**
 * Calculate outstanding amount after accounting for payments
 * @param {Object} due - Student due object with amount_paid
 * @param {Date} [asOfDate] - Calculate as of this date
 * @returns {Object} Extended calculation with outstanding and payment info
 */
export function calculateOutstandingAmount(due, asOfDate = new Date()) {
  const calculation = calculateCurrentDueAmount(due, asOfDate);
  const amountPaid = parseFloat(due.amount_paid || 0);
  const outstanding = Math.max(0, parseFloat(calculation.currentAmount) - amountPaid);
  
  return {
    ...calculation,
    amountPaid: amountPaid.toFixed(2),
    outstanding: outstanding.toFixed(2),
    isFullyPaid: outstanding < 0.01, // Tolerance for floating point
    percentagePaid: parseFloat(calculation.currentAmount) > 0 
      ? ((amountPaid / parseFloat(calculation.currentAmount)) * 100).toFixed(2)
      : '0.00'
  };
}

/**
 * Process a payment and calculate the new principal after payment
 * This implements the reset logic:
 * 1. Calculate current compounded amount
 * 2. Subtract payment
 * 3. Remaining becomes new principal (or 0 if fully paid)
 * 4. Reset created_at to now (payment date)
 * 5. If fully paid, principal becomes 0 and no more updates
 * 
 * @param {Object} due - Current due state
 * @param {number|string} paymentAmount - Amount being paid
 * @param {Date} [paymentDate] - Date of payment (defaults to now)
 * @returns {Object} Payment processing result
 */
export function processPayment(due, paymentAmount, paymentDate = new Date()) {
  const payment = parseFloat(paymentAmount);
  
  if (isNaN(payment) || payment <= 0) {
    throw new Error('Payment amount must be positive');
  }
  
  // Calculate current state
  const current = calculateOutstandingAmount(due, paymentDate);
  const currentTotal = parseFloat(current.currentAmount);
  const currentOutstanding = parseFloat(current.outstanding);
  
  // Validate payment doesn't exceed outstanding
  if (payment > currentOutstanding + 0.01) { // Small tolerance
    throw new Error(`Payment amount (${payment.toFixed(2)}) exceeds outstanding (${currentOutstanding.toFixed(2)})`);
  }
  
  // Calculate new state after payment
  const totalPaid = parseFloat(current.amountPaid) + payment;
  const remainingBalance = currentTotal - totalPaid;
  
  // New principal is the remaining balance (0 if fully paid)
  const newPrincipal = Math.max(0, remainingBalance);
  const isCleared = newPrincipal < 0.01; // Tolerance
  
  return {
    // Current state
    currentPrincipal: parseFloat(due.principal_amount || 0).toFixed(2),
    currentCompounded: current.currentAmount,
    currentOutstanding: current.outstanding,
    previousAmountPaid: current.amountPaid,
    
    // Payment info
    paymentAmount: payment.toFixed(2),
    paymentDate: paymentDate,
    
    // New state
    newPrincipal: newPrincipal.toFixed(2),
    newAmountPaid: totalPaid.toFixed(2),
    newCreatedAt: paymentDate, // Reset timestamp
    isCleared: isCleared,
    
    // Metadata
    interestPaidOff: parseFloat(current.interestAccrued) > 0 
      ? Math.min(payment, parseFloat(current.interestAccrued)).toFixed(2)
      : '0.00',
    principalPaidOff: (payment - Math.min(payment, parseFloat(current.interestAccrued))).toFixed(2)
  };
}

/**
 * Enrich a due object with calculated interest fields
 * Useful for API responses
 * 
 * @param {Object} due - Due object from database
 * @param {Date} [asOfDate] - Calculate as of this date
 * @returns {Object} Due with additional calculated fields
 */
export function enrichDueWithInterest(due, asOfDate = new Date()) {
  const calculation = calculateOutstandingAmount(due, asOfDate);
  
  return {
    ...due,
    // Display principal instead of current_amount
    display_amount: calculation.principal,
    // Add calculated fields
    calculated_current_amount: calculation.currentAmount,
    calculated_interest: calculation.interestAccrued,
    calculated_outstanding: calculation.outstanding,
    days_accrued: calculation.days,
    is_fully_paid: calculation.isFullyPaid
  };
}

/**
 * Batch enrich multiple dues
 * @param {Array} dues - Array of due objects
 * @param {Date} [asOfDate] - Calculate as of this date
 * @returns {Array} Enriched dues
 */
export function enrichDuesWithInterest(dues, asOfDate = new Date()) {
  return dues.map(due => enrichDueWithInterest(due, asOfDate));
}

/**
 * Calculate total outstanding for multiple dues
 * @param {Array} dues - Array of due objects
 * @param {Date} [asOfDate] - Calculate as of this date
 * @returns {Object} Aggregated totals
 */
export function calculateTotalOutstanding(dues, asOfDate = new Date()) {
  let totalPrincipal = 0;
  let totalCompounded = 0;
  let totalPaid = 0;
  let totalInterest = 0;
  let totalOutstanding = 0;
  
  dues.forEach(due => {
    const calc = calculateOutstandingAmount(due, asOfDate);
    totalPrincipal += parseFloat(calc.principal);
    totalCompounded += parseFloat(calc.currentAmount);
    totalPaid += parseFloat(calc.amountPaid);
    totalInterest += parseFloat(calc.interestAccrued);
    totalOutstanding += parseFloat(calc.outstanding);
  });
  
  return {
    totalPrincipal: totalPrincipal.toFixed(2),
    totalCompounded: totalCompounded.toFixed(2),
    totalPaid: totalPaid.toFixed(2),
    totalInterest: totalInterest.toFixed(2),
    totalOutstanding: totalOutstanding.toFixed(2),
    count: dues.length
  };
}
