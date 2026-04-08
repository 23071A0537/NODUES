# Dynamic Interest Migration Checklist

## Pre-Migration

- [ ] **Backup Database**

  ```bash
  pg_dump -U postgres nodues_db > backup_pre_interest_migration.sql
  ```

- [ ] **Review Current Data**

  ```sql
  -- Check how many dues have interest enabled
  SELECT
    COUNT(*) as total_dues,
    COUNT(*) FILTER (WHERE is_compounded = TRUE) as compounded_dues,
    COUNT(*) FILTER (WHERE interest_rate IS NOT NULL AND interest_rate > 0) as dues_with_rate
  FROM student_dues;
  ```

- [ ] **Document Current State**
  - Note total outstanding amounts
  - Save sample calculations for verification

## Migration Steps

### 1. Database Migration

- [ ] **Run SQL Migration**

  ```bash cd BACKEND
  psql -U your_user -d your_database -f migrations/006_add_dynamic_interest_calculation.sql
  ```

- [ ] **Verify Functions Created**

  ```sql
  -- Check functions exist
  SELECT routine_name
  FROM information_schema.routines
  WHERE routine_name LIKE 'calculate_%';

  -- Check view exists
  SELECT table_name
  FROM information_schema.views
  WHERE table_name = 'student_dues_with_interest';
  ```

- [ ] **Test Functions**

  ```sql
  -- Test basic calculation
  SELECT calculate_compounded_amount(10000, 0.001, TRUE, NOW() - INTERVAL '30 days');
  -- Should return ~10304.55

  -- Test with no compounding
  SELECT calculate_compounded_amount(10000, 0.001, FALSE, NOW() - INTERVAL '30 days');
  -- Should return 10000.00
  ```

### 2. Data Cleanup (If Needed)

- [ ] **Set Principal Amount**

  ```sql
  -- If migrating from old system where current_amount was stored
  -- Only run if principal_amount is NULL for existing dues
  UPDATE student_dues
  SET principal_amount = COALESCE(current_amount, 0) - COALESCE(amount_paid, 0)
  WHERE principal_amount IS NULL
    AND is_payable = TRUE;
  ```

- [ ] **Verify Data Integrity**
  ```sql
  -- Ensure no NULL principals for payable dues
  SELECT COUNT(*)
  FROM student_dues
  WHERE principal_amount IS NULL
    AND is_payable = TRUE
    AND is_cleared = FALSE;
  -- Should return 0
  ```

### 3. Backend Deployment

- [ ] **Install Dependencies** (if needed)

  ```bash
  cd BACKEND
  npm install
  ```

- [ ] **Code Review**
  - [ ] Review `services/interestCalculationService.js`
  - [ ] Review `utils/financialUtils.js`
  - [ ] Review updated controllers

- [ ] **Update Environment** (if needed)

  ```env
  # Add to .env if configuring interest settings
  DEFAULT_DAILY_INTEREST_RATE=0.001
  INTEREST_GRACE_PERIOD_DAYS=0
  ```

- [ ] **Run Tests**

  ```bash
  npm test
  ```

- [ ] **Deploy Backend**

  ```bash
  # Development
  npm run dev

  # Production
  pm2 restart nodues-backend
  ```

### 4. Verification

- [ ] **Test Interest Calculation**
  - Create test due with known values
  - Verify calculation after waiting
  - Compare with manual calculation

- [ ] **Test Payment Flow**
  - [ ] Create payment session
  - [ ] Process payment
  - [ ] Verify principal reset
  - [ ] Verify timestamp reset
  - [ ] Check payment record created

- [ ] **Test API Endpoints**

  ```bash
  # Get student dues
  curl -X GET http://localhost:3000/api/student/dues \
    -H "Authorization: Bearer TOKEN"

  # Verify response includes calculated fields
  # - display_amount (principal)
  # - calculated_outstanding
  # - calculated_interest
  ```

- [ ] **Test Dashboard Queries**
  - Admin dashboard totals
  - HOD department stats
  - Operator views

### 5. Frontend Updates (If Needed)

- [ ] **Review API Response Changes**
  - `current_amount` now shows `principal_amount`
  - `calculated_outstanding` shows total to pay
  - `calculated_interest` shows accrued interest

- [ ] **Update UI Components**
  - [ ] Due amount display
  - [ ] Payment amount calculation
  - [ ] Outstanding balance display
  - [ ] Interest breakdown (if shown)

- [ ] **Test Frontend**
  - Student dues page
  - Payment flow
  - Dashboard widgets

### 6. Monitoring

- [ ] **Set Up Monitoring**

  ```sql
  -- Create monitoring query
  CREATE VIEW interest_monitoring AS
  SELECT
    COUNT(*) as total_compounded_dues,
    AVG(EXTRACT(DAY FROM (NOW() - created_at))) as avg_days_since_principal_set,
    SUM(principal_amount) as total_principal,
    SUM(calculate_compounded_amount(principal_amount, interest_rate, is_compounded, created_at)) as total_compounded,
    SUM(calculate_compounded_amount(principal_amount, interest_rate, is_compounded, created_at)) - SUM(principal_amount) as total_interest_accrued
  FROM student_dues
  WHERE is_compounded = TRUE
    AND is_cleared = FALSE;
  ```

- [ ] **Check Database Performance**

  ```sql
  -- Monitor query performance
  EXPLAIN ANALYZE
  SELECT SUM(calculate_outstanding_amount(principal_amount, interest_rate, is_compounded, created_at, amount_paid))
  FROM student_dues
  WHERE is_cleared = FALSE;
  ```

- [ ] **Add Indexes If Needed**

  ```sql
  -- If queries are slow
  CREATE INDEX IF NOT EXISTS idx_student_dues_created_at
  ON student_dues(created_at)
  WHERE is_cleared = FALSE;

  CREATE INDEX IF NOT EXISTS idx_student_dues_is_compounded
  ON student_dues(is_compounded)
  WHERE is_cleared = FALSE;
  ```

## Post-Migration

### Testing Checklist

- [ ] **Student-Side Testing**
  - [ ] View dues with interest
  - [ ] Create payment for single due
  - [ ] Create payment for multiple dues
  - [ ] Verify payment confirmation
  - [ ] Check payment history

- [ ] **Operator-Side Testing**
  - [ ] Add new due with interest
  - [ ] View student with compounded dues
  - [ ] Clear non-payable due

- [ ] **Admin-Side Testing**
  - [ ] Dashboard statistics
  - [ ] Department analytics
  - [ ] Overall stats

- [ ] **HOD-Side Testing**
  - [ ] Department dashboard
  - [ ] Student dues report
  - [ ] Analytics views

### Data Validation

- [ ] **Compare Totals**

  ```sql
  -- Compare old vs new calculations (if applicable)
  SELECT
    'Old Method' as method,
    SUM(current_amount - amount_paid) as total_outstanding
  FROM student_dues
  WHERE is_cleared = FALSE

  UNION ALL

  SELECT
    'New Method' as method,
    SUM(calculate_outstanding_amount(principal_amount, interest_rate, is_compounded, created_at, amount_paid))
  FROM student_dues
  WHERE is_cleared = FALSE;
  ```

- [ ] **Verify Sample Records**
  - Pick 5-10 random dues
  - Manually calculate expected values
  - Compare with system calculations

### Documentation

- [ ] **Update API Documentation**
  - Document new response fields
  - Update example responses
  - Note deprecated fields (if any)

- [ ] **Update User Guides**
  - Explain interest display
  - Update payment guide
  - Add FAQ about interest

- [ ] **Team Training**
  - Brief operators on changes
  - Explain to support team
  - Update admin documentation

## Rollback Plan

If issues arise:

### 1. Rollback Database

```bash
# Restore from backup
psql -U postgres nodues_db < backup_pre_interest_migration.sql
```

### 2. Rollback Code

```bash
git revert <commit-hash>
pm2 restart nodues-backend
```

### 3. Remove SQL Functions (if needed)

```sql
DROP VIEW IF EXISTS student_dues_with_interest;
DROP FUNCTION IF EXISTS calculate_outstanding_amount;
DROP FUNCTION IF EXISTS calculate_compounded_amount;
```

## Success Criteria

✅ **Migration is successful when:**

1. All SQL functions are created and working
2. Existing dues display correctly with calculated interest
3. New payments process successfully
4. Principal amount resets after payment
5. Timestamp resets after payment
6. Dashboard statistics are accurate
7. No performance degradation
8. Frontend displays data correctly
9. Mobile app works (if applicable)
10. No errors in logs

## Timeline Estimate

- **Database Migration:** 5-10 minutes
- **Backend Deployment:** 10-15 minutes
- **Testing:** 30-60 minutes
- **Frontend Updates:** 30-60 minutes (if needed)
- **Verification:** 30 minutes
- **Total:** ~2-3 hours

## Support Contacts

- **Database Issues:** [DBA Contact]
- **Backend Issues:** [Backend Team]
- **Frontend Issues:** [Frontend Team]
- **Business Logic:** [Product Owner]

---

**Prepared:** February 17, 2026
**Migration Owner:** [Your Name]
**Approved By:** [Approver]
