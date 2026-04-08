import { AlertCircle, CheckCircle, DollarSign, Users } from "lucide-react";
import { useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import DashboardLayout from "../../components/DashboardLayout";

interface DashboardStats {
  totalFaculty: number;
  activeDues: number;
  activePayable: number;
  activeNonPayable: number;
  totalAmount: number;
  clearedDues: number;
  recentDues: RecentDue[];
}

interface RecentDue {
  id: number;
  employee_code: string;
  faculty_name: string;
  due_type: string;
  is_payable: boolean;
  current_amount: number | null;
  is_cleared: boolean;
  created_at: string;
}

const Dashboard = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalFaculty: 0,
    activeDues: 0,
    activePayable: 0,
    activeNonPayable: 0,
    totalAmount: 0,
    clearedDues: 0,
    recentDues: [],
  });
  const [loading, setLoading] = useState(true);

  const userData = JSON.parse(localStorage.getItem("user") || "{}");
  const user = {
    username: userData.name || userData.username || "HR",
    email: userData.email || "",
    role: "hr" as const,
  };

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/hr/dashboard/stats", {
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        setStats(data.data);
      } else {
        toast.error(data.message || "Failed to load dashboard data");
      }
    } catch {
      toast.error("Error loading dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const statCards = [
    {
      title: "Total Faculty",
      value: stats.totalFaculty,
      icon: Users,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      title: "Active Dues",
      value: stats.activeDues,
      icon: AlertCircle,
      color: "text-warning",
      bg: "bg-warning/10",
    },
    {
      title: "Cleared Dues",
      value: stats.clearedDues,
      icon: CheckCircle,
      color: "text-success",
      bg: "bg-success/10",
    },
    {
      title: "Outstanding Amount",
      value: `₹${stats.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: "text-error",
      bg: "bg-error/10",
    },
  ];

  return (
    <DashboardLayout
      role={user.role}
      username={user.username}
      email={user.email}
    >
      <Toaster position="top-right" />
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">HR Dashboard</h1>
          <p className="text-base-content/60 mt-1">
            Faculty Dues Management Overview
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <span className="loading loading-spinner loading-lg text-primary" />
          </div>
        ) : (
          <>
            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {statCards.map((card) => {
                const Icon = card.icon;
                return (
                  <div
                    key={card.title}
                    className="card bg-base-100 shadow border border-base-200"
                  >
                    <div className="card-body p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-base-content/60">
                            {card.title}
                          </p>
                          <p className="text-2xl font-bold mt-1">
                            {card.value}
                          </p>
                        </div>
                        <div className={`p-3 rounded-xl ${card.bg}`}>
                          <Icon className={card.color} size={24} />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Active Due Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="card bg-base-100 shadow border border-base-200">
                <div className="card-body">
                  <h2 className="card-title text-base">
                    Active Dues Breakdown
                  </h2>
                  <div className="space-y-3 mt-2">
                    <div className="flex justify-between items-center">
                      <span className="text-base-content/70">Payable Dues</span>
                      <span className="badge badge-warning badge-outline font-semibold px-3">
                        {stats.activePayable}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-base-content/70">
                        Non-Payable Dues
                      </span>
                      <span className="badge badge-info badge-outline font-semibold px-3">
                        {stats.activeNonPayable}
                      </span>
                    </div>
                    <div className="divider my-1" />
                    <div className="flex justify-between items-center font-semibold">
                      <span>Total Active</span>
                      <span>{stats.activeDues}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card bg-base-100 shadow border border-base-200">
                <div className="card-body">
                  <h2 className="card-title text-base">Quick Actions</h2>
                  <div className="space-y-2 mt-2">
                    <a
                      href="/hr/add-faculty-due"
                      className="btn btn-primary w-full"
                    >
                      Add Faculty Due
                    </a>
                    <a
                      href="/hr/active-dues"
                      className="btn btn-outline btn-warning w-full"
                    >
                      View Active Dues
                    </a>
                    <a href="/hr/check-due" className="btn btn-outline w-full">
                      Check Faculty Due
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Dues */}
            <div className="card bg-base-100 shadow border border-base-200">
              <div className="card-body">
                <h2 className="card-title text-base">
                  Recent Faculty Dues (Last 10)
                </h2>
                {stats.recentDues.length === 0 ? (
                  <p className="text-center text-base-content/50 py-6">
                    No dues added yet
                  </p>
                ) : (
                  <div className="overflow-x-auto mt-2">
                    <table className="table table-sm">
                      <thead>
                        <tr>
                          <th>Employee Code</th>
                          <th>Faculty Name</th>
                          <th>Due Type</th>
                          <th>Type</th>
                          <th>Amount</th>
                          <th>Status</th>
                          <th>Added On</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.recentDues.map((due) => (
                          <tr key={due.id} className="hover">
                            <td className="font-mono text-sm">
                              {due.employee_code}
                            </td>
                            <td>{due.faculty_name}</td>
                            <td>{due.due_type}</td>
                            <td>
                              <span
                                className={`badge badge-sm ${
                                  due.is_payable
                                    ? "badge-warning badge-outline"
                                    : "badge-info badge-outline"
                                }`}
                              >
                                {due.is_payable ? "Payable" : "Non-Payable"}
                              </span>
                            </td>
                            <td>
                              {due.current_amount != null
                                ? `₹${Number(due.current_amount).toLocaleString("en-IN")}`
                                : "—"}
                            </td>
                            <td>
                              <span
                                className={`badge badge-sm ${
                                  due.is_cleared
                                    ? "badge-success"
                                    : "badge-error"
                                }`}
                              >
                                {due.is_cleared ? "Cleared" : "Active"}
                              </span>
                            </td>
                            <td className="text-sm text-base-content/60">
                              {new Date(due.created_at).toLocaleDateString(
                                "en-IN",
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
