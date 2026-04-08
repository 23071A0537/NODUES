import { Search } from "lucide-react";
import { useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import DashboardLayout from "../../components/DashboardLayout";

interface FacultyInfo {
  id: number;
  employee_code: string;
  name: string;
  department_name: string;
  section_name: string;
  designation: string;
  email: string;
  mobile: string;
}

interface FacultyDue {
  id: number;
  due_type: string;
  is_payable: boolean;
  current_amount: number | null;
  amount_paid: number;
  due_description: string;
  due_clear_by_date: string;
  is_cleared: boolean;
  overall_status: boolean;
  created_at: string;
  updated_at: string;
  added_by_name: string;
  cleared_by_name: string;
}

interface CheckResult {
  faculty: FacultyInfo;
  dues: FacultyDue[];
  activeDues: number;
  clearedDues: number;
}

const CheckFacultyDue = () => {
  const [empCode, setEmpCode] = useState("");
  const [result, setResult] = useState<CheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"active" | "cleared">("active");

  const userData = JSON.parse(localStorage.getItem("user") || "{}");
  const user = {
    username: userData.name || userData.username || "HR",
    email: userData.email || "",
    role: "hr" as const,
  };

  const search = async () => {
    const code = empCode.trim().toUpperCase();
    if (!code) return toast.error("Enter an employee code");
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/hr/check/${code}`, {
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        setResult(data.data);
        if (!data.data.faculty) {
          toast.error("Faculty not found");
        }
      } else {
        toast.error(data.message || "Faculty not found");
      }
    } catch {
      toast.error("Error searching faculty");
    } finally {
      setLoading(false);
    }
  };

  const activeDues = result?.dues.filter((d) => !d.is_cleared) ?? [];
  const clearedDues = result?.dues.filter((d) => d.is_cleared) ?? [];

  return (
    <DashboardLayout
      role={user.role}
      username={user.username}
      email={user.email}
    >
      <Toaster position="top-right" />
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold">Check Faculty Due</h1>
          <p className="text-base-content/60 mt-1">
            Look up all dues for a faculty member by employee code
          </p>
        </div>

        {/* Search bar */}
        <div className="card bg-base-100 shadow border border-base-200">
          <div className="card-body">
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Enter Employee Code (e.g. EMP001)"
                className="input input-bordered flex-1 uppercase"
                value={empCode}
                onChange={(e) => setEmpCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && search()}
              />
              <button
                className="btn btn-primary gap-2"
                onClick={search}
                disabled={loading}
              >
                {loading ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  <Search size={18} />
                )}
                Search
              </button>
            </div>
          </div>
        </div>

        {/* Results */}
        {result?.faculty && (
          <>
            {/* Faculty profile card */}
            <div className="card bg-base-100 shadow border border-base-200">
              <div className="card-body">
                <div className="flex items-start justify-between flex-wrap gap-4">
                  <div className="space-y-1">
                    <h2 className="text-xl font-bold">{result.faculty.name}</h2>
                    <p className="text-base-content/60">
                      {result.faculty.designation} &bull;{" "}
                      {result.faculty.department_name}
                      {result.faculty.section_name
                        ? ` / ${result.faculty.section_name}`
                        : ""}
                    </p>
                    {result.faculty.email && (
                      <p className="text-sm text-base-content/60">
                        {result.faculty.email}
                      </p>
                    )}
                    {result.faculty.mobile && (
                      <p className="text-sm text-base-content/60">
                        {result.faculty.mobile}
                      </p>
                    )}
                  </div>
                  <div className="font-mono text-lg font-semibold bg-base-200 px-4 py-2 rounded-lg">
                    {result.faculty.employee_code}
                  </div>
                </div>

                {/* Due summary badges */}
                <div className="flex gap-3 mt-3">
                  <div className="stat bg-error/10 rounded-xl p-3 flex-1 text-center">
                    <div className="stat-value text-2xl text-error">
                      {result.activeDues}
                    </div>
                    <div className="stat-desc">Active Dues</div>
                  </div>
                  <div className="stat bg-success/10 rounded-xl p-3 flex-1 text-center">
                    <div className="stat-value text-2xl text-success">
                      {result.clearedDues}
                    </div>
                    <div className="stat-desc">Cleared Dues</div>
                  </div>
                  <div className="stat bg-base-200 rounded-xl p-3 flex-1 text-center">
                    <div className="stat-value text-2xl">
                      {result.dues.length}
                    </div>
                    <div className="stat-desc">Total Dues</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Dues list tabs */}
            <div className="card bg-base-100 shadow border border-base-200">
              <div className="card-body">
                <div className="tabs tabs-bordered mb-4">
                  <button
                    className={`tab tab-lg gap-2 ${activeTab === "active" ? "tab-active" : ""}`}
                    onClick={() => setActiveTab("active")}
                  >
                    Active Dues
                    {result.activeDues > 0 && (
                      <span className="badge badge-error badge-sm">
                        {result.activeDues}
                      </span>
                    )}
                  </button>
                  <button
                    className={`tab tab-lg gap-2 ${activeTab === "cleared" ? "tab-active" : ""}`}
                    onClick={() => setActiveTab("cleared")}
                  >
                    Cleared Dues
                    {result.clearedDues > 0 && (
                      <span className="badge badge-success badge-sm">
                        {result.clearedDues}
                      </span>
                    )}
                  </button>
                </div>

                {activeTab === "active" && (
                  <>
                    {activeDues.length === 0 ? (
                      <p className="text-center text-base-content/50 py-8">
                        No active dues for this faculty member
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {activeDues.map((due) => (
                          <DueCard key={due.id} due={due} />
                        ))}
                      </div>
                    )}
                  </>
                )}

                {activeTab === "cleared" && (
                  <>
                    {clearedDues.length === 0 ? (
                      <p className="text-center text-base-content/50 py-8">
                        No cleared dues for this faculty member
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {clearedDues.map((due) => (
                          <DueCard key={due.id} due={due} />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

const DueCard = ({ due }: { due: FacultyDue }) => (
  <div
    className={`rounded-lg border p-4 ${
      due.is_cleared
        ? "border-success/30 bg-success/5"
        : "border-warning/30 bg-warning/5"
    }`}
  >
    <div className="flex items-start justify-between flex-wrap gap-2">
      <div>
        <div className="flex items-center gap-2">
          <span className="font-semibold">{due.due_type}</span>
          <span
            className={`badge badge-sm ${
              due.is_payable
                ? "badge-warning badge-outline"
                : "badge-info badge-outline"
            }`}
          >
            {due.is_payable ? "Payable" : "Non-Payable"}
          </span>
          <span
            className={`badge badge-sm ${due.is_cleared ? "badge-success" : "badge-error"}`}
          >
            {due.is_cleared ? "Cleared" : "Active"}
          </span>
        </div>
        {due.due_description && (
          <p className="text-sm text-base-content/60 mt-1">
            {due.due_description}
          </p>
        )}
      </div>
      {due.current_amount != null && (
        <span className="text-lg font-bold">
          ₹{Number(due.current_amount).toLocaleString("en-IN")}
        </span>
      )}
    </div>

    <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-base-content/50 mt-2">
      <span>Added by: {due.added_by_name}</span>
      <span>
        Added on: {new Date(due.created_at).toLocaleDateString("en-IN")}
      </span>
      {due.due_clear_by_date && (
        <span>
          Clear by:{" "}
          {new Date(due.due_clear_by_date).toLocaleDateString("en-IN")}
        </span>
      )}
      {due.is_cleared && due.cleared_by_name && (
        <span>Cleared by: {due.cleared_by_name}</span>
      )}
      {due.is_cleared && due.updated_at && (
        <span>
          Cleared on: {new Date(due.updated_at).toLocaleDateString("en-IN")}
        </span>
      )}
    </div>
  </div>
);

export default CheckFacultyDue;
