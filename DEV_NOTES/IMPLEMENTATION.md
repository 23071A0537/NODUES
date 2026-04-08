# No Dues System - Implementation Documentation

## Overview

This is a comprehensive No Dues Management System built with the PERN stack (PostgreSQL, Express, React, Node.js). The system manages student dues across departments and sections with role-based access control.

## Features Implemented

### 1. **User Roles**

- **Admin**: Full system access with all privileges
- **Operator**: Department or Section-specific operators
- **HOD**: Head of Department access
- **Student**: View and manage their own dues

### 2. **Common UI Components**

#### Sidebar Component (`components/Sidebar.tsx`)

- Fixed sidebar with role-based navigation links
- Logout and change password options
- Different menu items based on user role

#### User Profile Dropdown (`components/UserProfileDropdown.tsx`)

- Clickable user icon in header
- Displays username, email, and role
- Dropdown closes on outside click

#### Dashboard Layout (`components/DashboardLayout.tsx`)

- Unified layout wrapper for all dashboard pages
- Includes header, sidebar, and main content area
- Handles logout functionality

### 3. **Admin Features**

#### Dashboard (`pages/admin/Dashboard.tsx`)

Features:

- Personalized greeting: "Hello, {username}"
- Statistics cards showing:
  - Number of departments
  - Number of sections
  - Number of users
  - Number of academic years
  - Total students
  - Total faculty
- Department/Section dues table with:
  - Non-payable dues count
  - Payable dues count
  - Total pending amount
  - Fixed table headers for scrolling
  - Totals row at bottom
  - Excel download functionality
- Quick action buttons to navigate to other features

#### Add Academic Year (`pages/admin/AddAcademicYear.tsx`)

Features:

- Add academic years with beginning and ending year
- Validation: ending year must be exactly 1 year after beginning
- View all existing academic years in a table
- Delete academic year with cascade warning
- Warning alerts about data deletion impact

#### Add Department/Section (`pages/admin/AddDepartmentSection.tsx`)

Features:

- Single form to add either department or section
- Type selection dropdown (Department/Section)
- Separate tables for departments and sections
- Delete functionality with cascade warnings
- Duplicate prevention

#### Add User (`pages/admin/AddUser.tsx`)

Features:

- Add users with roles: Admin, Operator, HOD
- For Operators:
  - Choose between Department Operator or Section Operator
  - Select specific department or section
- For HOD:
  - Select department (only one HOD per department validation)
- Default passwords:
  - Admin: `admin123`
  - Operator/HOD: `pass123`
- Search functionality across all user fields
- Change password for any user
- Delete user functionality
- User listing with all details

#### Add Students (`pages/admin/AddStudents.tsx`)

Features:

- Bulk upload via Excel file
- Required fields:
  - S.No., Name, H.T.No. (Roll Number), Branch, Section
  - Email, Mobile, Father Name, Father Mobile
- Select academic year before upload
- Download Excel template
- Validation and error handling
- Transaction rollback on errors
- Pagination (50 students per page)
- Search by name, roll number, branch, email
- Auto-create departments if branch doesn't exist
- Default password: `pass123`
- Change student password functionality

#### Add Faculty (`pages/admin/AddFaculty.tsx`)

Features:

- Bulk upload via Excel file
- Faculty types: Teaching and Non-Teaching
- Required fields:
  - S.No, Employee Code, Employee Name
  - Department, Designation, Email, Mobile
- Download Excel template
- Auto-add to sections if department doesn't exist
- Pagination (50 faculty per page)
- Search functionality
- Assign roles to faculty (Admin, Operator, HOD)
- Change faculty password
- Default password: `pass123`

### 4. **Backend API Implementation**

All backend routes are prefixed with `/api/admin/`

#### Academic Year APIs

- `POST /api/admin/academic-year` - Add new academic year
- `GET /api/admin/academic-year` - Get all academic years
- `DELETE /api/admin/academic-year/:id` - Delete academic year

#### Department/Section APIs

- `POST /api/admin/departments` - Add new department
- `POST /api/admin/sections` - Add new section
- `GET /api/admin/departments` - Get all departments
- `GET /api/admin/sections` - Get all sections
- `DELETE /api/admin/departments/:id` - Delete department
- `DELETE /api/admin/sections/:id` - Delete section

#### Dashboard APIs

- `GET /api/admin/dashboard/stats` - Get dashboard statistics
- `GET /api/admin/dashboard/department-dues` - Get department/section dues data

#### User APIs

- `POST /api/admin/users` - Add new user
- `GET /api/admin/users` - Get all users
- `PUT /api/admin/users/:id` - Update user (including password)
- `DELETE /api/admin/users/:id` - Delete user

#### Student APIs

- `POST /api/admin/students` - Bulk add students
- `GET /api/admin/students` - Get all students

#### Faculty APIs

- `POST /api/admin/faculty` - Bulk add faculty
- `GET /api/admin/faculty` - Get all faculty

### 5. **Excel Functionality**

The application uses the `xlsx` library for Excel operations:

- Download templates with proper headers
- Upload and parse Excel files
- Export data to Excel format
- Validation of uploaded data

### 6. **Database Schema Integration**

The implementation follows the database schema defined in `DatabaseSchema.txt`:

- Proper foreign key relationships
- Cascade deletes where appropriate
- Role-based access through roles table
- Department/Section associations
- Academic year tracking

## Technology Stack

### Frontend

- **React 18** with TypeScript
- **React Router** for navigation
- **DaisyUI** + **Tailwind CSS** for styling
- **Lucide React** for icons
- **XLSX** for Excel operations
- **React Hot Toast** for notifications
- **Zustand** for state management

### Backend

- **Node.js** with Express
- **PostgreSQL** database (Neon serverless)
- **Bcrypt** for password hashing
- **Arcjet** for rate limiting and security
- **Helmet** for HTTP security headers
- **Morgan** for logging
- **CORS** for cross-origin requests

## File Structure

```
NODUES_FINAL/
├── BACKEND/
│   ├── config/
│   │   └── db.js                 # Database connection
│   ├── controllers/
│   │   ├── adminController.js     # Admin API logic
│   │   └── authController.js      # Authentication logic
│   ├── routes/
│   │   ├── adminRoutes.js         # Admin routes
│   │   └── authRoutes.js          # Auth routes
│   ├── lib/
│   │   └── arcjet.js              # Security configuration
│   └── server.js                  # Main server file
│
├── FRONTEND/
│   ├── src/
│   │   ├── components/
│   │   │   ├── DashboardLayout.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── UserProfileDropdown.tsx
│   │   │   ├── Header.tsx
│   │   │   └── Footer.tsx
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   └── admin/
│   │   │       ├── Dashboard.tsx
│   │   │       ├── AddAcademicYear.tsx
│   │   │       ├── AddDepartmentSection.tsx
│   │   │       ├── AddUser.tsx
│   │   │       ├── AddStudents.tsx
│   │   │       └── AddFaculty.tsx
│   │   ├── store/
│   │   │   └── useThemeStore.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── package.json
│
└── DEV_NOTES/
    ├── DatabaseSchema.txt
    ├── TechStack.txt
    └── IMPLEMENTATION.md (this file)
```

## Getting Started

### Prerequisites

- Node.js v20+
- PostgreSQL database
- npm or yarn

### Installation

1. **Install dependencies:**

   ```bash
   # Root dependencies
   npm install

   # Frontend dependencies
   cd FRONTEND
   npm install
   ```

2. **Environment Variables:**
   Create a `.env` file in the root directory:

   ```env
   PORT=3000
   DATABASE_URL=your_postgres_connection_string
   ARCJET_KEY=your_arcjet_key
   ```

3. **Database Setup:**
   Run the SQL schema from `DEV_NOTES/DatabaseSchema.txt` on your PostgreSQL database.

4. **Run the Application:**

   ```bash
   # Backend (from root)
   npm run dev

   # Frontend (from FRONTEND folder)
   npm run dev
   ```

## Key Features & Validations

### Academic Year

- Must span exactly one year (e.g., 2024-2025)
- No duplicate years allowed
- Deletion cascades to students and related data

### Department/Section

- Department names must be unique
- Section names must be unique
- Deletion cascades to students, faculty, users, and dues

### Users

- Email must be unique
- One HOD per department only
- Operators must be assigned to a department or section
- Password complexity can be enforced

### Students

- Roll numbers must be unique
- Email must be unique
- Must belong to an academic year
- Branch auto-creates department if not exists

### Faculty

- Employee codes must be unique
- Can be teaching or non-teaching
- Department field auto-adds to sections if not in departments
- Can be assigned user roles (admin, operator, hod)

## Security Features

- **Password Hashing**: Bcrypt with salt rounds
- **Rate Limiting**: Arcjet protection
- **CORS**: Configured for frontend origin
- **Helmet**: HTTP security headers
- **Input Validation**: All inputs validated
- **SQL Injection Prevention**: Parameterized queries

## Next Steps (TODO)

1. **Implement remaining user roles:**
   - Operator dashboard and features
   - HOD dashboard and features
   - Student dashboard and dues view

2. **Add authentication:**
   - JWT token implementation
   - Login/logout flow
   - Protected routes
   - Session management

3. **Implement dues management:**
   - Add/edit/delete dues
   - Payment tracking
   - Due clearance workflow
   - Permissions system

4. **Add Change Password page:**
   - Self-service password change
   - Password strength validation
   - Password history

5. **Reporting features:**
   - More Excel exports
   - PDF generation
   - Custom reports

6. **Additional features:**
   - Email notifications
   - File upload for supporting documents
   - Audit logs
   - Search and filters enhancement

## Notes

- All pages currently use mock data. Replace fetch calls with actual API endpoints.
- The UI is fully responsive and uses DaisyUI themes.
- Excel templates are dynamically generated.
- Pagination is implemented for large data sets.
- The sidebar is fixed and role-based.
- User profile dropdown shows all user details.

## Support

For issues or questions, refer to the database schema and tech stack documentation in the DEV_NOTES folder.
