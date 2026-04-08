import {
  Building2,
  Calendar,
  CheckCircle,
  FileText,
  GraduationCap,
} from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import DashboardLayout from "../../components/DashboardLayout";

interface DepartmentAnalytics {
  department: string;
  activeNonPayable: number;
  activePayable: number;
  clearedNonPayable: number;
  clearedPayable: number;
}

interface OverallStats {
  activeNonPayable: number;
  activePayable: number;
  clearedNonPayable: number;
  clearedPayable: number;
  totalPendingAmount: number;
}

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

interface FacultyDuesByDept {
  department: string;
  activeDues: number;
  clearedDues: number;
  totalAmount: number;
}

interface StudentVsFacultyDues {
  studentDues: {
    active: number;
    cleared: number;
    totalAmount: number;
  };
  facultyDues: {
    active: number;
    cleared: number;
    totalAmount: number;
  };
}

const AdminReports = () => {
  const [departmentAnalytics, setDepartmentAnalytics] = useState<
    DepartmentAnalytics[]
  >([]);
  const [overallStats, setOverallStats] = useState<OverallStats>({
    activeNonPayable: 0,
    activePayable: 0,
    clearedNonPayable: 0,
    clearedPayable: 0,
    totalPendingAmount: 0,
  });
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [academicYearData, setAcademicYearData] = useState<AcademicYearData[]>(
    [],
  );
  const [facultyDuesByDept, setFacultyDuesByDept] = useState<
    FacultyDuesByDept[]
  >([]);
  const [studentVsFacultyDues, setStudentVsFacultyDues] =
    useState<StudentVsFacultyDues | null>(null);
  const [loading, setLoading] = useState(true);

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
    fetchReportsData();
  }, []);

  const fetchReportsData = async () => {
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

      const analyticsResponse = await fetchWithCreds(
        `/api/admin/dashboard/department-analytics?_t=${Date.now()}`,
      );
      if (analyticsResponse.ok) {
        const analyticsData = await analyticsResponse.json();
        setDepartmentAnalytics(analyticsData.data);
      }

      const overallResponse = await fetchWithCreds(
        `/api/admin/dashboard/overall-stats?_t=${Date.now()}`,
      );
      if (overallResponse.ok) {
        const overallData = await overallResponse.json();
        setOverallStats(overallData.data);
      }

      const monthlyResponse = await fetchWithCreds(
        `/api/admin/dashboard/monthly-data?_t=${Date.now()}`,
      );
      if (monthlyResponse.ok) {
        const monthlyDataResponse = await monthlyResponse.json();
        if (monthlyDataResponse.success) {
          setMonthlyData(monthlyDataResponse.data);
        }
      }

      const yearResponse = await fetchWithCreds(
        `/api/admin/dashboard/academic-year-data?_t=${Date.now()}`,
      );
      if (yearResponse.ok) {
        const yearDataResponse = await yearResponse.json();
        if (yearDataResponse.success) {
          setAcademicYearData(yearDataResponse.data);
        }
      }

      const facultyDeptResponse = await fetchWithCreds(
        `/api/admin/dashboard/faculty-dues-by-department?_t=${Date.now()}`,
      );
      if (facultyDeptResponse.ok) {
        const facultyDeptData = await facultyDeptResponse.json();
        if (facultyDeptData.success) {
          setFacultyDuesByDept(facultyDeptData.data);
        }
      }

      const studentVsFacultyResponse = await fetchWithCreds(
        `/api/admin/dashboard/student-vs-faculty-dues?_t=${Date.now()}`,
      );
      if (studentVsFacultyResponse.ok) {
        const studentVsFacultyData = await studentVsFacultyResponse.json();
        if (studentVsFacultyData.success) {
          setStudentVsFacultyDues(studentVsFacultyData.data);
        }
      }
    } catch (error) {
      console.error("Error fetching reports data:", error);
      toast.error("Failed to load reports data");
    } finally {
      setLoading(false);
    }
  };

  const overallDistributionData = [
    {
      name: "Active Payable",
      value: overallStats.activePayable,
      color: "#10b981",
    },
    {
      name: "Active Non-Payable",
      value: overallStats.activeNonPayable,
      color: "#f59e0b",
    },
    {
      name: "Cleared Payable",
      value: overallStats.clearedPayable,
      color: "#3b82f6",
    },
    {
      name: "Cleared Non-Payable",
      value: overallStats.clearedNonPayable,
      color: "#8b5cf6",
    },
  ];

  const studentFacultyDistributionData = studentVsFacultyDues
    ? [
        {
          name: "Student Dues",
          value: studentVsFacultyDues.studentDues.active,
          color: "#10b981",
        },
        {
          name: "Faculty Dues",
          value: studentVsFacultyDues.facultyDues.active,
          color: "#f59e0b",
        },
      ]
    : [];

  return (
    <DashboardLayout
      role={user.role}
      username={user.username}
      email={user.email}
    >
      <div className="space-y-6 official-enter">
        <div className="official-card p-6">
          <h2 className="official-title text-2xl sm:text-3xl">Admin Reports</h2>
          <p className="official-subtitle mt-2">
            Analytics and graph-based reports moved from dashboard
          </p>
        </div>

        {loading ? (
          <div className="official-card p-10 flex justify-center">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="official-card p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="text-primary" size={24} />
                  <h3 className="text-xl font-bold text-primary">
                    Last 6 Months Trends (Global)
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
                    Academic Year-wise Active Dues (Global)
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

              <div className="official-card p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Building2 className="text-primary" size={24} />
                  <h3 className="text-xl font-bold text-primary">
                    Department-wise Active Dues
                  </h3>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={departmentAnalytics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="department"
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
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

              <div className="official-card p-6">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle className="text-primary" size={24} />
                  <h3 className="text-xl font-bold text-primary">
                    Overall Dues Distribution
                  </h3>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={overallDistributionData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => `${entry.name}: ${entry.value}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {overallDistributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="official-card p-6">
                <div className="flex items-center gap-2 mb-4">
                  <GraduationCap className="text-primary" size={24} />
                  <h3 className="text-xl font-bold text-primary">
                    Student vs Faculty Dues Comparison
                  </h3>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={studentFacultyDistributionData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => `${entry.name}: ${entry.value}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {studentFacultyDistributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="official-card p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Building2 className="text-primary" size={24} />
                  <h3 className="text-xl font-bold text-primary">
                    Faculty Dues by Department
                  </h3>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={facultyDuesByDept}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="department"
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar
                      dataKey="activeDues"
                      fill="#3b82f6"
                      name="Active Dues"
                    />
                    <Bar
                      dataKey="clearedDues"
                      fill="#10b981"
                      name="Cleared Dues"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminReports;
