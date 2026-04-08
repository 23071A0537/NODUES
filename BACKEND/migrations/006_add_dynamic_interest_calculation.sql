-- ============================================
-- Migration: Add Dynamic Compound Interest Calculation with Grace Period
-- ============================================
-- This migration adds SQL functions to calculate compounded amounts dynamically
-- Eliminates the need for nightly batch jobs to update current_amount
-- 
-- Grace Period Logic:
-- - BEFORE due_clear_by_date: current_amount = principal_amount (no interest)
-- - AFTER due_clear_by_date: Start compounding from that date
-- - When fully paid (principal=0): current_amount = 0
-- 
-- Usage: SELECT calculate_compounded_amount(principal_amount, interest_rate, is_compounded, due_clear_by_date)

-- Function to calculate compound interest dynamically with grace period
CREATE OR REPLACE FUNCTION calculate_compounded_amount(
    p_principal NUMERIC,
    p_daily_rate NUMERIC,
    p_is_compounded BOOLEAN,
    p_due_clear_by_date TIMESTAMPTZ
)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    days_elapsed INTEGER;
    compounded_amount NUMERIC;
BEGIN
    -- Return 0 if principal is 0 (fully paid)
    IF p_principal IS NULL OR p_principal = 0 THEN
        RETURN 0;
    END IF;
    
    -- Return principal if not compounded or no interest rate
    IF p_is_compounded IS FALSE OR p_is_compounded IS NULL OR p_daily_rate IS NULL OR p_daily_rate = 0 THEN
        RETURN COALESCE(p_principal, 0);
    END IF;
    
    -- Grace period: if current date is before due_clear_by_date, no interest
    IF CURRENT_TIMESTAMP < p_due_clear_by_date THEN
        RETURN COALESCE(p_principal, 0);
    END IF;
    
    -- Calculate days since due_clear_by_date (not created_at)
    days_elapsed := EXTRACT(DAY FROM (CURRENT_TIMESTAMP - p_due_clear_by_date))::INTEGER;
    
    -- Ensure non-negative days
    IF days_elapsed < 0 THEN
        days_elapsed := 0;
    END IF;
    
    -- Calculate: A = P * (1 + r)^n
    -- Use power function for compound interest
    compounded_amount := p_principal * POWER(1 + p_daily_rate, days_elapsed);
    
    -- Round to 2 decimal places
    RETURN ROUND(compounded_amount, 2);
END;
$$;

-- Function to calculate outstanding amount for a due with grace period
CREATE OR REPLACE FUNCTION calculate_outstanding_amount(
    p_principal NUMERIC,
    p_daily_rate NUMERIC,
    p_is_compounded BOOLEAN,
    p_due_clear_by_date TIMESTAMPTZ,
    p_amount_paid NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    current_amount NUMERIC;
    outstanding NUMERIC;
BEGIN
    -- Calculate current compounded amount (with grace period)
    current_amount := calculate_compounded_amount(p_principal, p_daily_rate, p_is_compounded, p_due_clear_by_date);
    
    -- Subtract amount paid
    outstanding := current_amount - COALESCE(p_amount_paid, 0);
    
    -- Ensure non-negative
    IF outstanding < 0 THEN
        outstanding := 0;
    END IF;
    
    RETURN ROUND(outstanding, 2);
END;
$$;

-- Create a view for easy access to student dues with calculated amounts
CREATE OR REPLACE VIEW student_dues_with_interest AS
SELECT 
    sd.*,
    calculate_compounded_amount(sd.principal_amount, sd.interest_rate, sd.is_compounded, sd.due_clear_by_date) as calculated_current_amount,
    calculate_outstanding_amount(sd.principal_amount, sd.interest_rate, sd.is_compounded, sd.due_clear_by_date, sd.amount_paid) as calculated_outstanding,
    calculate_compounded_amount(sd.principal_amount, sd.interest_rate, sd.is_compounded, sd.due_clear_by_date) - COALESCE(sd.principal_amount, 0) as calculated_interest,
    EXTRACT(DAY FROM (CURRENT_TIMESTAMP - sd.due_clear_by_date))::INTEGER as days_past_due_date,
    CASE 
        WHEN CURRENT_TIMESTAMP < sd.due_clear_by_date THEN TRUE
        ELSE FALSE
    END as is_in_grace_period
FROM student_dues sd;

-- Comment on functions
COMMENT ON FUNCTION calculate_compounded_amount IS 'Calculates compounded amount with grace period: no interest before due_clear_by_date, compounds after using A = P(1+r)^n formula';
COMMENT ON FUNCTION calculate_outstanding_amount IS 'Calculates outstanding amount after subtracting payments from compounded amount (with grace period)';
COMMENT ON VIEW student_dues_with_interest IS 'View that includes dynamically calculated interest with grace period and outstanding amounts';

-- Grant permissions (adjust as needed for your roles)
GRANT EXECUTE ON FUNCTION calculate_compounded_amount TO PUBLIC;
GRANT EXECUTE ON FUNCTION calculate_outstanding_amount TO PUBLIC;
GRANT SELECT ON student_dues_with_interest TO PUBLIC;
