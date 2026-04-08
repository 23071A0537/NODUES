/**
 * Session Manager Component
 * Handles session timeout and activity tracking across the application
 */

import { useEffect } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import {
  resetActivityTimer,
  startActivityTracking,
  stopTracking,
} from "../utils/activityTracker";
import { logout } from "../utils/api";

interface SessionManagerProps {
  children: React.ReactNode;
}

export const SessionManager: React.FC<SessionManagerProps> = ({ children }) => {
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is logged in
    const user = localStorage.getItem("user");
    if (!user) {
      // Not logged in, don't track activity
      return;
    }

    // Handle session timeout
    const handleTimeout = async () => {
      toast.error("Session expired due to inactivity");
      await logout();
    };

    // Handle warning (30 seconds before timeout)
    const handleWarning = (seconds: number) => {
      // Show toast warning
      toast(
        (t) => (
          <div className="flex flex-col gap-2">
            <p className="font-semibold">Session expiring soon!</p>
            <p className="text-sm">
              Your session will expire in {seconds} seconds due to inactivity.
            </p>
            <button
              onClick={() => {
                resetActivityTimer();
                toast.dismiss(t.id);
                toast.success("Session extended!");
              }}
              className="bg-blue-600 text-white px-4 py-1 rounded text-sm hover:bg-blue-700"
            >
              Stay Logged In
            </button>
          </div>
        ),
        {
          duration: seconds * 1000,
          icon: "⏰",
        },
      );
    };

    // Start tracking activity
    startActivityTracking(handleTimeout, handleWarning);

    // Cleanup on unmount
    return () => {
      stopTracking();
    };
  }, [navigate]);

  return <>{children}</>;
};

export default SessionManager;
