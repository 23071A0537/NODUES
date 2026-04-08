import { sql } from './config/db.js';

/**
 * Check payment records and dues status
 */

async function checkPaymentRecords() {
  try {
    console.log('🔍 Checking Payment Records and Dues Status...\n');

    // Check for payment records
    console.log('1️⃣  Checking due_payments table...');
    const payments = await sql`
      SELECT dp.*, sd.current_amount, sd.amount_paid, sd.is_cleared
      FROM due_payments dp
      JOIN student_dues sd ON dp.due_id = sd.id
      ORDER BY dp.paid_at DESC
      LIMIT 10
    `;

    if (payments.length === 0) {
      console.log('   ℹ️  No payment records found\n');
    } else {
      console.log(`   ✓ Found ${payments.length} payment record(s):`);
      payments.forEach(p => {
        console.log(`      • Due ${p.due_id}: Paid ₹${p.paid_amount}, Status: ${p.payment_status}`);
        console.log(`        Current Amount: ₹${p.current_amount}, Amount Paid: ₹${p.amount_paid}, Cleared: ${p.is_cleared}`);
        console.log(`        Outstanding: ₹${parseFloat(p.current_amount) - parseFloat(p.amount_paid)}`);
      });
      console.log();
    }

    // Check for dues with partial payments
    console.log('2️⃣  Checking for dues with payments (amount_paid > 0)...');
    const paidDues = await sql`
      SELECT id, student_roll_number, current_amount, amount_paid, is_cleared,
             (current_amount - COALESCE(amount_paid, 0)) as outstanding
      FROM student_dues
      WHERE amount_paid > 0
      ORDER BY updated_at DESC
      LIMIT 10
    `;

    if (paidDues.length === 0) {
      console.log('   ℹ️  No dues with payments found\n');
    } else {
      console.log(`   ✓ Found ${paidDues.length} due(s) with payments:`);
      paidDues.forEach(d => {
        console.log(`      • Due ${d.id} (${d.student_roll_number}): ₹${d.current_amount}`);
        console.log(`        Paid: ₹${d.amount_paid}, Outstanding: ₹${d.outstanding}, Cleared: ${d.is_cleared}`);
        if (!d.is_cleared && d.outstanding < 0.01) {
          console.log('        ⚠️  WARNING: Outstanding < 0.01 but not marked as cleared!');
        }
      });
      console.log();
    }

    // Check for any active dues
    console.log('3️⃣  Checking all active dues (is_cleared = FALSE)...');
    const activeDues = await sql`
      SELECT id, student_roll_number, current_amount, amount_paid, is_cleared, is_payable,
             (current_amount - COALESCE(amount_paid, 0)) as outstanding
      FROM student_dues
      WHERE is_cleared = FALSE
      ORDER BY created_at DESC
      LIMIT 10
    `;

    if (activeDues.length === 0) {
      console.log('   ℹ️  No active dues found\n');
    } else {
      console.log(`   ✓ Found ${activeDues.length} active due(s):`);
      activeDues.forEach(d => {
        console.log(`      • Due ${d.id} (${d.student_roll_number}): ₹${d.current_amount}`);
        console.log(`        Paid: ₹${d.amount_paid || 0}, Outstanding: ₹${d.outstanding}, Payable: ${d.is_payable}`);
      });
      console.log();
    }

    // Check for cleared dues with non-zero outstanding
    console.log('4️⃣  Checking for anomalies (cleared but outstanding > 0)...');
    const anomalies = await sql`
      SELECT id, student_roll_number, current_amount, amount_paid, is_cleared,
             (current_amount - COALESCE(amount_paid, 0)) as outstanding
      FROM student_dues
      WHERE is_cleared = TRUE AND (current_amount - COALESCE(amount_paid, 0)) > 0.01
    `;

    if (anomalies.length === 0) {
      console.log('   ✓ No anomalies found\n');
    } else {
      console.log(`   ⚠️  Found ${anomalies.length} anomaly(ies):`);
      anomalies.forEach(d => {
        console.log(`      • Due ${d.id}: Outstanding = ₹${d.outstanding} but marked as cleared!`);
      });
      console.log();
    }

    // Check for not-cleared dues with zero outstanding
    console.log('5️⃣  Checking for paid-off dues not marked as cleared...');
    const paidButNotCleared = await sql`
      SELECT id, student_roll_number, current_amount, amount_paid, is_cleared,
             (current_amount - COALESCE(amount_paid, 0)) as outstanding
      FROM student_dues
      WHERE is_cleared = FALSE AND (current_amount - COALESCE(amount_paid, 0)) <= 0.01 AND amount_paid > 0
    `;

    if (paidButNotCleared.length === 0) {
      console.log('   ✓ No such dues found (good!)\n');
    } else {
      console.log(`   ⚠️  Found ${paidButNotCleared.length} due(s) that should be cleared:`);
      paidButNotCleared.forEach(d => {
        console.log(`      • Due ${d.id}: Outstanding = ₹${d.outstanding} but NOT marked as cleared!`);
        console.log(`        Current: ₹${d.current_amount}, Paid: ₹${d.amount_paid}`);
      });
      console.log('\n   🔧 These dues should have is_cleared = TRUE\n');
    }

    console.log('✅ Check completed!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    process.exit(0);
  }
}

checkPaymentRecords();
