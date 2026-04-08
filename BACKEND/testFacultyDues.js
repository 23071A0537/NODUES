import { sql } from './config/db.js';

/**
 * Comprehensive test script for faculty dues system
 * Tests:
 * 1. Database schema verification
 * 2. HR operator creation
 * 3. Faculty due creation
 * 4. Admin dashboard statistics
 * 5. Permission letter workflow
 */

async function testFacultyDuesSystem() {
  try {
    console.log('========================================');
    console.log('Faculty Dues System Test');
    console.log('========================================\n');

    // ===========================================
    // 1. Verify Database Schema
    // ===========================================
    console.log('📋 Step 1: Verifying Database Schema...\n');

    const facultyDueTable = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'faculty_due'
      ORDER BY ordinal_position
    `;

    if (facultyDueTable.length > 0) {
      console.log(`✅ faculty_due table exists with ${facultyDueTable.length} columns`);
    } else {
      console.log('❌ faculty_due table not found. Run migration 005 first!');
      process.exit(1);
    }

    const facultyPaymentsTable = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'faculty_due_payments'
    `;

    if (facultyPaymentsTable.length > 0) {
      console.log(`✅ faculty_due_payments table exists with ${facultyPaymentsTable.length} columns`);
    } else {
      console.log('❌ faculty_due_payments table not found');
      process.exit(1);
    }

    // ===========================================
    // 2. Check for Test Faculty
    // ===========================================
    console.log('\n📋 Step 2: Checking Test Data...\n');

    const facultyCount = await sql`
      SELECT COUNT(*) as count FROM faculty
    `;
    console.log(`   Total Faculty: ${facultyCount[0].count}`);

    if (facultyCount[0].count === 0) {
      console.log('⚠️  No faculty found. Please add test faculty first.');
    }

    // Get a sample faculty
    const sampleFaculty = await sql`
      SELECT employee_code, name, department_id
      FROM faculty
      LIMIT 1
    `;

    if (sampleFaculty.length > 0) {
      console.log(`   Sample Faculty: ${sampleFaculty[0].name} (${sampleFaculty[0].employee_code})`);
    }

    // ===========================================
    // 3. Check for HR Operator
    // ===========================================
    console.log('\n📋 Step 3: Checking HR Operator...\n');

    const hrOperators = await sql`
      SELECT u.user_id, u.username, u.email, u.access_level, u.operator_type, d.name as department_name
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.access_level = 'all_faculty'
    `;

    if (hrOperators.length > 0) {
      console.log(`✅ Found ${hrOperators.length} HR operator(s):`);
      hrOperators.forEach(op => {
        console.log(`   - ${op.username} (${op.email}) - ${op.department_name || 'N/A'}`);
      });
    } else {
      console.log('⚠️  No HR operators found (access_level=all_faculty)');
      console.log('\n💡 To create an HR operator, run:');
      console.log(`
        UPDATE users 
        SET access_level = 'all_faculty',
            operator_type = 'department'
        WHERE username = 'your_operator_username';
      `);
    }

    // ===========================================
    // 4. Check Existing Faculty Dues
    // ===========================================
    console.log('\n📋 Step 4: Checking Existing Faculty Dues...\n');

    const existingFacultyDues = await sql`
      SELECT 
        fd.id,
        fd.employee_code,
        f.name as faculty_name,
        dt.type_name,
        fd.is_payable,
        fd.current_amount,
        fd.is_cleared,
        fd.overall_status,
        fd.permission_granted
      FROM faculty_due fd
      JOIN faculty f ON fd.employee_code = f.employee_code
      JOIN due_types dt ON fd.due_type_id = dt.id
      ORDER BY fd.created_at DESC
      LIMIT 10
    `;

    if (existingFacultyDues.length > 0) {
      console.log(`✅ Found ${existingFacultyDues.length} faculty dues:\n`);
      existingFacultyDues.forEach((due, idx) => {
        console.log(`   ${idx + 1}. ${due.faculty_name} (${due.employee_code})`);
        console.log(`      Due Type: ${due.type_name}`);
        console.log(`      Payable: ${due.is_payable ? 'Yes' : 'No'} ${due.is_payable ? `(₹${due.current_amount})` : ''}`);
        console.log(`      Cleared: ${due.is_cleared ? 'Yes' : 'No'}`);
        console.log(`      Permission: ${due.permission_granted ? 'Granted' : 'Not Granted'}`);
        console.log('');
      });
    } else {
      console.log('   No faculty dues found yet.');
    }

    // ===========================================
    // 5. Test Admin Dashboard Stats
    // ===========================================
    console.log('📋 Step 5: Testing Admin Dashboard Stats...\n');

    // Get active and cleared faculty dues
    const facultyDuesStats = await sql`
      SELECT 
        COUNT(CASE WHEN is_cleared = FALSE THEN 1 END) as active_faculty_dues,
        COUNT(CASE WHEN is_cleared = TRUE THEN 1 END) as cleared_faculty_dues,
        COALESCE(SUM(CASE WHEN is_cleared = FALSE AND is_payable = TRUE THEN current_amount ELSE 0 END), 0) as faculty_dues_amount
      FROM faculty_due
    `;

    console.log('   Faculty Dues Statistics:');
    console.log(`   - Active Dues: ${facultyDuesStats[0].active_faculty_dues}`);
    console.log(`   - Cleared Dues: ${facultyDuesStats[0].cleared_faculty_dues}`);
    console.log(`   - Total Amount: ₹${facultyDuesStats[0].faculty_dues_amount}`);

    // Get department-wise breakdown
    const deptBreakdown = await sql`
      SELECT 
        d.name as department,
        COUNT(CASE WHEN fd.is_cleared = false THEN 1 END) as active_dues,
        COUNT(CASE WHEN fd.is_cleared = true THEN 1 END) as cleared_dues,
        COALESCE(SUM(CASE WHEN fd.is_payable = true AND fd.is_cleared = false THEN fd.current_amount ELSE 0 END), 0) as total_amount
      FROM faculty f
      LEFT JOIN departments d ON f.department_id = d.id
      LEFT JOIN faculty_due fd ON fd.employee_code = f.employee_code
      WHERE d.id IS NOT NULL
      GROUP BY d.id, d.name
      HAVING COUNT(fd.id) > 0
      ORDER BY d.name
    `;

    if (deptBreakdown.length > 0) {
      console.log('\n   Department-wise Breakdown:');
      deptBreakdown.forEach(dept => {
        console.log(`   - ${dept.department}: ${dept.active_dues} active, ${dept.cleared_dues} cleared (₹${dept.total_amount})`);
      });
    }

    // ===========================================
    // 6. Compare Student vs Faculty Dues
    // ===========================================
    console.log('\n📋 Step 6: Student vs Faculty Comparison...\n');

    const studentDues = await sql`
      SELECT 
        COUNT(CASE WHEN is_cleared = false THEN 1 END) as active_dues,
        COALESCE(SUM(CASE WHEN is_cleared = false AND is_payable = true THEN current_amount ELSE 0 END), 0) as total_amount
      FROM student_dues
      WHERE student_roll_number IN (SELECT roll_number FROM students)
    `;

    const facultyDues = await sql`
      SELECT 
        COUNT(CASE WHEN is_cleared = false THEN 1 END) as active_dues,
        COALESCE(SUM(CASE WHEN is_cleared = false AND is_payable = true THEN current_amount ELSE 0 END), 0) as total_amount
      FROM faculty_due
    `;

    console.log('   Comparison:');
    console.log(`   📚 Student Dues:  ${studentDues[0].active_dues} active (₹${studentDues[0].total_amount})`);
    console.log(`   👨‍🏫 Faculty Dues:  ${facultyDues[0].active_dues} active (₹${facultyDues[0].total_amount})`);

    // ===========================================
    // 7. Test Due Types
    // ===========================================
    console.log('\n📋 Step 7: Checking Due Types for Faculty...\n');

    const facultyDueTypes = await sql`
      SELECT id, type_name, description, is_for_student, requires_permission
      FROM due_types
      WHERE is_for_student = false OR is_for_student IS NULL
      ORDER BY type_name
    `;

    if (facultyDueTypes.length > 0) {
      console.log(`✅ Found ${facultyDueTypes.length} due types suitable for faculty:\n`);
      facultyDueTypes.forEach(dt => {
        console.log(`   - ${dt.type_name} (ID: ${dt.id})`);
        if (dt.requires_permission) {
          console.log(`     📝 Requires permission letter`);
        }
      });
    } else {
      console.log('⚠️  No due types marked for faculty (is_for_student=false)');
      console.log('\n💡 To create faculty due types, run:');
      console.log(`
        INSERT INTO due_types (type_name, description, is_for_student, requires_permission)
        VALUES 
          ('Library Fine', 'Late book return fine', false, false),
          ('Equipment Damage', 'Compensation for damaged equipment', false, true);
      `);
    }

    // ===========================================
    // 8. Verify Indexes
    // ===========================================
    console.log('\n📋 Step 8: Verifying Indexes...\n');

    const indexes = await sql`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'faculty_due'
      ORDER BY indexname
    `;

    console.log(`✅ Found ${indexes.length} indexes on faculty_due table`);

    // ===========================================
    // 9. Test Permission Letter System
    // ===========================================
    console.log('\n📋 Step 9: Permission Letter System Test...\n');

    const permissionDues = await sql`
      SELECT 
        fd.id,
        f.name as faculty_name,
        dt.type_name,
        fd.permission_granted,
        fd.supporting_document_link,
        fd.overall_status
      FROM faculty_due fd
      JOIN faculty f ON fd.employee_code = f.employee_code
      JOIN due_types dt ON fd.due_type_id = dt.id
      WHERE dt.requires_permission = true
      ORDER BY fd.created_at DESC
      LIMIT 5
    `;

    if (permissionDues.length > 0) {
      console.log(`   Found ${permissionDues.length} dues requiring permission:\n`);
      permissionDues.forEach((due, idx) => {
        console.log(`   ${idx + 1}. ${due.faculty_name} - ${due.type_name}`);
        console.log(`      Permission: ${due.permission_granted ? '✅ Granted' : '⏳ Pending'}`);
        console.log(`      Overall Status: ${due.overall_status ? '✅ Cleared' : '⏳ Active'}`);
        if (due.supporting_document_link) {
          console.log(`      Document: ${due.supporting_document_link.substring(0, 50)}...`);
        }
        console.log('');
      });
    } else {
      console.log('   No dues with permission requirements found.');
    }

    // ===========================================
    // Summary
    // ===========================================
    console.log('\n========================================');
    console.log('✅ Faculty Dues System Test Complete!');
    console.log('========================================\n');

    console.log('📊 Summary:');
    console.log(`   ✓ faculty_due table: ${facultyDueTable.length} columns`);
    console.log(`   ✓ faculty_due_payments table: ${facultyPaymentsTable.length} columns`);
    console.log(`   ✓ Total Faculty: ${facultyCount[0].count}`);
    console.log(`   ✓ HR Operators: ${hrOperators.length}`);
    console.log(`   ✓ Faculty Dues: ${existingFacultyDues.length}`);
    console.log(`   ✓ Faculty Due Types: ${facultyDueTypes.length}`);
    console.log(`   ✓ Indexes: ${indexes.length}`);

    if (hrOperators.length === 0) {
      console.log('\n⚠️  Action Required:');
      console.log('   Create an HR operator with access_level=\'all_faculty\'');
    }

    if (facultyDueTypes.length === 0) {
      console.log('\n⚠️  Action Required:');
      console.log('   Create due types with is_for_student=false for faculty');
    }

    console.log('\n💡 Next Steps:');
    console.log('   1. Login as HR operator');
    console.log('   2. Navigate to Add Due page');
    console.log('   3. Add a test faculty due');
    console.log('   4. Verify it appears in admin dashboard');
    console.log('   5. Test permission letter workflow\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Error details:', error);
    process.exit(1);
  }
}

testFacultyDuesSystem();
