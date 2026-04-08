import express from "express";
import {
    addAcademicYear,
    addDepartment,
    addFacultyUsers,
    addSection,
    addStudentUsers,
    addUser,
    assignFacultyRole,
    changeFacultyPassword,
    changeStudentPassword,
    changeUserPassword,
    deleteAcademicYear,
    deleteDepartment,
    deleteSection,
    deleteUser,
    getAcademicYearData,
    getAcademicYears,
    getAllFaculties,
    getAllStudents,
    getAllUsers,
    getDashboardStats,
    getDepartmentAnalytics,
    getDepartmentDues,
    getDepartments,
    getFacultyDuesByDepartment,
    getMonthlyData,
    getOverallStats,
    getSections,
    getStudentVsFacultyDues,
    toggleFacultyActiveStatus,
    toggleStudentActiveStatus,
    toggleUserActiveStatus,
    updateFaculty,
    updateStudent,
    updateUser
} from "../controllers/adminController.js";
import { authenticateRole, authenticateToken } from "../middleware/auth.js";

const route = express.Router();

// Apply authentication middleware to all admin routes
route.use(authenticateToken);
route.use(authenticateRole(['admin']));

// Academic Year routes
route.post("/academic-years", addAcademicYear);
route.get("/academic-years", getAcademicYears);
route.delete("/academic-years/:id", deleteAcademicYear);

// Department/Section routes
route.post("/departments", addDepartment);
route.post("/sections", addSection);
route.get("/departments", getDepartments);
route.get("/sections", getSections);
route.delete("/departments/:id", deleteDepartment);
route.delete("/sections/:id", deleteSection);

// Dashboard routes
route.get("/dashboard/stats", getDashboardStats);
route.get("/dashboard/department-dues", getDepartmentDues);
route.get("/dashboard/department-analytics", getDepartmentAnalytics);
route.get("/dashboard/overall-stats", getOverallStats);
route.get("/dashboard/monthly-data", getMonthlyData);
route.get("/dashboard/academic-year-data", getAcademicYearData);
route.get("/dashboard/faculty-dues-by-department", getFacultyDuesByDepartment);
route.get("/dashboard/student-vs-faculty-dues", getStudentVsFacultyDues);

// User routes
route.post("/users", addUser);
route.get("/users", getAllUsers);
route.put("/users/:id", updateUser);
route.put("/users/:id/password", changeUserPassword);
route.put("/users/:userId/toggle-active", toggleUserActiveStatus);
route.delete("/users/:id", deleteUser);

// Student routes
route.post("/students", addStudentUsers);
route.post("/students/bulk-upload", addStudentUsers);
route.get("/students", getAllStudents);
route.put("/students/:id", updateStudent);
route.put("/students/:id/password", changeStudentPassword);
route.put("/students/:id/toggle-active", toggleStudentActiveStatus);

// Faculty routes
route.post("/faculty", addFacultyUsers);
route.post("/faculty/bulk-upload", addFacultyUsers);
route.get("/faculty", getAllFaculties);
route.put("/faculty/:id", updateFaculty);
route.put("/faculty/:id/password", changeFacultyPassword);
route.put("/faculty/:id/toggle-active", toggleFacultyActiveStatus);
route.put("/faculty/:id/role", assignFacultyRole);

export default route;