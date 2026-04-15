import {
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle,
  Clock,
  CreditCard,
  FileText,
  GraduationCap,
  KeyRound,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Search,
  Upload,
  UserPlus,
  Users,
  UsersRound,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";

interface SidebarProps {
  role: "admin" | "operator" | "hod" | "student" | "hr" | "faculty";
  onLogout: () => void;
  sectionName?: string;
  onNavigate?: () => void;
}

const Sidebar = ({ role, onLogout, sectionName, onNavigate }: SidebarProps) => {
  const location = useLocation();

  const adminLinks = [
    { to: "/admin/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/admin/reports", icon: FileText, label: "Reports" },
    { to: "/admin/add-user", icon: UserPlus, label: "Add User" },
    {
      to: "/admin/add-department",
      icon: Building2,
      label: "Add Department/Section",
    },
    {
      to: "/admin/add-academic-year",
      icon: Calendar,
      label: "Add Academic Year",
    },
    { to: "/admin/add-students", icon: GraduationCap, label: "Add Students" },
    { to: "/admin/add-faculty", icon: UsersRound, label: "Add Faculty" },
  ];

  // Check if operator is also faculty (show Faculty Dues link)
  const userDataStr =
    typeof window !== "undefined" ? localStorage.getItem("user") : null;
  let userDataParsed: Record<string, unknown> = {};
  try {
    userDataParsed = userDataStr ? JSON.parse(userDataStr) : {};
  } catch {
    userDataParsed = {};
  }
  const isFaculty = userDataParsed.is_faculty === true;
  const hasDepartmentStudentScope =
    Boolean(userDataParsed.department_id) &&
    userDataParsed.access_level !== "all_faculty";

  const operatorLinks = [
    { to: "/operator/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/operator/reports", icon: FileText, label: "Reports" },
    { to: "/operator/add-due", icon: FileText, label: "Add Due" },
    { to: "/operator/active-dues", icon: AlertCircle, label: "Active Dues" },
    { to: "/operator/cleared-dues", icon: CheckCircle, label: "Cleared Dues" },
    ...(hasDepartmentStudentScope
      ? [
          {
            to: "/operator/students-with-dues",
            icon: Users,
            label: "Students With Dues",
          },
        ]
      : []),
    ...(sectionName?.toUpperCase() === "ACADEMIC"
      ? [{ to: "/operator/check-due", icon: Search, label: "Check Due" }]
      : []),
    ...(isFaculty
      ? [{ to: "/operator/faculty-dues", icon: Users, label: "Faculty Dues" }]
      : []),
    {
      to: "/operator/pending-approvals",
      icon: Clock,
      label: "Pending Approvals",
    },
    {
      to: "/operator/sms-dashboard",
      icon: MessageSquare,
      label: "SMS Notifications",
    },
  ];

  const hodLinks = [
    { to: "/hod/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/hod/students-with-dues", icon: Users, label: "Students with Dues" },
    { to: "/hod/whole-report", icon: FileText, label: "Whole Report" },
  ];

  const studentLinks = [
    { to: "/student/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/student/dues", icon: CreditCard, label: "My Dues" },
    {
      to: "/student/cleared-dues",
      icon: CheckCircle,
      label: "Payment History",
    },
    {
      to: "/student/upload-document",
      icon: Upload,
      label: "Upload Documents",
    },
  ];

  const hrLinks = [
    { to: "/hr/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/hr/add-faculty-due", icon: FileText, label: "Add Faculty Due" },
    { to: "/hr/active-dues", icon: AlertCircle, label: "Active Dues" },
    { to: "/hr/cleared-dues", icon: CheckCircle, label: "Cleared Dues" },
    { to: "/hr/check-due", icon: Search, label: "Check Faculty Due" },
  ];

  const facultyLinks = [
    { to: "/faculty/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/faculty/dues", icon: CreditCard, label: "My Dues" },
    {
      to: "/faculty/upload-documents",
      icon: Upload,
      label: "Upload Documents",
    },
    { to: "/faculty/cleared-dues", icon: CheckCircle, label: "Cleared Dues" },
  ];

  const getLinks = () => {
    switch (role) {
      case "admin":
        return adminLinks;
      case "operator":
        return operatorLinks;
      case "hod":
        return hodLinks;
      case "student":
        return studentLinks;
      case "hr":
        return hrLinks;
      case "faculty":
        return facultyLinks;
      default:
        return [];
    }
  };

  const links = getLinks();

  const roleLabel =
    role === "hod"
      ? "Head of Department"
      : role === "hr"
        ? "Human Resources"
        : role === "operator"
          ? "Department Operator"
          : role.charAt(0).toUpperCase() + role.slice(1);

  return (
    <div className="h-full overflow-y-auto px-3 py-4 sm:px-4">
      <div className="official-surface-plain mb-4 px-4 py-3">
        <p className="official-kicker">Signed in as</p>
        <p className="mt-1 text-sm font-semibold text-primary">{roleLabel}</p>
        {sectionName && (
          <p className="mt-1 text-xs text-base-content/65">
            Section: <span className="font-semibold">{sectionName}</span>
          </p>
        )}
      </div>

      <nav className="space-y-1.5" aria-label="Sidebar navigation">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = location.pathname === link.to;
          return (
            <Link
              key={link.to}
              to={link.to}
              onClick={onNavigate}
              aria-current={isActive ? "page" : undefined}
              className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all ${
                isActive
                  ? "bg-primary text-primary-content shadow-md"
                  : "text-base-content/85 hover:bg-base-200 hover:text-base-content"
              }`}
            >
              <span
                className={`rounded-lg p-1.5 ${
                  isActive
                    ? "bg-primary-content/20"
                    : "bg-base-200 text-primary group-hover:bg-base-300"
                }`}
              >
                <Icon size={16} />
              </span>
              <span className="text-sm font-semibold tracking-wide">
                {link.label}
              </span>
            </Link>
          );
        })}

        <div className="my-4 border-t border-base-300" />

        <Link
          to={`/${role}/change-password`}
          onClick={onNavigate}
          className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-base-content/85 transition-all hover:bg-base-200 hover:text-base-content"
        >
          <span className="rounded-lg bg-base-200 p-1.5 text-primary group-hover:bg-base-300">
            <KeyRound size={16} />
          </span>
          <span className="text-sm font-semibold tracking-wide">
            Change Password
          </span>
        </Link>

        <button
          onClick={onLogout}
          className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold tracking-wide text-error transition-all hover:bg-error hover:text-error-content"
        >
          <span className="rounded-lg bg-error/10 p-1.5">
            <LogOut size={16} />
          </span>
          <span>Logout</span>
        </button>
      </nav>
    </div>
  );
};

export default Sidebar;
