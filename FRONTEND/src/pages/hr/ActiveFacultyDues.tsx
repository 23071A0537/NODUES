import { Download, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import * as XLSX from "xlsx";
import DashboardLayout from "../../components/DashboardLayout";

interface FacultyDue {
  id: number;
  employee_code: string;
  faculty_name: string;
  department_name: string;
  section_name: string;
  due_type: string;
  is_payable: boolean;
  current_amount: number | null;
  amount_paid: number;
  due_description: string;
  due_clear_by_date: string;
  created_at: string;
  added_by_name: string;
  needs_original: boolean;
  needs_pdf: boolean;
}

interface DueType {
  id: number;
  type_name: string;
}

const ActiveFacultyDues = () => {
  const [dues, setDues] = useState<FacultyDue[]>([]);
  const [filtered, setFiltered] = useState<FacultyDue[]>([]);
  const [dueTypes, setDueTypes] = useState<DueType[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [payableFilter, setPayableFilter] = useState<
    "all" | "payable" | "non-payable"
  >("all");
  const [dueTypeFilter, setDueTypeFilter] = useState("all");

  const [clearing, setClearing] = useState(false);
  const [clearTarget, setClearTarget] = useState<FacultyDue | null>(null);
  const [clearRemarks, setClearRemarks] = useState("");

  const ITEMS_PER_PAGE = 50;
  const [page, setPage] = useState(1);

  const userData = JSON.parse(localStorage.getItem("user") || "{}");
  const user = {
    username: userData.name || userData.username || "HR",
    email: userData.email || "",
    role: "hr" as const,
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [duesRes, typesRes] = await Promise.all([
        fetch("/api/hr/dues/active", { credentials: "include" }),
        fetch("/api/hr/due-types", { credentials: "include" }),
      ]);
      const [duesData, typesData] = await Promise.all([
        duesRes.json(),
        typesRes.json(),
      ]);
      if (duesData.success) setDues(duesData.data);
      if (typesData.success) setDueTypes(typesData.data);
    } catch {
      toast.error("Error loading dues");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    let result = [...dues];
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (d) =>
          d.faculty_name.toLowerCase().includes(term) ||
          d.employee_code.toLowerCase().includes(term) ||
          d.department_name?.toLowerCase().includes(term),
      );
    }
    if (payableFilter === "payable")
      result = result.filter((d) => d.is_payable);
    if (payableFilter === "non-payable")
      result = result.filter((d) => !d.is_payable);
    if (dueTypeFilter !== "all")
      result = result.filter((d) => d.due_type === dueTypeFilter);
    setFiltered(result);
    setPage(1);
  }, [dues, searchTerm, payableFilter, dueTypeFilter]);

  const paginated = filtered.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE,
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));

  const clearDue = async () => {
    if (!clearTarget) return;
    setClearing(true);
    try {
      const res = await fetch(`/api/hr/dues/${clearTarget.id}/clear`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ remarks: clearRemarks }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Due cleared successfully");
        setClearTarget(null);
        setClearRemarks("");
        fetchData();
      } else {
        toast.error(data.message || "Failed to clear due");
      }
    } catch {
      toast.error("Error clearing due");
    } finally {
      setClearing(false);
    }
  };

  const exportExcel = () => {
    const rows = filtered.map((d) => ({
      "Employee Code": d.employee_code,
      "Faculty Name": d.faculty_name,
      Department: d.department_name,
      Section: d.section_name || "",
      "Due Type": d.due_type,
      Type: d.is_payable ? "Payable" : "Non-Payable",
      "Amount (₹)": d.current_amount ?? "",
      "Amount Paid (₹)": d.amount_paid,
      Description: d.due_description || "",
      "Clear By": d.due_clear_by_date
        ? new Date(d.due_clear_by_date).toLocaleDateString("en-IN")
        : "",
      "Added By": d.added_by_name,
      "Added On": new Date(d.created_at).toLocaleDateString("en-IN"),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Active Faculty Dues");
    XLSX.writeFile(
      wb,
      `active_faculty_dues_${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  };

  return (
    <DashboardLayout
      role={user.role}
      username={user.username}
      email={user.email}
    >
      <Toaster position="top-right" />
      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">Active Faculty Dues</h1>
            <p className="text-base-content/60 mt-1">
              {filtered.length} due{filtered.length !== 1 ? "s" : ""} found
            </p>
          </div>
          <button
            className="btn btn-outline btn-sm gap-2"
            onClick={exportExcel}
          >
            <Download size={16} /> Export Excel
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40"
            />
            <input
              type="text"
              placeholder="Search by name / code / dept..."
              className="input input-bordered pl-9 w-64"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2"
                onClick={() => setSearchTerm("")}
              >
                <X size={14} />
              </button>
            )}
          </div>

          <select
            className="select select-bordered"
            value={payableFilter}
            onChange={(e) =>
              setPayableFilter(e.target.value as typeof payableFilter)
            }
          >
            <option value="all">All Types</option>
            <option value="payable">Payable</option>
            <option value="non-payable">Non-Payable</option>
          </select>

          <select
            className="select select-bordered"
            value={dueTypeFilter}
            onChange={(e) => setDueTypeFilter(e.target.value)}
          >
            <option value="all">All Due Types</option>
            {dueTypes.map((dt) => (
              <option key={dt.id} value={dt.type_name}>
                {dt.type_name}
              </option>
            ))}
          </select>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-16">
            <span className="loading loading-spinner loading-lg text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="card bg-base-100 shadow border border-base-200">
            <div className="card-body text-center py-16">
              <p className="text-base-content/50">
                No active faculty dues found
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="card bg-base-100 shadow border border-base-200 overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Employee Code</th>
                    <th>Faculty Name</th>
                    <th>Department</th>
                    <th>Due Type</th>
                    <th>Category</th>
                    <th>Amount</th>
                    <th>Clear By</th>
                    <th>Added By</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((due) => (
                    <tr key={due.id} className="hover">
                      <td className="font-mono text-sm">{due.employee_code}</td>
                      <td className="font-medium">{due.faculty_name}</td>
                      <td className="text-sm">{due.department_name}</td>
                      <td className="text-sm">{due.due_type}</td>
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
                      <td className="text-sm">
                        {due.due_clear_by_date
                          ? new Date(due.due_clear_by_date).toLocaleDateString(
                              "en-IN",
                            )
                          : "—"}
                      </td>
                      <td className="text-sm text-base-content/60">
                        {due.added_by_name}
                      </td>
                      <td>
                        <button
                          className="btn btn-success btn-xs"
                          onClick={() => {
                            setClearTarget(due);
                            setClearRemarks("");
                          }}
                        >
                          Clear
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-2">
                <button
                  className="btn btn-sm btn-ghost"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  «
                </button>
                <span className="btn btn-sm btn-ghost no-animation cursor-default">
                  {page} / {totalPages}
                </span>
                <button
                  className="btn btn-sm btn-ghost"
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  »
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Clear Due Modal */}
      {clearTarget && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Clear Faculty Due</h3>
            <div className="mt-3 space-y-1">
              <p>
                <span className="font-medium">{clearTarget.faculty_name}</span>{" "}
                ({clearTarget.employee_code})
              </p>
              <p className="text-sm text-base-content/60">
                {clearTarget.due_type} &bull;{" "}
                {clearTarget.current_amount != null
                  ? `₹${Number(clearTarget.current_amount).toLocaleString("en-IN")}`
                  : "Non-Payable"}
              </p>
            </div>
            <div className="form-control mt-4">
              <label className="label">
                <span className="label-text">Remarks (optional)</span>
              </label>
              <textarea
                className="textarea textarea-bordered"
                rows={3}
                placeholder="Reason for clearing..."
                value={clearRemarks}
                onChange={(e) => setClearRemarks(e.target.value)}
              />
            </div>
            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={() => setClearTarget(null)}
                disabled={clearing}
              >
                Cancel
              </button>
              <button
                className="btn btn-success"
                onClick={clearDue}
                disabled={clearing}
              >
                {clearing && (
                  <span className="loading loading-spinner loading-sm" />
                )}
                Confirm Clear
              </button>
            </div>
          </div>
          <div
            className="modal-backdrop"
            onClick={() => !clearing && setClearTarget(null)}
          />
        </div>
      )}
    </DashboardLayout>
  );
};

export default ActiveFacultyDues;
