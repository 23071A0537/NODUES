# Database Schema Audit - January 31, 2026

## Executive Summary

Database schema analysis comparing the documented schema against codebase usage.

---

## Current Schema Status

### ✅ Tables Present

1. **academic_year** - Contains beginning_year, ending_year
2. **roles** - Contains role names (admin, hod, operator, student)
3. **departments** - Contains department names
4. **sections** - Contains section names
5. **users** - Contains admin, hod, operator accounts
6. **students** - Contains student records
7. **faculty** - Contains faculty records
8. **due_types** - Contains due type definitions
9. **student_dues** - Contains due records
10. **due_payments** - Contains payment records

### ✅ Migrations Applied

1. **001_add_operator_fields.sql** - Added operator_type, access_level to users; needs_original, needs_pdf, is_compounded to student_dues
2. **002_add_document_columns.sql** - Added constraints for document types and compounded interest

---

## Schema Gaps & Issues Found

### 🔴 Issue 1: due_types Table Missing `is_payable` Column

**Location:** `due_types` table

**Current Definition (from schema):**

```sql
CREATE TABLE due_types (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    type_name VARCHAR(100) NOT NULL,
    description TEXT,
    is_for_student INTEGER,  -- ISSUE: This is INTEGER but used as BOOLEAN?
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    requires_permission BOOLEAN DEFAULT FALSE
);
```

**Problem:**

- The column `is_for_student` is INTEGER type but conceptually should track if a due type is payable or not
- Codebase usage shows that `is_payable` is determined at the due level (student_dues.is_payable), not at the type level
- This is actually CORRECT - payability is per-due, not per-due-type

**Status:** ✅ NO ACTION NEEDED - Current design is correct

---

### ⚠️ Issue 2: due_types Table has `is_for_student` Column

**Current Field:** `is_for_student INTEGER`

**Problem:**

- This column is INTEGER but semantically should be BOOLEAN
- Used to distinguish between student dues and faculty dues
- Type inconsistency with other boolean fields in the system

**Recommendation:**

- Create migration to convert `is_for_student` to BOOLEAN
- Update existing data: INTEGER 1 → TRUE, 0 → FALSE

**Impact Level:** LOW - Functional but inconsistent

---

### ✅ Issue 3: students Table Structure

**Verified Columns:**

- student_id UUID ✅
- name VARCHAR(100) ✅
- roll_number VARCHAR(20) ✅
- branch VARCHAR(50) ✅
- section VARCHAR(10) ✅
- email VARCHAR(100) ✅
- mobile VARCHAR(15) ✅
- father_name VARCHAR(100) ✅
- father_mobile VARCHAR(15) ✅
- academic_year_id INTEGER ✅
- role_id INTEGER ✅
- password TEXT ✅
- department_id INTEGER ✅
- section_id INTEGER ✅
- created_at TIMESTAMPTZ ✅

**Status:** ✅ COMPLETE - All required fields present

---

### ✅ Issue 4: users Table Structure

**Verified Columns:**

- user_id UUID ✅
- username VARCHAR(50) ✅
- email VARCHAR(100) ✅
- role_id INTEGER ✅
- department_id INTEGER ✅
- section_id INTEGER ✅
- password TEXT ✅
- operator_type VARCHAR(20) ✅ (added by migration 001)
- access_level VARCHAR(30) ✅ (added by migration 001)
- created_at TIMESTAMPTZ ✅

**Status:** ✅ COMPLETE - All required fields present including operator fields

---

### ✅ Issue 5: faculty Table Structure

**Verified Columns:**

- faculty_id UUID ✅
- employee_code VARCHAR(20) ✅
- name VARCHAR(100) ✅
- department_id INTEGER ✅
- section_id INTEGER ✅
- designation TEXT[] ✅
- email VARCHAR(100) ✅
- mobile VARCHAR(15) ✅
- role_id INTEGER ✅
- staff_type VARCHAR(50) ✅
- created_at TIMESTAMPTZ ✅
- password TEXT ✅

**Status:** ✅ COMPLETE

---

### ✅ Issue 6: student_dues Table Structure

**Verified Columns:**

- id INTEGER ✅
- student_roll_number VARCHAR(20) ✅
- added_by_user_id UUID ✅
- added_by_department_id INTEGER ✅
- added_by_section_id INTEGER ✅
- due_type_id INTEGER ✅
- is_payable BOOLEAN ✅
- current_amount NUMERIC(10,2) ✅
- amount_paid NUMERIC(10,2) ✅
- permission_granted BOOLEAN ✅
- supporting_document_link TEXT ✅
- cleared_by_user_id UUID ✅
- due_clear_by_date DATE ✅
- is_cleared BOOLEAN ✅
- overall_status BOOLEAN ✅
- due_description TEXT ✅
- remarks TEXT ✅
- proof_drive_link TEXT ✅
- needs_original BOOLEAN ✅ (added by migration 001/002)
- needs_pdf BOOLEAN ✅ (added by migration 001/002)
- is_compounded BOOLEAN ✅ (added by migration 001/002)
- updated_at TIMESTAMPTZ ✅ (added by migration 001)
- created_at TIMESTAMPTZ ✅

**Constraints Verified:**

- `chk_amount_logic` - Payable dues must have amount ✅
- `chk_amount_paid` - Paid amount ≤ current amount ✅
- `chk_due_source` - Either department OR section ✅
- `chk_document_type` - Document constraints ✅
- `chk_compounded_payable` - Compound only for payable ✅
- `chk_overall_status` - Status logic ✅

**Status:** ✅ COMPLETE with all migrations applied

---

### ✅ Issue 7: Indexes Present

**Verified Indexes:**

- idx_students_academic_year ✅
- idx_students_role ✅
- idx_students_department_id ✅
- idx_students_section_id ✅
- idx_faculty_department ✅
- idx_faculty_section ✅
- idx_student_dues_student ✅
- idx_student_dues_user ✅
- idx_student_dues_due_type ✅
- idx_student_dues_documentation ✅
- idx_due_payments_due ✅

**Status:** ✅ COMPLETE

---

## Codebase Requirements vs Schema

### Operator Controller Requirements

```
✅ getDashboardStats() - Uses departments, sections, users, academic_year, students, faculty counts
✅ getDueTypes() - Selects id, type_name, description, is_for_student, requires_permission
✅ addDue() - Uses student_roll_number, due_type_id, is_payable, current_amount, etc.
✅ getActiveDues() - Filters by is_cleared=false, is_payable
✅ getClearedDues() - Filters by is_cleared=true
✅ clearDue() - Updates is_cleared, cleared_by_user_id, permission_granted
```

### Admin Controller Requirements

```
✅ getDashboardStats() - Counts from all main tables
✅ getDepartmentDues() - Joins student_dues with departments/sections
✅ getDepartmentAnalytics() - Analyzes payable/non-payable/cleared patterns
✅ getOverallStats() - Aggregates system-wide statistics
```

### Auth Controller Requirements

```
✅ loginUser() - Joins students with roles
✅ loginUser() - Joins users/faculty with roles and departments/sections
```

---

## Recommendations

### 1. **Optional: Convert `is_for_student` to BOOLEAN** (LOW Priority)

**Create Migration 003:**

```sql
-- Migration: Normalize is_for_student column type
ALTER TABLE due_types
ALTER COLUMN is_for_student TYPE BOOLEAN
USING (is_for_student::boolean);

-- Data conversion
UPDATE due_types SET is_for_student = TRUE WHERE is_for_student = 1;
UPDATE due_types SET is_for_student = FALSE WHERE is_for_student = 0 OR is_for_student IS NULL;
```

**Impact:** Code consistency, minor performance improvement

### 2. **Add Computed Index for Performance** (OPTIONAL)

```sql
-- For faculty dues queries
CREATE INDEX idx_faculty_dues ON student_dues(student_roll_number)
WHERE student_roll_number IN (SELECT employee_code FROM faculty);
```

### 3. **Add Audit Trigger** (OPTIONAL)

```sql
-- Track all changes to student_dues for compliance
CREATE TABLE student_dues_audit (
    audit_id BIGSERIAL PRIMARY KEY,
    due_id INTEGER NOT NULL,
    action VARCHAR(10) NOT NULL,
    changed_fields JSONB,
    changed_by UUID,
    changed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

---

## Verification Checklist

- [x] All tables exist
- [x] All required columns present
- [x] All migrations applied correctly
- [x] Foreign key constraints in place
- [x] Check constraints validate data
- [x] Indexes created for performance
- [x] Roles table seeded with default roles
- [x] Document columns (needs_original, needs_pdf, is_compounded) present
- [x] Operator fields (operator_type, access_level) present
- [x] JWT authentication compatible
- [x] Pagination support via IDs

---

## Conclusion

**Overall Status: ✅ SCHEMA IS UP-TO-DATE**

The database schema is **fully aligned** with the codebase requirements. All necessary columns, constraints, and migrations are in place. The schema supports:

1. Multi-role user management (admin, hod, operator, student, faculty)
2. Department/Section-based access control
3. Payable and non-payable due tracking
4. Document requirement tracking
5. Due payment and clearance workflows
6. Comprehensive analytics and reporting

**No critical issues found.** One optional improvement: normalize `is_for_student` column type from INTEGER to BOOLEAN for consistency.

---

## Schema Version

- **Current Version:** 2.0
- **Last Updated:** January 31, 2026
- **Migrations Applied:** 2 of 2
- **Status:** Production Ready ✅
