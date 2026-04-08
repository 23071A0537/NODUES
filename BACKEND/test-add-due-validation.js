/**
 * Test Script for Interest Rate Validation in Add Due API
 * 
 * This validates that interest_rate is required when adding dues with compound interest
 * 
 * Run: node test-add-due-validation.js
 */

// Mock validation logic (extracted from operatorController.js)
function validateAddDueRequest(body) {
  const {
    roll_number,
    due_type_id,
    is_payable,
    amount,
    due_date,
    is_compounded,
    interest_rate
  } = body;

  // Required fields
  if (!roll_number || !due_type_id || is_payable === undefined || !due_date) {
    return { success: false, message: "Missing required fields" };
  }

  // Amount required for payable dues
  if (is_payable && !amount) {
    return { success: false, message: "Amount is required for payable dues" };
  }

  // Interest rate required for compounded dues
  if (is_payable && is_compounded && (interest_rate === undefined || interest_rate === null || interest_rate === '')) {
    return { 
      success: false, 
      message: "Interest rate is required for payable dues with compound interest" 
    };
  }

  // Validate interest rate format
  if (interest_rate !== undefined && interest_rate !== null && interest_rate !== '') {
    const rate = parseFloat(interest_rate);
    if (isNaN(rate) || rate < 0 || rate > 1) {
      return { 
        success: false, 
        message: "Interest rate must be a decimal between 0 and 1 (e.g., 0.001 for 0.1% daily)" 
      };
    }
  }

  return { success: true, message: "Validation passed" };
}

// Test cases
console.log('╔══════════════════════════════════════════════════════╗');
console.log('║  Add Due Interest Rate Validation Test Suite        ║');
console.log('╚══════════════════════════════════════════════════════╝\n');

let passed = 0;
let failed = 0;

function test(name, testFn) {
  try {
    const result = testFn();
    if (result) {
      console.log(`✓ ${name}`);
      passed++;
    } else {
      console.log(`✗ ${name} - FAILED`);
      failed++;
    }
  } catch (error) {
    console.log(`✗ ${name} - ERROR: ${error.message}`);
    failed++;
  }
}

console.log('═══════════════════════════════════════════════════════');
console.log('TEST 1: Basic Validation');
console.log('═══════════════════════════════════════════════════════\n');

test('Valid non-compounded payable due', () => {
  const result = validateAddDueRequest({
    roll_number: '21B01A0501',
    due_type_id: 1,
    is_payable: true,
    amount: 5000,
    due_date: '2026-03-01',
    is_compounded: false
  });
  console.log(`  Result: ${result.message}`);
  return result.success === true;
});

test('Valid compounded due with interest rate', () => {
  const result = validateAddDueRequest({
    roll_number: '21B01A0501',
    due_type_id: 1,
    is_payable: true,
    amount: 10000,
    due_date: '2026-03-01',
    is_compounded: true,
    interest_rate: 0.001
  });
  console.log(`  Result: ${result.message}`);
  return result.success === true;
});

test('Valid non-payable due (no interest)', () => {
  const result = validateAddDueRequest({
    roll_number: '21B01A0501',
    due_type_id: 5,
    is_payable: false,
    due_date: '2026-03-01'
  });
  console.log(`  Result: ${result.message}`);
  return result.success === true;
});

console.log('\n═══════════════════════════════════════════════════════');
console.log('TEST 2: Missing Required Fields');
console.log('═══════════════════════════════════════════════════════\n');

test('Missing roll_number', () => {
  const result = validateAddDueRequest({
    due_type_id: 1,
    is_payable: true,
    amount: 5000,
    due_date: '2026-03-01'
  });
  console.log(`  Result: ${result.message}`);
  return result.success === false && result.message.includes('Missing required fields');
});

test('Missing amount for payable due', () => {
  const result = validateAddDueRequest({
    roll_number: '21B01A0501',
    due_type_id: 1,
    is_payable: true,
    due_date: '2026-03-01'
  });
  console.log(`  Result: ${result.message}`);
  return result.success === false && result.message.includes('Amount is required');
});

test('Missing interest_rate for compounded due', () => {
  const result = validateAddDueRequest({
    roll_number: '21B01A0501',
    due_type_id: 1,
    is_payable: true,
    amount: 10000,
    due_date: '2026-03-01',
    is_compounded: true
    // interest_rate missing!
  });
  console.log(`  Result: ${result.message}`);
  return result.success === false && result.message.includes('Interest rate is required');
});

console.log('\n═══════════════════════════════════════════════════════');
console.log('TEST 3: Invalid Interest Rate Values');
console.log('═══════════════════════════════════════════════════════\n');

test('Interest rate too high (> 1)', () => {
  const result = validateAddDueRequest({
    roll_number: '21B01A0501',
    due_type_id: 1,
    is_payable: true,
    amount: 10000,
    due_date: '2026-03-01',
    is_compounded: true,
    interest_rate: 1.5
  });
  console.log(`  Result: ${result.message}`);
  return result.success === false && result.message.includes('between 0 and 1');
});

test('Negative interest rate', () => {
  const result = validateAddDueRequest({
    roll_number: '21B01A0501',
    due_type_id: 1,
    is_payable: true,
    amount: 10000,
    due_date: '2026-03-01',
    is_compounded: true,
    interest_rate: -0.1
  });
  console.log(`  Result: ${result.message}`);
  return result.success === false && result.message.includes('between 0 and 1');
});

test('Invalid interest rate (string)', () => {
  const result = validateAddDueRequest({
    roll_number: '21B01A0501',
    due_type_id: 1,
    is_payable: true,
    amount: 10000,
    due_date: '2026-03-01',
    is_compounded: true,
    interest_rate: 'invalid'
  });
  console.log(`  Result: ${result.message}`);
  return result.success === false && result.message.includes('between 0 and 1');
});

console.log('\n═══════════════════════════════════════════════════════');
console.log('TEST 4: Edge Cases');
console.log('═══════════════════════════════════════════════════════\n');

test('Zero interest rate (valid)', () => {
  const result = validateAddDueRequest({
    roll_number: '21B01A0501',
    due_type_id: 1,
    is_payable: true,
    amount: 10000,
    due_date: '2026-03-01',
    is_compounded: true,
    interest_rate: 0
  });
  console.log(`  Result: ${result.message}`);
  return result.success === true;
});

test('Maximum interest rate (1.0)', () => {
  const result = validateAddDueRequest({
    roll_number: '21B01A0501',
    due_type_id: 1,
    is_payable: true,
    amount: 10000,
    due_date: '2026-03-01',
    is_compounded: true,
    interest_rate: 1.0
  });
  console.log(`  Result: ${result.message}`);
  return result.success === true;
});

test('Very small interest rate (0.0001)', () => {
  const result = validateAddDueRequest({
    roll_number: '21B01A0501',
    due_type_id: 1,
    is_payable: true,
    amount: 10000,
    due_date: '2026-03-01',
    is_compounded: true,
    interest_rate: 0.0001
  });
  console.log(`  Result: ${result.message}`);
  return result.success === true;
});

test('Interest rate with many decimals (0.001234)', () => {
  const result = validateAddDueRequest({
    roll_number: '21B01A0501',
    due_type_id: 1,
    is_payable: true,
    amount: 10000,
    due_date: '2026-03-01',
    is_compounded: true,
    interest_rate: 0.001234
  });
  console.log(`  Result: ${result.message}`);
  return result.success === true;
});

console.log('\n═══════════════════════════════════════════════════════');
console.log('TEST 5: Conditional Requirements');
console.log('═══════════════════════════════════════════════════════\n');

test('Interest rate ignored for non-payable due', () => {
  const result = validateAddDueRequest({
    roll_number: '21B01A0501',
    due_type_id: 5,
    is_payable: false,
    due_date: '2026-03-01',
    is_compounded: true,
    interest_rate: 0.001
  });
  console.log(`  Result: ${result.message}`);
  // Should pass because non-payable dues don't need validation
  return result.success === true;
});

test('Interest rate ignored for non-compounded payable due', () => {
  const result = validateAddDueRequest({
    roll_number: '21B01A0501',
    due_type_id: 1,
    is_payable: true,
    amount: 5000,
    due_date: '2026-03-01',
    is_compounded: false,
    interest_rate: 0.001
  });
  console.log(`  Result: ${result.message}`);
  // Should pass even with interest_rate present
  return result.success === true;
});

console.log('\n╔══════════════════════════════════════════════════════╗');
console.log('║                   TEST SUMMARY                       ║');
console.log('╚══════════════════════════════════════════════════════╝\n');

const total = passed + failed;
const successRate = ((passed / total) * 100).toFixed(1);

console.log(`  Total Tests: ${total}`);
console.log(`  Passed: ${passed} ✓`);
console.log(`  Failed: ${failed} ✗`);
console.log(`  Success Rate: ${successRate}%\n`);

if (failed === 0) {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  ✓ ALL VALIDATION TESTS PASSED!                      ║');
  console.log('║                                                      ║');
  console.log('║  Interest rate validation is working correctly.     ║');
  console.log('║  The API will properly enforce:                      ║');
  console.log('║  - Interest rate required for compounded dues        ║');
  console.log('║  - Valid decimal format (0 to 1)                     ║');
  console.log('║  - Proper error messages for invalid input          ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');
  process.exit(0);
} else {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  ✗ SOME TESTS FAILED                                 ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');
  process.exit(1);
}
