# Quick Testing Guide - Dynamic Compound Interest

## 🚀 Quick Start (5 Minutes)

### Step 1: Run SQL Migration

```bash
cd BACKEND
psql -U postgres -d your_database_name -f migrations/006_add_dynamic_interest_calculation.sql
```

### Step 2: Test SQL Functions

```bash
psql -U postgres -d your_database_name -f test-interest.sql
```

✅ **Expected:** All calculations should show compound interest working correctly.

### Step 3: Test Backend Service

```bash
cd BACKEND
node test-interest-quick.js
```

✅ **Expected:** All tests should pass (green checkmarks).

**Note:** Expected values are mathematically precise:

- 10,000 × (1.001)³⁰ = 10,304.39 (using standard IEEE 754 precision)
- All calculations use proper rounding to 2 decimal places

---

## 📋 Detailed Testing (30 Minutes)

Follow the complete guide in [TESTING_GUIDE_DYNAMIC_INTEREST.md](./DEV_NOTES/TESTING_GUIDE_DYNAMIC_INTEREST.md)

### Key Test Areas

1. **SQL Functions** - Database-level calculation
2. **Backend Service** - JavaScript calculation logic
3. **Payment Flow** - Principal reset after payment
4. **API Endpoints** - End-to-end testing

---

## ✅ Success Checklist

- [ ] SQL functions return correct calculations
- [ ] Backend test suite passes (all ✓)
- [ ] Payment resets `principal_amount`
- [ ] Payment resets `created_at` timestamp
- [ ] Interest compounds on new principal after payment
- [ ] API returns calculated interest fields

---

## 🧪 Manual Verification

### Create Test Due (SQL)

```sql
INSERT INTO student_dues (
  student_roll_number,
  added_by_user_id,
  added_by_department_id,
  due_type_id,
  is_payable,
  principal_amount,
  is_compounded,
  interest_rate,
  due_clear_by_date,
  created_at
) VALUES (
  'YOUR_STUDENT_ROLL',
  'YOUR_USER_ID',
  1,
  1,
  TRUE,
  10000.00,
  TRUE,
  0.001,  -- 0.1% daily
  CURRENT_DATE + INTERVAL '30 days',
  NOW() - INTERVAL '15 days'  -- Created 15 days ago
) RETURNING id;
```

### Check Calculation

```sql
SELECT
  id,
  principal_amount,
  EXTRACT(DAY FROM (NOW() - created_at)) as days_elapsed,
  calculate_compounded_amount(
    principal_amount,
    interest_rate,
    is_compounded,
    created_at
  ) as current_with_interest
FROM student_dues
WHERE id = YOUR_DUE_ID;
```

**Expected Result:**

- Days: 15
- Principal: 10,000.00
- Current: ~10,150.99
- Interest: ~150.99

---

## 🔧 Troubleshooting

### Functions not found?

```sql
-- Check if functions exist
SELECT routine_name
FROM information_schema.routines
WHERE routine_name LIKE 'calculate_%';
```

If empty, re-run the migration.

### Wrong calculations?

```sql
-- Debug a specific due
SELECT
  principal_amount,
  interest_rate,
  is_compounded,
  created_at,
  EXTRACT(DAY FROM (NOW() - created_at)) as days,
  principal_amount * POWER(1 + interest_rate, EXTRACT(DAY FROM (NOW() - created_at))::INTEGER) as expected
FROM student_dues
WHERE id = YOUR_DUE_ID;
```

---

## 📚 Full Documentation

- **Implementation Guide:** [DYNAMIC_INTEREST_IMPLEMENTATION.md](./DEV_NOTES/DYNAMIC_INTEREST_IMPLEMENTATION.md)
- **Complete Testing:** [TESTING_GUIDE_DYNAMIC_INTEREST.md](./DEV_NOTES/TESTING_GUIDE_DYNAMIC_INTEREST.md)
- **Quick Reference:** [DYNAMIC_INTEREST_QUICK_REFERENCE.md](./DEV_NOTES/DYNAMIC_INTEREST_QUICK_REFERENCE.md)
- **Migration Checklist:** [DYNAMIC_INTEREST_MIGRATION_CHECKLIST.md](./DEV_NOTES/DYNAMIC_INTEREST_MIGRATION_CHECKLIST.md)

---

## 🎯 Key Formula

$$A = P(1 + r)^n$$

Where:

- **P** = Principal amount (base owed)
- **r** = Daily interest rate (decimal, e.g., 0.001 = 0.1%)
- **n** = Days since last payment
- **A** = Current amount (principal + interest)

### Example:

```
Principal: ₹10,000
Rate: 0.1% daily (0.001)
Days: 30

Calculation: 10,000 × (1.001)³⁰ = ₹10,304.55
Interest: ₹304.55
```

---

## 💡 Quick Tips

1. **Always show principal to users** - Not the compounded amount
2. **Payment resets everything** - New principal, new timestamp
3. **No batch jobs needed** - Interest calculated on-demand
4. **Use transactions** - FOR UPDATE locks prevent issues
5. **Trust the formula** - Math doesn't lie!

---

**Ready to test?** Start with Step 1 above! 🚀
