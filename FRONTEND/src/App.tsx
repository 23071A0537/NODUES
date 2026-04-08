import { Toaster } from "react-hot-toast";
import { Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import SessionManager from "./components/SessionManager";
import ChangePassword from "./pages/ChangePassword";
import Login from "./pages/Login";

// Admin Pages
import AddAcademicYear from "./pages/admin/AddAcademicYear";
import AddDepartmentSection from "./pages/admin/AddDepartmentSection";
import AddFaculty from "./pages/admin/AddFaculty";
import AddStudents from "./pages/admin/AddStudents";
import AddUser from "./pages/admin/AddUser";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminReports from "./pages/admin/Reports";

// HOD Pages
import HODDashboard from "./pages/hod/Dashboard";
import StudentsWithDues from "./pages/hod/StudentsWithDues";
import WholeReport from "./pages/hod/WholeReport";

// Operator Pages
import ActiveDues from "./pages/operator/ActiveDues";
import AddDue from "./pages/operator/AddDue";
import CheckDue from "./pages/operator/CheckDue";
import ClearedDues from "./pages/operator/ClearedDues";
import OperatorDashboard from "./pages/operator/Dashboard";
import FacultyDues from "./pages/operator/FacultyDues";
import PendingApprovals from "./pages/operator/PendingApprovals";
import OperatorReports from "./pages/operator/Reports";
import SmsDashboard from "./pages/operator/SmsDashboard";

// Student Pages
import StudentClearedDues from "./pages/student/ClearedDues";
import StudentDashboard from "./pages/student/Dashboard";
import Dues from "./pages/student/Dues";
import PaymentPage from "./pages/student/PaymentPage";
import UploadDocument from "./pages/student/UploadDocument";

// HR Pages
import ActiveFacultyDues from "./pages/hr/ActiveFacultyDues";
import AddFacultyDue from "./pages/hr/AddFacultyDue";
import CheckFacultyDue from "./pages/hr/CheckFacultyDue";
import ClearedFacultyDues from "./pages/hr/ClearedFacultyDues";
import HRDashboard from "./pages/hr/Dashboard";

// Faculty Self-Service Pages
import FacultyDashboard from "./pages/faculty/Dashboard";
import FacultySelfDues from "./pages/faculty/Dues";
import FacultyUploadDocument from "./pages/faculty/UploadDocument";

function App() {
  return (
    <SessionManager>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route
          path="/change-password"
          element={
            <ProtectedRoute>
              <ChangePassword />
            </ProtectedRoute>
          }
        />

        {/* Admin Routes */}
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/reports"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <AdminReports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/add-academic-year"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <AddAcademicYear />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/add-department-section"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <AddDepartmentSection />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/add-department"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <AddDepartmentSection />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/add-faculty"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <AddFaculty />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/add-students"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <AddStudents />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/add-user"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <AddUser />
            </ProtectedRoute>
          }
        />

        {/* HOD Routes */}
        <Route
          path="/hod/dashboard"
          element={
            <ProtectedRoute allowedRoles={["hod"]}>
              <HODDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hod/students-with-dues"
          element={
            <ProtectedRoute allowedRoles={["hod"]}>
              <StudentsWithDues />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hod/whole-report"
          element={
            <ProtectedRoute allowedRoles={["hod"]}>
              <WholeReport />
            </ProtectedRoute>
          }
        />

        {/* Operator Routes */}
        <Route
          path="/operator/dashboard"
          element={
            <ProtectedRoute allowedRoles={["operator"]}>
              <OperatorDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/operator/reports"
          element={
            <ProtectedRoute allowedRoles={["operator"]}>
              <OperatorReports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/operator/active-dues"
          element={
            <ProtectedRoute allowedRoles={["operator"]}>
              <ActiveDues />
            </ProtectedRoute>
          }
        />
        <Route
          path="/operator/add-due"
          element={
            <ProtectedRoute allowedRoles={["operator"]}>
              <AddDue />
            </ProtectedRoute>
          }
        />
        <Route
          path="/operator/check-due"
          element={
            <ProtectedRoute allowedRoles={["operator"]}>
              <CheckDue />
            </ProtectedRoute>
          }
        />
        <Route
          path="/operator/cleared-dues"
          element={
            <ProtectedRoute allowedRoles={["operator"]}>
              <ClearedDues />
            </ProtectedRoute>
          }
        />
        <Route
          path="/operator/faculty-dues"
          element={
            <ProtectedRoute allowedRoles={["operator"]}>
              <FacultyDues />
            </ProtectedRoute>
          }
        />
        <Route
          path="/operator/pending-approvals"
          element={
            <ProtectedRoute allowedRoles={["operator"]}>
              <PendingApprovals />
            </ProtectedRoute>
          }
        />
        <Route
          path="/operator/sms-dashboard"
          element={
            <ProtectedRoute allowedRoles={["operator"]}>
              <SmsDashboard />
            </ProtectedRoute>
          }
        />

        {/* Student Routes */}
        <Route
          path="/student/dashboard"
          element={
            <ProtectedRoute allowedRoles={["student"]}>
              <StudentDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/student/dues"
          element={
            <ProtectedRoute allowedRoles={["student"]}>
              <Dues />
            </ProtectedRoute>
          }
        />
        <Route
          path="/student/cleared-dues"
          element={
            <ProtectedRoute allowedRoles={["student"]}>
              <StudentClearedDues />
            </ProtectedRoute>
          }
        />
        <Route
          path="/student/payment"
          element={
            <ProtectedRoute allowedRoles={["student"]}>
              <PaymentPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/student/upload-document"
          element={
            <ProtectedRoute allowedRoles={["student"]}>
              <UploadDocument />
            </ProtectedRoute>
          }
        />

        {/* Role-specific Change Password Routes */}
        <Route
          path="/admin/change-password"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <ChangePassword />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hod/change-password"
          element={
            <ProtectedRoute allowedRoles={["hod"]}>
              <ChangePassword />
            </ProtectedRoute>
          }
        />
        <Route
          path="/operator/change-password"
          element={
            <ProtectedRoute allowedRoles={["operator"]}>
              <ChangePassword />
            </ProtectedRoute>
          }
        />
        <Route
          path="/student/change-password"
          element={
            <ProtectedRoute allowedRoles={["student"]}>
              <ChangePassword />
            </ProtectedRoute>
          }
        />

        {/* HR Routes */}
        <Route
          path="/hr/dashboard"
          element={
            <ProtectedRoute allowedRoles={["hr"]}>
              <HRDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hr/add-faculty-due"
          element={
            <ProtectedRoute allowedRoles={["hr"]}>
              <AddFacultyDue />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hr/active-dues"
          element={
            <ProtectedRoute allowedRoles={["hr"]}>
              <ActiveFacultyDues />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hr/cleared-dues"
          element={
            <ProtectedRoute allowedRoles={["hr"]}>
              <ClearedFacultyDues />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hr/check-due"
          element={
            <ProtectedRoute allowedRoles={["hr"]}>
              <CheckFacultyDue />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hr/change-password"
          element={
            <ProtectedRoute allowedRoles={["hr"]}>
              <ChangePassword />
            </ProtectedRoute>
          }
        />

        {/* Faculty Self-Service Routes */}
        <Route
          path="/faculty/dashboard"
          element={
            <ProtectedRoute allowedRoles={["faculty"]}>
              <FacultyDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/faculty/dues"
          element={
            <ProtectedRoute allowedRoles={["faculty"]}>
              <FacultySelfDues />
            </ProtectedRoute>
          }
        />
        <Route
          path="/faculty/upload-documents"
          element={
            <ProtectedRoute allowedRoles={["faculty"]}>
              <FacultyUploadDocument />
            </ProtectedRoute>
          }
        />
        <Route
          path="/faculty/cleared-dues"
          element={
            <ProtectedRoute allowedRoles={["faculty"]}>
              <FacultySelfDues />
            </ProtectedRoute>
          }
        />
        <Route
          path="/faculty/change-password"
          element={
            <ProtectedRoute allowedRoles={["faculty"]}>
              <ChangePassword />
            </ProtectedRoute>
          }
        />
      </Routes>
    </SessionManager>
  );
}

export default App;
