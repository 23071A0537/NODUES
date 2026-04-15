/**
 * Session Timeout Middleware
 * Tracks user activity and enforces session timeout after 3 minutes of inactivity
 */

import { getTokenClearCookieOptions } from '../utils/authCookie.js';

const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds

// In-memory store for session activity (in production, use Redis or database)
const sessionActivity = new Map();

/**
 * Track user activity and update last activity timestamp
 */
export const trackActivity = (req, res, next) => {
  if (req.user && req.user.user_id) {
    const sessionKey = `${req.user.user_id}_${req.user.role}`;
    sessionActivity.set(sessionKey, Date.now());
  }
  next();
};

/**
 * Check if session has expired due to inactivity
 */
export const checkSessionTimeout = (req, res, next) => {
  if (!req.user || !req.user.user_id) {
    return next();
  }

  const sessionKey = `${req.user.user_id}_${req.user.role}`;
  const lastActivity = sessionActivity.get(sessionKey);

  if (!lastActivity) {
    // First request - set activity and continue
    sessionActivity.set(sessionKey, Date.now());
    return next();
  }

  const timeSinceActivity = Date.now() - lastActivity;

  if (timeSinceActivity > SESSION_TIMEOUT) {
    // Session expired - clear cookies and session
    res.clearCookie('token', getTokenClearCookieOptions());
    sessionActivity.delete(sessionKey);
    
    return res.status(401).json({
      success: false,
      message: 'Session expired due to inactivity. Please login again.',
      sessionExpired: true
    });
  }

  // Update activity timestamp
  sessionActivity.set(sessionKey, Date.now());
  next();
};

/**
 * Clear session on logout
 */
export const clearSession = (userId, role) => {
  const sessionKey = `${userId}_${role}`;
  sessionActivity.delete(sessionKey);
};

/**
 * Get session info for debugging
 */
export const getSessionInfo = (userId, role) => {
  const sessionKey = `${userId}_${role}`;
  const lastActivity = sessionActivity.get(sessionKey);
  
  if (!lastActivity) {
    return { active: false };
  }

  const timeSinceActivity = Date.now() - lastActivity;
  const remainingTime = SESSION_TIMEOUT - timeSinceActivity;

  return {
    active: true,
    lastActivity: new Date(lastActivity).toISOString(),
    timeSinceActivity: Math.floor(timeSinceActivity / 1000), // in seconds
    remainingTime: Math.floor(remainingTime / 1000), // in seconds
    willExpireAt: new Date(lastActivity + SESSION_TIMEOUT).toISOString()
  };
};
