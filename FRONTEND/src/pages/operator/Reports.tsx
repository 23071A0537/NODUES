import { Calendar, FileText } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import DashboardLayout from "../../components/DashboardLayout";

interface MonthlyData {
  month: string;
  activePayable: number;
  activeNonPayable: number;
  clearedPayable: number;
  clearedNonPayable: number;
}

interface AcademicYearData {
  year: string;
  activePayable: number;
  activeNonPayable: number;
}

const OperatorReports = () => {
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [academicYearData, setAcademicYearData] = useState<AcademicYearData[]>(
    [],
  );
  const [loading, setLoading] = useState(true);

  const userData = JSON.parse(localStorage.getItem("user") || "{}");
  const user = {
    username: userData.name || userData.username || "Operator",
    email: userData.email || "operator@vnrvjiet.in",
    role: (userData.role || "operator") as
      | "admin"
      | "operator"
      | "hod"
      | "student",
    sectionName: userData.section_name || "",
  };

  useEffect(() => {
    fetchReportsData();
  }, []);

  const fetchReportsData = async () => {
    try {
      setLoading(true);
      const fetchOpts = { credentials: "include" as RequestCredentials };

      const monthlyResponse = await fetch(
        "/api/operator/dashboard/monthly-data",
        fetchOpts,
      );
      if (monthlyResponse.ok) {
        const monthlyDataResponse = await monthlyResponse.json();
        if (monthlyDataResponse.success) {
          setMonthlyData(monthlyDataResponse.data);
        }
      }

      const yearResponse = await fetch(
        "/api/operator/dashboard/academic-year-data",
        fetchOpts,
      );
      if (yearResponse.ok) {
        const yearDataResponse = await yearResponse.json();
        if (yearDataResponse.success) {
          setAcademicYearData(yearDataResponse.data);
        }
      }
    } catch (error) {
      console.error("Error fetching reports data:", error);
      toast.error("Failed to fetch report data");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout
      role={user.role}
      username={user.username}
      email={user.email}
      sectionName={user.sectionName}
    >
      <div className="space-y-6 official-enter">
        <div className="official-card p-6">
          <h2 className="official-title text-2xl sm:text-3xl mb-2">
            Operator Reports
          </h2>
          <p className="official-subtitle">
            Analytics and graph-based reports moved from dashboard
          </p>
        </div>

        {loading ? (
          <div className="official-card p-10 flex justify-center">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="official-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="text-primary" size={24} />
                <h3 className="text-xl font-bold text-primary">
                  Last 6 Months Trends
                </h3>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="activePayable"
                    stroke="#10b981"
                    name="Active Payable"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="activeNonPayable"
                    stroke="#f59e0b"
                    name="Active Non-Payable"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="clearedPayable"
                    stroke="#3b82f6"
                    name="Cleared Payable"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="clearedNonPayable"
                    stroke="#8b5cf6"
                    name="Cleared Non-Payable"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="official-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="text-primary" size={24} />
                <h3 className="text-xl font-bold text-primary">
                  Academic Year-wise Active Dues
                </h3>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={academicYearData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar
                    dataKey="activePayable"
                    fill="#10b981"
                    name="Active Payable"
                  />
                  <Bar
                    dataKey="activeNonPayable"
                    fill="#f59e0b"
                    name="Active Non-Payable"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default OperatorReports;
