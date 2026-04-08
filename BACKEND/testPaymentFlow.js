import { sql } from './config/db.js';

/**
 * Test script to verify payment flow and database updates
 * Run with: node testPaymentFlow.js
 */

async function testPaymentFlow() {
  try {
    console.log('🧪 Testing Payment Flow...\n');

    // Step 1: Find a student with active dues
    console.log('1️⃣  Finding student with active dues...');
    const studentWithDues = await sql`
      SELECT DISTINCT sd.student_roll_number, s.name, sd.id as due_id, sd.current_amount, sd.amount_paid
      FROM student_dues sd
      JOIN students s ON s.roll_number = sd.student_roll_number
      WHERE sd.is_payable = TRUE AND sd.is_cleared = FALSE
      LIMIT 1
    `;

    if (studentWithDues.length === 0) {
      console.log('   ❌ No active payable dues found. Please create test data first.');
      return;
    }

    const student = studentWithDues[0];
    console.log(`   ✓ Found student: ${student.name} (${student.student_roll_number})`);
    console.log(`   ✓ Due ID: ${student.due_id}`);
    console.log(`   ✓ Current Amount: ${student.current_amount}`);
    console.log(`   ✓ Amount Paid: ${student.amount_paid}`);
    console.log(`   ✓ Outstanding: ${parseFloat(student.current_amount) - parseFloat(student.amount_paid)}\n`);

    // Step 2: Simulate payment
    const paymentAmount = parseFloat(student.current_amount) - parseFloat(student.amount_paid);
    console.log(`2️⃣  Simulating payment of ₹${paymentAmount}...`);
    
    const newAmountPaid = parseFloat(student.amount_paid) + paymentAmount;
    const isCleared = newAmountPaid >= parseFloat(student.current_amount) - 0.01;

    console.log(`   → New Amount Paid: ${newAmountPaid}`);
    console.log(`   → Should be cleared: ${isCleared}\n`);

    // Step 3: Check what would be updated in database
    console.log('3️⃣  Checking database before update...');
    const beforeUpdate = await sql`
      SELECT id, current_amount, amount_paid, is_cleared, overall_status
      FROM student_dues
      WHERE id = ${student.due_id}
    `;
    console.log('   Before:', beforeUpdate[0]);

    // Step 4: Perform the update
    console.log('\n4️⃣  Performing UPDATE...');
    await sql`
      UPDATE student_dues 
      SET amount_paid = ${newAmountPaid},
          is_cleared = ${isCleared},
          overall_status = ${isCleared},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${student.due_id}
    `;
    console.log('   ✓ Update completed');

    // Step 5: Verify the update
    console.log('\n5️⃣  Verifying update...');
    const afterUpdate = await sql`
      SELECT id, current_amount, amount_paid, is_cleared, overall_status,
             (current_amount - amount_paid) as outstanding_amount
      FROM student_dues
      WHERE id = ${student.due_id}
    `;
    console.log('   After:', afterUpdate[0]);

    // Step 6: Check if due appears in active dues query
    console.log('\n6️⃣  Checking if due still appears in active dues...');
    const stillActive = await sql`
      SELECT id, current_amount, amount_paid, is_cleared, 
             (current_amount - amount_paid) as outstanding_amount
      FROM student_dues
      WHERE student_roll_number = ${student.student_roll_number}
        AND is_cleared = FALSE
    `;

    if (stillActive.length > 0) {
      console.log('   ⚠️  Due still appears in active dues:');
      stillActive.forEach(due => {
        console.log(`      Due ${due.id}: amount_paid=${due.amount_paid}, is_cleared=${due.is_cleared}, outstanding=${due.outstanding_amount}`);
      });
    } else {
      console.log('   ✓ Due has been cleared and removed from active list');
    }

    // Step 7: Rollback for testing purposes
    console.log('\n7️⃣  Rolling back for next test...');
    await sql`
      UPDATE student_dues 
      SET amount_paid = ${student.amount_paid},
          is_cleared = FALSE,
          overall_status = FALSE
      WHERE id = ${student.due_id}
    `;
    console.log('   ✓ Rolled back to original state\n');

    console.log('✅ Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    process.exit(0);
  }
}

testPaymentFlow();
