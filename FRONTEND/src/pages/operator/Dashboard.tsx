import {
  AlertCircle,
  DollarSign,
  Download,
  FileText,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import * as XLSX from "xlsx";
import DashboardLayout from "../../components/DashboardLayout";

interface SummaryStats {
  studentsUnderControl: number;
  totalDues: number;
  totalPayableDues: number;
  totalNonPayableDues: number;
  totalDuesAmount: number;
}

const Dashboard = () => {
  const [stats, setStats] = useState<SummaryStats>({
    studentsUnderControl: 0,
    totalDues: 0,
    totalPayableDues: 0,
    totalNonPayableDues: 0,
    totalDuesAmount: 0,
  });
  const [loading, setLoading] = useState(true);

  // Get user data from localStorage
  const userData = JSON.parse(localStorage.getItem("user") || "{}");
  const user = {
    username: userData.name || userData.username || "Operator",
    email: userData.email || "operator@vnrvjiet.in",
    role: (userData.role || "operator") as
      | "admin"
      | "operator"
      | "hod"
      | "student",
    departmentId: userData.department_id,
    sectionId: userData.section_id,
    departmentName: userData.department_name || "Department",
    sectionName: userData.section_name || "",
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const fetchOpts = { credentials: "include" as RequestCredentials };

      // Fetch summary stats
      const statsResponse = await fetch(
        "/api/operator/dashboard/stats",
        fetchOpts,
      );
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        if (statsData.success) {
          setStats(statsData.data);
        }
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      toast.error("Failed to fetch dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const downloadTableData = () => {
    const tableData = [
      {
        Metric: "Total Number of Dues",
        Value: stats.totalDues,
      },
      {
        Metric: "Total Number of Payable Dues",
        Value: stats.totalPayableDues,
      },
      {
        Metric: "Total Number of Non-Payable Dues",
        Value: stats.totalNonPayableDues,
      },
      {
        Metric: "Total Dues Amount",
        Value: `₹${stats.totalDuesAmount.toLocaleString("en-IN")}`,
      },
    ];

    const ws = XLSX.utils.json_to_sheet(tableData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Dashboard Stats");
    XLSX.writeFile(
      wb,
      `dashboard_stats_${new Date().toISOString().split("T")[0]}.xlsx`,
    );
    toast.success("Data exported successfully");
  };

  if (loading) {
    return (
      <DashboardLayout
        role={user.role}
        username={user.username}
        email={user.email}
        sectionName={user.sectionName}
      >
        <div className="flex items-center justify-center min-h-screen">
          <div className="loading loading-spinner loading-lg"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      role={user.role}
      username={user.username}
      email={user.email}
      sectionName={user.sectionName}
    >
      <Toaster position="top-right" />
      <div className="space-y-6">
        {/* Page Header */}
        <div className="bg-base-100 rounded-lg shadow-md p-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-primary mb-2">
            Operator Dashboard
          </h2>
          <p className="text-base-content/70">
            {user.sectionId
              ? `Section: ${user.sectionName}`
              : `Department: ${user.departmentName}`}
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-base-100 rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-base-content/70">
                {user.departmentName.includes("Faculty")
                  ? "Faculties Under Control"
                  : "Students Under Control"}
              </div>
              <Users className="text-primary" size={24} />
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-primary">
              {stats.studentsUnderControl}
            </div>
          </div>

          <div className="bg-base-100 rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-base-content/70">
                Total Dues
              </div>
              <FileText className="text-info" size={24} />
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-info">
              {stats.totalDues}
            </div>
          </div>

          <div className="bg-base-100 rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-base-content/70">
                Payable Dues
              </div>
              <DollarSign className="text-success" size={24} />
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-success">
              {stats.totalPayableDues}
            </div>
          </div>

          <div className="bg-base-100 rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-base-content/70">
                Non-Payable Dues
              </div>
              <AlertCircle className="text-warning" size={24} />
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-warning">
              {stats.totalNonPayableDues}
            </div>
          </div>

          <div className="bg-base-100 rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-base-content/70">
                Total Amount
              </div>
              <DollarSign className="text-error" size={24} />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-error">
              ₹{stats.totalDuesAmount.toLocaleString("en-IN")}
            </div>
          </div>
        </div>

        {/* Tabular View */}
        <div className="bg-base-100 rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl sm:text-2xl font-bold text-primary">
              Dues Statistics
            </h3>
            <button
              onClick={downloadTableData}
              className="btn btn-primary btn-sm gap-2"
            >
              <Download size={16} />
              Export Data
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="table table-zebra w-full">
              <thead>
                <tr>
                  <th className="text-center">Metric</th>
                  <th className="text-center">Value</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="text-center font-semibold">
                    Total Number of Dues
                  </td>
                  <td className="text-center text-info font-bold">
                    {stats.totalDues}
                  </td>
                </tr>
                <tr>
                  <td className="text-center font-semibold">
                    Total Number of Payable Dues
                  </td>
                  <td className="text-center text-success font-bold">
                    {stats.totalPayableDues}
                  </td>
                </tr>
                <tr>
                  <td className="text-center font-semibold">
                    Total Number of Non-Payable Dues
                  </td>
                  <td className="text-center text-warning font-bold">
                    {stats.totalNonPayableDues}
                  </td>
                </tr>
                <tr>
                  <td className="text-center font-semibold">
                    Total Dues Amount
                  </td>
                  <td className="text-center text-error font-bold">
                    ₹{stats.totalDuesAmount.toLocaleString("en-IN")}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-base-100 rounded-lg shadow-md p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-xl font-bold text-primary">Reports Moved</h3>
              <p className="text-base-content/70 mt-1">
                Dashboard graphs are now available on the dedicated reports
                page.
              </p>
            </div>
            <a href="/operator/reports" className="btn btn-primary">
              Open Reports
            </a>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-base-100 rounded-lg shadow-md p-6">
          <h3 className="text-2xl font-bold text-primary mb-4">
            Quick Actions
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <a
              href="/operator/reports"
              className="btn btn-warning btn-lg gap-2"
            >
              <FileText size={20} />
              Reports
            </a>
            <a
              href="/operator/add-due"
              className="btn btn-primary btn-lg gap-2"
            >
              <FileText size={20} />
              Add Due
            </a>
            <a
              href="/operator/active-dues"
              className="btn btn-info btn-lg gap-2"
            >
              <AlertCircle size={20} />
              Active Dues
            </a>
            <a
              href="/operator/cleared-dues"
              className="btn btn-success btn-lg gap-2"
            >
              <Download size={20} />
              Cleared Dues
            </a>
            <a href="/change-password" className="btn btn-warning btn-lg gap-2">
              <Users size={20} />
              Change Password
            </a>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
