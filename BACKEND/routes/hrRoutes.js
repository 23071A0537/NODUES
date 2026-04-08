import express from "express";
import {
    addFacultyDue,
    bulkAddFacultyDues,
    checkFacultyDues,
    clearFacultyDue,
    getActiveFacultyDues,
    getClearedFacultyDues,
    getDashboardStats,
    getDueTypes,
    getFacultyList,
} from "../controllers/hrController.js";
import { authenticateRole, authenticateToken } from "../middleware/auth.js";

const route = express.Router();

// All HR routes require authentication and 'hr' role
route.use(authenticateToken);
route.use(authenticateRole(["hr"]));

// Dashboard
route.get("/dashboard/stats", getDashboardStats);

// Faculty lookup
route.get("/faculty", getFacultyList);

// Due types
route.get("/due-types", getDueTypes);

// Faculty dues management
route.post("/dues", addFacultyDue);
route.post("/dues/bulk", bulkAddFacultyDues);
route.get("/dues/active", getActiveFacultyDues);
route.get("/dues/cleared", getClearedFacultyDues);
route.put("/dues/:id/clear", clearFacultyDue);

// Check dues by employee code
route.get("/check/:employeeCode", checkFacultyDues);

export default route;
