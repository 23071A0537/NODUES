# Testing Guide: Dynamic Compound Interest

## Prerequisites

- PostgreSQL database running
- Backend server setup
- Database connection configured in `.env`
- Admin/test user credentials

## Step 1: Run SQL Migration

### 1.1 Connect to Database

```bash
# Windows (PowerShell)
cd "c:\Users\G.Monish Reddy\OneDrive\Desktop\NODUES_FINAL\BACKEND"

# Connect to PostgreSQL
psql -U postgres -d your_database_name
```

### 1.2 Execute Migration

```bash
# From BACKEND directory
psql -U postgres -d your_database_name -f migrations/006_add_dynamic_interest_calculation.sql
```

**Expected Output:**

```
CREATE FUNCTION
CREATE FUNCTION
CREATE VIEW
COMMENT
COMMENT
COMMENT
GRANT
GRANT
GRANT
```

### 1.3 Verify Installation

```sql
-- Check functions exist
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name LIKE 'calculate_%'
  AND routine_schema = 'public';
```

**Expected Result:**

```
        routine_name         | routine_type
-----------------------------+--------------
 calculate_compounded_amount | FUNCTION
 calculate_outstanding_amount| FUNCTION
```

```sql
-- Check view exists
SELECT table_name
FROM information_schema.views
WHERE table_name = 'student_dues_with_interest';
```

**Expected Result:**

```
        table_name
-------------------------
 student_dues_with_interest
```

## Step 2: Test SQL Functions

### 2.1 Test Basic Compound Interest

```sql
-- Test: 10,000 at 0.1% daily for 30 days
SELECT calculate_compounded_amount(
  10000::NUMERIC,           -- principal
  0.001::NUMERIC,           -- 0.1% daily rate
  TRUE,                     -- is compounded
  NOW() - INTERVAL '30 days' -- 30 days ago
) as compounded_amount;
```

**Expected Result:** `10304.55` (approximately)

### 2.2 Test No Compounding

```sql
-- Test: When is_compounded = FALSE
SELECT calculate_compounded_amount(
  10000::NUMERIC,
  0.001::NUMERIC,
  FALSE,                    -- NOT compounded
  NOW() - INTERVAL '30 days'
) as principal_only;
```

**Expected Result:** `10000.00` (no interest added)

### 2.3 Test Outstanding Calculation

```sql
-- Test: With partial payment
SELECT calculate_outstanding_amount(
  10000::NUMERIC,           -- principal
  0.001::NUMERIC,           -- rate
  TRUE,                     -- compounded
  NOW() - INTERVAL '30 days',
  5000::NUMERIC            -- amount already paid
) as outstanding;
```

**Expected Result:** `5304.55` (approximately)

### 2.4 Verify Manual Calculation

```sql
-- Manual verification
SELECT
  10000 as principal,
  10000 * POWER(1.001, 30) as manual_calculation,
  calculate_compounded_amount(10000, 0.001, TRUE, NOW() - INTERVAL '30 days') as function_result;
```

Both values should match (around 10304.55)

## Step 3: Create Test Data

### 3.1 Get Test Student

```sql
-- Find or create a test student
SELECT student_id, roll_number, name, email
FROM students
LIMIT 1;
```

Save the `student_id` and `roll_number` for testing.

### 3.2 Get Test User (Operator)

```sql
-- Get an operator user
SELECT user_id, username, department_id
FROM users
WHERE role_id = (SELECT id FROM roles WHERE role = 'operator')
LIMIT 1;
```

Save the `user_id`.

### 3.3 Create Test Due with Interest

```sql
-- Create a test due with compound interest
INSERT INTO student_dues (
  student_roll_number,
  added_by_user_id,
  added_by_department_id,
  due_type_id,
  due_description,
  is_payable,
  principal_amount,
  amount_paid,
  is_compounded,
  interest_rate,
  is_cleared,
  due_clear_by_date,
  created_at
) VALUES (
  'YOUR_TEST_ROLL_NUMBER',              -- Replace with test student's roll number
  'YOUR_TEST_USER_ID',                  -- Replace with operator's user_id
  1,                                    -- Department ID
  (SELECT id FROM due_types WHERE is_for_student = TRUE LIMIT 1),
  'TEST: Compound Interest Due - 0.1% daily',
  TRUE,                                 -- Payable
  10000.00,                            -- Principal = ₹10,000
  0.00,                                -- No payment yet
  TRUE,                                -- Interest compounded
  0.001,                               -- 0.1% per day
  FALSE,                               -- Not cleared
  CURRENT_DATE + INTERVAL '30 days',  -- Due in 30 days
  NOW() - INTERVAL '15 days'          -- Created 15 days ago
) RETURNING id, student_roll_number, principal_amount, interest_rate;
```

**Save the returned `id`** for later tests.

### 3.4 Verify Test Due Created

```sql
-- Check the test due
SELECT
  id,
  principal_amount,
  interest_rate,
  is_compounded,
  created_at,
  EXTRACT(DAY FROM (NOW() - created_at)) as days_elapsed,
  calculate_compounded_amount(principal_amount, interest_rate, is_compounded, created_at) as current_with_interest,
  calculate_compounded_amount(principal_amount, interest_rate, is_compounded, created_at) - principal_amount as interest_accrued
FROM student_dues
WHERE due_description LIKE 'TEST: Compound Interest%';
```

**Expected Output (after 15 days):**

```
principal_amount: 10000.00
days_elapsed: 15
current_with_interest: 10150.99
interest_accrued: 150.99
```

## Step 4: Test Backend Calculations

### 4.1 Start Backend Server

```bash
# In BACKEND directory
npm run dev
```

Wait for: `Server running on port 3000`

### 4.2 Test Interest Calculation Service

Create a test file: `BACKEND/test-interest.js`

```javascript
import {
  calculateCompoundedAmount,
  calculateOutstandingAmount,
  processPayment,
} from "./services/interestCalculationService.js";

console.log("=== Testing Interest Calculations ===\n");

// Test 1: Basic compound interest
console.log("Test 1: Compound Interest for 30 days");
const result1 = calculateCompoundedAmount(10000, 0.001, 30);
console.log(`Principal: ₹10,000`);
console.log(`Rate: 0.1% daily`);
console.log(`Days: 30`);
console.log(`Compounded: ₹${result1}`);
console.log(`Expected: ₹10,304.55`);
console.log(`Match: ${result1 === "10304.55" ? "✓" : "✗"}\n`);

// Test 2: Outstanding with payment
console.log("Test 2: Outstanding after partial payment");
const due = {
  principal_amount: 10000,
  interest_rate: 0.001,
  is_compounded: true,
  created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
  amount_paid: 5000,
};

const calc = calculateOutstandingAmount(due);
console.log(`Principal: ₹${calc.principal}`);
console.log(`Compounded: ₹${calc.currentAmount}`);
console.log(`Paid: ₹${calc.amountPaid}`);
console.log(`Outstanding: ₹${calc.outstanding}`);
console.log(`Interest Accrued: ₹${calc.interestAccrued}\n`);

// Test 3: Payment processing
console.log("Test 3: Process payment and reset");
const payment = processPayment(due, 6000);
console.log(`Payment: ₹${payment.paymentAmount}`);
console.log(`Old Principal: ₹${payment.currentPrincipal}`);
console.log(`New Principal: ₹${payment.newPrincipal}`);
console.log(`Is Cleared: ${payment.isCleared}`);
console.log(`Interest Paid Off: ₹${payment.interestPaidOff}`);
console.log(`Principal Paid Off: ₹${payment.principalPaidOff}\n`);
```

Run the test:

```bash
node test-interest.js
```

**Expected Output:**

```
=== Testing Interest Calculations ===

Test 1: Compound Interest for 30 days
Principal: ₹10,000
Rate: 0.1% daily
Days: 30
Compounded: ₹10,304.55
Expected: ₹10,304.55
Match: ✓

Test 2: Outstanding after partial payment
Principal: ₹10000.00
Compounded: ₹10304.55
Paid: ₹5000.00
Outstanding: ₹5304.55
Interest Accrued: ₹304.55

Test 3: Process payment and reset
Payment: ₹6000.00
Old Principal: ₹10000.00
New Principal: ₹4304.55
Is Cleared: false
Interest Paid Off: ₹304.55
Principal Paid Off: ₹5695.45
```

## Step 5: Test API Endpoints

### 5.1 Login as Student

```bash
# Use your test student credentials
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test_student@vnrvjiet.in",
    "password": "student123"
  }'
```

Save the returned `token`.

### 5.2 Get Student Dues

```bash
# Replace YOUR_TOKEN with actual token
curl -X GET "http://localhost:3000/api/student/dues?status=payable" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Verify Response Includes:**

```json
{
  "dues": [
    {
      "id": 123,
      "principal_amount": "10000.00",
      "current_amount": "10150.99",
      "calculated_outstanding": "10150.99",
      "calculated_interest": "150.99",
      "days_accrued": 15,
      "amount_paid": "0.00"
    }
  ],
  "totals": {
    "total_outstanding": 10150.99,
    "total_interest_accrued": 150.99
  }
}
```

### 5.3 Test Payment Creation

```bash
curl -X POST http://localhost:3000/api/student/payment/create \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "due_ids": [YOUR_TEST_DUE_ID],
    "return_url": "/student/dues"
  }'
```

**Verify Response:**

```json
{
  "payment_id": "uuid-here",
  "redirect_url": "/api/payments/gateway/uuid-here",
  "total_amount": 10150.99,
  "due_items": [
    {
      "id": 123,
      "type_name": "Library Fine",
      "amount": 10150.99
    }
  ]
}
```

## Step 6: Test Payment Processing

### 6.1 Simulate Payment

```bash
# Get payment session ID from previous step
curl -X POST http://localhost:3000/api/payments/mock/YOUR_SESSION_ID/process \
  -H "Content-Type: application/json" \
  -d '{
    "status": "SUCCESS"
  }'
```

### 6.2 Verify Database Update

```sql
-- Check the due was updated
SELECT
  id,
  principal_amount,
  amount_paid,
  created_at,
  is_cleared,
  EXTRACT(DAY FROM (NOW() - created_at)) as days_since_payment
FROM student_dues
WHERE id = YOUR_TEST_DUE_ID;
```

**Expected Result:**

```
principal_amount: 4150.99  (if paid ₹6000)
amount_paid: 6000.00
days_since_payment: 0      (reset!)
is_cleared: false
```

### 6.3 Verify Payment Record

```sql
-- Check payment was recorded
SELECT
  id,
  due_id,
  paid_amount,
  payment_reference,
  payment_status,
  paid_at
FROM due_payments
WHERE due_id = YOUR_TEST_DUE_ID
ORDER BY paid_at DESC
LIMIT 1;
```

**Expected Result:**

```
paid_amount: 6000.00
payment_status: SUCCESS
```

## Step 7: Verify Interest Reset

### 7.1 Wait a Day (or Simulate)

```sql
-- Simulate 1 day passing by updating created_at
UPDATE student_dues
SET created_at = NOW() - INTERVAL '1 day'
WHERE id = YOUR_TEST_DUE_ID;
```

### 7.2 Calculate New Interest

```sql
SELECT
  id,
  principal_amount,
  EXTRACT(DAY FROM (NOW() - created_at)) as days_elapsed,
  calculate_compounded_amount(principal_amount, interest_rate, is_compounded, created_at) as current_amount,
  calculate_compounded_amount(principal_amount, interest_rate, is_compounded, created_at) - principal_amount as new_interest
FROM student_dues
WHERE id = YOUR_TEST_DUE_ID;
```

**Expected Result (after 1 day):**

```
principal_amount: 4150.99
days_elapsed: 1
current_amount: 4155.14
new_interest: 4.15  (0.1% of 4150.99)
```

This proves that interest is now compounding on the NEW, LOWER principal!

## Step 8: Test Edge Cases

### 8.1 Full Payment (Clears Due)

```sql
-- Create another test due
INSERT INTO student_dues (
  student_roll_number, added_by_user_id, added_by_department_id,
  due_type_id, is_payable, principal_amount, amount_paid,
  is_compounded, interest_rate, is_cleared, due_clear_by_date, created_at
) VALUES (
  'YOUR_TEST_ROLL_NUMBER',
  'YOUR_TEST_USER_ID',
  1,
  (SELECT id FROM due_types WHERE is_for_student = TRUE LIMIT 1),
  TRUE, 1000.00, 0.00, TRUE, 0.001, FALSE,
  CURRENT_DATE + INTERVAL '30 days',
  NOW() - INTERVAL '10 days'
) RETURNING id;
```

Use the payment API to pay the full outstanding amount and verify `is_cleared = TRUE`.

### 8.2 No Interest (Non-Compounded)

```sql
-- Create non-compounded due
INSERT INTO student_dues (
  student_roll_number, added_by_user_id, added_by_department_id,
  due_type_id, is_payable, principal_amount, amount_paid,
  is_compounded, interest_rate, is_cleared, due_clear_by_date
) VALUES (
  'YOUR_TEST_ROLL_NUMBER',
  'YOUR_TEST_USER_ID',
  1,
  (SELECT id FROM due_types WHERE is_for_student = TRUE LIMIT 1),
  TRUE, 1000.00, 0.00, FALSE, 0.001, FALSE,
  CURRENT_DATE + INTERVAL '30 days'
) RETURNING id;

-- Verify no interest after 30 days
SELECT
  calculate_compounded_amount(principal_amount, interest_rate, is_compounded, created_at) as amount
FROM student_dues
WHERE id = (SELECT id from previous query);
```

**Expected:** Amount = 1000.00 (no change)

### 8.3 Multiple Dues Payment

Create 3 test dues, then use payment API to pay them all together. Verify proportional distribution works correctly.

## Step 9: Performance Testing

### 9.1 Test Query Performance

```sql
-- Explain analyze for dashboard query
EXPLAIN ANALYZE
SELECT
  COUNT(*) as total_dues,
  SUM(principal_amount) as total_principal,
  SUM(calculate_outstanding_amount(principal_amount, interest_rate, is_compounded, created_at, amount_paid)) as total_outstanding
FROM student_dues
WHERE is_cleared = FALSE
  AND is_compounded = TRUE;
```

Check execution time is reasonable (< 100ms for hundreds of dues).

### 9.2 Test View Performance

```sql
EXPLAIN ANALYZE
SELECT * FROM student_dues_with_interest
WHERE calculated_outstanding > 0
LIMIT 50;
```

## Step 10: Cleanup Test Data

```sql
-- Remove test dues
DELETE FROM due_payments
WHERE due_id IN (
  SELECT id FROM student_dues
  WHERE due_description LIKE 'TEST:%'
);

DELETE FROM student_dues
WHERE due_description LIKE 'TEST:%';
```

## ✅ Success Criteria

Your implementation is working correctly if:

- [x] SQL functions return correct calculations
- [x] Backend service functions match SQL results
- [x] API returns dues with calculated interest
- [x] Payment updates principal_amount (not current_amount)
- [x] Payment resets created_at timestamp
- [x] Interest compounds on new principal after payment
- [x] Transaction prevents concurrent payment issues
- [x] Non-compounded dues show no interest
- [x] Full payment clears the due
- [x] Multiple dues payment distributes correctly

## 🐛 Troubleshooting

### Issue: Function not found

```sql
-- Verify function exists
\df calculate_compounded_amount
```

If missing, re-run migration.

### Issue: Wrong calculation

```sql
-- Debug calculation
SELECT
  principal_amount,
  interest_rate,
  is_compounded,
  created_at,
  NOW() as current_time,
  EXTRACT(DAY FROM (NOW() - created_at)) as days,
  POWER(1 + interest_rate, EXTRACT(DAY FROM (NOW() - created_at))::INTEGER) as multiplier,
  principal_amount * POWER(1 + interest_rate, EXTRACT(DAY FROM (NOW() - created_at))::INTEGER) as manual_calc
FROM student_dues
WHERE id = YOUR_DUE_ID;
```

### Issue: Payment not resetting timestamp

Check transaction succeeded:

```sql
SELECT * FROM student_dues WHERE id = YOUR_DUE_ID;
```

`created_at` should be recent after payment.

---

**Testing Duration:** ~30-45 minutes  
**Last Updated:** February 17, 2026
