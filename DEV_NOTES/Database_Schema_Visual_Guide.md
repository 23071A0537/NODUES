# Database Schema Changes - Visual Guide

## 📊 student_dues Table - Before vs After

### ❌ BEFORE (18 columns)

```
student_dues Table:
├── id (PK)
├── student_roll_number
├── added_by_user_id (FK)
├── added_by_department_id (FK)
├── added_by_section_id (FK)
├── due_type_id (FK)
├── is_payable
├── current_amount
├── amount_paid
├── permission_granted
├── supporting_document_link
├── cleared_by_user_id (FK)
├── due_clear_by_date
├── is_cleared
├── overall_status
├── due_description
├── remarks
├── proof_drive_link
└── created_at

Constraints: 5
- chk_amount_logic
- chk_amount_paid
- chk_due_source
- fk_* (5 foreign keys)
- chk_overall_status

Indexes: 3
- idx_student_dues_student
- idx_student_dues_user
- idx_student_dues_due_type
```

### ✅ AFTER (21 columns)

```
student_dues Table:
├── id (PK)
├── student_roll_number
├── added_by_user_id (FK)
├── added_by_department_id (FK)
├── added_by_section_id (FK)
├── due_type_id (FK)
├── is_payable
├── current_amount
├── amount_paid
├── permission_granted
├── supporting_document_link
├── cleared_by_user_id (FK)
├── due_clear_by_date
├── is_cleared
├── overall_status
├── due_description
├── remarks
├── proof_drive_link
├── is_compounded ⭐ NEW
├── needs_original ⭐ NEW
├── needs_pdf ⭐ NEW
└── created_at

Constraints: 7
- chk_amount_logic
- chk_amount_paid
- chk_due_source
- fk_* (5 foreign keys)
- chk_overall_status
- chk_document_type ⭐ NEW
- chk_compounded_payable ⭐ NEW

Indexes: 4
- idx_student_dues_student
- idx_student_dues_user
- idx_student_dues_due_type
- idx_student_dues_documentation ⭐ NEW
```

---

## 👤 users Table - Before vs After

### ❌ BEFORE (8 columns)

```
users Table:
├── user_id (PK)
├── username
├── email
├── role_id (FK)
├── department_id (FK)
├── section_id (FK)
├── password
└── created_at

Constraints: 3
- chk_user_dept_or_section
- fk_users_role
- fk_users_department
- fk_users_section
```

### ✅ AFTER (10 columns)

```
users Table:
├── user_id (PK)
├── username
├── email
├── role_id (FK)
├── department_id (FK)
├── section_id (FK)
├── password
├── operator_type ⭐ (from Migration 001)
├── access_level ⭐ (from Migration 001)
└── created_at

Constraints: 3
- chk_user_dept_or_section
- fk_users_role
- fk_users_department
- fk_users_section
```

---

## 🔄 Data Flow - New Columns

### Payable Due Flow

```
┌─────────────────────────────────────────┐
│ Operator enters due via form            │
│ ├─ Step 1: Identify student             │
│ ├─ Step 2: Select due type + Payable    │
│ ├─ Step 3: Amount + Date + Interest ⭐  │
│ └─ Step 4: Review                       │
└─────────────────────────────────────────┘
            ↓
┌─────────────────────────────────────────┐
│ Backend receives data                   │
│ ├─ is_payable: true                     │
│ ├─ current_amount: 1000                 │
│ └─ is_compounded: true ⭐               │
└─────────────────────────────────────────┘
            ↓
┌─────────────────────────────────────────┐
│ Saved to database                       │
│ Due ID: 123                             │
│ ├─ is_payable: true ✅                  │
│ ├─ current_amount: 1000 ✅              │
│ ├─ is_compounded: true ✅ (NEW)         │
│ ├─ needs_original: NULL ✅ (Correct)    │
│ └─ needs_pdf: NULL ✅ (Correct)         │
└─────────────────────────────────────────┘
```

### Non-Payable Document Due Flow

```
┌─────────────────────────────────────────┐
│ Operator enters due via form            │
│ ├─ Step 1: Identify student             │
│ ├─ Step 2: Select Documentation type    │
│ ├─ Step 3: Due date + Document req ⭐   │
│ └─ Step 4: Review                       │
└─────────────────────────────────────────┘
            ↓
┌─────────────────────────────────────────┐
│ Backend receives data                   │
│ ├─ is_payable: false                    │
│ ├─ current_amount: NULL                 │
│ ├─ needs_original: true ⭐              │
│ └─ needs_pdf: false ⭐                  │
└─────────────────────────────────────────┘
            ↓
┌─────────────────────────────────────────┐
│ Saved to database                       │
│ Due ID: 124                             │
│ ├─ is_payable: false ✅                 │
│ ├─ current_amount: NULL ✅ (Correct)    │
│ ├─ is_compounded: NULL ✅ (Correct)     │
│ ├─ needs_original: true ✅ (NEW)        │
│ └─ needs_pdf: false ✅ (NEW)            │
└─────────────────────────────────────────┘
```

---

## 🔐 Constraint Logic

### Document Type Constraint

```
Valid Combinations:
├─ needs_original: NULL, needs_pdf: NULL
│  (Not a documentation due)
├─ needs_original: true, needs_pdf: false
│  (Original document required)
└─ needs_original: false, needs_pdf: true
   (PDF document required)

Invalid Combinations:
├─ needs_original: true, needs_pdf: true
│  ❌ REJECTED (can't require both)
├─ needs_original: false, needs_pdf: false
│  ❌ REJECTED (must require one)
└─ needs_original: true, needs_pdf: NULL
   ❌ REJECTED (must pair them)
```

### Compounding Constraint

```
For Payable Dues (is_payable = true):
├─ is_compounded: true ✅
├─ is_compounded: false ✅
└─ is_compounded: NULL ❌ REJECTED

For Non-Payable Dues (is_payable = false):
├─ is_compounded: NULL ✅
├─ is_compounded: true ❌ REJECTED
└─ is_compounded: false ❌ REJECTED
```

---

## 📈 Index Performance

### New Index: idx_student_dues_documentation

```
Index Definition:
CREATE INDEX idx_student_dues_documentation
ON student_dues (needs_original, needs_pdf)
WHERE is_payable = FALSE;

Benefits:
├─ Speeds up queries for non-payable documentation dues
├─ Partial index - only indexes relevant rows
├─ Covers both document type columns
└─ Useful for reports and filtering

Example Queries Sped Up:
├─ Find all non-payable dues needing original docs
├─ Find all non-payable dues needing PDFs
├─ Generate documentation requirement reports
└─ Student notifications for document status
```

---

## 🚀 Migration Timeline

```
Timeline:
│
├─ Jan 2026: Form Redesign Started
│
├─ Migration 001 (Operator Fields) ✅
│  ├─ Added operator_type
│  ├─ Added access_level
│  └─ Status: Already Applied
│
├─ Migration 002 (Document Tracking) ⭐ TODAY
│  ├─ Added is_compounded
│  ├─ Added needs_original
│  ├─ Added needs_pdf
│  ├─ Added constraints
│  ├─ Added index
│  └─ Status: Ready to Apply
│
└─ Future: Additional Migrations (TBD)
```

---

## 💾 Data Storage Impact

### Per Row Storage

```
Before Migration 002:
├─ Fixed columns: ~500 bytes
├─ Variable columns: ~200 bytes (avg)
└─ Total: ~700 bytes/row

After Migration 002:
├─ Fixed columns: ~500 bytes
├─ Variable columns: ~200 bytes (avg)
├─ New BOOLEAN columns: ~3 bytes (or NULL)
└─ Total: ~703 bytes/row

Increase: +3 bytes per row (negligible)
For 10,000 dues: +30 KB (negligible)
```

---

## 🔍 Query Examples

### Finding Dues with Interest

```sql
SELECT id, student_roll_number, current_amount, is_compounded
FROM student_dues
WHERE is_payable = true
AND is_compounded = true;
```

### Finding Documentation Dues Needing Original

```sql
SELECT id, student_roll_number, due_type_id
FROM student_dues
WHERE is_payable = false
AND needs_original = true;
```

### Finding All Documents Due

```sql
SELECT id, student_roll_number,
       CASE
           WHEN needs_original = true THEN 'Original Document'
           WHEN needs_pdf = true THEN 'PDF Document'
           ELSE 'Unknown'
       END as requirement
FROM student_dues
WHERE is_payable = false
AND (needs_original IS NOT NULL
     OR needs_pdf IS NOT NULL);
```

---

## ✨ Summary Table

| Item                         | Before    | After     | Change                     |
| ---------------------------- | --------- | --------- | -------------------------- |
| **student_dues columns**     | 18        | 21        | +3                         |
| **student_dues constraints** | 5         | 7         | +2                         |
| **student_dues indexes**     | 3         | 4         | +1                         |
| **users columns**            | 10        | 10        | 0 (was from Migration 001) |
| **Data per row**             | 700 bytes | 703 bytes | +3 bytes                   |
| **Backward compat**          | N/A       | ✅ 100%   | Safe                       |
| **Downtime needed**          | N/A       | ❌ None   | Zero                       |
| **Data migration**           | N/A       | ❌ None   | Auto NULL                  |

---

**Created:** January 31, 2026
**Version:** 2.0
**Purpose:** Visual reference for database schema changes
