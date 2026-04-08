/**
 * Activity Tracker
 * Monitors user activity and enforces 30-minute session timeout
 * Automatically refreshes JWT token every 10 minutes while user is active
 */

const ACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds
const CHECK_INTERVAL = 30 * 1000; // Check every 30 seconds
const WARNING_TIME = 60 * 1000; // Show warning 60 seconds before timeout
const REFRESH_INTERVAL = 10 * 60 * 1000; // Refresh token every 10 minutes of activity

let lastActivityTime = Date.now();
let lastRefreshTime = Date.now();
let activityCheckInterval: ReturnType<typeof setInterval> | null = null;
let warningShown = false;
let onTimeout: (() => void) | null = null;
let onWarning: ((secondsRemaining: number) => void) | null = null;

/**
 * Update the last activity time
 */
const updateActivity = () => {
  lastActivityTime = Date.now();
  warningShown = false;
};

/**
 * Events that indicate user activity
 */
const activityEvents = [
  "mousedown",
  "mousemove",
  "keydown",
  "scroll",
  "touchstart",
  "click",
  "focus",
];

/**
 * Throttle function to limit how often we update activity
 */
const throttle = (func: () => void, limit: number) => {
  let inThrottle: boolean;
  return function () {
    if (!inThrottle) {
      func();
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

// Throttled activity update (max once per second)
const throttledUpdateActivity = throttle(updateActivity, 1000);

/**
 * Refresh the server-side JWT token
 */
const refreshServerSession = async () => {
  try {
    const response = await fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "include",
    });
    if (response.ok) {
      lastRefreshTime = Date.now();
    }
  } catch {
    // Silently fail - the next API call will handle auth errors
  }
};

/**
 * Check for inactivity
 */
const checkInactivity = () => {
  const timeSinceActivity = Date.now() - lastActivityTime;
  const remainingTime = ACTIVITY_TIMEOUT - timeSinceActivity;

  // Auto-refresh JWT token if user is active and enough time has passed
  const timeSinceRefresh = Date.now() - lastRefreshTime;
  if (
    timeSinceActivity < ACTIVITY_TIMEOUT &&
    timeSinceRefresh >= REFRESH_INTERVAL
  ) {
    refreshServerSession();
  }

  // Show warning if close to timeout
  if (remainingTime <= WARNING_TIME && remainingTime > 0 && !warningShown) {
    warningShown = true;
    const secondsRemaining = Math.floor(remainingTime / 1000);
    if (onWarning) {
      onWarning(secondsRemaining);
    }
  }

  // Timeout reached
  if (timeSinceActivity >= ACTIVITY_TIMEOUT) {
    if (onTimeout) {
      onTimeout();
    }
    stopTracking();
  }
};

/**
 * Start tracking user activity
 */
export const startActivityTracking = (
  timeoutCallback: () => void,
  warningCallback?: (secondsRemaining: number) => void,
) => {
  // Set callbacks
  onTimeout = timeoutCallback;
  if (warningCallback) {
    onWarning = warningCallback;
  }

  // Reset activity time
  updateActivity();
  lastRefreshTime = Date.now();

  // Add event listeners for all activity events
  activityEvents.forEach((event) => {
    window.addEventListener(event, throttledUpdateActivity, { passive: true });
  });

  // Start checking for inactivity
  if (!activityCheckInterval) {
    activityCheckInterval = setInterval(checkInactivity, CHECK_INTERVAL);
  }
};

/**
 * Stop tracking user activity
 */
export const stopTracking = () => {
  // Remove event listeners
  activityEvents.forEach((event) => {
    window.removeEventListener(event, throttledUpdateActivity);
  });

  // Clear interval
  if (activityCheckInterval) {
    clearInterval(activityCheckInterval);
    activityCheckInterval = null;
  }

  // Reset state
  warningShown = false;
  onTimeout = null;
  onWarning = null;
};

/**
 * Reset activity timer (call this when user performs an action)
 */
export const resetActivityTimer = () => {
  updateActivity();
  warningShown = false;
};

/**
 * Get remaining session time in seconds
 */
export const getRemainingTime = (): number => {
  const timeSinceActivity = Date.now() - lastActivityTime;
  const remainingTime = ACTIVITY_TIMEOUT - timeSinceActivity;
  return Math.max(0, Math.floor(remainingTime / 1000));
};

/**
 * Check if user is currently active (within timeout period)
 */
export const isActive = (): boolean => {
  const timeSinceActivity = Date.now() - lastActivityTime;
  return timeSinceActivity < ACTIVITY_TIMEOUT;
};
