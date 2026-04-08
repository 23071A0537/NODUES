/**
 * Quick Test Script for Dynamic Compound Interest
 * 
 * Run this to verify the interest calculation service is working correctly
 * 
 * Usage: node test-interest-quick.js
 */

import {
    calculateCompoundedAmount,
    calculateOutstandingAmount,
    calculateTotalOutstanding,
    enrichDuesWithInterest,
    processPayment
} from './services/interestCalculationService.js';

console.log('╔═══════════════════════════════════════════════════════╗');
console.log('║  Dynamic Compound Interest - Quick Test Suite        ║');
console.log('╚═══════════════════════════════════════════════════════╝\n');

let passedTests = 0;
let failedTests = 0;

function test(name, fn) {
  try {
    const result = fn();
    if (result) {
      console.log(`✓ ${name}`);
      passedTests++;
    } else {
      console.log(`✗ ${name} - FAILED`);
      failedTests++;
    }
  } catch (error) {
    console.log(`✗ ${name} - ERROR: ${error.message}`);
    failedTests++;
  }
}

function assertEquals(actual, expected, tolerance = 0.01) {
  const actualNum = parseFloat(actual);
  const expectedNum = parseFloat(expected);
  return Math.abs(actualNum - expectedNum) < tolerance;
}

console.log('═════════════════════════════════════════════════════════');
console.log('TEST 1: Basic Compound Interest Calculation');
console.log('═════════════════════════════════════════════════════════\n');

test('10,000 at 0.1% daily for 30 days = 10,304.39', () => {
  const result = calculateCompoundedAmount(10000, 0.001, 30);
  console.log(`  Result: ₹${result}`);
  console.log(`  Formula: 10000 × (1.001)³⁰ = 10000 × 1.0304393 = 10304.39`);
  return assertEquals(result, 10304.39);
});

test('10,000 at 0.1% daily for 0 days = 10,000.00', () => {
  const result = calculateCompoundedAmount(10000, 0.001, 0);
  console.log(`  Result: ₹${result}`);
  return assertEquals(result, 10000.00);
});

test('5,000 at 0.2% daily for 15 days = 5,152.12', () => {
  const result = calculateCompoundedAmount(5000, 0.002, 15);
  console.log(`  Result: ₹${result}`);
  console.log(`  Formula: 5000 × (1.002)¹⁵ = 5000 × 1.030243922 = 5152.12`);
  return assertEquals(result, 5152.12);
});

console.log('═════════════════════════════════════════════════════════');
console.log('TEST 2: Grace Period Logic (Before Due Date)');
console.log('═════════════════════════════════════════════════════════\n');

test('Before due_clear_by_date: no interest charged', () => {
  const due = {
    principal_amount: 10000,
    interest_rate: 0.001,
    is_compounded: true,
    due_clear_by_date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days in future
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    amount_paid: 0
  };
  const calc = calculateOutstandingAmount(due);
  console.log(`  Principal: ₹${calc.principal}`);
  console.log(`  Current: ₹${calc.currentAmount}`);
  console.log(`  Interest: ₹${calc.interestAccrued}`);
  console.log(`  In Grace Period: ${calc.isInGracePeriod}`);
  return calc.currentAmount === calc.principal && 
         calc.interestAccrued === '0.00' && 
         calc.isInGracePeriod === true;
});

test('After due_clear_by_date: interest starts compounding', () => {
  const due = {
    principal_amount: 10000,
    interest_rate: 0.001,
    is_compounded: true,
    due_clear_by_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // created 60 days ago
    amount_paid: 0
  };
  const calc = calculateOutstandingAmount(due);
  console.log(`  Principal: ₹${calc.principal}`);
  console.log(`  Current: ₹${calc.currentAmount}`);
  console.log(`  Interest: ₹${calc.interestAccrued}`);
  console.log(`  Days past due: ${calc.days}`);
  console.log(`  In Grace Period: ${calc.isInGracePeriod}`);
  // Should compound for 30 days from due_clear_by_date
  return assertEquals(calc.currentAmount, 10304.39) && 
         calc.isInGracePeriod === false &&
         calc.days === 30;
});

test('Fully paid due (principal=0) shows zero current_amount', () => {
  const due = {
    principal_amount: 0, // Fully paid
    interest_rate: 0.001,
    is_compounded: true,
    due_clear_by_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
    amount_paid: 10000
  };
  const calc = calculateOutstandingAmount(due);
  console.log(`  Principal: ₹${calc.principal}`);
  console.log(`  Current: ₹${calc.currentAmount}`);
  console.log(`  Is Fully Paid: ${calc.isFullyPaid}`);
  return calc.principal === '0.00' && 
         calc.currentAmount === '0.00' && 
         calc.isFullyPaid === true;
});

console.log('\n═════════════════════════════════════════════════════════');
console.log('TEST 3: Non-Compounded Dues (Fixed Amount)');
console.log('═════════════════════════════════════════════════════════\n');

test('Non-compounded due stays at principal', () => {
  const due = {
    principal_amount: 10000,
    interest_rate: 0.001,
    is_compounded: false,
    due_clear_by_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    amount_paid: 0
  };
  const calc = calculateOutstandingAmount(due);
  console.log(`  Principal: ₹${calc.principal}`);
  console.log(`  Current: ₹${calc.currentAmount}`);
  console.log(`  Interest: ₹${calc.interestAccrued}`);
  return calc.currentAmount === calc.principal && calc.interestAccrued === '0.00';
});

console.log('\n═════════════════════════════════════════════════════════');
console.log('TEST 4: Outstanding Calculation');
console.log('═════════════════════════════════════════════════════════\n');

test('Outstanding after partial payment is correct', () => {
  const due = {
    principal_amount: 10000,
    interest_rate: 0.001,
    is_compounded: true,
    due_clear_by_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
    amount_paid: 5000
  };
  const calc = calculateOutstandingAmount(due);
  console.log(`  Principal: ₹${calc.principal}`);
  console.log(`  Compounded: ₹${calc.currentAmount}`);
  console.log(`  Paid: ₹${calc.amountPaid}`);
  console.log(`  Outstanding: ₹${calc.outstanding}`);
  
  // Outstanding should be: 10304.39 - 5000 = 5304.39
  return assertEquals(calc.outstanding, 5304.39);
});

test('Fully paid due shows zero outstanding', () => {
  const due = {
    principal_amount: 0, // Principal set to 0 after full payment
    interest_rate: 0.001,
    is_compounded: true,
    due_clear_by_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    amount_paid: 10305
  };
  const calc = calculateOutstandingAmount(due);
  console.log(`  Outstanding: ₹${calc.outstanding}`);
  console.log(`  Is Fully Paid: ${calc.isFullyPaid}`);
  return calc.isFullyPaid && parseFloat(calc.outstanding) < 0.01;
});

console.log('\n═════════════════════════════════════════════════════════');
console.log('TEST 5: Payment Processing & Reset');
console.log('═════════════════════════════════════════════════════════\n');

test('Payment calculates new principal correctly', () => {
  const due = {
    principal_amount: 10000,
    interest_rate: 0.001,
    is_compounded: true,
    due_clear_by_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    amount_paid: 0
  };
  
  const payment = processPayment(due, 6000);
  console.log(`  Current Compounded: ₹${payment.currentCompounded}`);
  console.log(`  Payment: ₹${payment.paymentAmount}`);
  console.log(`  New Principal: ₹${payment.newPrincipal}`);
  console.log(`  Interest Paid Off: ₹${payment.interestPaidOff}`);
  console.log(`  Principal Paid Off: ₹${payment.principalPaidOff}`);
  
  // New principal should be: 10304.39 - 6000 = 4304.39
  return assertEquals(payment.newPrincipal, 4304.39);
});

test('Full payment clears the due', () => {
  const due = {
    principal_amount: 10000,
    interest_rate: 0.001,
    is_compounded: true,
    due_clear_by_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    amount_paid: 0
  };
  
  // Pay the exact outstanding amount (10304.39)
  const payment = processPayment(due, 10304.39);
  console.log(`  Payment: ₹${payment.paymentAmount}`);
  console.log(`  Is Cleared: ${payment.isCleared}`);
  console.log(`  New Principal: ₹${payment.newPrincipal}`);
  
  return payment.isCleared && parseFloat(payment.newPrincipal) < 0.01;
});

test('Payment resets timestamp', () => {
  const due = {
    principal_amount: 10000,
    interest_rate: 0.001,
    is_compounded: true,
    due_clear_by_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    amount_paid: 0
  };
  
  // Make a partial payment of 5000
  const payment = processPayment(due, 5000);
  const now = new Date();
  const resetTime = new Date(payment.newCreatedAt);
  const diffSeconds = Math.abs(now - resetTime) / 1000;
  
  console.log(`  New Created At: ${payment.newCreatedAt.toISOString()}`);
  console.log(`  Seconds from now: ${diffSeconds.toFixed(2)}`);
  
  // Should be within 1 second of now
  return diffSeconds < 1;
});

console.log('\n═════════════════════════════════════════════════════════');
console.log('TEST 6: Batch Operations');
console.log('═════════════════════════════════════════════════════════\n');

test('Enrich multiple dues with interest', () => {
  const dues = [
    {
      id: 1,
      principal_amount: 10000,
      interest_rate: 0.001,
      is_compounded: true,
      due_clear_by_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      amount_paid: 0
    },
    {
      id: 2,
      principal_amount: 5000,
      interest_rate: 0.001,
      is_compounded: true,
      due_clear_by_date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      amount_paid: 1000
    }
  ];
  
  const enriched = enrichDuesWithInterest(dues);
  console.log(`  Enriched ${enriched.length} dues`);
  console.log(`  Due 1 - Outstanding: ₹${enriched[0].calculated_outstanding}`);
  console.log(`  Due 2 - Outstanding: ₹${enriched[1].calculated_outstanding}`);
  
  return enriched.length === 2 && 
         enriched[0].calculated_outstanding && 
         enriched[1].calculated_outstanding;
});

test('Calculate total outstanding across multiple dues', () => {
  const dues = [
    {
      principal_amount: 10000,
      interest_rate: 0.001,
      is_compounded: true,
      due_clear_by_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      amount_paid: 0
    },
    {
      principal_amount: 5000,
      interest_rate: 0.001,
      is_compounded: false,
      due_clear_by_date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      amount_paid: 0
    }
  ];
  
  const totals = calculateTotalOutstanding(dues);
  console.log(`  Total Principal: ₹${totals.totalPrincipal}`);
  console.log(`  Total Compounded: ₹${totals.totalCompounded}`);
  console.log(`  Total Interest: ₹${totals.totalInterest}`);
  console.log(`  Total Outstanding: ₹${totals.totalOutstanding}`);
  console.log(`  Count: ${totals.count}`);
  
  return totals.count === 2 && 
         parseFloat(totals.totalPrincipal) === 15000 &&
         parseFloat(totals.totalInterest) > 0;
});

console.log('\n═════════════════════════════════════════════════════════');
console.log('TEST 7: Edge Cases');
console.log('═════════════════════════════════════════════════════════\n');

test('Zero principal returns zero', () => {
  const result = calculateCompoundedAmount(0, 0.001, 30);
  console.log(`  Result: ₹${result}`);
  return result === '0.00';
});

test('Zero interest rate returns principal', () => {
  const result = calculateCompoundedAmount(10000, 0, 30);
  console.log(`  Result: ₹${result}`);
  return result === '10000.00';
});

test('Negative days returns principal (edge case)', () => {
  // Since we throw error on negative days, test that behavior is defined
  try {
    const result = calculateCompoundedAmount(10000, 0.001, -10);
    console.log(`  Result: ₹${result}`);
    // If no error, should return principal
    return result === '10000.00';
  } catch (error) {
    console.log(`  Throws error (acceptable): ${error.message}`);
    // Throwing error is also acceptable behavior
    return error.message.includes('Invalid number of days');
  }
});

test('Payment exceeding outstanding throws error', () => {
  const due = {
    principal_amount: 1000,
    interest_rate: 0.001,
    is_compounded: true,
    due_clear_by_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    amount_paid: 0
  };
  
  try {
    processPayment(due, 2000); // Try to pay more than owed
    return false; // Should have thrown
  } catch (error) {
    console.log(`  Correctly threw error: ${error.message}`);
    return error.message.includes('exceeds outstanding');
  }
});

console.log('\n═════════════════════════════════════════════════════════');
console.log('TEST 8: Interest Compounding Verification');
console.log('═════════════════════════════════════════════════════════\n');

test('Verify compound formula: A = P(1+r)^n', () => {
  const P = 10000;
  const r = 0.001;
  const n = 30;
  
  // Manual calculation
  const manualResult = P * Math.pow(1 + r, n);
  
  // Service calculation
  const serviceResult = parseFloat(calculateCompoundedAmount(P, r, n));
  
  console.log(`  Manual: ₹${manualResult.toFixed(2)}`);
  console.log(`  Service: ₹${serviceResult.toFixed(2)}`);
  console.log(`  Difference: ₹${Math.abs(manualResult - serviceResult).toFixed(2)}`);
  
  return Math.abs(manualResult - serviceResult) < 0.01;
});

test('Daily compounding increases exponentially', () => {
  const principal = 10000;
  const rate = 0.001;
  
  const after10days = parseFloat(calculateCompoundedAmount(principal, rate, 10));
  const after20days = parseFloat(calculateCompoundedAmount(principal, rate, 20));
  const after30days = parseFloat(calculateCompoundedAmount(principal, rate, 30));
  
  console.log(`  After 10 days: ₹${after10days.toFixed(2)} (10000 × 1.001¹⁰)`);
  console.log(`  After 20 days: ₹${after20days.toFixed(2)} (10000 × 1.001²⁰)`);
  console.log(`  After 30 days: ₹${after30days.toFixed(2)} (10000 × 1.001³⁰)`);
  console.log(`  Growth is exponential: ${after20days - after10days < after30days - after20days ? '✓' : '✗'}`);
  
  // Each should be greater than previous
  return after10days < after20days && after20days < after30days &&
         after30days > principal;
});

// Summary
console.log('\n╔═══════════════════════════════════════════════════════╗');
console.log('║                   TEST SUMMARY                        ║');
console.log('╚═══════════════════════════════════════════════════════╝\n');

const totalTests = passedTests + failedTests;
const successRate = ((passedTests / totalTests) * 100).toFixed(1);

console.log(`  Total Tests: ${totalTests}`);
console.log(`  Passed: ${passedTests} ✓`);
console.log(`  Failed: ${failedTests} ✗`);
console.log(`  Success Rate: ${successRate}%\n`);

if (failedTests === 0) {
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║  ✓ ALL TESTS PASSED - System Ready for Production!   ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');
  process.exit(0);
} else {
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║  ✗ SOME TESTS FAILED - Please Review Implementation  ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');
  process.exit(1);
}
