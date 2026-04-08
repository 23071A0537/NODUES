# No-Dues Management System

A comprehensive web-based system for managing student dues, payments, and clearances for educational institutions.

## 🚀 Features

### For Students

- 📊 View all pending dues (payable and non-payable)
- 💳 Pay dues online with mock payment gateway
- 📜 Download due forms and payment receipts (PDF)
- 📅 Track payment history
- 🔔 View due dates and overdue alerts
- 📱 Mobile-responsive interface
- 🌓 Light/Dark theme support

### For Operators (Department/Section)

- ➕ Add dues for students in bulk or individually
- 📊 Dashboard with statistics
- 👥 Manage students under control
- 📝 Update and delete dues
- 📋 View pending approvals
- 📊 Export data to Excel

### For HOD (Head of Department)

- 👀 View all students in department
- 📊 Department-wide reports and analytics
- 📈 Track dues clearance status
- 📥 Export department reports

### For Admin

- 👥 Manage users (operators, HODs, students, faculty)
- 🏢 Manage departments, sections, academic years
- 📋 Manage due types
- 📊 System-wide analytics
- 📥 Bulk import students/faculty via Excel

## 🛠️ Tech Stack

### Frontend

- **Framework:** React 18 + TypeScript
- **Build Tool:** Vite
- **Styling:** Tailwind CSS + DaisyUI
- **State Management:** Zustand
- **Routing:** React Router DOM
- **Icons:** Heroicons

### Backend

- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** PostgreSQL (Neon)
- **Authentication:** JWT (jsonwebtoken)
- **Password Hashing:** Bcrypt
- **Security:** Helmet, CORS, Arcjet (rate limiting, bot protection)
- **PDF Generation:** PDFKit
- **Excel Processing:** XLSX

## 📋 Prerequisites

- Node.js (v18 or higher)
- PostgreSQL database (or Neon serverless Postgres)
- npm or yarn

## 🔧 Installation

### 1. Clone the repository

```bash
git clone <repository-url>
cd NODUES_FINAL
```

### 2. Backend Setup

```bash
cd BACKEND

# Install dependencies
npm install

# Create .env file (copy from .env.example)
cp .env.example .env

# Edit .env with your configuration
nano .env
```

**Required Environment Variables:**

```env
DATABASE_URL=postgresql://username:password@host:port/database
JWT_SECRET=your-secret-key-min-32-characters
PORT=3000
NODE_ENV=development
ARCJET_KEY=your-arcjet-key  # Optional
```

### 3. Database Setup

Run the database schema:

```bash
# Option 1: Using provided SQL file
psql -U username -d database -f DEV_NOTES/DatabaseSchema.txt

# Option 2: Using migrations
node runAllMigrations.js
```

Seed initial data:

```bash
# Add admin user
node seeds/addAdminUser.js

# Add operator (example)
node seeds/addCseOperator.js
```

### 4. Frontend Setup

```bash
cd FRONTEND

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Edit .env with backend URL
echo "VITE_API_URL=http://localhost:3000" > .env
```

## 🚀 Running the Application

### Development Mode

**Backend:**

```bash
cd BACKEND
npm start
# Server runs on http://localhost:3000
```

**Frontend:**

```bash
cd FRONTEND
npm run dev
# App runs on http://localhost:5173
```

### Production Build

**Backend:**

```bash
cd BACKEND
npm run build  # If using TypeScript
npm start
```

**Frontend:**

```bash
cd FRONTEND
npm run build
# Build output in dist/ folder
# Serve with your preferred static server
```

## 📚 Project Structure

```
NODUES_FINAL/
├── BACKEND/
│   ├── config/
│   │   └── db.js              # Database configuration
│   ├── controllers/           # Route controllers
│   │   ├── authController.js
│   │   ├── studentController.js
│   │   ├── operatorController.js
│   │   ├── hodController.js
│   │   ├── adminController.js
│   │   └── paymentController.js
│   ├── middleware/
│   │   └── auth.js            # Authentication middleware
│   ├── routes/                # API routes
│   ├── utils/                 # Utility functions ✨ NEW
│   │   ├── validation.js      # Input validation
│   │   ├── errorHandler.js    # Error handling & logging
│   │   └── database.js        # Database helpers
│   ├── migrations/            # Database migrations
│   ├── seeds/                 # Database seeders
│   ├── lib/
│   │   └── arcjet.js          # Security configuration
│   ├── .env.example           # Environment template ✨ NEW
│   ├── package.json
│   └── server.js              # Entry point
│
├── FRONTEND/
│   ├── src/
│   │   ├── components/        # Reusable components
│   │   │   ├── DashboardLayout.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   ├── ThemeSelector.tsx
│   │   │   └── student/       # Student-specific components
│   │   ├── pages/             # Page components
│   │   │   ├── student/
│   │   │   ├── operator/
│   │   │   ├── hod/
│   │   │   ├── admin/
│   │   │   └── Login.tsx
│   │   ├── store/             # Zustand stores
│   │   │   ├── useStudentDuesStore.ts
│   │   │   └── useThemeStore.ts
│   │   ├── utils/             # Utility functions ✨ NEW
│   │   │   └── api.ts         # API helpers
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
│
├── DEV_NOTES/                 # Documentation
│   ├── API_DOCUMENTATION.md
│   ├── DatabaseSchema.txt
│   ├── Database_Migration_Guide.md
│   └── ...
│
└── API_DOCUMENTATION.md       # Complete API docs ✨ NEW
```

## 🔐 Default Credentials

After running seeders:

**Admin:**

- Email: `admin_1@vnrvjiet.in`
- Password: `admin123`

**Operator (CSE):**

- Email: `cse_operator@vnrvjiet.in`
- Password: `cse123`

**⚠️ Change these immediately in production!**

## 📖 API Documentation

See [API_DOCUMENTATION.md](API_DOCUMENTATION.md) for complete API reference.

Base URL: `http://localhost:3000`

### Authentication

All protected endpoints require JWT token:

```
Authorization: Bearer <token>
```

### Example API Calls

**Login:**

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "loginType": "student",
    "rollNumber": "21R11A0501",
    "password": "student123"
  }'
```

**Get Dues:**

```bash
curl http://localhost:3000/api/student/dues \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 🧪 Testing

### Verify Database Setup

```bash
cd BACKEND
node verifyMigration.js
```

### Check Operator Access

```bash
node verifyOperator.js
```

### Test Authentication

```bash
node testAuth.js
```

## 🛡️ Security Features

- ✅ JWT-based authentication with 7-day expiry
- ✅ Bcrypt password hashing (salt rounds: 10)
- ✅ SQL injection prevention (parameterized queries)
- ✅ XSS protection (Helmet middleware)
- ✅ CORS configured
- ✅ Rate limiting (500 req/sec via Arcjet)
- ✅ Bot protection
- ✅ Role-based access control
- ✅ Input validation on all endpoints
- ✅ Secure payment session handling

## 📊 Database Schema

Key tables:

- `students` - Student records
- `users` - Staff (admin, HOD, operators)
- `faculty` - Faculty records
- `student_dues` - Dues tracking
- `due_payments` - Payment records
- `due_types` - Types of dues
- `departments`, `sections`, `academic_year` - Reference data

See [DEV_NOTES/DatabaseSchema.txt](DEV_NOTES/DatabaseSchema.txt) for complete schema.

## 🐛 Troubleshooting

### Database Connection Error

- Check `DATABASE_URL` in `.env`
- Verify PostgreSQL is running
- Check firewall/network settings

### JWT Token Errors

- Ensure `JWT_SECRET` is set in `.env`
- Check token expiry (7 days)
- Verify Authorization header format

### CORS Errors

- Check backend CORS configuration
- Verify frontend URL matches allowed origin
- Check for HTTPS/HTTP mismatch

### Payment Gateway Issues

- This is a mock gateway for testing
- Real integration requires payment provider credentials

## 🚀 Deployment

### Backend Deployment (e.g., Railway, Render)

1. Set environment variables
2. Run migrations: `node runAllMigrations.js`
3. Start server: `npm start`
4. Ensure PostgreSQL connection is configured

### Frontend Deployment (e.g., Vercel, Netlify)

1. Set `VITE_API_URL` to production backend URL
2. Build: `npm run build`
3. Deploy `dist/` folder

## 📝 License

This project is for educational purposes.

## 👥 Contributors

- Development Team
- VNR VJIET

## 📞 Support

For issues or questions, please create an issue in the repository.

## 🔄 Recent Updates

### ✨ New Features Added

- ✅ Comprehensive input validation utilities
- ✅ Centralized error handling and logging
- ✅ Database transaction wrapper
- ✅ API helper utilities for frontend
- ✅ Complete API documentation
- ✅ Environment configuration template
- ✅ Theme switching (light/dark mode)
- ✅ Mobile responsive design
- ✅ Payment history tracking
- ✅ PDF generation for receipts and forms

### 🐛 Bug Fixes

- ✅ Theme switching on student pages
- ✅ Mobile layout improvements
- ✅ CSP configuration for inline scripts
- ✅ Dashboard stats calculation

---

**Made with ❤️ for efficient dues management**
