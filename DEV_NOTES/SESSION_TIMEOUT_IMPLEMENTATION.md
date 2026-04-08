# Cookie-Based Authentication with 3-Minute Session Timeout

## Overview

Implemented secure cookie-based authentication with automatic logout after 3 minutes of user inactivity.

## Implementation Summary

### Backend Changes

#### 1. **Installed Dependencies**

```bash
npm install cookie-parser
```

#### 2. **Session Timeout Middleware** (`BACKEND/middleware/sessionTimeout.js`)

- Tracks user activity in memory
- Enforces 3-minute inactivity timeout
- Provides session management functions

**Key Features:**

- `trackActivity` - Updates last activity timestamp
- `checkSessionTimeout` - Validates session hasn't expired
- `clearSession` - Removes session on logout
- `getSessionInfo` - Returns session details for debugging

#### 3. **Updated Auth Controller** (`BACKEND/controllers/authController.js`)

**Changes:**

- JWT token expiration changed from `7d` to `3m` (3 minutes)
- Tokens now sent as **httpOnly cookies** instead of response body
- Added `logoutUser` endpoint to clear cookies
- Added `refreshSession` endpoint to extend sessions
- Cookie settings:
  - `httpOnly: true` - Prevents XSS attacks
  - `secure: production` - HTTPS only in production
  - `sameSite: 'strict'` - CSRF protection
  - `maxAge: 3 minutes`

#### 4. **Updated Auth Middleware** (`BACKEND/middleware/auth.js`)

- Now reads JWT from cookies first
- Falls back to Authorization header for backward compatibility
- Clears invalid cookies automatically

#### 5. **Updated Server Configuration** (`BACKEND/server.js`)

```javascript
import cookieParser from "cookie-parser";

app.use(cookieParser());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true, // Allow cookies
  }),
);
```

#### 6. **Updated Auth Routes** (`BACKEND/routes/authRoutes.js`)

```javascript
router.post("/login", loginUser);
router.post("/logout", authenticateToken, logoutUser);
router.post(
  "/refresh",
  authenticateToken,
  checkSessionTimeout,
  trackActivity,
  refreshSession,
);
router.put(
  "/change-password",
  authenticateToken,
  checkSessionTimeout,
  trackActivity,
  changePassword,
);
```

#### 7. **Environment Variables** (`.env`)

```env
FRONTEND_URL=http://localhost:5173
```

### Frontend Changes

#### 1. **Activity Tracker** (`FRONTEND/src/utils/activityTracker.ts`)

Monitors user interactions to detect inactivity:

- Tracks: mousedown, mousemove, keydown, scroll, touchstart, click, focus
- Shows warning 30 seconds before timeout
- Automatically logs out after 3 minutes of inactivity
- Throttles updates to once per second

**Key Functions:**

- `startActivityTracking()` - Begin monitoring
- `stopTracking()` - Stop monitoring
- `resetActivityTimer()` - Extend session
- `getRemainingTime()` - Get seconds until timeout
- `isActive()` - Check if session is active

#### 2. **Updated API Utilities** (`FRONTEND/src/utils/api.ts`)

**Changes:**

- Removed localStorage token management
- Added `credentials: 'include'` to all requests
- Updated `logout()` to call backend endpoint
- Added `refreshSession()` function
- Enhanced error handling for session expiration

#### 3. **Session Manager Component** (`FRONTEND/src/components/SessionManager.tsx`)

Wraps the entire application to:

- Start activity tracking on mount
- Show toast warning 30 seconds before timeout
- Provide "Stay Logged In" button to extend session
- Automatically logout on timeout
- Clean up on unmount

#### 4. **Updated Login Component** (`FRONTEND/src/pages/Login.tsx`)

**Changes:**

- Removed `localStorage.setItem("token")` (now in cookies)
- Added `credentials: 'include'` to login request
- Only stores user data in localStorage (not token)

#### 5. **Updated App Component** (`FRONTEND/src/App.tsx`)

```tsx
<SessionManager>
  <div className="min-h-screen bg-base-200">
    <Routes>{/* All routes */}</Routes>
  </div>
</SessionManager>
```

## How It Works

### Login Flow

1. User enters credentials
2. Backend validates and creates JWT token
3. Token sent as **httpOnly cookie** (inaccessible to JavaScript)
4. User data stored in localStorage (without token)
5. Frontend starts activity tracking
6. User redirected to dashboard

### Activity Monitoring

1. SessionManager starts tracking on mount
2. All user interactions reset the activity timer
3. After 2.5 minutes of inactivity → Warning toast appears
4. User can click "Stay Logged In" to extend session
5. After 3 minutes of inactivity → Automatic logout

### Session Expiration

1. Frontend detects session will expire soon
2. Shows warning toast with countdown
3. User can extend session by:
   - Moving mouse
   - Clicking anywhere
   - Typing
   - Clicking "Stay Logged In" button
4. If no activity → logout and redirect to login

### API Request Flow

1. Every API request includes cookie automatically
2. Backend middleware checks:
   - Is token valid?
   - Has session expired?
   - Is user active?
3. If session expired → 401 response with `sessionExpired: true`
4. Frontend redirects to login

## Security Benefits

1. **XSS Protection**: httpOnly cookies can't be accessed by JavaScript
2. **CSRF Protection**: sameSite='strict' prevents cross-site requests
3. **Inactivity Timeout**: Auto-logout reduces unauthorized access risk
4. **Secure Transport**: HTTPS-only cookies in production
5. **Token Rotation**: Short-lived tokens (3 minutes)

## Testing

### Test Session Timeout

1. Login to the application
2. Don't interact with the page for 2.5 minutes
3. You should see a warning toast
4. Click "Stay Logged In" to extend session
5. OR wait 30 more seconds → automatic logout

### Test Activity Tracking

1. Login to the application
2. Move mouse, click, or type periodically
3. Session should remain active indefinitely
4. Check browser Network tab → no expired session errors

### Test Logout

1. Login to the application
2. Click logout button
3. Cookie should be cleared
4. Attempting to access protected routes → redirect to login

## API Endpoints

### POST /api/auth/login

**Request:**

```json
{
  "email": "user@example.com",
  "password": "password123",
  "loginType": "teacher"
}
```

**Response:**

- Sets `token` cookie (httpOnly, 3min expiration)
- Returns user data (without token)

### POST /api/auth/logout

**Headers:**

- Cookie: token=xyz...

**Response:**

- Clears `token` cookie
- Clears session from memory

### POST /api/auth/refresh

**Headers:**

- Cookie: token=xyz...

**Response:**

- Issues new `token` cookie (3min expiration)
- Resets activity timer

## Troubleshooting

### Issue: Session expires immediately

**Solution:** Check that CORS is configured with `credentials: true`

### Issue: Cookie not being sent

**Solution:** Ensure `credentials: 'include'` in all fetch requests

### Issue: Warning doesn't appear

**Solution:** Check SessionManager is wrapping the app in App.tsx

### Issue: Activity tracking not working

**Solution:** Ensure user is logged in (check localStorage for 'user')

## Configuration

### Adjust Timeout Duration

In `BACKEND/middleware/sessionTimeout.js`:

```javascript
const SESSION_TIMEOUT = 3 * 60 * 1000; // Change 3 to desired minutes
```

In `BACKEND/controllers/authController.js`:

```javascript
const JWT_EXPIRES_IN = "3m"; // Change to match session timeout
const COOKIE_MAX_AGE = 3 * 60 * 1000; // Change to match session timeout
```

In `FRONTEND/src/utils/activityTracker.ts`:

```javascript
const ACTIVITY_TIMEOUT = 3 * 60 * 1000; // Change to match backend
```

### Adjust Warning Time

In `FRONTEND/src/utils/activityTracker.ts`:

```javascript
const WARNING_TIME = 30 * 1000; // Show warning 30 seconds before timeout
```

## Production Deployment

1. Set `NODE_ENV=production` in backend
2. Ensure HTTPS is enabled
3. Update `FRONTEND_URL` in .env to production URL
4. Build frontend with production environment variables
5. Test cookie functionality in production environment

## Monitoring

Check session activity:

```javascript
import { getSessionInfo } from "./middleware/sessionTimeout.js";

const info = getSessionInfo(userId, role);
console.log(info);
// {
//   active: true,
//   lastActivity: "2026-02-24T10:00:00.000Z",
//   timeSinceActivity: 45, // seconds
//   remainingTime: 135, // seconds
//   willExpireAt: "2026-02-24T10:03:00.000Z"
// }
```

## Migration Notes

**For Existing Users:**
Users will need to **re-login** after deployment because:

1. Old tokens in localStorage won't have cookies
2. New system uses httpOnly cookies
3. Tokens expire in 3 minutes instead of 7 days

**Backward Compatibility:**
The auth middleware still accepts Authorization header tokens for a transition period. Remove this fallback after all users have migrated.

## Files Modified

### Backend

- ✅ `BACKEND/package.json` - Added cookie-parser
- ✅ `BACKEND/middleware/sessionTimeout.js` - NEW
- ✅ `BACKEND/middleware/auth.js` - Updated
- ✅ `BACKEND/controllers/authController.js` - Updated
- ✅ `BACKEND/routes/authRoutes.js` - Updated
- ✅ `BACKEND/server.js` - Updated
- ✅ `.env` - Added FRONTEND_URL

### Frontend

- ✅ `FRONTEND/src/utils/activityTracker.ts` - NEW
- ✅ `FRONTEND/src/utils/api.ts` - Updated
- ✅ `FRONTEND/src/components/SessionManager.tsx` - NEW
- ✅ `FRONTEND/src/pages/Login.tsx` - Updated
- ✅ `FRONTEND/src/App.tsx` - Updated

## Next Steps

1. ✅ Test login flow
2. ✅ Test session timeout
3. ✅ Test activity tracking
4. ✅ Test logout
5. ✅ Deploy to production
6. ✅ Monitor for issues
