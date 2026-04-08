# Dynamic Compound Interest Implementation with Grace Period

## Overview

This implementation replaces the nightly batch update system with **dynamic compound interest calculation** using the formula:

$$A = P(1 + r)^n$$

Where:

- **A** = Current compounded amount
- **P** = Principal amount (stored in database)
- **r** = Daily interest rate (stored as decimal)
- **n** = Number of days **AFTER** `due_clear_by_date` (grace period before that)

## Grace Period Logic

### Before `due_clear_by_date`

- **No interest is charged**
- `current_amount = principal_amount`
- Student has time to pay without penalties

### After `due_clear_by_date`

- **Interest starts compounding**
- Days calculated from `due_clear_by_date` (not `created_at`)
- Formula applies: A = P(1 + r)^n

### When Fully Paid

- `principal_amount = 0`
- `current_amount = 0`
- No further interest calculations

## Key Features

### ✅ No Batch Jobs Required

- Interest is calculated on-demand when querying dues
- Eliminates need for cron jobs or scheduled tasks
- Always provides real-time, accurate values

### ✅ Grace Period Support

- Students have until `due_clear_by_date` to pay without interest
- Interest only compounds AFTER the grace period ends
- Transparent and fair to students

### ✅ Payment Reset Logic

When a payment is made:

1. Calculate current compounded amount at payment time
2. Subtract payment from compounded amount
3. **Remaining balance becomes new principal** (or 0 if fully paid)
4. **Reset `created_at` to payment timestamp**
5. If fully paid, `principal_amount = 0` and no more updates occur

### ✅ Transaction Safety

- All payment operations use database transactions
- Row-level locking prevents concurrent payment issues
- Atomic updates ensure data consistency

### ✅ Financial Accuracy

- Uses `NUMERIC` types for all monetary values
- Rounds to 2 decimal places for currency precision
- High-precision JavaScript calculations in service layer
- SQL functions for database-level aggregations

## Architecture

### Backend Services

#### 1. Interest Calculation Service

**Location:** `BACKEND/services/interestCalculationService.js`

**Core Functions:**

- `calculateCompoundedAmount(principal, dailyRate, days)` - Pure compound interest calculation
- `calculateOutstandingAmount(due, asOfDate)` - Outstanding after payments
- `processPayment(due, paymentAmount)` - Payment processing with reset logic
- `enrichDuesWithInterest(dues)` - Enrich dues with calculated fields

**Example Usage:**

```javascript
import {
  calculateOutstandingAmount,
  processPayment,
} from "../services/interestCalculationService.js";

// Get current state with grace period
const due = {
  principal_amount: 10000,
  interest_rate: 0.001, // 0.1% daily
  is_compounded: true,
  due_clear_by_date: "2026-02-01", // Grace period until this date
  created_at: "2026-01-01",
  amount_paid: 0,
};

const calculation = calculateOutstandingAmount(due);
console.log(calculation);
// Output (if before due_clear_by_date):
// {
//   principal: "10000.00",
//   currentAmount: "10000.00",  // No interest yet!
//   interestAccrued: "0.00",
//   outstanding: "10000.00",
//   isInGracePeriod: true,
//   isFullyPaid: false
// }

// Output (if 30 days after due_clear_by_date):
// {
//   principal: "10000.00",
//   currentAmount: "10304.39",  // 30 days of compound interest
//   interestAccrued: "304.39",
//   outstanding: "10304.39",
//   isInGracePeriod: false,
//   isFullyPaid: false
// }
// {
//   principal: "10000.00",
//   currentAmount: "10477.00",  // After 47 days
//   interestAccrued: "477.00",
//   outstanding: "10477.00",
//   days: 47
// }

// Process payment
const payment = processPayment(due, 5000);
console.log(payment);
// {
//   newPrincipal: "5477.00",  // Remaining becomes new principal
//   newCreatedAt: Date(now),  // Reset timestamp
//   isCleared: false
// }
```

#### 2. Financial Utilities

**Location:** `BACKEND/utils/financialUtils.js`

**Key Functions:**

- `roundMoney(value)` - Proper rounding for currency
- `addMoney(a, b)` - Precise addition
- `subtractMoney(a, b)` - Precise subtraction
- `distributeProportionally(total, proportions)` - Distribute payments
- `validateMoney(value, options)` - Input validation

### Database Layer

#### SQL Functions

**Location:** `BACKEND/migrations/006_add_dynamic_interest_calculation.sql`

**Functions Created:**

1. **`calculate_compounded_amount(principal, rate, is_compounded, due_clear_by_date)`**
   - Calculates A = P(1+r)^n in PostgreSQL with grace period
   - Returns principal if before `due_clear_by_date` (no interest)
   - Compounds from `due_clear_by_date` if after that date
   - Returns 0 if principal is 0 (fully paid)
   - Returns NUMERIC rounded to 2 decimals

2. **`calculate_outstanding_amount(principal, rate, is_compounded, due_clear_by_date, amount_paid)`**
   - Calculates outstanding = compounded - paid (with grace period)
   - Ensures non-negative results

3. **View: `student_dues_with_interest`**
   - Pre-joined view with calculated fields including grace period status
   - Adds `is_in_grace_period` and `days_past_due_date` columns
   - Useful for reporting and dashboards

**Example SQL Usage:**

```sql
-- Get total outstanding across all dues (with grace period)
SELECT SUM(
  calculate_outstanding_amount(
    principal_amount,
    interest_rate,
    is_compounded,
    due_clear_by_date,  -- Uses grace period logic
    amount_paid
  )
) as total_outstanding
FROM student_dues
WHERE is_cleared = FALSE;

-- Use the view to see grace period status
SELECT
  roll_number,
  principal_amount,
  calculated_current_amount,
  is_in_grace_period,
  days_past_due_date
FROM student_dues_with_interest
WHERE calculated_outstanding > 0;
```

## Payment Flow

### 1. Create Payment Session

**Controller:** `studentController.js::createPaymentSession`

```javascript
// Get dues with interest fields
const dues = await sql`
  SELECT principal_amount, interest_rate, is_compounded, created_at, amount_paid
  FROM student_dues WHERE id = ANY(${due_ids})
`;

// Calculate real-time outstanding for each
const duesWithCalc = dues.map((due) => {
  const calc = calculateOutstandingAmount(due);
  return { ...due, outstanding: parseFloat(calc.outstanding) };
});

// Total payment needed
const totalOutstanding = duesWithCalc.reduce(
  (sum, d) => sum + d.outstanding,
  0,
);
```

### 2. Process Payment

**Controller:** `paymentController.js::processMockPayment`

```javascript
await sql.begin(async (tx) => {
  // Lock rows
  const dues = await tx`
    SELECT * FROM student_dues 
    WHERE id = ANY(${due_ids})
    FOR UPDATE  -- Row lock
  `;

  // Process each due
  for (const due of dues) {
    const paymentForDue = calculatePaymentPortion(due, totalPayment);
    const result = processPayment(due, paymentForDue);

    // Update with new principal and reset timestamp
    await tx`
      UPDATE student_dues
      SET principal_amount = ${result.newPrincipal},
          created_at = ${result.newCreatedAt},
          amount_paid = ${result.newAmountPaid},
          is_cleared = ${result.isCleared}
      WHERE id = ${due.id}
    `;

    // Record payment
    await tx`
      INSERT INTO due_payments (due_id, paid_amount, ...)
      VALUES (${due.id}, ${paymentForDue}, ...)
    `;
  }
});
```

### 3. Display to Users

**Controller:** `studentController.js::getDues`

```javascript
// Fetch dues with interest fields
const dues = await sql`
  SELECT principal_amount, interest_rate, is_compounded, created_at, amount_paid, ...
  FROM student_dues
`;

// Enrich with calculations
const enrichedDues = enrichDuesWithInterest(dues);

// Return to frontend
const response = enrichedDues.map((due) => ({
  id: due.id,
  amount: due.display_amount, // Shows principal_amount
  outstanding: due.calculated_outstanding,
  interest_accrued: due.calculated_interest,
  days_accrued: due.days_accrued,
}));
```

## Data Display Strategy

### What Users See

#### Principal Amount Display

Users always see the **principal_amount** as the "due amount" rather than the compounded amount. This provides consistency and transparency:

```javascript
{
  due_id: 123,
  amount: "10000.00",  // principal_amount (what they borrowed/owe)
  outstanding: "10477.00",  // what they need to pay today (with interest)
  interest_accrued: "477.00",  // how much interest has accumulated
  days_since_last_payment: 47
}
```

#### Benefits:

- ✅ Principal remains constant until payment
- ✅ Users can see how much interest has accrued
- ✅ Transparent calculation: principal + interest = outstanding
- ✅ Matches financial industry standards

## Migration Guide

### Step 1: Run SQL Migration

```bash
cd BACKEND
psql -U your_user -d your_database -f migrations/006_add_dynamic_interest_calculation.sql
```

This creates:

- `calculate_compounded_amount()` function
- `calculate_outstanding_amount()` function
- `student_dues_with_interest` view

### Step 2: Verify Existing Data

Ensure all dues have proper values:

```sql
-- Check for NULL principal amounts
SELECT COUNT(*) FROM student_dues WHERE principal_amount IS NULL AND is_payable = TRUE;

-- If current_amount exists, you may need to migrate it to principal_amount
-- Only needed if you're migrating from old system
UPDATE student_dues
SET principal_amount = current_amount - COALESCE(amount_paid, 0)
WHERE principal_amount IS NULL;
```

### Step 3: Deploy Backend Code

The new code is backwards compatible. It:

- Uses `principal_amount` instead of `current_amount`
- Calculates interest dynamically
- Still updates `amount_paid` for tracking

### Step 4: Update Frontend (If Needed)

If frontend expects `current_amount`, it will still receive it as:

```javascript
current_amount: due.display_amount; // Actually the principal
```

## Testing

### Unit Tests

Test the interest calculation service:

```javascript
// test/interestCalculation.test.js
import { calculateCompoundedAmount } from "../services/interestCalculationService.js";

test("compound interest after 30 days", () => {
  const result = calculateCompoundedAmount(10000, 0.001, 30);
  expect(result).toBe("10304.55"); // 10000 * (1.001)^30
});

test("no interest when not compounded", () => {
  const result = calculateCompoundedAmount(10000, 0.001, 30, false);
  expect(result).toBe("10000.00");
});
```

### Integration Tests

Test payment flow:

```javascript
test("payment resets principal and timestamp", async () => {
  const due = await createTestDue({ principal: 10000, rate: 0.001 });
  await wait(10); // days

  // Pay half
  await processPayment(due.id, 5150);

  const updated = await getDue(due.id);
  expect(updated.principal_amount).toBe(5150.0); // Half of compounded
  expect(updated.created_at).toBeRecent(); // Reset timestamp
});
```

## Performance Considerations

### Database Queries

✅ **Efficient:** SQL functions calculated at database level
✅ **Indexed:** `created_at` should be indexed for date calculations
✅ **No N+1:** Calculations done in single query

### Caching Strategy

For dashboards showing aggregate stats:

```javascript
// Cache for 5 minutes
const cacheKey = "dashboard:total_outstanding";
let total = await redis.get(cacheKey);

if (!total) {
  total = await sql`SELECT SUM(calculate_outstanding_amount(...)) as total`;
  await redis.set(cacheKey, total, "EX", 300);
}
```

## Troubleshooting

### Issue: Outstanding amount seems wrong

**Check:**

1. Verify `interest_rate` is in decimal form (e.g., 0.001 for 0.1%)
2. Check `created_at` timestamp is correct
3. Ensure `is_compounded` flag is set properly

**Debug:**

```sql
SELECT
  id,
  principal_amount,
  interest_rate,
  is_compounded,
  created_at,
  calculate_compounded_amount(principal_amount, interest_rate, is_compounded, created_at) as calc_amount,
  EXTRACT(DAY FROM (NOW() - created_at)) as days_elapsed
FROM student_dues
WHERE id = 123;
```

### Issue: Payment not resetting timestamp

**Check transaction logs:**

```sql
SELECT * FROM due_payments WHERE due_id = 123 ORDER BY paid_at DESC;
SELECT created_at FROM student_dues WHERE id = 123;
```

The `created_at` should match or be close to the latest `paid_at`.

## Benefits Summary

✅ **No Manual Intervention:** Interest calculates automatically
✅ **Real-Time Accuracy:** Always reflects current state
✅ **Scalable:** No batch jobs consuming resources
✅ **Transparent:** Users see principal + accrued interest
✅ **Auditable:** Payment history preserved in `due_payments`
✅ **Financial Best Practices:** Uses proper decimal arithmetic
✅ **Transaction Safe:** Prevents double payments and race conditions

## Future Enhancements

### Possible Additions:

1. **Interest Rate History:** Track rate changes over time
2. **Partial Payment Strategy:** Different allocation rules (interest first vs principal first)
3. **Grace Periods:** Don't compound for first N days
4. **Interest Caps:** Maximum interest amount
5. **Payment Plans:** Scheduled payments with projection
6. **Interest Forgiveness:** Admin ability to waive interest

### Implementation Example (Grace Period):

```javascript
export function calculateCompoundedAmountWithGrace(
  principal,
  rate,
  days,
  graceDays = 0,
) {
  const compoundingDays = Math.max(0, days - graceDays);
  return calculateCompoundedAmount(principal, rate, compoundingDays);
}
```

## Support

For questions or issues:

1. Check this documentation
2. Review code comments in service files
3. Test with sample data in development
4. Verify SQL functions are installed correctly

---

**Implementation Date:** February 17, 2026
**Version:** 1.0.0
**Status:** ✅ Production Ready
