# HOD Module - Complete Design Document

**Date:** January 31, 2026  
**Version:** 1.0  
**Status:** Design Phase

---

## Table of Contents

1. [Overview](#overview)
2. [Database Schema Analysis](#database-schema-analysis)
3. [Access Control & Business Rules](#access-control--business-rules)
4. [Backend API Endpoints](#backend-api-endpoints)
5. [Frontend Pages](#frontend-pages)
6. [Implementation Checklist](#implementation-checklist)

---

## Overview

The HOD (Head of Department) module allows department heads to:

- View statistics for **students in their department only**
- Monitor **all dues** for those students (even if issued by other departments)
- Analyze trends across academic years
- Export reports for administrative purposes

**Key Principle:** HOD has **read-only access** to students in their department and all dues associated with those students, regardless of which department issued the due.

---

## Database Schema Analysis

### Schema Support for HOD Module

#### ✅ Required Tables

```sql
-- Users table (HODs stored here)
users {
  user_id UUID PRIMARY KEY
  username VARCHAR(50)
  email VARCHAR(100)
  role_id INTEGER → references roles(id) [role='hod']
  department_id INTEGER → HOD's department
  section_id INTEGER → NULL for HODs
  password TEXT
}

-- Students table
students {
  student_id UUID PRIMARY KEY
  name VARCHAR(100)
  roll_number VARCHAR(20) UNIQUE
  branch VARCHAR(50)
  section VARCHAR(10)
  email VARCHAR(100)
  mobile VARCHAR(15)
  father_name VARCHAR(100)
  father_mobile VARCHAR(15)
  academic_year_id INTEGER
  department_id INTEGER → Student's home department
  section_id INTEGER
}

-- Student Dues table
student_dues {
  id INTEGER PRIMARY KEY
  student_roll_number VARCHAR(20) → references students(roll_number)
  added_by_department_id INTEGER → Department that ISSUED the due
  added_by_section_id INTEGER
  due_type_id INTEGER
  is_payable BOOLEAN
  current_amount NUMERIC(10,2)
  amount_paid NUMERIC(10,2)
  is_cleared BOOLEAN
  permission_granted BOOLEAN
  due_clear_by_date DATE
  created_at TIMESTAMPTZ
  updated_at TIMESTAMPTZ
}

-- Academic Year table
academic_year {
  id INTEGER PRIMARY KEY
  beginning_year INTEGER
  ending_year INTEGER
}

-- Departments table
departments {
  id INTEGER PRIMARY KEY
  name VARCHAR(100) UNIQUE
}
```

#### ✅ Key Relationships for HOD Queries

```
HOD (users table with role='hod')
  ↓ department_id
  ├─→ Students (students.department_id = HOD.department_id)
       ↓ roll_number
       └─→ Student Dues (student_dues.student_roll_number = students.roll_number)
            ├─ Can be issued by ANY department (added_by_department_id)
            ├─ Filtered by is_cleared, is_payable
            └─ Joined with academic_year via students.academic_year_id
```

#### ✅ Required Indexes (Already Present)

- `idx_students_department_id` - Fast filtering of students by department ✅
- `idx_students_academic_year` - Academic year grouping ✅
- `idx_student_dues_student` - Join dues with students ✅
- `idx_student_dues_documentation` - Filter documentation dues ✅

#### 📝 Recommended Additional Index

```sql
-- For faster HOD queries filtering by department + cleared status
CREATE INDEX idx_student_dues_dept_cleared
ON student_dues (student_roll_number, is_cleared, is_payable);
```

---

## Access Control & Business Rules

### 1. HOD Identification

```javascript
// From JWT token or session
const hodInfo = {
  user_id: "uuid",
  role: "hod",
  department_id: 5, // HOD's department
  department_name: "Computer Science",
};
```

### 2. Data Filtering Rules

#### Rule 1: Students Scope

```sql
-- HOD can ONLY see students where:
students.department_id = HOD.department_id
```

#### Rule 2: Dues Scope

```sql
-- For each student in HOD's department, show ALL dues:
SELECT * FROM student_dues
WHERE student_roll_number IN (
  SELECT roll_number FROM students
  WHERE department_id = HOD.department_id
)
-- NOTE: added_by_department_id can be ANY department
```

#### Rule 3: Active vs Inactive Dues

```sql
-- Active Dues: is_cleared = FALSE AND permission_granted = FALSE
-- Cleared Dues: is_cleared = TRUE OR permission_granted = TRUE
-- All Dues: No filter
```

#### Rule 4: Payable vs Non-Payable

```sql
-- Payable: is_payable = TRUE AND current_amount IS NOT NULL
-- Non-Payable: is_payable = FALSE
```

---

## Backend API Endpoints

### Base Route: `/api/hod`

**Authentication:** JWT with role check `authenticateRole(['hod'])`

---

### 1. Dashboard Endpoints

#### 1.1 Get Dashboard Summary Stats

```
GET /api/hod/dashboard/stats
```

**Description:** Returns 6 summary statistics for HOD's department

**Authentication:** Required (HOD role)

**Response:**

```json
{
  "success": true,
  "data": {
    "totalStudents": 250,
    "totalDues": 486,
    "totalPayableDues": 320,
    "totalNonPayableDues": 166,
    "totalDuesAmount": 1250000.0,
    "studentsHavingDues": 178
  }
}
```

**SQL Query Logic:**

```sql
-- 1. Total Students in department
SELECT COUNT(*) FROM students WHERE department_id = ${hodDepartmentId}

-- 2. Total Dues (all dues for department students)
SELECT COUNT(*) FROM student_dues sd
JOIN students s ON sd.student_roll_number = s.roll_number
WHERE s.department_id = ${hodDepartmentId}

-- 3. Total Payable Dues (active only)
SELECT COUNT(*) FROM student_dues sd
JOIN students s ON sd.student_roll_number = s.roll_number
WHERE s.department_id = ${hodDepartmentId}
  AND sd.is_payable = TRUE
  AND sd.is_cleared = FALSE

-- 4. Total Non-Payable Dues (active only)
SELECT COUNT(*) FROM student_dues sd
JOIN students s ON sd.student_roll_number = s.roll_number
WHERE s.department_id = ${hodDepartmentId}
  AND sd.is_payable = FALSE
  AND sd.is_cleared = FALSE

-- 5. Total Dues Amount
SELECT COALESCE(SUM(sd.current_amount), 0) FROM student_dues sd
JOIN students s ON sd.student_roll_number = s.roll_number
WHERE s.department_id = ${hodDepartmentId}
  AND sd.is_payable = TRUE

-- 6. Students Having Dues (unique count)
SELECT COUNT(DISTINCT s.student_id) FROM students s
JOIN student_dues sd ON s.roll_number = sd.student_roll_number
WHERE s.department_id = ${hodDepartmentId}
  AND sd.is_cleared = FALSE
```

---

#### 1.2 Get Academic Year Analytics

```
GET /api/hod/dashboard/academic-year-analytics
```

**Description:** Returns data for double bar graph showing students with dues by academic year

**Authentication:** Required (HOD role)

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "academicYear": "2021-2022",
      "studentsWithPayableDues": 45,
      "studentsWithNonPayableDues": 38
    },
    {
      "academicYear": "2022-2023",
      "studentsWithPayableDues": 52,
      "studentsWithNonPayableDues": 41
    },
    {
      "academicYear": "2023-2024",
      "studentsWithPayableDues": 60,
      "studentsWithNonPayableDues": 55
    }
  ]
}
```

**SQL Query Logic:**

```sql
SELECT
  CONCAT(ay.beginning_year, '-', ay.ending_year) as academic_year,
  COUNT(DISTINCT CASE
    WHEN sd.is_payable = TRUE AND sd.is_cleared = FALSE
    THEN s.student_id
  END) as students_with_payable_dues,
  COUNT(DISTINCT CASE
    WHEN sd.is_payable = FALSE AND sd.is_cleared = FALSE
    THEN s.student_id
  END) as students_with_non_payable_dues
FROM academic_year ay
JOIN students s ON s.academic_year_id = ay.id
LEFT JOIN student_dues sd ON sd.student_roll_number = s.roll_number
WHERE s.department_id = ${hodDepartmentId}
  AND sd.is_cleared = FALSE
GROUP BY ay.id, ay.beginning_year, ay.ending_year
HAVING COUNT(sd.id) > 0
ORDER BY ay.beginning_year ASC;
```

---

### 2. Students with Dues Endpoints

#### 2.1 Get Students with Active Dues

```
GET /api/hod/students-with-dues
Query Parameters:
  - rollNumber (optional): Filter by roll number
  - academicYear (optional): Filter by academic year ID
  - startDate (optional): Filter dues created from date
  - endDate (optional): Filter dues created to date
  - page (default: 1): Page number
  - limit (default: 50): Items per page
```

**Description:** Returns students from HOD's department who have at least one active due

**Authentication:** Required (HOD role)

**Response:**

```json
{
  "success": true,
  "data": {
    "students": [
      {
        "rollNumber": "21131A0501",
        "name": "John Doe",
        "academicYear": "2021-2022",
        "branch": "Computer Science",
        "section": "A",
        "mobile": "9876543210",
        "fatherName": "John's Father",
        "fatherMobile": "9876543211",
        "activeDuesCount": 3,
        "dues": [
          {
            "dueId": 1234,
            "amount": 5000.0,
            "isPayable": true,
            "status": "Active",
            "issuingDepartment": "Library",
            "dueType": "Library Fine",
            "createdDate": "2024-01-15",
            "dueDate": "2024-02-28",
            "description": "Late return of books"
          },
          {
            "dueId": 1235,
            "amount": null,
            "isPayable": false,
            "status": "Active",
            "issuingDepartment": "Accounts",
            "dueType": "Documentation Required",
            "createdDate": "2024-01-20",
            "dueDate": "2024-03-01",
            "description": "Submit bonafide certificate"
          }
        ]
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalRecords": 178,
      "recordsPerPage": 50
    }
  }
}
```

**SQL Query Logic:**

```sql
-- Main query with pagination
SELECT
  s.roll_number,
  s.name,
  CONCAT(ay.beginning_year, '-', ay.ending_year) as academic_year,
  s.branch,
  s.section,
  s.mobile,
  s.father_name,
  s.father_mobile,
  COUNT(sd.id) as active_dues_count
FROM students s
JOIN academic_year ay ON s.academic_year_id = ay.id
JOIN student_dues sd ON sd.student_roll_number = s.roll_number
WHERE s.department_id = ${hodDepartmentId}
  AND sd.is_cleared = FALSE
  ${rollNumber ? `AND s.roll_number ILIKE '%${rollNumber}%'` : ''}
  ${academicYear ? `AND s.academic_year_id = ${academicYear}` : ''}
  ${startDate ? `AND sd.created_at >= '${startDate}'` : ''}
  ${endDate ? `AND sd.created_at <= '${endDate}'` : ''}
GROUP BY s.student_id, s.roll_number, s.name, ay.beginning_year, ay.ending_year, s.branch, s.section, s.mobile, s.father_name, s.father_mobile
ORDER BY s.roll_number ASC
LIMIT ${limit} OFFSET ${(page - 1) * limit};

-- Subquery for each student's dues
SELECT
  sd.id as due_id,
  sd.current_amount as amount,
  sd.is_payable,
  CASE
    WHEN sd.is_cleared = TRUE THEN 'Cleared'
    WHEN sd.permission_granted = TRUE THEN 'Permission Granted'
    ELSE 'Active'
  END as status,
  d.name as issuing_department,
  dt.type_name as due_type,
  sd.created_at as created_date,
  sd.due_clear_by_date as due_date,
  sd.due_description as description
FROM student_dues sd
JOIN due_types dt ON sd.due_type_id = dt.id
LEFT JOIN departments d ON sd.added_by_department_id = d.id
WHERE sd.student_roll_number = ${student.roll_number}
  AND sd.is_cleared = FALSE
ORDER BY sd.created_at DESC;
```

---

#### 2.2 Export Students with Dues (CSV)

```
GET /api/hod/students-with-dues/export
Query Parameters: Same as 2.1
```

**Description:** Exports filtered students to CSV

**Authentication:** Required (HOD role)

**Response:** CSV file with headers:

```
Roll Number,Student Name,Class,Section,Phone Number,Father's Name,Father's Phone Number
```

---

### 3. Whole Report Endpoints

#### 3.1 Get All Department Students

```
GET /api/hod/whole-report
Query Parameters:
  - rollNumber (optional): Filter by roll number
  - academicYear (optional): Filter by academic year ID
  - startDate (optional): Filter dues created/paid from date
  - endDate (optional): Filter dues created/paid to date
  - page (default: 1): Page number
  - limit (default: 50): Items per page
```

**Description:** Returns ALL students in HOD's department with their complete dues history

**Authentication:** Required (HOD role)

**Response:**

```json
{
  "success": true,
  "data": {
    "students": [
      {
        "rollNumber": "21131A0501",
        "name": "John Doe",
        "academicYear": "2021-2022",
        "branch": "Computer Science",
        "section": "A",
        "mobile": "9876543210",
        "activeDuesCount": 2,
        "totalDuesCount": 5
      },
      {
        "rollNumber": "21131A0502",
        "name": "Jane Smith",
        "academicYear": "2021-2022",
        "branch": "Computer Science",
        "section": "A",
        "mobile": "9876543220",
        "activeDuesCount": 0,
        "totalDuesCount": 3
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalRecords": 250,
      "recordsPerPage": 50
    }
  }
}
```

**SQL Query Logic:**

```sql
SELECT
  s.roll_number,
  s.name,
  CONCAT(ay.beginning_year, '-', ay.ending_year) as academic_year,
  s.branch,
  s.section,
  s.mobile,
  COUNT(CASE WHEN sd.is_cleared = FALSE THEN 1 END) as active_dues_count,
  COUNT(sd.id) as total_dues_count
FROM students s
JOIN academic_year ay ON s.academic_year_id = ay.id
LEFT JOIN student_dues sd ON sd.student_roll_number = s.roll_number
WHERE s.department_id = ${hodDepartmentId}
  ${rollNumber ? `AND s.roll_number ILIKE '%${rollNumber}%'` : ''}
  ${academicYear ? `AND s.academic_year_id = ${academicYear}` : ''}
GROUP BY s.student_id, s.roll_number, s.name, ay.beginning_year, ay.ending_year, s.branch, s.section, s.mobile
ORDER BY s.roll_number ASC
LIMIT ${limit} OFFSET ${(page - 1) * limit};
```

---

#### 3.2 Get Student Dues History

```
GET /api/hod/student-dues-history/:rollNumber
```

**Description:** Returns complete dues history for a specific student (Active + Paid + Inactive)

**Authentication:** Required (HOD role)

**Authorization:** Student must belong to HOD's department

**Response:**

```json
{
  "success": true,
  "data": {
    "student": {
      "rollNumber": "21131A0501",
      "name": "John Doe",
      "academicYear": "2021-2022",
      "branch": "Computer Science",
      "section": "A"
    },
    "dues": [
      {
        "dueId": 1234,
        "amount": 5000.0,
        "isPayable": true,
        "status": "Active",
        "statusBadge": "error",
        "issuingDepartment": "Library",
        "dueType": "Library Fine",
        "createdDate": "2024-01-15",
        "dueDate": "2024-02-28",
        "paidDate": null,
        "paidAmount": 0,
        "outstandingAmount": 5000.0
      },
      {
        "dueId": 1230,
        "amount": 3000.0,
        "isPayable": true,
        "status": "Paid",
        "statusBadge": "success",
        "issuingDepartment": "Accounts",
        "dueType": "Exam Fee",
        "createdDate": "2023-12-01",
        "dueDate": "2023-12-31",
        "paidDate": "2023-12-25",
        "paidAmount": 3000.0,
        "outstandingAmount": 0
      },
      {
        "dueId": 1225,
        "amount": null,
        "isPayable": false,
        "status": "Permission Granted",
        "statusBadge": "info",
        "issuingDepartment": "CSE Department",
        "dueType": "Documentation Required",
        "createdDate": "2023-11-10",
        "dueDate": "2023-12-10",
        "paidDate": null,
        "paidAmount": 0,
        "outstandingAmount": 0
      }
    ],
    "summary": {
      "totalDues": 5,
      "activeDues": 2,
      "clearedDues": 3,
      "totalOutstanding": 5000.0
    }
  }
}
```

**SQL Query Logic:**

```sql
-- Verify student belongs to HOD's department
SELECT s.* FROM students s
WHERE s.roll_number = ${rollNumber}
  AND s.department_id = ${hodDepartmentId}
LIMIT 1;

-- Get all dues for student
SELECT
  sd.id as due_id,
  sd.current_amount as amount,
  sd.is_payable,
  CASE
    WHEN sd.is_cleared = TRUE THEN 'Paid'
    WHEN sd.permission_granted = TRUE THEN 'Permission Granted'
    ELSE 'Active'
  END as status,
  CASE
    WHEN sd.is_cleared = FALSE AND sd.permission_granted = FALSE THEN 'error'
    WHEN sd.is_cleared = TRUE THEN 'success'
    WHEN sd.permission_granted = TRUE THEN 'info'
    ELSE 'ghost'
  END as status_badge,
  d.name as issuing_department,
  dt.type_name as due_type,
  sd.created_at as created_date,
  sd.due_clear_by_date as due_date,
  sd.updated_at as paid_date,
  sd.amount_paid as paid_amount,
  COALESCE(sd.current_amount - sd.amount_paid, 0) as outstanding_amount
FROM student_dues sd
JOIN due_types dt ON sd.due_type_id = dt.id
LEFT JOIN departments d ON sd.added_by_department_id = d.id
WHERE sd.student_roll_number = ${rollNumber}
ORDER BY sd.created_at DESC;
```

---

### 4. Utility Endpoints

#### 4.1 Get Academic Years List

```
GET /api/hod/academic-years
```

**Description:** Returns list of academic years for filter dropdowns

**Response:**

```json
{
  "success": true,
  "data": [
    { "id": 1, "year": "2020-2021" },
    { "id": 2, "year": "2021-2022" },
    { "id": 3, "year": "2022-2023" }
  ]
}
```

---

## Frontend Pages

### Page 1: HOD Dashboard (`/hod/dashboard`)

#### Components Structure

```
<DashboardLayout role="hod">
  <DashboardHeader /> {/* Welcome, {HOD Name} */}

  <SummaryCards>
    <StatCard title="Total Students" value={250} icon={Users} />
    <StatCard title="Total Dues" value={486} icon={FileText} />
    <StatCard title="Payable Dues" value={320} icon={DollarSign} />
    <StatCard title="Non-Payable Dues" value={166} icon={AlertCircle} />
    <StatCard title="Total Amount" value="₹12,50,000" icon={DollarSign} />
    <StatCard title="Students Having Dues" value={178} icon={Users} />
  </SummaryCards>

  <AcademicYearGraph data={graphData} />

  <QuickActions>
    <Button href="/hod/students-with-dues">See Students with Dues</Button>
    <Button href="/hod/whole-report">Whole Report</Button>
    <Button href="/change-password">Change Password</Button>
  </QuickActions>
</DashboardLayout>
```

#### Graph Component (Recharts)

```tsx
<ResponsiveContainer width="100%" height={400}>
  <BarChart data={academicYearData}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="academicYear" />
    <YAxis />
    <Tooltip />
    <Legend />
    <Bar dataKey="studentsWithPayableDues" fill="#10b981" name="Payable Dues" />
    <Bar
      dataKey="studentsWithNonPayableDues"
      fill="#f59e0b"
      name="Non-Payable Dues"
    />
  </BarChart>
</ResponsiveContainer>
```

---

### Page 2: Students with Dues (`/hod/students-with-dues`)

#### Features

- Filters: Roll Number, Academic Year, Date Range
- Expandable table rows showing student dues
- CSV export button
- Pagination

#### Component Structure

```tsx
<DashboardLayout role="hod">
  <PageHeader title="Students with Active Dues" />

  <FilterSection>
    <SearchInput placeholder="Roll Number" />
    <Select placeholder="Academic Year" />
    <DateInput label="From Date" />
    <DateInput label="To Date" />
    <Button onClick={applyFilters}>Search</Button>
    <Button onClick={clearFilters}>Clear</Button>
    <Button onClick={exportCSV}>Export CSV</Button>
  </FilterSection>

  <ExpandableTable>
    {students.map((student) => (
      <TableRow key={student.rollNumber} expandable>
        <td>{student.rollNumber}</td>
        <td>{student.name}</td>
        <td>{student.academicYear}</td>
        <td>{student.branch}</td>
        <td>{student.section}</td>
        <td>{student.mobile}</td>

        <ExpandedContent>
          <DuesTable dues={student.dues} />
        </ExpandedContent>
      </TableRow>
    ))}
  </ExpandableTable>

  <Pagination />
</DashboardLayout>
```

---

### Page 3: Whole Report (`/hod/whole-report`)

#### Features

- Shows ALL students in department
- Click student → Modal/Panel with full dues history
- Filters: Roll Number, Academic Year, Date Range
- Status badges for Active/Paid/Inactive dues

#### Component Structure

```tsx
<DashboardLayout role="hod">
  <PageHeader title="Department Students - Complete Report" />

  <FilterSection>
    <SearchInput placeholder="Roll Number" />
    <Select placeholder="Academic Year" />
    <DateInput label="From Date" />
    <DateInput label="To Date" />
  </FilterSection>

  <StudentsTable>
    {students.map((student) => (
      <TableRow
        key={student.rollNumber}
        onClick={() => openDuesHistoryModal(student.rollNumber)}
        className="cursor-pointer hover:bg-base-200"
      >
        <td>{student.rollNumber}</td>
        <td>{student.name}</td>
        <td>{student.academicYear}</td>
        <td>{student.branch}</td>
        <td>{student.section}</td>
        <td>{student.mobile}</td>
        <td>
          <span className="badge badge-error">{student.activeDuesCount}</span>
        </td>
      </TableRow>
    ))}
  </StudentsTable>

  <DuesHistoryModal
    isOpen={modalOpen}
    studentRollNumber={selectedStudent}
    onClose={closeModal}
  >
    <StudentInfo />
    <DuesHistoryTable>
      {/* Due ID, Amount, Payable, Status, Issuing Dept, Created, Paid */}
    </DuesHistoryTable>
    <DuesSummary />
  </DuesHistoryModal>

  <Pagination />
</DashboardLayout>
```

---

## Implementation Checklist

### Backend Tasks

#### Phase 1: Database & Routes

- [ ] Create HOD routes file: `BACKEND/routes/hodRoutes.js`
- [ ] Create HOD controller: `BACKEND/controllers/hodController.js`
- [ ] Add recommended index: `idx_student_dues_dept_cleared`
- [ ] Apply authentication middleware to all HOD routes
- [ ] Register HOD routes in `server.js`

#### Phase 2: Implement Endpoints

- [ ] `GET /api/hod/dashboard/stats` - Summary statistics
- [ ] `GET /api/hod/dashboard/academic-year-analytics` - Graph data
- [ ] `GET /api/hod/students-with-dues` - Students with active dues
- [ ] `GET /api/hod/students-with-dues/export` - CSV export
- [ ] `GET /api/hod/whole-report` - All department students
- [ ] `GET /api/hod/student-dues-history/:rollNumber` - Full dues history
- [ ] `GET /api/hod/academic-years` - Dropdown data

#### Phase 3: Testing

- [ ] Test department filtering (HOD sees only their students)
- [ ] Test cross-department dues visibility
- [ ] Test pagination and filters
- [ ] Test CSV export
- [ ] Test authorization (HOD can't access other departments)

---

### Frontend Tasks

#### Phase 1: Page Structure

- [ ] Create `FRONTEND/src/pages/hod/` directory
- [ ] Create `Dashboard.tsx`
- [ ] Create `StudentsWithDues.tsx`
- [ ] Create `WholeReport.tsx`
- [ ] Add HOD routes to `App.tsx`
- [ ] Add HOD sidebar links

#### Phase 2: Components

- [ ] Create `SummaryCards.tsx` component
- [ ] Create `AcademicYearGraph.tsx` (Recharts)
- [ ] Create `ExpandableTable.tsx` for students with dues
- [ ] Create `DuesHistoryModal.tsx` for whole report
- [ ] Create `FilterSection.tsx` reusable component
- [ ] Create CSV export utility function

#### Phase 3: Integration

- [ ] Fetch dashboard stats from API
- [ ] Fetch graph data and render
- [ ] Implement filters with debounce
- [ ] Implement pagination
- [ ] Implement CSV download
- [ ] Add loading states and error handling

#### Phase 4: UX Polish

- [ ] Add tooltips to summary cards
- [ ] Add status color badges (Active=red, Paid=green, Permission=blue)
- [ ] Add responsive design for mobile
- [ ] Add empty states when no data
- [ ] Add confirmation for logout
- [ ] Test accessibility (keyboard navigation, screen readers)

---

## Security Considerations

1. **Authorization Middleware**

   ```javascript
   const verifyHODAccess = async (req, res, next) => {
     const { user_id, role, department_id } = req.user; // from JWT

     if (role !== "hod" || !department_id) {
       return res.status(403).json({
         success: false,
         message: "Unauthorized access",
       });
     }

     req.hodDepartmentId = department_id;
     next();
   };
   ```

2. **Student Access Validation**
   - Always verify student belongs to HOD's department before showing data
   - Use parameterized queries to prevent SQL injection
   - Sanitize all user inputs (roll number, dates)

3. **Rate Limiting**
   - Implement rate limiting on export endpoints to prevent abuse
   - Limit CSV export size (max 1000 records)

---

## Performance Optimization

1. **Database Query Optimization**
   - Use `COUNT(DISTINCT student_id)` instead of subqueries
   - Index on `(department_id, is_cleared, is_payable)` for faster filtering
   - Use connection pooling for concurrent requests

2. **Frontend Optimization**
   - Debounce filter inputs (300ms delay)
   - Virtual scrolling for large tables (react-window)
   - Lazy load dues details on row expand
   - Cache graph data in component state

3. **Caching Strategy**
   - Cache dashboard stats for 5 minutes (Redis)
   - Invalidate cache when new due is added to department students

---

## API Error Responses

### Standard Error Format

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error (development only)"
}
```

### Common Error Codes

- `401 Unauthorized` - Invalid or missing JWT token
- `403 Forbidden` - User is not HOD or accessing wrong department
- `404 Not Found` - Student not found or not in HOD's department
- `500 Internal Server Error` - Database or server error

---

## Future Enhancements

1. **Advanced Analytics**
   - Pie chart showing dues distribution by type
   - Line graph showing dues trends over time
   - Department comparison (if multi-department HOD)

2. **Notifications**
   - Email digest of students with overdue payments
   - Alert when new due is added to department students
   - Monthly report generation

3. **Export Options**
   - PDF export with charts
   - Excel export with multiple sheets
   - Automated report scheduling

4. **Filters Enhancement**
   - Filter by due type
   - Filter by issuing department
   - Filter by amount range
   - Save filter presets

---

**End of HOD Module Design Document**  
**Version:** 1.0  
**Last Updated:** January 31, 2026
