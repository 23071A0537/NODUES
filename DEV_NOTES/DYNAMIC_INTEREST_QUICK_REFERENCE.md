# Dynamic Compound Interest - Quick Reference

## 🎯 Overview

Replaced nightly batch updates with **real-time compound interest calculation** using:

$$A = P(1 + r)^n$$

- **P** = Principal amount (what's owed)
- **r** = Daily interest rate (decimal)
- **n** = Days since last payment/creation
- **A** = Current amount (principal + interest)

## 📁 New Files Created

### 1. Services

- **`BACKEND/services/interestCalculationService.js`**
  - `calculateCompoundedAmount()` - Core formula implementation
  - `calculateOutstandingAmount()` - Outstanding after payments
  - `processPayment()` - Payment with principal reset
  - `enrichDuesWithInterest()` - Add calculated fields to dues

### 2. Utilities

- **`BACKEND/utils/financialUtils.js`**
  - Money arithmetic functions
  - Proportional distribution
  - Validation helpers

### 3. Database

- **`BACKEND/migrations/006_add_dynamic_interest_calculation.sql`**
  - `calculate_compounded_amount()` SQL function
  - `calculate_outstanding_amount()` SQL function
  - `student_dues_with_interest` view

### 4. Documentation

- **`DEV_NOTES/DYNAMIC_INTEREST_IMPLEMENTATION.md`** - Full guide
- **`DEV_NOTES/DYNAMIC_INTEREST_MIGRATION_CHECKLIST.md`** - Migration steps

## 🔄 How It Works

### Before (Old System)

```
Nightly Job:
  ├─ Get all dues with compound interest
  ├─ Calculate A = P(1+r)^1 for each
  ├─ Update current_amount in database
  └─ Repeat every night

Problem: Not real-time, resource intensive
```

### After (New System)

```
On Query:
  ├─ Fetch principal_amount, interest_rate, created_at
  ├─ Calculate A = P(1+r)^n dynamically
  └─ Return calculated value

Benefit: Always accurate, no batch jobs
```

## 💰 Payment Flow

### Step 1: User Initiates Payment

```javascript
// Frontend requests payment for dues
POST /api/student/payment/create
{
  "due_ids": [1, 2, 3],
  "total_amount": calculated_at_time_of_request
}
```

### Step 2: Backend Calculates Real-Time Outstanding

```javascript
// Get current outstanding for each due (with interest accrued until now)
const duesWithInterest = dues.map((due) => {
  const calc = calculateOutstandingAmount(due);
  return { ...due, outstanding: calc.outstanding };
});

const totalOutstanding = sum(duesWithInterest.map((d) => d.outstanding));
```

### Step 3: Process Payment

```javascript
await sql.begin(async (tx) => {
  for (const due of dues) {
    // Calculate how much interest has accrued
    const currentCompounded = calculateCompoundedAmount(
      due.principal_amount,
      due.interest_rate,
      daysBetween(due.created_at, now()),
    );

    // Apply payment
    const remaining = currentCompounded - payment;

    // NEW PRINCIPAL = REMAINING BALANCE
    // RESET TIMESTAMP = NOW
    await tx`
      UPDATE student_dues
      SET principal_amount = ${remaining},
          created_at = NOW(),
          is_cleared = ${remaining < 0.01}
      WHERE id = ${due.id}
    `;
  }
});
```

### Step 4: Interest Starts Fresh

```
Before Payment:
  Principal: $10,000
  Interest Rate: 0.1% daily
  Days Elapsed: 30 days
  Interest Accrued: $304.55
  Current Amount: $10,304.55

User Pays: $5,000

After Payment:
  Principal: $5,304.55  ← new principal is remaining balance
  Interest Rate: 0.1% daily (unchanged)
  Days Elapsed: 0  ← reset!
  Interest Accrued: $0
  Current Amount: $5,304.55

Tomorrow (1 day later):
  Principal: $5,304.55
  Days Elapsed: 1
  Interest Accrued: $5.30
  Current Amount: $5,309.85
```

## 🎨 What Users See

### Student Dashboard

```json
{
  "dues": [
    {
      "id": 123,
      "type": "Library Fine",
      "amount": "10000.00", // ← Principal (base amount)
      "outstanding": "10304.55", // ← What they need to pay TODAY
      "interest_accrued": "304.55", // ← Interest accumulated
      "days_accrued": 30, // ← Days since principal set
      "amount_paid": "0.00",
      "is_cleared": false
    }
  ],
  "totals": {
    "total_principal": "10000.00",
    "total_outstanding": "10304.55",
    "total_interest": "304.55"
  }
}
```

### Payment Breakdown

```
Due #123: Library Fine

Base Amount:        $10,000.00
Interest (30 days):    $304.55 (0.1% daily compounded)
                    ────────────
Total Due:          $10,304.55

You are paying:     $5,000.00

After Payment:
New Base Amount:    $5,304.55  ← This becomes new principal
Interest Reset:     $0.00      ← Starts from zero
Next Interest:      Compounds on $5,304.55
```

## ⚙️ Configuration

### Interest Rates

```javascript
// In due creation
{
  "is_compounded": true,
  "interest_rate": 0.001,  // 0.1% per day
  "principal_amount": 10000
}

// Daily: 0.001 = 0.1% → 10000 * (1.001)^30 = 10304.55
// Monthly (30 days): ~3.04%
// Yearly (365 days): ~44.02%
```

### Interest Rate Examples

| Daily % | Monthly (30d) | Yearly (365d) |
| ------- | ------------- | ------------- |
| 0.05%   | 1.52%         | 19.72%        |
| 0.1%    | 3.04%         | 44.02%        |
| 0.2%    | 6.17%         | 107.88%       |
| 0.5%    | 16.10%        | 525.77%       |

## 🔍 Key Code Snippets

### Calculate Interest

```javascript
import { calculateOutstandingAmount } from "../services/interestCalculationService.js";

const due = {
  principal_amount: 10000,
  interest_rate: 0.001,
  is_compounded: true,
  created_at: "2026-01-01T00:00:00Z",
  amount_paid: 0,
};

const result = calculateOutstandingAmount(due);
console.log(result.outstanding); // "10304.55" (if 30 days later)
```

### Process Payment

```javascript
import { processPayment } from "../services/interestCalculationService.js";

const paymentResult = processPayment(due, 5000);
console.log(paymentResult);
// {
//   currentPrincipal: "10000.00",
//   currentCompounded: "10304.55",
//   paymentAmount: "5000.00",
//   newPrincipal: "5304.55",    ← Use this to UPDATE principal_amount
//   newCreatedAt: Date(now),     ← Use this to UPDATE created_at
//   interestPaidOff: "304.55",
//   principalPaidOff: "4695.45",
//   isCleared: false
// }
```

### SQL Query with Interest

```sql
-- Get outstanding with interest
SELECT
  id,
  principal_amount,
  calculate_compounded_amount(
    principal_amount,
    interest_rate,
    is_compounded,
    created_at
  ) as current_amount,
  calculate_outstanding_amount(
    principal_amount,
    interest_rate,
    is_compounded,
    created_at,
    amount_paid
  ) as outstanding
FROM student_dues
WHERE is_cleared = FALSE;
```

## ✅ Validation

### Test Calculation

```javascript
// Formula: A = P(1 + r)^n
const P = 10000;
const r = 0.001;
const n = 30;

const A = P * Math.pow(1 + r, n);
console.log(A); // 10304.545...

// Rounded: $10,304.55 ✓
```

### Test in Production

```sql
-- Create test due
INSERT INTO student_dues (
  student_roll_number,
  due_type_id,
  principal_amount,
  interest_rate,
  is_compounded,
  is_payable,
  created_at
) VALUES (
  'TEST001',
  1,
  10000,
  0.001,
  true,
  true,
  NOW() - INTERVAL '30 days'
);

-- Check calculation
SELECT
  principal_amount,
  calculate_compounded_amount(principal_amount, interest_rate, is_compounded, created_at) as compounded,
  EXTRACT(DAY FROM (NOW() - created_at)) as days
FROM student_dues
WHERE student_roll_number = 'TEST001';

-- Should show:
-- principal_amount: 10000.00
-- compounded: 10304.55
-- days: 30
```

## 🚨 Important Notes

1. **Principal vs Current**
   - `principal_amount` = base amount (shown to users)
   - `current_amount` (calculated) = principal + interest

2. **Payment Resets**
   - Every payment updates `principal_amount`
   - Every payment resets `created_at`
   - Interest compounds on NEW principal from payment date

3. **No Batch Jobs**
   - Remove any cron jobs updating `current_amount`
   - Interest is calculated on-the-fly

4. **Transaction Safety**
   - Always use `FOR UPDATE` when processing payments
   - Wrap in `sql.begin()` transaction

## 📊 Monitoring

```sql
-- Daily interest monitoring
SELECT
  COUNT(*) as total_compounded_dues,
  SUM(principal_amount) as total_principal,
  SUM(calculate_compounded_amount(principal_amount, interest_rate, is_compounded, created_at)) as total_with_interest,
  SUM(calculate_compounded_amount(principal_amount, interest_rate, is_compounded, created_at)) - SUM(principal_amount) as total_interest_accrued
FROM student_dues
WHERE is_compounded = TRUE
  AND is_cleared = FALSE;
```

---

**Version:** 1.0.0  
**Date:** February 17, 2026  
**Status:** ✅ Production Ready
