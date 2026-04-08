-- =====================================================
-- Dynamic Compound Interest - SQL Test Script
-- =====================================================
-- Run this after executing migration 006
-- Usage: psql -U postgres -d your_database -f test-interest.sql

\echo '════════════════════════════════════════════════════════'
\echo 'Dynamic Compound Interest - SQL Function Tests'
\echo '════════════════════════════════════════════════════════'
\echo ''

-- Test 1: Basic compound interest calculation
\echo 'TEST 1: Basic Compound Interest'
\echo '────────────────────────────────────────────────────────'
\echo 'Formula: A = P(1+r)^n'
\echo 'Principal: 10,000 | Rate: 0.1% daily | Days: 30'
\echo ''

SELECT 
  10000 as principal,
  0.001 as daily_rate,
  '30 days' as period,
  calculate_compounded_amount(
    10000::NUMERIC,
    0.001::NUMERIC,
    TRUE,
    CURRENT_TIMESTAMP - INTERVAL '30 days'
  ) as compounded_amount,
  calculate_compounded_amount(
    10000::NUMERIC,
    0.001::NUMERIC,
    TRUE,
    CURRENT_TIMESTAMP - INTERVAL '30 days'
  ) - 10000 as interest_accrued;

\echo ''
\echo 'Expected: ~10,304.55 with ~304.55 interest'
\echo ''

-- Test 2: No compounding
\echo 'TEST 2: Non-Compounded Due (Fixed Amount)'
\echo '────────────────────────────────────────────────────────'

SELECT 
  10000 as principal,
  calculate_compounded_amount(
    10000::NUMERIC,
    0.001::NUMERIC,
    FALSE,  -- NOT compounded
    CURRENT_TIMESTAMP - INTERVAL '30 days'
  ) as amount_after_30_days,
  'Should equal principal' as note;

\echo ''

-- Test 3: Outstanding calculation
\echo 'TEST 3: Outstanding Amount After Partial Payment'
\echo '────────────────────────────────────────────────────────'

SELECT 
  10000 as principal,
  5000 as amount_paid,
  calculate_outstanding_amount(
    10000::NUMERIC,
    0.001::NUMERIC,
    TRUE,
    CURRENT_TIMESTAMP - INTERVAL '30 days',
    5000::NUMERIC
  ) as outstanding,
  'Outstanding = Compounded - Paid' as formula;

\echo ''
\echo 'Expected: ~5,304.55 (10,304.55 - 5,000)'
\echo ''

-- Test 4: Zero days (just created)
\echo 'TEST 4: Newly Created Due (0 days elapsed)'
\echo '────────────────────────────────────────────────────────'

SELECT 
  10000 as principal,
  calculate_compounded_amount(
    10000::NUMERIC,
    0.001::NUMERIC,
    TRUE,
    CURRENT_TIMESTAMP  -- Created now
  ) as current_amount,
  'Should equal principal when n=0' as note;

\echo ''

-- Test 5: Different time periods
\echo 'TEST 5: Interest Growth Over Time'
\echo '────────────────────────────────────────────────────────'

SELECT 
  days,
  calculate_compounded_amount(
    10000::NUMERIC,
    0.001::NUMERIC,
    TRUE,
    CURRENT_TIMESTAMP - (days || ' days')::INTERVAL
  ) as amount,
  calculate_compounded_amount(
    10000::NUMERIC,
    0.001::NUMERIC,
    TRUE,
    CURRENT_TIMESTAMP - (days || ' days')::INTERVAL
  ) - 10000 as interest
FROM (VALUES (0), (7), (15), (30), (60), (90)) AS t(days)
ORDER BY days;

\echo ''

-- Test 6: View functionality
\echo 'TEST 6: student_dues_with_interest View'
\echo '────────────────────────────────────────────────────────'
\echo 'Checking if view exists and can be queried...'
\echo ''

SELECT 
  COUNT(*) as total_rows,
  COUNT(*) FILTER (WHERE is_compounded = TRUE) as compounded_dues,
  SUM(calculated_interest) as total_interest_accrued
FROM student_dues_with_interest
WHERE is_cleared = FALSE;

\echo ''

-- Test 7: Performance test
\echo 'TEST 7: Performance Test'
\echo '────────────────────────────────────────────────────────'
\echo 'Calculating total outstanding for all unclosed dues...'
\echo ''

EXPLAIN ANALYZE
SELECT 
  COUNT(*) as total_dues,
  SUM(calculate_outstanding_amount(
    principal_amount,
    interest_rate,
    is_compounded,
    created_at,
    amount_paid
  )) as total_outstanding
FROM student_dues
WHERE is_cleared = FALSE;

\echo ''

-- Test 8: Edge cases
\echo 'TEST 8: Edge Cases'
\echo '────────────────────────────────────────────────────────'
\echo 'Testing zero values, nulls, and extremes...'
\echo ''

SELECT 
  'Zero Principal' as test_case,
  calculate_compounded_amount(0, 0.001, TRUE, CURRENT_TIMESTAMP - INTERVAL '30 days') as result
UNION ALL
SELECT 
  'Zero Rate' as test_case,
  calculate_compounded_amount(10000, 0, TRUE, CURRENT_TIMESTAMP - INTERVAL '30 days') as result
UNION ALL
SELECT 
  'NULL Rate (Not Compounded)' as test_case,
  calculate_compounded_amount(10000, NULL, FALSE, CURRENT_TIMESTAMP - INTERVAL '30 days') as result
UNION ALL
SELECT 
  'Very High Rate (1% daily)' as test_case,
  calculate_compounded_amount(10000, 0.01, TRUE, CURRENT_TIMESTAMP - INTERVAL '30 days') as result;

\echo ''

-- Test 9: Verify against manual calculation
\echo 'TEST 9: Verify Against Manual SQL Calculation'
\echo '────────────────────────────────────────────────────────'

WITH test_data AS (
  SELECT 
    10000::NUMERIC as principal,
    0.001::NUMERIC as rate,
    30 as days
)
SELECT 
  principal,
  rate,
  days,
  principal * POWER(1 + rate, days) as manual_calculation,
  calculate_compounded_amount(
    principal,
    rate,
    TRUE,
    CURRENT_TIMESTAMP - (days || ' days')::INTERVAL
  ) as function_result,
  ABS(
    (principal * POWER(1 + rate, days)) - 
    calculate_compounded_amount(
      principal,
      rate,
      TRUE,
      CURRENT_TIMESTAMP - (days || ' days')::INTERVAL
    )
  ) as difference
FROM test_data;

\echo ''
\echo 'Expected: Difference should be < 0.01'
\echo ''

-- Test 10: Real-world scenario
\echo 'TEST 10: Real-World Payment Scenario'
\echo '────────────────────────────────────────────────────────'
\echo 'Simulating a payment flow...'
\echo ''

WITH scenario AS (
  SELECT 
    10000::NUMERIC as original_principal,
    0.001::NUMERIC as rate,
    30 as days_before_payment,
    6000::NUMERIC as payment_amount
),
before_payment AS (
  SELECT 
    *,
    calculate_compounded_amount(
      original_principal,
      rate,
      TRUE,
      CURRENT_TIMESTAMP - (days_before_payment || ' days')::INTERVAL
    ) as compounded_before_payment
  FROM scenario
),
after_payment AS (
  SELECT 
    *,
    compounded_before_payment - payment_amount as new_principal
  FROM before_payment
)
SELECT 
  'Before Payment' as stage,
  original_principal as principal,
  days_before_payment as days_elapsed,
  compounded_before_payment as current_amount,
  compounded_before_payment - original_principal as interest_accrued
FROM after_payment
UNION ALL
SELECT 
  'After Payment' as stage,
  new_principal as principal,
  0 as days_elapsed,
  new_principal as current_amount,
  0 as interest_accrued
FROM after_payment;

\echo ''

-- Summary
\echo '════════════════════════════════════════════════════════'
\echo '                    TEST SUMMARY'
\echo '════════════════════════════════════════════════════════'
\echo ''
\echo 'All tests completed!'
\echo ''
\echo 'If all values look correct, the dynamic interest'
\echo 'calculation system is working properly.'
\echo ''
\echo 'Next steps:'
\echo '1. Run backend test: node test-interest-quick.js'
\echo '2. Test API endpoints with Postman/curl'
\echo '3. Verify payment flows reset principal correctly'
\echo ''
\echo '════════════════════════════════════════════════════════'
