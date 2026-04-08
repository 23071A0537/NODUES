import { Navigate } from "react-router-dom";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const userDataStr = localStorage.getItem("user");

  // Check if user is authenticated (token is in httpOnly cookie)
  if (!userDataStr) {
    return <Navigate to="/login" replace />;
  }

  // If specific roles are required, check user's role
  if (allowedRoles && allowedRoles.length > 0) {
    try {
      const userData = JSON.parse(userDataStr);
      const userRole = userData.role;

      if (!allowedRoles.includes(userRole)) {
        // Redirect to their appropriate dashboard
        return <Navigate to={`/${userRole}/dashboard`} replace />;
      }
    } catch (error) {
      console.error("Error parsing user data:", error);
      return <Navigate to="/login" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
