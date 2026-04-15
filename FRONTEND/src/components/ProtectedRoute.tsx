import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [redirectPath, setRedirectPath] = useState("/login");
  const [isAuthorized, setIsAuthorized] = useState(false);
  const allowedRolesKey = (allowedRoles || []).join("|");

  useEffect(() => {
    let isActive = true;

    const verifySession = async () => {
      const userDataStr = localStorage.getItem("user");

      // Check if user is authenticated (token is in httpOnly cookie)
      if (!userDataStr) {
        if (isActive) {
          setRedirectPath("/login");
          setIsAuthorized(false);
          setIsCheckingSession(false);
        }
        return;
      }

      let userData: { role?: string };
      try {
        userData = JSON.parse(userDataStr);
      } catch (error) {
        console.error("Error parsing user data:", error);
        localStorage.removeItem("user");
        if (isActive) {
          setRedirectPath("/login");
          setIsAuthorized(false);
          setIsCheckingSession(false);
        }
        return;
      }

      // If specific roles are required, check user's role
      if (allowedRoles && allowedRoles.length > 0) {
        const userRole = userData.role;
        if (!userRole || !allowedRoles.includes(userRole)) {
          if (isActive) {
            setRedirectPath(userRole ? `/${userRole}/dashboard` : "/login");
            setIsAuthorized(false);
            setIsCheckingSession(false);
          }
          return;
        }
      }

      try {
        const response = await fetch("/api/auth/refresh", {
          method: "POST",
          credentials: "include",
        });

        if (!response.ok) {
          localStorage.removeItem("user");
          if (isActive) {
            setRedirectPath("/login");
            setIsAuthorized(false);
            setIsCheckingSession(false);
          }
          return;
        }

        const data = await response.json().catch(() => null);

        if (!data?.success) {
          localStorage.removeItem("user");
          if (isActive) {
            setRedirectPath("/login");
            setIsAuthorized(false);
            setIsCheckingSession(false);
          }
          return;
        }

        if (isActive) {
          setIsAuthorized(true);
          setIsCheckingSession(false);
        }
      } catch {
        localStorage.removeItem("user");
        if (isActive) {
          setRedirectPath("/login");
          setIsAuthorized(false);
          setIsCheckingSession(false);
        }
      }
    };

    void verifySession();

    return () => {
      isActive = false;
    };
  }, [allowedRolesKey]);

  if (isCheckingSession) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center text-sm text-base-content/65">
        Verifying session...
      </div>
    );
  }

  if (!isAuthorized) {
    return <Navigate to={redirectPath} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
