import { sql } from './config/db.js';

async function runMigration006() {
  try {
    console.log('========================================');
    console.log('Running Migration 006: Add Dynamic Interest Calculation');
    console.log('========================================\n');

    // Create calculate_compounded_amount function
    try {
      await sql`
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
        $$
      `;
      console.log('✅ Created calculate_compounded_amount function');
    } catch (err) {
      console.log('⚠️  Error creating calculate_compounded_amount:', err.message);
    }

    // Create calculate_outstanding_amount function
    try {
      await sql`
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
        $$
      `;
      console.log('✅ Created calculate_outstanding_amount function');
    } catch (err) {
      console.log('⚠️  Error creating calculate_outstanding_amount:', err.message);
    }

    // Create student_dues_with_interest view
    try {
      await sql`
        CREATE OR REPLACE VIEW student_dues_with_interest AS
        SELECT 
          sd.*,
          calculate_compounded_amount(sd.principal_amount, sd.interest_rate, sd.is_compounded, sd.due_clear_by_date::timestamptz) as calculated_current_amount,
          calculate_outstanding_amount(sd.principal_amount, sd.interest_rate, sd.is_compounded, sd.due_clear_by_date::timestamptz, sd.amount_paid) as calculated_outstanding,
          calculate_compounded_amount(sd.principal_amount, sd.interest_rate, sd.is_compounded, sd.due_clear_by_date::timestamptz) - COALESCE(sd.principal_amount, 0) as calculated_interest,
          EXTRACT(DAY FROM (CURRENT_TIMESTAMP - sd.due_clear_by_date))::INTEGER as days_past_due_date,
          CASE 
            WHEN CURRENT_TIMESTAMP < sd.due_clear_by_date THEN TRUE
            ELSE FALSE
          END as is_in_grace_period
        FROM student_dues sd
      `;
      console.log('✅ Created student_dues_with_interest view');
    } catch (err) {
      console.log('⚠️  Error creating view:', err.message);
    }

    // Add comments
    try {
      await sql`
        COMMENT ON FUNCTION calculate_compounded_amount IS 'Calculates compounded amount with grace period: no interest before due_clear_by_date, compounds after using A = P(1+r)^n formula'
      `;
      await sql`
        COMMENT ON FUNCTION calculate_outstanding_amount IS 'Calculates outstanding amount after subtracting payments from compounded amount (with grace period)'
      `;
      await sql`
        COMMENT ON VIEW student_dues_with_interest IS 'View that includes dynamically calculated interest with grace period and outstanding amounts'
      `;
      console.log('✅ Added comments');
    } catch (err) {
      console.log('⚠️  Error adding comments:', err.message);
    }

    // Grant permissions
    try {
      await sql`GRANT EXECUTE ON FUNCTION calculate_compounded_amount TO PUBLIC`;
      await sql`GRANT EXECUTE ON FUNCTION calculate_outstanding_amount TO PUBLIC`;
      await sql`GRANT SELECT ON student_dues_with_interest TO PUBLIC`;
      console.log('✅ Granted permissions');
    } catch (err) {
      console.log('⚠️  Error granting permissions:', err.message);
    }

    console.log('\n========================================');
    console.log('✅ Migration 006 completed successfully!');
    console.log('========================================');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Migration 006 failed:', err.message);
    console.error(err);
    process.exit(1);
  }
}

runMigration006();
