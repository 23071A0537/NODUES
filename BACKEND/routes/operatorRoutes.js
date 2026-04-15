import express from "express";
import { uploadSingleFile } from "../config/multer.js";
import {
    addDue,
    approveDocument,
    bulkUploadDues,
    checkStudentDues,
    clearDue,
    getAcademicYearData,
    getAcademicYearsForOperator,
    getActiveDues,
    getAlumniDuesExportData,
    getClearedDues,
    getDashboardStats,
    getDepartmentStudentsWithDues,
    getDueTypes,
    getMonthlyData,
    getNoDuesFormPdfForStudent,
    getPendingApprovals,
    grantPermission,
    lookupFacultyByEmployeeCode,
    lookupPerson,
    rejectDocument,
    reopenAlumniFormsForStudents,
    uploadPermissionDocument
} from "../controllers/operatorController.js";
import { authenticateRole, authenticateToken } from "../middleware/auth.js";

const route = express.Router();

// Apply authentication middleware to all operator routes
route.use(authenticateToken);
route.use(authenticateRole(['operator']));

// Dashboard routes
route.get("/dashboard/stats", getDashboardStats);
route.get("/dashboard/monthly-data", getMonthlyData);
route.get("/dashboard/academic-year-data", getAcademicYearData);

// Due types
route.get("/due-types", getDueTypes);
route.get("/academic-years", getAcademicYearsForOperator);

// Lookup student/faculty by code
route.get("/lookup-person/:code", lookupPerson);
route.get("/lookup-faculty/:employeeCode", lookupFacultyByEmployeeCode);

// Dues management
route.post("/dues", addDue);
route.get("/dues/alumni/export-data", getAlumniDuesExportData);
route.post("/dues/alumni/reopen-forms", reopenAlumniFormsForStudents);
route.post("/dues/bulk-upload", bulkUploadDues);
route.get("/dues/active", getActiveDues);
route.get("/dues/cleared", getClearedDues);
route.get("/students-with-dues", getDepartmentStudentsWithDues);
route.put("/dues/:id/clear", clearDue);
route.post("/dues/:id/grant-permission", grantPermission);
route.post("/dues/:id/upload-permission-document", uploadSingleFile, uploadPermissionDocument);

// Check student dues (for ACADEMIC section operator)
route.get("/check-student-dues/:rollNumber", checkStudentDues);
route.get(
    "/check-student-dues/:rollNumber/no-dues-form",
    getNoDuesFormPdfForStudent,
);

// Document approval workflow
route.get("/pending-approvals", getPendingApprovals);
route.post("/dues/:dueId/approve", approveDocument);
route.post("/dues/:dueId/reject", rejectDocument);

export default route;
