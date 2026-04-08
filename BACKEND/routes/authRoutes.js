import express from "express";
import { changePassword, loginUser, logoutUser, refreshSession } from "../controllers/authController.js";
import { authenticateToken } from "../middleware/auth.js";
import { checkSessionTimeout, trackActivity } from "../middleware/sessionTimeout.js";

const router = express.Router();

// Public routes
router.post("/login", loginUser);

// Protected routes with session timeout checking
router.put("/change-password", authenticateToken, checkSessionTimeout, trackActivity, changePassword);
router.post("/logout", authenticateToken, logoutUser);
router.post("/refresh", authenticateToken, checkSessionTimeout, trackActivity, refreshSession);

export default router;