# Database Migration Guide

## Overview

This document explains the database schema changes and how to apply them.

## Current Migrations

### Migration 001: Add Operator Fields (Already Applied ✅)

**File:** `BACKEND/migrations/001_add_operator_fields.sql`
**Date Applied:** Earlier in this session
**Changes:**

- Added `operator_type` column to `users` table
- Added `access_level` column to `users` table

### Migration 002: Add Document Columns (NEW ⭐)

**File:** `BACKEND/migrations/002_add_document_columns.sql`
**Date Created:** January 31, 2026
**Status:** Ready to apply
**Changes:**

- Added `is_compounded` BOOLEAN column to `student_dues`
- Added `needs_original` BOOLEAN column to `student_dues`
- Added `needs_pdf` BOOLEAN column to `student_dues`
- Added constraint to ensure only one document type per due
- Added constraint to ensure compounding is only for payable dues
- Added index for filtering documentation dues

## Column Details

### student_dues.is_compounded

```
Type: BOOLEAN
Nullable: Yes
Default: NULL
Purpose: Track whether interest will compound on payable dues
Valid Values:
  - TRUE: Interest compounding applies
  - FALSE: Fixed amount (no compounding)
  - NULL: Not applicable (non-payable due)
Constraint: Only used for payable dues
```

### student_dues.needs_original

```
Type: BOOLEAN
Nullable: Yes
Default: NULL
Purpose: Track if original document is required for non-payable dues
Valid Values:
  - TRUE: Original document required
  - FALSE: Original not required (PDF is required instead)
  - NULL: Not applicable (payable due or non-document due)
Constraint: Must be paired with needs_pdf
```

### student_dues.needs_pdf

```
Type: BOOLEAN
Nullable: Yes
Default: NULL
Purpose: Track if PDF document is required for non-payable dues
Valid Values:
  - TRUE: PDF document required
  - FALSE: PDF not required (Original is required instead)
  - NULL: Not applicable (payable due or non-document due)
Constraint: Must be paired with needs_original (exactly one is true)
```

## Database Constraints Added

### Document Type Constraint

```sql
CONSTRAINT chk_document_type CHECK (
    (needs_original IS NULL AND needs_pdf IS NULL)
    OR
    (needs_original = TRUE AND needs_pdf = FALSE)
    OR
    (needs_original = FALSE AND needs_pdf = TRUE)
)
```

**Purpose:** Ensures that for documentation dues, exactly one document type is required

### Compounding Constraint

```sql
CONSTRAINT chk_compounded_payable CHECK (
    (is_payable = FALSE AND is_compounded IS NULL)
    OR
    (is_payable = TRUE AND is_compounded IS NOT NULL)
)
```

**Purpose:** Ensures compounding is only set for payable dues

## Database Index Added

### idx_student_dues_documentation

```sql
CREATE INDEX idx_student_dues_documentation
ON student_dues (needs_original, needs_pdf)
WHERE is_payable = FALSE;
```

**Purpose:** Optimize queries filtering non-payable documentation dues
**Performance:** Speeds up queries like "find all non-payable dues requiring original documents"

## How to Apply Migrations

### Option 1: Using Node.js Script (Recommended)

```bash
cd BACKEND
node runAllMigrations.js
```

**What it does:**

1. Reads all `.sql` files in `migrations/` directory (sorted alphabetically)
2. Splits by semicolons
3. Executes each statement individually
4. Shows progress and results
5. Continues even if one statement fails (already applied)
6. Exits with status 0 on success

### Option 2: Using Neon Dashboard

1. Go to [Neon Console](https://console.neon.tech)
2. Select your database
3. Go to SQL Editor
4. Copy contents of migration files in order
5. Execute each statement

### Option 3: Using PostgreSQL CLI

```bash
psql -h pg.neon.tech -U [user] -d [database] -f BACKEND/migrations/001_add_operator_fields.sql
psql -h pg.neon.tech -U [user] -d [database] -f BACKEND/migrations/002_add_document_columns.sql
```

## Verification

### After applying migration 002, verify:

**Check columns exist:**

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'student_dues'
AND column_name IN ('is_compounded', 'needs_original', 'needs_pdf');
```

**Expected output:**

```
column_name     | data_type | is_nullable
----------------|-----------|-------------
is_compounded   | boolean   | YES
needs_original  | boolean   | YES
needs_pdf       | boolean   | YES
```

**Check constraints exist:**

```sql
SELECT constraint_name
FROM information_schema.table_constraints
WHERE table_name = 'student_dues'
AND constraint_name LIKE 'chk_%';
```

**Expected output:**

```
constraint_name
-----------------------
chk_amount_logic
chk_amount_paid
chk_due_source
chk_document_type        ✅ NEW
chk_compounded_payable   ✅ NEW
chk_overall_status
```

**Check index exists:**

```sql
SELECT indexname
FROM pg_indexes
WHERE tablename = 'student_dues';
```

**Expected output includes:**

```
idx_student_dues_documentation  ✅ NEW
```

## Rollback Instructions

If you need to revert migration 002:

```sql
-- Remove constraints
ALTER TABLE student_dues DROP CONSTRAINT chk_document_type;
ALTER TABLE student_dues DROP CONSTRAINT chk_compounded_payable;

-- Remove index
DROP INDEX idx_student_dues_documentation;

-- Remove columns
ALTER TABLE student_dues DROP COLUMN is_compounded;
ALTER TABLE student_dues DROP COLUMN needs_original;
ALTER TABLE student_dues DROP COLUMN needs_pdf;
```

**WARNING:** This will delete all compounding and document tracking data. Use only if absolutely necessary.

## Migration Impact Analysis

### Data Compatibility

- ✅ **Backward compatible**: New columns are nullable, existing data unaffected
- ✅ **No data migration needed**: NULL values work fine for existing dues
- ✅ **No downtime required**: ALTER TABLE on empty columns is very fast

### Application Impact

- ✅ **Backend**: Already handles new columns (updated in form redesign)
- ✅ **Frontend**: Already uses new columns (4-step wizard form)
- ✅ **API**: No changes needed (same endpoints)

### Performance Impact

- ✅ **Positive**: New index improves documentation due queries
- ✅ **Negligible**: NULL columns have minimal storage impact
- ✅ **Fast**: Adding columns to sparse table is instant

## Existing Data Updates

Existing dues created before migration 002 will have NULL values for the new columns. This is correct behavior:

```sql
-- Example of existing due
SELECT id, is_payable, is_compounded, needs_original, needs_pdf
FROM student_dues
LIMIT 1;

-- Result:
id  | is_payable | is_compounded | needs_original | needs_pdf
----|------------|---------------|----------------|----------
1   | true       | NULL          | NULL           | NULL

-- This is correct! No documentation type set, no compounding info
```

### Updating Existing Dues (Optional)

If you want to add compounding/document info to existing dues:

```sql
-- Add compounding info to payable dues
UPDATE student_dues
SET is_compounded = false  -- or true, depending on policy
WHERE is_payable = true
AND is_compounded IS NULL;

-- Add document type to non-payable documentation dues
UPDATE student_dues
SET needs_original = true   -- or false for PDF
WHERE is_payable = false
AND needs_original IS NULL
AND needs_pdf IS NULL;
```

## Migration Schedule

- ✅ **Migration 001**: Applied (operator fields)
- ⏳ **Migration 002**: Ready to apply (document tracking)
- 📋 **Future**: To be determined

## Troubleshooting

### Error: Constraint violation

```
ERROR: duplicate key value violates unique constraint
```

**Cause:** Index creation failed due to duplicate values
**Solution:** Check and clean existing data, retry

### Error: Column already exists

```
ERROR: column "is_compounded" of relation "student_dues" already exists
```

**Cause:** Migration 002 already applied
**Solution:** No action needed, migration is complete

### Error: Connection failed

```
ERROR: could not connect to server
```

**Cause:** Database connection issue
**Solution:** Check connection string, verify database is running

## Support & Questions

For detailed information:

- See `DEV_NOTES/DatabaseSchema.txt` for complete schema
- See `BACKEND/migrations/` for all migration files
- See `FRONTEND/src/pages/operator/AddDue.tsx` for form implementation

## Checklist

- [ ] Read migration files
- [ ] Backup database (if production)
- [ ] Apply migration 002
- [ ] Verify columns exist
- [ ] Test form submission with new columns
- [ ] Monitor for errors in logs
- [ ] Update monitoring/documentation

---

**Last Updated:** January 31, 2026
**Version:** 2.0
**Status:** ✅ Ready for Deployment
