import {
  AlertCircle,
  DollarSign,
  FileText,
  RefreshCw,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import DashboardLayout from "../../components/DashboardLayout";

interface DashboardStats {
  totalStudents: number;
  totalDues: number;
  totalPayableDues: number;
  totalNonPayableDues: number;
  totalDuesAmount: number;
  studentsHavingDues: number;
}

interface AcademicYearData {
  academicYear: string;
  studentsWithPayableDues: number;
  studentsWithNonPayableDues: number;
}

const HODDashboard = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    totalDues: 0,
    totalPayableDues: 0,
    totalNonPayableDues: 0,
    totalDuesAmount: 0,
    studentsHavingDues: 0,
  });

  const [academicYearData, setAcademicYearData] = useState<AcademicYearData[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get user data from localStorage
  const userData = JSON.parse(localStorage.getItem("user") || "{}");
  const user = {
    username: userData.username || "HOD",
    email: userData.email || "hod@vnrvjiet.in",
    role: (userData.role || "hod") as "admin" | "operator" | "hod" | "student",
    departmentName: userData.department_name || "Department",
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch dashboard stats
      const statsResponse = await fetch("/api/hod/dashboard/stats", {
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!statsResponse.ok) {
        throw new Error("Failed to fetch dashboard stats");
      }

      const statsData = await statsResponse.json();
      setStats(statsData.data);

      // Fetch academic year analytics
      const analyticsResponse = await fetch(
        "/api/hod/dashboard/academic-year-analytics",
        {
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      if (!analyticsResponse.ok) {
        throw new Error("Failed to fetch analytics");
      }

      const analyticsData = await analyticsResponse.json();
      setAcademicYearData(analyticsData.data);

      toast.success("Dashboard data loaded successfully");
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load dashboard";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout
        role={user.role}
        username={user.username}
        email={user.email}
      >
        <div className="flex items-center justify-center min-h-screen">
          <div className="loading loading-spinner loading-lg text-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout
        role={user.role}
        username={user.username}
        email={user.email}
      >
        <div className="bg-error/10 border border-error rounded-lg p-6 text-center">
          <AlertCircle className="mx-auto text-error mb-4" size={48} />
          <h3 className="text-xl font-bold text-error mb-2">
            Error Loading Dashboard
          </h3>
          <p className="text-base-content/70 mb-4">{error}</p>
          <button
            className="btn btn-primary gap-2"
            onClick={fetchDashboardData}
          >
            <RefreshCw size={20} />
            Retry
          </button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      role={user.role}
      username={user.username}
      email={user.email}
    >
      <Toaster position="top-right" />
      <div className="space-y-6">
        {/* Welcome Message */}
        <div className="bg-base-100 rounded-lg shadow-md p-6">
          <h2 className="text-3xl font-bold text-primary">
            Hello, {user.username}!
          </h2>
          <p className="text-base-content/70 mt-2">
            Welcome to the HOD Dashboard - {user.departmentName}
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <div className="bg-base-100 rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-base-content/70">
                Total Students
              </div>
              <Users className="text-primary" size={24} />
            </div>
            <div className="text-3xl font-bold text-primary">
              {stats.totalStudents.toLocaleString()}
            </div>
          </div>

          <div className="bg-base-100 rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-base-content/70">
                Total Dues
              </div>
              <FileText className="text-info" size={24} />
            </div>
            <div className="text-3xl font-bold text-info">
              {stats.totalDues.toLocaleString()}
            </div>
          </div>

          <div className="bg-base-100 rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-base-content/70">
                Payable Dues
              </div>
              <AlertCircle className="text-success" size={24} />
            </div>
            <div className="text-3xl font-bold text-success">
              {stats.totalPayableDues.toLocaleString()}
            </div>
          </div>

          <div className="bg-base-100 rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-base-content/70">
                Non-Payable Dues
              </div>
              <AlertCircle className="text-warning" size={24} />
            </div>
            <div className="text-3xl font-bold text-warning">
              {stats.totalNonPayableDues.toLocaleString()}
            </div>
          </div>

          <div className="bg-base-100 rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-base-content/70">
                Total Amount
              </div>
              <DollarSign className="text-error" size={24} />
            </div>
            <div className="text-2xl font-bold text-error">
              ₹{stats.totalDuesAmount.toLocaleString("en-IN")}
            </div>
          </div>

          <div className="bg-base-100 rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-base-content/70">
                Students Having Dues
              </div>
              <Users className="text-secondary" size={24} />
            </div>
            <div className="text-3xl font-bold text-secondary">
              {stats.studentsHavingDues.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Academic Year Analytics Chart */}
        {academicYearData.length > 0 && (
          <div className="bg-base-100 rounded-lg shadow-md p-6">
            <h3 className="text-2xl font-bold text-primary mb-4">
              Students with Dues by Academic Year
            </h3>
            <div className="w-full h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={academicYearData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="academicYear" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar
                    dataKey="studentsWithPayableDues"
                    fill="#10b981"
                    name="Payable Dues"
                  />
                  <Bar
                    dataKey="studentsWithNonPayableDues"
                    fill="#f59e0b"
                    name="Non-Payable Dues"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Coming Soon Notice - Only show if no data */}
        {stats.totalStudents === 0 && (
          <div className="bg-base-100 rounded-lg shadow-md p-8 text-center">
            <h3 className="text-2xl font-bold text-primary mb-4">
              No Data Available
            </h3>
            <p className="text-base-content/70 mb-6">
              There are currently no students or dues in your department.
            </p>
          </div>
        )}

        {/* Quick Actions */}
        <div className="bg-base-100 rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-2xl font-bold text-primary">Quick Actions</h3>
            <button
              className="btn btn-sm btn-ghost gap-2"
              onClick={fetchDashboardData}
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <a
              href="/hod/change-password"
              className="btn btn-primary btn-lg gap-2"
            >
              <FileText size={20} />
              Change Password
            </a>
            <a
              href="/hod/students-with-dues"
              className="btn btn-outline btn-secondary btn-lg gap-2"
            >
              <Users size={20} />
              Students with Dues
            </a>
            <a
              href="/hod/whole-report"
              className="btn btn-outline btn-accent btn-lg gap-2"
            >
              <FileText size={20} />
              Whole Report
            </a>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default HODDashboard;
