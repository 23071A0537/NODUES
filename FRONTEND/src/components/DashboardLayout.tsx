import { Menu, X } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "./Header";
import Sidebar from "./Sidebar";
import UserProfileDropdown from "./UserProfileDropdown";

interface DashboardLayoutProps {
  children: ReactNode;
  role: "admin" | "operator" | "hod" | "student" | "hr" | "faculty";
  username: string;
  email: string;
  sectionName?: string;
}

const DashboardLayout = ({
  children,
  role,
  username,
  email,
  sectionName,
}: DashboardLayoutProps) => {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include" as RequestCredentials,
      });
    } catch {
      // Continue with client-side cleanup even if server call fails
    }
    // Clear any stored authentication tokens
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    // Navigate to login page
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-base-200 text-base-content institutional-backdrop">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <div className="fixed inset-x-0 top-0 z-[70]">
        <Header />
      </div>

      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed left-3 top-[4.35rem] z-[75] inline-flex h-10 w-10 items-center justify-center rounded-xl border border-base-300 bg-base-100 shadow lg:hidden"
        aria-expanded={sidebarOpen}
        aria-controls="dashboard-sidebar"
        aria-label="Toggle menu"
      >
        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      <div className="fixed right-3 top-[4.35rem] z-[75] sm:right-5">
        <UserProfileDropdown username={username} email={email} role={role} />
      </div>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-[64] bg-black/45 backdrop-blur-[2px] lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div
        id="dashboard-sidebar"
        className={`fixed bottom-0 left-0 top-16 z-[68] w-[17rem] border-r border-base-300 bg-base-100 shadow-lg transition-transform duration-300 ease-out ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        <Sidebar
          role={role}
          onLogout={handleLogout}
          sectionName={sectionName}
          onNavigate={() => setSidebarOpen(false)}
        />
      </div>

      <main
        id="main-content"
        className="relative min-h-[calc(100vh-4rem)] px-3 pb-8 pt-16 sm:px-5 lg:ml-[17rem] lg:px-8"
      >
        <div className="mx-auto max-w-[1400px] official-enter">{children}</div>
      </main>
    </div>
  );
};

export default DashboardLayout;
