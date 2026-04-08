import express from "express";
import * as facultyController from "../controllers/facultyController.js";
import { authenticateFacultyDues, authenticateRole, authenticateToken } from "../middleware/auth.js";

const route = express.Router();

// Apply token auth to all routes
route.use(authenticateToken);

// ── Legacy route: operator/faculty-member accessing own dues ──────────────────
// (authenticateFacultyDues allows any user whose email is in the faculty table)
route.get("/dues/legacy", authenticateFacultyDues, facultyController.getFacultyDues);

// ── Self-service routes: only 'faculty' role (employee_code login) ────────────
route.use(authenticateRole(["faculty"]));

route.get("/dashboard/stats",       facultyController.getDashboardStats);
route.get("/dues",                  facultyController.getMyActiveDues);
route.get("/dues/cleared",          facultyController.getClearedDues);
route.get("/pending-uploads",       facultyController.getPendingUploads);
route.post("/dues/:id/upload-document", facultyController.uploadDocument);

export default route;
