# No-Dues Management System - API Documentation

## Base URL

```
Development: http://localhost:3000
Production: https://your-domain.com
```

## Authentication

All protected endpoints require a Bearer token in the Authorization header:

```
Authorization: Bearer <JWT_TOKEN>
```

Token expires in 7 days. Store securely in localStorage.

## Common Response Format

### Success Response

```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

### Error Response

```json
{
  "success": false,
  "message": "Error description",
  "details": { ... }
}
```

## Authentication Endpoints

### POST /api/auth/login

Login for students, operators, HODs, and admins

**Request Body:**

```json
{
  "loginType": "student" | "teacher",
  "rollNumber": "21R11A0501",  // For students
  "email": "user@vnrvjiet.in",  // For staff
  "password": "password123"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "user_id": "uuid",
    "username": "John Doe",
    "email": "user@vnrvjiet.in",
    "role": "student" | "operator" | "hod" | "admin",
    "roll_number": "21R11A0501",  // For students
    "token": "jwt_token_here"
  }
}
```

### POST /api/auth/change-password

Change user password (requires authentication)

**Request Body:**

```json
{
  "currentPassword": "old_password",
  "newPassword": "new_password"
}
```

---

## Student Endpoints

### GET /api/student/dues

Get student's active dues

**Auth:** Required (Student role)

**Query Parameters:**

- `status` (optional): "payable" | "all" (default: "payable")
- `limit` (optional): Number (default: 50, max: 100)
- `offset` (optional): Number (default: 0)

**Response:**

```json
{
  "dues": [
    {
      "id": 1,
      "due_type_id": 1,
      "type_name": "Library Fine",
      "type_description": "Fine for overdue books",
      "is_payable": true,
      "current_amount": 500.0,
      "amount_paid": 0.0,
      "outstanding_amount": 500.0,
      "due_clear_by_date": "2026-03-31",
      "is_cleared": false,
      "added_by_entity": "Library",
      "status_badge": "payable",
      "is_compounded": false,
      "needs_original": null,
      "needs_pdf": null
    }
  ],
  "pagination": {
    "total": 10,
    "limit": 50,
    "offset": 0
  },
  "totals": {
    "total_dues": 10,
    "total_outstanding": 5000.0,
    "payable_total": 5000.0
  }
}
```

### GET /api/student/dues/history

Get cleared dues history

**Auth:** Required (Student role)

**Query Parameters:**

- `start_date` (optional): YYYY-MM-DD
- `end_date` (optional): YYYY-MM-DD
- `due_type_id` (optional): Number
- `limit` (optional): Number (default: 50)
- `offset` (optional): Number (default: 0)

**Response:**

```json
{
  "history": [
    {
      "id": 1,
      "type_name": "Library Fine",
      "current_amount": 500.0,
      "amount_paid": 500.0,
      "updated_at": "2026-02-01T10:30:00Z",
      "cleared_by_username": "John Doe",
      "payments": [
        {
          "id": 1,
          "paid_amount": 500.0,
          "payment_reference": "PAY_ABC123",
          "payment_method": "online",
          "payment_status": "SUCCESS",
          "paid_at": "2026-02-01T10:30:00Z"
        }
      ]
    }
  ],
  "pagination": {
    "total": 5,
    "limit": 50,
    "offset": 0
  }
}
```

### POST /api/student/payment/create-session

Create payment session for selected dues

**Auth:** Required (Student role)

**Request Body:**

```json
{
  "due_ids": [1, 2, 3],
  "return_url": "http://localhost:5173/student/dues"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "payment_id": "uuid",
    "redirect_url": "/payment/gateway/session_id",
    "total_amount": 1500.0,
    "due_items": [
      {
        "id": 1,
        "type_name": "Library Fine",
        "amount": 500.0
      }
    ]
  }
}
```

### GET /api/student/payment/status/:paymentId

Check payment status

**Auth:** Required (Student role)

**Response:**

```json
{
  "status": "SUCCESS" | "PENDING" | "FAILED",
  "payment_reference": "PAY_ABC123",
  "total_amount": 1500.00,
  "redirect_url": "/student/dues"
}
```

### GET /api/student/dues/:dueId/form/download

Download due form PDF

**Auth:** Required (Student role)

**Response:** PDF file download

### GET /api/student/dues/:dueId/receipt/download

Download payment receipt PDF

**Auth:** Required (Student role)

**Response:** PDF file download

---

## Operator Endpoints

### GET /api/operator/dashboard/stats

Get operator dashboard statistics

**Auth:** Required (Operator role)

**Response:**

```json
{
  "success": true,
  "data": {
    "studentsUnderControl": 150,
    "totalDues": 300,
    "totalPayableDues": 200,
    "totalNonPayableDues": 100,
    "totalDuesAmount": 150000.0
  }
}
```

### GET /api/operator/students

List students under operator's control

**Auth:** Required (Operator role)

**Query Parameters:**

- `limit` (optional): Number (default: 50)
- `offset` (optional): Number (default: 0)
- `search` (optional): String (searches name, roll number, email)

**Response:**

```json
{
  "success": true,
  "data": {
    "students": [
      {
        "student_id": "uuid",
        "name": "John Doe",
        "roll_number": "21R11A0501",
        "email": "john@vnrvjiet.in",
        "branch": "CSE",
        "section": "A"
      }
    ],
    "total": 150,
    "limit": 50,
    "offset": 0
  }
}
```

### POST /api/operator/dues/add

Add due for student(s)

**Auth:** Required (Operator role)

**Request Body:**

```json
{
  "student_roll_numbers": ["21R11A0501", "21R11A0502"],
  "due_type_id": 1,
  "is_payable": true,
  "current_amount": 500.0, // Required if is_payable=true
  "due_clear_by_date": "2026-03-31",
  "due_description": "Library fine for overdue books",
  "is_compounded": false, // Required if is_payable=true
  "needs_original": null, // For non-payable docs
  "needs_pdf": null, // For non-payable docs
  "proof_drive_link": "https://drive.google.com/..." // Optional
}
```

**Response:**

```json
{
  "success": true,
  "message": "Dues added successfully",
  "data": {
    "created": 2,
    "failed": 0
  }
}
```

### GET /api/operator/dues

List all dues added by operator

**Auth:** Required (Operator role)

**Query Parameters:**

- `status` (optional): "active" | "cleared" | "all"
- `student_roll` (optional): Filter by roll number
- `due_type_id` (optional): Filter by due type
- `limit` (optional): Number
- `offset` (optional): Number

### PUT /api/operator/dues/:dueId

Update due details

**Auth:** Required (Operator role)

**Request Body:** (All fields optional)

```json
{
  "current_amount": 600.0,
  "due_clear_by_date": "2026-04-30",
  "due_description": "Updated description",
  "remarks": "Extension granted"
}
```

### DELETE /api/operator/dues/:dueId

Delete a due (only if not cleared)

**Auth:** Required (Operator role)

---

## HOD Endpoints

### GET /api/hod/department/students

List all students in HOD's department

**Auth:** Required (HOD role)

**Query Parameters:**

- `section` (optional): Filter by section
- `academic_year_id` (optional): Filter by year
- `search` (optional): Search name/roll number
- `limit`, `offset`: Pagination

### GET /api/hod/students/:rollNumber/dues

View specific student's dues

**Auth:** Required (HOD role)

**Response:** Similar to student dues endpoint

### GET /api/hod/reports/department-summary

Get department-wide dues summary

**Auth:** Required (HOD role)

**Response:**

```json
{
  "success": true,
  "data": {
    "total_students": 500,
    "students_with_dues": 120,
    "total_dues_count": 300,
    "total_amount_due": 500000.0,
    "cleared_dues_count": 180,
    "pending_dues_count": 120
  }
}
```

---

## Admin Endpoints

### GET /api/admin/users

List all users

**Auth:** Required (Admin role)

**Query Parameters:**

- `role` (optional): Filter by role
- `search` (optional): Search username/email
- `limit`, `offset`: Pagination

### POST /api/admin/users

Create new user (operator, HOD, etc.)

**Auth:** Required (Admin role)

**Request Body:**

```json
{
  "username": "John Doe",
  "email": "john@vnrvjiet.in",
  "password": "password123",
  "role_id": 3, // 1=admin, 2=hod, 3=operator, 4=student
  "department_id": 1, // Optional
  "section_id": null, // Optional
  "operator_type": "department", // For operators
  "access_level": "all_students" // For operators
}
```

### PUT /api/admin/users/:userId

Update user details

**Auth:** Required (Admin role)

### DELETE /api/admin/users/:userId

Delete user

**Auth:** Required (Admin role)

### POST /api/admin/students/bulk

Bulk upload students via Excel

**Auth:** Required (Admin role)

**Request:** multipart/form-data with Excel file

### POST /api/admin/academic-years

Add academic year

**Auth:** Required (Admin role)

**Request Body:**

```json
{
  "beginningYear": 2025,
  "endingYear": 2026
}
```

### GET /api/admin/departments

List all departments

**Auth:** Required (Admin role)

### POST /api/admin/departments

Add department

**Auth:** Required (Admin role)

**Request Body:**

```json
{
  "name": "Computer Science and Engineering"
}
```

### GET /api/admin/due-types

List all due types

**Auth:** Required (Admin role)

### POST /api/admin/due-types

Add due type

**Auth:** Required (Admin role)

**Request Body:**

```json
{
  "type_name": "Library Fine",
  "description": "Fine for overdue library books",
  "is_for_student": true,
  "requires_permission": false
}
```

---

## Payment Gateway Endpoints

### GET /payment/gateway/:sessionId

Mock payment gateway page

**Auth:** Not required (public page)

**Response:** HTML payment gateway interface

### POST /payment/process/:sessionId

Process payment (mock)

**Auth:** Not required

**Request Body:**

```json
{
  "action": "success" | "fail"
}
```

---

## Error Codes

| Code | Meaning                              |
| ---- | ------------------------------------ |
| 200  | Success                              |
| 201  | Created                              |
| 400  | Bad Request - Invalid input          |
| 401  | Unauthorized - Missing/invalid token |
| 403  | Forbidden - Insufficient permissions |
| 404  | Not Found                            |
| 409  | Conflict - Duplicate entry           |
| 429  | Too Many Requests - Rate limited     |
| 500  | Internal Server Error                |

---

## Rate Limiting

- 500 requests per second per IP
- 100 tokens refilled per second
- Bot protection enabled
- Search engine bots allowed

---

## Security Features

- JWT authentication with 7-day expiry
- Bcrypt password hashing
- SQL injection prevention via parameterized queries
- XSS protection via Helmet
- CORS configured
- Rate limiting via Arcjet
- Role-based access control
- Input validation on all endpoints

---

## Development vs Production

### Development

- Detailed error messages with stack traces
- Console logging enabled
- CORS allows localhost

### Production

- Generic error messages
- Structured JSON logging
- CORS restricted to production domain
- SSL/HTTPS required
- Enhanced security headers
