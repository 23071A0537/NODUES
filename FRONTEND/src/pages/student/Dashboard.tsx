import { AlertCircle, DollarSign, FileText } from "lucide-react";
import { useEffect, useState } from "react";
import { Toaster } from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../../components/DashboardLayout";

interface DueStats {
  total_dues: number;
  total_outstanding: number;
  payable_total: number;
}

const StudentDashboard = () => {
  const [stats, setStats] = useState<DueStats>({
    total_dues: 0,
    total_outstanding: 0,
    payable_total: 0,
  });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Get user data from localStorage
  const userData = JSON.parse(localStorage.getItem("user") || "{}");
  const user = {
    username: userData.username || "Student",
    email: userData.email || "student@vnrvjiet.in",
    role: (userData.role || "student") as
      | "admin"
      | "operator"
      | "hod"
      | "student",
    rollNumber: userData.roll_number || "N/A",
  };

  useEffect(() => {
    fetchDuesStats();

    // Refresh stats when window regains focus (handles tab switching)
    const handleFocus = () => {
      fetchDuesStats();
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  const fetchDuesStats = async () => {
    try {
      const response = await fetch(
        `/api/student/dues?status=all&limit=1&_t=${Date.now()}`,
        {
          credentials: "include" as RequestCredentials,
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
          },
        },
      );

      if (!response.ok) throw new Error("Failed to fetch dues");

      const data = await response.json();
      setStats(data.totals);
    } catch (error) {
      console.error("Error fetching dues stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const downloadNoDuesForm = async (table: "template" | "extra") => {
    try {
      const response = await fetch(`/api/student/no-dues-form?table=${table}`, {
        credentials: "include" as RequestCredentials,
      });

      if (!response.ok) throw new Error("Failed to download PDF");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `No_Dues_Form_${table}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading no dues form:", error);
    }
  };

  const downloadBothNoDuesForms = async () => {
    await downloadNoDuesForm("template");
    setTimeout(() => downloadNoDuesForm("extra"), 300);
  };

  if (loading) {
    return (
      <DashboardLayout
        role={user.role}
        username={user.username}
        email={user.email}
      >
        <div className="official-surface flex min-h-[18rem] items-center justify-center">
          <div className="loading loading-spinner loading-lg text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const statCards = [
    {
      title: "Total Dues",
      value: String(stats.total_dues),
      icon: FileText,
      tone: "text-info",
    },
    {
      title: "Payable Amount",
      value: `₹${stats.payable_total.toLocaleString("en-IN")}`,
      icon: AlertCircle,
      tone: "text-error",
    },
    {
      title: "Total Outstanding",
      value: `₹${stats.total_outstanding.toLocaleString("en-IN")}`,
      icon: DollarSign,
      tone: "text-warning",
    },
  ];

  const hasPayableAmount = stats.payable_total > 0;
  const hasOutstandingAmount = stats.total_outstanding > 0;

  return (
    <DashboardLayout
      role={user.role}
      username={user.username}
      email={user.email}
    >
      <Toaster position="top-right" />
      <div className="space-y-5 sm:space-y-6">
        <section className="official-surface p-5 sm:p-7">
          <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <div>
              <p className="official-kicker">Student Workspace</p>
              <h2 className="official-title mt-2">Welcome, {user.username}</h2>
              <p className="official-subtitle mt-2">
                Complete dues, submit required records, and prepare your final
                no-dues clearance from one official dashboard.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="official-chip">
                  Roll Number: {user.rollNumber}
                </span>
                <span className="official-chip">Clearance Session Active</span>
              </div>
            </div>

            <div className="official-surface-plain p-4 sm:p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.11em] text-base-content/55">
                Current Priority
              </p>
              <p className="mt-2 text-sm font-semibold text-base-content">
                {hasPayableAmount
                  ? "You have payable dues. Complete payment first."
                  : hasOutstandingAmount
                    ? "Outstanding dues exist. Review your dues list."
                    : "No immediate payment action required."}
              </p>
              <button
                onClick={() => navigate("/student/dues")}
                className="btn btn-primary btn-sm mt-3"
              >
                Open Dues Workspace
              </button>
            </div>
          </div>
        </section>

        <section className="official-grid sm:grid-cols-2 lg:grid-cols-3">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <article
                key={card.title}
                className="official-surface-plain p-4 sm:p-5"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-base-content/60">
                    {card.title}
                  </p>
                  <Icon size={18} className={card.tone} />
                </div>
                <p
                  className={`mt-3 text-2xl font-bold sm:text-3xl ${card.tone}`}
                >
                  {card.value}
                </p>
              </article>
            );
          })}
        </section>

        <section className="official-surface-plain p-5 sm:p-6">
          <h3 className="text-2xl font-bold text-primary">Action Board</h3>
          <p className="mt-1 text-sm text-base-content/65">
            Complete the most important steps in order for faster clearance.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
            <article className="rounded-xl border border-base-300 bg-base-100 p-4">
              <p className="text-xs uppercase tracking-[0.1em] text-base-content/55 font-semibold">
                Step 1
              </p>
              <p className="mt-1 text-sm font-semibold text-base-content">
                Review and pay dues
              </p>
              <p className="mt-1 text-xs text-base-content/65">
                Open dues list, select payable items, and complete payment.
              </p>
              <button
                onClick={() => navigate("/student/dues")}
                className="btn btn-outline btn-sm mt-3"
              >
                View Dues
              </button>
            </article>

            <article className="rounded-xl border border-base-300 bg-base-100 p-4">
              <p className="text-xs uppercase tracking-[0.1em] text-base-content/55 font-semibold">
                Step 2
              </p>
              <p className="mt-1 text-sm font-semibold text-base-content">
                Keep account secure
              </p>
              <p className="mt-1 text-xs text-base-content/65">
                Update your password regularly to protect clearance records.
              </p>
              <button
                onClick={() => navigate("/student/change-password")}
                className="btn btn-outline btn-sm mt-3"
              >
                Change Password
              </button>
            </article>

            <article className="rounded-xl border border-base-300 bg-base-100 p-4">
              <p className="text-xs uppercase tracking-[0.1em] text-base-content/55 font-semibold">
                Step 3
              </p>
              <p className="mt-1 text-sm font-semibold text-base-content">
                Download no-dues forms
              </p>
              <p className="mt-1 text-xs text-base-content/65">
                Keep both template and extra forms ready for final submission.
              </p>
              <button
                onClick={downloadBothNoDuesForms}
                className="btn btn-outline btn-sm mt-3"
              >
                Download Forms
              </button>
            </article>
          </div>
        </section>

        <section className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-base-content/80">
          Clearance tip: resolve payable dues first, then verify document-only
          dues to avoid last-minute delays.
        </section>
      </div>
    </DashboardLayout>
  );
};

export default StudentDashboard;
