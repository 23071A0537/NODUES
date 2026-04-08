import jwt from 'jsonwebtoken';
import { sql } from '../config/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export const authenticateToken = (req, res, next) => {
  try {
    // First check for token in cookies
    let token = req.cookies?.token;
    
    // Fallback to Authorization header for backward compatibility
    if (!token) {
      const authHeader = req.headers['authorization'];
      token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    }

    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Access token required' 
      });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
        // Clear cookie if token is invalid
        res.clearCookie('token');
        return res.status(403).json({ 
          success: false, 
          message: 'Invalid or expired token' 
        });
      }

      req.user = user;
      next();
    });
  } catch (error) {
    return res.status(401).json({ 
      success: false, 
      message: 'Authentication failed' 
    });
  }
};

export const authenticateRole = (allowedRoles) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Unauthorized' 
      });
    }

    // Check if user's account is active (only for users table, not students/faculty)
    // Users with active field in token should be checked
    if (req.user.hasOwnProperty('active') && req.user.active === false) {
      return res.status(403).json({ 
        success: false, 
        message: 'Your account has been deactivated. Please contact the administrator.' 
      });
    }

    // Verify active status from database for users (admin, hod, operator, hr)
    if (req.user.role && ['admin', 'hod', 'operator', 'hr'].includes(req.user.role)) {
      try {
        const userCheck = await sql`
          SELECT active 
          FROM users 
          WHERE user_id = ${req.user.user_id}
          LIMIT 1
        `;
        
        if (userCheck.length > 0 && userCheck[0].active === false) {
          return res.status(403).json({ 
            success: false, 
            message: 'Your account has been deactivated. Please contact the administrator.' 
          });
        }
      } catch (error) {
        console.error('Error checking user active status:', error);
        // Continue if error - don't block access
      }
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Insufficient permissions.' 
      });
    }

    next();
  };
};

// Special middleware for faculty dues access
// Allows faculty members to access their dues even if they have operator/hod roles
export const authenticateFacultyDues = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Unauthorized' 
      });
    }

    const email = req.user.email;

    // Check if user exists in faculty table
    const facultyCheck = await sql`
      SELECT faculty_id, email, name
      FROM faculty
      WHERE email = ${email}
      LIMIT 1
    `;

    if (facultyCheck.length === 0) {
      return res.status(403).json({ 
        success: false, 
        message: 'Faculty account not found. Only faculty members can access faculty dues.' 
      });
    }

    // Add faculty info to request
    req.faculty = facultyCheck[0];
    next();
  } catch (error) {
    console.error('Error checking faculty access:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error verifying faculty access' 
    });
  }
};
