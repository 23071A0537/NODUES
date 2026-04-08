import {
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle,
  DollarSign,
  Download,
  FileText,
  GraduationCap,
  MessageSquare,
  UserCheck,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import DashboardLayout from "../../components/DashboardLayout";

interface DashboardStats {
  totalDepartments: number;
  totalSections: number;
  totalUsers: number;
  totalAcademicYears: number;
  totalStudents: number;
  totalFaculty: number;
  activeStudentDues?: number;
  clearedStudentDues?: number;
  studentDuesAmount?: number;
  activeFacultyDues?: number;
  clearedFacultyDues?: number;
  facultyDuesAmount?: number;
}

interface DepartmentDue {
  name: string;
  type: "department" | "section";
  nonPayableDues: number;
  payableDues: number;
  totalAmount: number;
}

interface OverallStats {
  activeNonPayable: number;
  activePayable: number;
  clearedNonPayable: number;
  clearedPayable: number;
  totalPendingAmount: number;
}

const AdminDashboard = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalDepartments: 0,
    totalSections: 0,
    totalUsers: 0,
    totalAcademicYears: 0,
    totalStudents: 0,
    totalFaculty: 0,
  });

  const [departmentDues, setDepartmentDues] = useState<DepartmentDue[]>([]);
  const [overallStats, setOverallStats] = useState<OverallStats>({
    activeNonPayable: 0,
    activePayable: 0,
    clearedNonPayable: 0,
    clearedPayable: 0,
    totalPendingAmount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [sendingSms, setSendingSms] = useState(false);

  // Get user data from localStorage
  const userData = JSON.parse(localStorage.getItem("user") || "{}");
  const user = {
    username: userData.name || userData.username || "Admin User",
    email: userData.email || "admin@vnrvjiet.in",
    role: (userData.role || "admin") as
      | "admin"
      | "operator"
      | "hod"
      | "student",
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      const fetchWithCreds = (url: string) =>
        fetch(url, {
          credentials: "include",
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
          },
        });

      // Fetch stats
      const statsResponse = await fetchWithCreds(
        `/api/admin/dashboard/stats?_t=${Date.now()}`,
      );
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData.data);
      }

      // Fetch department dues
      const duesResponse = await fetchWithCreds(
        `/api/admin/dashboard/department-dues?_t=${Date.now()}`,
      );
      if (duesResponse.ok) {
        const duesData = await duesResponse.json();
        setDepartmentDues(duesData.data);
      }

      // Fetch overall stats
      const overallResponse = await fetchWithCreds(
        `/api/admin/dashboard/overall-stats?_t=${Date.now()}`,
      );
      if (overallResponse.ok) {
        const overallData = await overallResponse.json();
        setOverallStats(overallData.data);
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const downloadExcel = () => {
    const tableData = departmentDues.map((due) => ({
      "Department/Section": due.name,
      Type: due.type.charAt(0).toUpperCase() + due.type.slice(1),
      "Non-Payable Dues": due.nonPayableDues,
      "Payable Dues": due.payableDues,
      "Total Amount (₹)": due.totalAmount,
    }));

    // Add totals row
    const totals = {
      "Department/Section": "TOTAL",
      Type: "",
      "Non-Payable Dues": departmentDues.reduce(
        (sum, due) => sum + due.nonPayableDues,
        0,
      ),
      "Payable Dues": departmentDues.reduce(
        (sum, due) => sum + due.payableDues,
        0,
      ),
      "Total Amount (₹)": departmentDues.reduce(
        (sum, due) => sum + due.totalAmount,
        0,
      ),
    };
    tableData.push(totals);

    const ws = XLSX.utils.json_to_sheet(tableData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Department Dues");
    XLSX.writeFile(
      wb,
      `department_dues_${new Date().toISOString().split("T")[0]}.xlsx`,
    );
  };

  const calculateTotals = () => {
    return {
      nonPayable: departmentDues.reduce(
        (sum, due) => sum + due.nonPayableDues,
        0,
      ),
      payable: departmentDues.reduce((sum, due) => sum + due.payableDues, 0),
      totalAmount: departmentDues.reduce(
        (sum, due) => sum + due.totalAmount,
        0,
      ),
    };
  };

  const totals = calculateTotals();

  const handlePushNotifications = async () => {
    try {
      setSendingSms(true);

      const response = await fetch("/api/sms/send-bulk-reminders", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();
      console.log("SMS Response:", data);

      if (response.ok && data.success) {
        const sent = data.data?.smsSent ?? 0;
        const failed = data.data?.smsFailed ?? 0;
        const skipped = data.data?.skipped;

        if (skipped) {
          toast(data.data?.message || "SMS job is already running", {
            duration: 3000,
          });
        } else {
          toast.success(
            `SMS sent successfully! ${sent} sent, ${failed} failed`,
            { duration: 5000 },
          );
        }
      } else {
        toast.error(data.message || "Failed to send SMS notifications");
      }
    } catch (error) {
      console.error("Error sending SMS:", error);
      toast.error("An error occurred while sending SMS notifications");
    } finally {
      setSendingSms(false);
    }
  };

  return (
    <DashboardLayout
      role={user.role}
      username={user.username}
      email={user.email}
    >
      <div className="space-y-6">
        {/* Welcome Message */}
        <div className="bg-base-100 rounded-lg shadow-md p-6">
          <h2 className="text-3xl font-bold text-primary">
            Hello, {user.username}!
          </h2>
          <p className="text-base-content/70 mt-2">
            Welcome to the Admin Dashboard
          </p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <div className="stats shadow bg-base-100">
            <div className="stat">
              <div className="stat-figure text-primary">
                <Building2 size={32} />
              </div>
              <div className="stat-title">Departments</div>
              <div className="stat-value text-primary">
                {stats.totalDepartments}
              </div>
            </div>
          </div>

          <div className="stats shadow bg-base-100">
            <div className="stat">
              <div className="stat-figure text-secondary">
                <Building2 size={32} />
              </div>
              <div className="stat-title">Sections</div>
              <div className="stat-value text-secondary">
                {stats.totalSections}
              </div>
            </div>
          </div>

          <div className="stats shadow bg-base-100">
            <div className="stat">
              <div className="stat-figure text-accent">
                <Users size={32} />
              </div>
              <div className="stat-title">Users</div>
              <div className="stat-value text-accent">{stats.totalUsers}</div>
            </div>
          </div>

          <div className="stats shadow bg-base-100">
            <div className="stat">
              <div className="stat-figure text-info">
                <Calendar size={32} />
              </div>
              <div className="stat-title">Academic Years</div>
              <div className="stat-value text-info">
                {stats.totalAcademicYears}
              </div>
            </div>
          </div>

          <div className="stats shadow bg-base-100">
            <div className="stat">
              <div className="stat-figure text-success">
                <GraduationCap size={32} />
              </div>
              <div className="stat-title">Students</div>
              <div className="stat-value text-success">
                {stats.totalStudents}
              </div>
            </div>
          </div>

          <div className="stats shadow bg-base-100">
            <div className="stat">
              <div className="stat-figure text-warning">
                <UserCheck size={32} />
              </div>
              <div className="stat-title">Faculty</div>
              <div className="stat-value text-warning">
                {stats.totalFaculty}
              </div>
            </div>
          </div>
        </div>

        {/* Overall Dues Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-base-100 rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-base-content/70">
                Active Payable
              </div>
              <AlertCircle className="text-success" size={24} />
            </div>
            <div className="text-3xl font-bold text-success">
              {overallStats.activePayable}
            </div>
          </div>

          <div className="bg-base-100 rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-base-content/70">
                Active Non-Payable
              </div>
              <AlertCircle className="text-warning" size={24} />
            </div>
            <div className="text-3xl font-bold text-warning">
              {overallStats.activeNonPayable}
            </div>
          </div>

          <div className="bg-base-100 rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-base-content/70">
                Cleared Payable
              </div>
              <CheckCircle className="text-info" size={24} />
            </div>
            <div className="text-3xl font-bold text-info">
              {overallStats.clearedPayable}
            </div>
          </div>

          <div className="bg-base-100 rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-base-content/70">
                Cleared Non-Payable
              </div>
              <CheckCircle className="text-primary" size={24} />
            </div>
            <div className="text-3xl font-bold text-primary">
              {overallStats.clearedNonPayable}
            </div>
          </div>

          <div className="bg-base-100 rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-base-content/70">
                Pending Amount
              </div>
              <DollarSign className="text-error" size={24} />
            </div>
            <div className="text-2xl font-bold text-error">
              ₹{overallStats.totalPendingAmount.toLocaleString("en-IN")}
            </div>
          </div>
        </div>

        {/* Faculty Dues Statistics Cards */}
        <div className="bg-base-100 rounded-lg shadow-md p-6">
          <h3 className="text-xl font-bold text-primary mb-4 flex items-center gap-2">
            <UserCheck size={24} />
            Faculty Dues Overview
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg p-6 border border-blue-200 dark:border-blue-700">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium text-blue-700 dark:text-blue-300">
                  Active Faculty Dues
                </div>
                <AlertCircle className="text-blue-600" size={24} />
              </div>
              <div className="text-3xl font-bold text-blue-700 dark:text-blue-300">
                {stats.activeFacultyDues || 0}
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-lg p-6 border border-green-200 dark:border-green-700">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium text-green-700 dark:text-green-300">
                  Cleared Faculty Dues
                </div>
                <CheckCircle className="text-green-600" size={24} />
              </div>
              <div className="text-3xl font-bold text-green-700 dark:text-green-300">
                {stats.clearedFacultyDues || 0}
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg p-6 border border-purple-200 dark:border-purple-700">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium text-purple-700 dark:text-purple-300">
                  Faculty Dues Amount
                </div>
                <DollarSign className="text-purple-600" size={24} />
              </div>
              <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                ₹{(stats.facultyDuesAmount || 0).toLocaleString("en-IN")}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-base-100 rounded-lg shadow-md p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-xl font-bold text-primary">Reports Moved</h3>
              <p className="text-base-content/70 mt-1">
                All dashboard graphs are now available on the dedicated reports
                page.
              </p>
            </div>
            <a href="/admin/reports" className="btn btn-primary">
              Open Reports
            </a>
          </div>
        </div>

        {/* Department/Section Dues Table */}
        <div className="bg-base-100 rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-2xl font-bold">
              Department/Section Dues Overview
            </h3>
            <button onClick={downloadExcel} className="btn btn-primary gap-2">
              <Download size={20} />
              Download Excel
            </button>
          </div>

          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="table table-zebra w-full">
              <thead className="sticky top-0 bg-base-200 z-10">
                <tr>
                  <th className="text-center">Department/Section Name</th>
                  <th className="text-center">Type</th>
                  <th className="text-center">Non-Payable Dues</th>
                  <th className="text-center">Payable Dues</th>
                  <th className="text-center">Total Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8">
                      <span className="loading loading-spinner loading-lg"></span>
                    </td>
                  </tr>
                ) : departmentDues.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8">
                      No data available
                    </td>
                  </tr>
                ) : (
                  departmentDues.map((due, index) => (
                    <tr key={index}>
                      <td className="text-center font-medium">{due.name}</td>
                      <td className="text-center">
                        <span
                          className={`badge ${due.type === "department" ? "badge-primary" : "badge-secondary"}`}
                        >
                          {due.type.charAt(0).toUpperCase() + due.type.slice(1)}
                        </span>
                      </td>
                      <td className="text-center">{due.nonPayableDues}</td>
                      <td className="text-center">{due.payableDues}</td>
                      <td className="text-center">
                        ₹{due.totalAmount.toLocaleString("en-IN")}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="sticky bottom-0 bg-base-300">
                <tr className="font-bold text-lg">
                  <td className="text-center" colSpan={2}>
                    TOTAL
                  </td>
                  <td className="text-center">{totals.nonPayable}</td>
                  <td className="text-center">{totals.payable}</td>
                  <td className="text-center">
                    ₹{totals.totalAmount.toLocaleString("en-IN")}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-base-100 rounded-lg shadow-md p-6">
          <h3 className="text-2xl font-bold mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <a href="/admin/reports" className="btn btn-outline btn-warning">
              <FileText size={20} />
              Reports
            </a>
            <a href="/admin/add-user" className="btn btn-outline btn-primary">
              <UserCheck size={20} />
              Add User
            </a>
            <a
              href="/admin/add-department"
              className="btn btn-outline btn-secondary"
            >
              <Building2 size={20} />
              Add Department/Section
            </a>
            <a
              href="/admin/add-academic-year"
              className="btn btn-outline btn-accent"
            >
              <Calendar size={20} />
              Add Academic Year
            </a>
            <a href="/admin/add-students" className="btn btn-outline btn-info">
              <GraduationCap size={20} />
              Add Students
            </a>
            <a
              href="/admin/add-faculty"
              className="btn btn-outline btn-success"
            >
              <Users size={20} />
              Add Faculty
            </a>
            <button
              onClick={handlePushNotifications}
              disabled={sendingSms}
              className="btn btn-outline btn-warning gap-2"
            >
              <MessageSquare size={20} />
              {sendingSms ? (
                <>
                  <span className="loading loading-spinner loading-sm"></span>
                  Sending...
                </>
              ) : (
                "Push Notifications"
              )}
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;
