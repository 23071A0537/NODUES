import {
  AlertCircle,
  Briefcase,
  CheckCircle,
  DollarSign,
  FileText,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../../components/DashboardLayout";

interface DashboardStats {
  activeDues: number;
  payableDues: number;
  nonPayableDues: number;
  clearedDues: number;
  totalOutstanding: number;
  recentDues: {
    id: string;
    due_description: string;
    current_amount: number;
    is_payable: boolean;
    is_cleared: boolean;
    due_clear_by_date: string | null;
    due_type_name: string;
  }[];
}

const FacultyDashboard = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const userData = JSON.parse(localStorage.getItem("user") || "{}");
  const user = {
    username: userData.username || "Faculty",
    email: userData.email || "",
    role: "faculty" as const,
    employeeCode: userData.employee_code || "",
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/faculty/dashboard/stats", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch stats");
      const data = await response.json();
      setStats(data.data);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
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
        <div className="official-surface flex items-center justify-center min-h-[18rem]">
          <div className="loading loading-spinner loading-lg text-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  const statCards = [
    {
      label: "Active Dues",
      value: stats?.activeDues ?? 0,
      icon: AlertCircle,
      color: "text-warning",
      bg: "bg-warning/10",
    },
    {
      label: "Payable Dues",
      value: stats?.payableDues ?? 0,
      icon: DollarSign,
      color: "text-info",
      bg: "bg-info/10",
    },
    {
      label: "Outstanding Amount",
      value: `₹${(stats?.totalOutstanding ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
      icon: FileText,
      color: "text-error",
      bg: "bg-error/10",
    },
    {
      label: "Cleared Dues",
      value: stats?.clearedDues ?? 0,
      icon: CheckCircle,
      color: "text-success",
      bg: "bg-success/10",
    },
  ];

  const hasPayableDues = (stats?.payableDues ?? 0) > 0;
  const pendingProofAction =
    (stats?.recentDues ?? []).filter((due) => due.is_payable && !due.is_cleared)
      .length > 0;

  return (
    <DashboardLayout
      role={user.role}
      username={user.username}
      email={user.email}
    >
      <div className="space-y-5 sm:space-y-6">
        <section className="official-surface p-5 sm:p-7">
          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <p className="official-kicker">Faculty Workspace</p>
              <div className="mt-2 flex items-center gap-3">
                <Briefcase size={24} className="text-primary" />
                <h1 className="official-title">Welcome, {user.username}</h1>
              </div>
              <p className="mt-2 text-sm text-base-content/70">
                Employee ID:{" "}
                <span className="font-semibold">{user.employeeCode}</span>
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="official-chip">Dues Monitoring</span>
                <span className="official-chip">Proof Submission Workflow</span>
              </div>
            </div>

            <div className="official-surface-plain p-4 sm:p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-base-content/55">
                Priority Focus
              </p>
              <p className="mt-2 text-sm font-semibold text-base-content">
                {hasPayableDues
                  ? "Pay dues and submit proof links for pending items."
                  : pendingProofAction
                    ? "Monitor proof verification progress in dues workspace."
                    : "No immediate payment action required."}
              </p>
              <button
                onClick={() => navigate("/faculty/dues")}
                className="btn btn-primary btn-sm mt-3"
              >
                Open Dues Workspace
              </button>
            </div>
          </div>
        </section>

        <section className="official-grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <article
                key={card.label}
                className="official-surface-plain flex flex-col gap-2 p-4"
              >
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-lg ${card.bg}`}
                >
                  <Icon size={20} className={card.color} />
                </div>
                <p className="text-2xl font-bold">{card.value}</p>
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-base-content/60">
                  {card.label}
                </p>
              </article>
            );
          })}
        </section>

        <section className="official-grid sm:grid-cols-3">
          <article className="official-surface-plain p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-base-content/55">
              Step 1
            </p>
            <p className="mt-1 text-sm font-semibold text-base-content">
              Check payable dues
            </p>
            <p className="mt-1 text-xs text-base-content/65">
              Identify dues requiring payment and immediate action.
            </p>
          </article>
          <article className="official-surface-plain p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-base-content/55">
              Step 2
            </p>
            <p className="mt-1 text-sm font-semibold text-base-content">
              Submit proof links
            </p>
            <p className="mt-1 text-xs text-base-content/65">
              Upload receipt links for each paid due for HR review.
            </p>
          </article>
          <article className="official-surface-plain p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-base-content/55">
              Step 3
            </p>
            <p className="mt-1 text-sm font-semibold text-base-content">
              Track clearance
            </p>
            <p className="mt-1 text-xs text-base-content/65">
              Monitor cleared status and keep supporting records organized.
            </p>
          </article>
        </section>

        <section className="official-surface-plain p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-primary">Recent Dues</h2>
            <button
              onClick={() => navigate("/faculty/dues")}
              className="btn btn-sm btn-outline"
            >
              View All
            </button>
          </div>
          {stats?.recentDues && stats.recentDues.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="table table-sm official-data-table w-full">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Due Date</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentDues.map((due) => (
                    <tr key={due.id}>
                      <td className="font-medium">{due.due_description}</td>
                      <td className="text-base-content/70">
                        {due.due_type_name}
                      </td>
                      <td>
                        ₹{Number(due.current_amount).toLocaleString("en-IN")}
                      </td>
                      <td>
                        {due.is_cleared ? (
                          <span className="badge badge-success badge-sm">
                            Cleared
                          </span>
                        ) : due.is_payable ? (
                          <span className="badge badge-warning badge-sm">
                            Payable
                          </span>
                        ) : (
                          <span className="badge badge-ghost badge-sm">
                            Non-Payable
                          </span>
                        )}
                      </td>
                      <td className="text-base-content/70">
                        {due.due_clear_by_date
                          ? new Date(due.due_clear_by_date).toLocaleDateString(
                              "en-IN",
                            )
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center text-base-content/55">
              <CheckCircle size={40} className="mx-auto mb-2 text-success" />
              <p>No dues found. You are all clear.</p>
            </div>
          )}
        </section>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
          <button
            onClick={() => navigate("/faculty/dues")}
            className="btn btn-outline h-12"
          >
            <DollarSign size={18} /> View My Dues
          </button>
          <button
            onClick={() => navigate("/faculty/upload-documents")}
            className="btn btn-outline h-12"
          >
            <FileText size={18} /> Upload Documents
          </button>
          <button
            onClick={() => navigate("/faculty/cleared-dues")}
            className="btn btn-outline h-12"
          >
            <CheckCircle size={18} /> Cleared Dues
          </button>
        </section>
      </div>
    </DashboardLayout>
  );
};

export default FacultyDashboard;
