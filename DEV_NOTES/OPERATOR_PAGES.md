# Operator Pages - NODUES System

This document provides an overview of all operator pages and their functionality in the NODUES (No Dues) system.

## Overview

Operators are responsible for managing dues for students and faculty members. There are two types of operators:

1. **Department Operator**: Manages dues for a specific department
   - Can add dues to all students (any department) OR
   - Can add dues only to students in their department

2. **Section Operator**: Manages dues for a specific section
   - Can add dues to all students (any section) OR
   - Can add dues to all faculty in their section

## Pages

### 1. Dashboard (`/operator/dashboard`)

**Purpose**: Provides a comprehensive overview of dues statistics and trends.

**Features**:

- **Summary Cards** (Horizontal Layout):
  - Number of Students/Faculties Under Control
  - Total Number of Dues
  - Total Number of Payable Dues
  - Total Number of Non-Payable Dues
  - Total Dues Amount

- **Tabular View**: Displays dues statistics in table format with export functionality (CSV/Excel)

- **Graphs Section**:
  - **Line Graph** (Last 6 Months):
    - Active payable dues
    - Active non-payable dues
    - Cleared payable dues (monthly)
    - Cleared non-payable dues (monthly)
  - **Bar Graph** (Academic Year-wise):
    - Active payable dues by academic year
    - Active non-payable dues by academic year

- **Quick Actions**: Buttons to navigate to other features

**Data Scope**: All data is filtered by the operator's department/section

---

### 2. Add Due (`/operator/add-due`)

**Purpose**: Add dues on students or faculty members individually or via bulk upload.

**Features**:

#### Manual Entry Form:

- **Roll Number/Employee Code\*** (required)
- **Due Type\*** (dropdown with description on hover)
  - Filtered based on whether it's for students or faculty (is_for_student flag)
- **Due Description** (optional text area)
- **Is Payable/Non-Payable\*** (radio buttons)

**If Payable**:

- Amount\*\*\* (currency input)
- Final Due Date\*\*\* (date picker)
- Interest Compounding\*\*\* (Yes/No radio buttons)

**If Non-Payable**:

- Final Due Date\*\*\* (date picker)
- **If Documentation Type**:
  - Needs Original\*\*\* (radio option)
  - Needs PDF\*\*\* (radio option)

- **Proof Link** (optional Google Drive link)

#### Bulk Upload via Excel:

- Download template button
- Upload Excel file
- Progress bar during upload
- Automatic rollback on error
- Success/failure count display

**Validation**:

- All required fields must be filled
- Appropriate fields appear based on due type selection
- Access control based on operator type and access level

**Future Feature**: SMS notification to student/faculty mobile number

---

### 3. Active Dues (`/operator/active-dues`)

**Purpose**: View and manage all active dues for the operator's department/section.

**Features**:

- **Filters**:
  - Search by roll number/name
  - Date range filter
  - Clear filters button

- **Paginated Table** (50 dues per page):
  - Roll Number
  - Name
  - Due Type
  - Payable/Non-Payable status
  - Amount (with amount paid if applicable)
  - Due Date
  - Status (Active/Permission Granted)
  - Actions (Clear button for non-payable dues requiring verification)

- **Clear Non-Payable Dues**:
  - Modal confirmation
  - Only for dues requiring document verification
  - Updates due status after operator verification

- **Export Functionality**: Download table data as Excel file

**Data Scope**: Only dues from operator's department/section

---

### 4. Cleared Dues (`/operator/cleared-dues`)

**Purpose**: View all dues that have been cleared for the operator's department/section.

**Features**:

- **Filters**:
  - Search by roll number/name
  - Date range filter (based on cleared date)
  - Clear filters button

- **Paginated Table** (50 dues per page):
  - Roll Number
  - Name
  - Due Type
  - Payable/Non-Payable status
  - Amount
  - Amount Paid
  - Due Date
  - Cleared On
  - Cleared By
  - Method (Cleared/Permission Granted)

- **Export Functionality**: Download table data as Excel file

**Data Scope**: Only cleared dues from operator's department/section

---

### 5. Faculty Dues (`/operator/faculty-dues`)

**Purpose**: View personal dues if the operator is also a faculty member.

**Visibility**: This page appears in the sidebar only if the operator's email matches a faculty email in the system.

**Features**:

- **Summary Cards**:
  - Total Dues
  - Active Dues
  - Cleared Dues

- **Active Dues Section**:
  - Table showing all active dues
  - Due type, amount, payment status
  - Due date and current status

- **Cleared Dues Section**:
  - Table showing all cleared dues
  - Payment details and clearance method

- **Information Alert**: Guidelines for handling dues

**Data Scope**: Personal dues only (for the logged-in faculty member)

---

## Admin Configuration Changes

### AddUser Page (`/admin/add-user`)

**New Fields for Operator Role**:

1. **Operator Type** (required):
   - Department Operator
   - Section Operator

2. **Access Level** (required):
   - For Department Operators:
     - All Students (Any Department)
     - Department Students Only
   - For Section Operators:
     - All Students (Any Section)
     - All Faculty (Section Only)

**Description Hints**: Dynamic text explaining what each access level allows

---

### AddFaculty Page (`/admin/add-faculty`)

**Updated Assign Role Modal**:
When assigning the "Operator" role to a faculty member, additional fields appear:

1. **Operator Type** (required):
   - Department Operator
   - Section Operator

2. **Access Level** (required):
   - Same options as AddUser page

**Note**: The faculty's existing department/section is used as the operator's department/section

---

## Database Schema Considerations

### Due Types Table

```sql
due_types (
  id INTEGER,
  type_name VARCHAR(100),
  description TEXT,
  is_for_student INTEGER,  -- 1 for students, 0 for faculty
  requires_permission BOOLEAN
)
```

### Student Dues Table

```sql
student_dues (
  id INTEGER,
  student_roll_number VARCHAR(20),
  added_by_user_id UUID,
  added_by_department_id INTEGER,
  added_by_section_id INTEGER,
  due_type_id INTEGER,
  is_payable BOOLEAN,
  current_amount NUMERIC(10,2),
  amount_paid NUMERIC(10,2),
  permission_granted BOOLEAN,
  due_clear_by_date DATE,
  is_cleared BOOLEAN,
  overall_status BOOLEAN,
  due_description TEXT,
  proof_drive_link TEXT,
  -- Additional fields for documentation
  needs_original BOOLEAN,
  needs_pdf BOOLEAN,
  is_compounded BOOLEAN  -- For interest calculation
)
```

---

## API Endpoints Required

### Operator Endpoints:

1. `GET /api/operator/dashboard/stats` - Get summary statistics
2. `GET /api/operator/dashboard/monthly-data` - Get last 6 months data
3. `GET /api/operator/dashboard/academic-year-data` - Get year-wise data
4. `GET /api/operator/due-types` - Get all due types
5. `POST /api/operator/dues` - Add a single due
6. `POST /api/operator/dues/bulk-upload` - Upload multiple dues via Excel
7. `GET /api/operator/dues/active` - Get all active dues
8. `GET /api/operator/dues/cleared` - Get all cleared dues
9. `PUT /api/operator/dues/:id/clear` - Clear a non-payable due

### Faculty Endpoints:

10. `GET /api/faculty/dues` - Get personal dues for faculty

---

## Access Control

- Operators can only view/manage dues from their assigned department/section
- Department-based filtering is enforced at the backend
- Access level determines which students/faculty they can add dues for:
  - `all_students`: Can add dues to any student in the database
  - `department_students`: Can add dues only to students in their department
  - `all_faculty`: Can add dues to faculty in their section

---

## User Experience Features

1. **Responsive Design**: All pages work on mobile, tablet, and desktop
2. **Loading States**: Spinner shown during data fetching
3. **Error Handling**: Toast notifications for success/error messages
4. **Pagination**: Large datasets split across multiple pages (50 items per page)
5. **Export Functionality**: Excel export for all tabular data
6. **Search & Filters**: Easy data filtering on all listing pages
7. **Form Validation**: Real-time validation with helpful error messages
8. **Conditional Fields**: Form fields appear/disappear based on selections
9. **Progress Bars**: Visual feedback during file upload
10. **Tooltips**: Helpful hints and descriptions throughout

---

## Future Enhancements

1. **SMS Notifications**: Send SMS to student/faculty when due is added
2. **Email Notifications**: Email alerts for approaching due dates
3. **Payment Integration**: Online payment gateway for payable dues
4. **Interest Calculation**: Automatic interest calculation for overdue payable dues
5. **Bulk Actions**: Clear multiple dues at once
6. **Advanced Analytics**: More detailed reports and visualizations
7. **Document Upload**: Direct document upload instead of Google Drive links
8. **Approval Workflow**: Multi-level approval for certain due types

---

## Technical Stack

- **Frontend**: React 18 + TypeScript
- **Styling**: TailwindCSS + DaisyUI
- **Charts**: Recharts
- **Icons**: Lucide React
- **Excel**: XLSX library
- **Notifications**: React Hot Toast
- **Routing**: React Router v6

---

## File Structure

```
FRONTEND/src/pages/operator/
├── Dashboard.tsx          # Main dashboard with stats and graphs
├── AddDue.tsx            # Add dues manually or via Excel
├── ActiveDues.tsx        # View and manage active dues
├── ClearedDues.tsx       # View cleared dues history
├── FacultyDues.tsx       # Faculty personal dues page
└── index.ts              # Export all operator pages
```

---

## Notes for Developers

1. All operator pages use the `DashboardLayout` component for consistent UI
2. User data is retrieved from `localStorage` in each component
3. Department/section filtering should be enforced at the API level
4. The Faculty Dues page should only be added to routes/sidebar if the operator is also a faculty member
5. Excel upload uses transactional approach - rollback on any error
6. All dates should be formatted to Indian locale (`en-IN`)
7. Currency amounts should use Indian Rupee symbol (₹) and locale formatting

---

Last Updated: January 27, 2026
