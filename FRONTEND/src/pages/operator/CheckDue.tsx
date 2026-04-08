import { AlertCircle, CheckCircle, Search, XCircle } from "lucide-react";
import { useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import DashboardLayout from "../../components/DashboardLayout";

interface DueItem {
  id: number;
  due_type: string;
  is_payable: boolean;
  current_amount: number | null;
  amount_paid: number | null;
  permission_granted: boolean;
  due_clear_by_date: string;
  due_description: string | null;
  requires_permission: boolean;
}

interface StudentInfo {
  student_id: string;
  name: string;
  roll_number: string;
  email: string;
  branch: string;
  section: string;
  department_name: string;
}

interface CheckDueResponse {
  student: StudentInfo;
  activeDues: DueItem[];
  clearedDues: DueItem[];
  noDuesForm: {
    templateRows: { label: string; hasDue: boolean }[];
    extraRows: { label: string; hasDue: boolean }[];
  };
  summary: {
    hasActiveDues: boolean;
    totalActiveDues: number;
    totalClearedDues: number;
    totalActiveAmount: number;
  };
}

const CheckDue = () => {
  const [rollNumber, setRollNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [studentData, setStudentData] = useState<CheckDueResponse | null>(null);

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
    sectionId: userData.section_id,
    sectionName: userData.section_name || "ACADEMIC",
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!rollNumber.trim()) {
      toast.error("Please enter a roll number");
      return;
    }

    setLoading(true);
    setSearchPerformed(false);

    try {
      const response = await fetch(
        `/api/operator/check-student-dues/${rollNumber.trim()}`,
        {
          credentials: "include" as RequestCredentials,
        },
      );

      const data = await response.json();

      if (response.ok && data.success) {
        setStudentData(data.data);
        setSearchPerformed(true);
        toast.success("Student dues retrieved successfully");
      } else {
        toast.error(data.message || "Failed to fetch student dues");
        setStudentData(null);
        setSearchPerformed(true);
      }
    } catch (error) {
      console.error("Error fetching student dues:", error);
      toast.error("Failed to fetch student dues");
      setStudentData(null);
      setSearchPerformed(true);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setRollNumber("");
    setStudentData(null);
    setSearchPerformed(false);
  };

  const formatCurrency = (amount: number | null): string => {
    if (amount === null || amount === undefined) return "₹0.00";
    return `₹${amount.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const downloadNoDuesForm = async (table: "template" | "extra") => {
    if (!studentData?.student?.roll_number) return;
    try {
      const response = await fetch(
        `/api/operator/check-student-dues/${studentData.student.roll_number}/no-dues-form?table=${table}`,
        { credentials: "include" as RequestCredentials },
      );

      if (!response.ok) {
        toast.error("Failed to download PDF");
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `No_Dues_Form_${studentData.student.roll_number}_${table}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading PDF:", error);
      toast.error("Failed to download PDF");
    }
  };

  return (
    <DashboardLayout
      role={user.role}
      username={user.username}
      email={user.email}
      sectionName={user.sectionName}
    >
      <Toaster position="top-right" />

      <div className="min-h-screen bg-base-200 p-6">
        <div className="mx-auto max-w-6xl">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">Check Student Dues</h1>
            <p className="text-base-content/70">
              Search for a student by roll number to view their active and
              cleared dues
            </p>
          </div>

          {/* Search Form */}
          <div className="card bg-base-100 shadow-xl mb-6">
            <div className="card-body">
              <form onSubmit={handleSearch} className="flex gap-4">
                <div className="form-control flex-1">
                  <label className="label">
                    <span className="label-text font-semibold">
                      Student Roll Number
                    </span>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered input-lg"
                    placeholder="e.g., 21R11A0501"
                    value={rollNumber}
                    onChange={(e) =>
                      setRollNumber(e.target.value.toUpperCase())
                    }
                    disabled={loading}
                  />
                </div>
                <div className="flex items-end gap-2">
                  <button
                    type="submit"
                    className={`btn btn-primary btn-lg ${loading ? "loading" : ""}`}
                    disabled={loading}
                  >
                    {!loading && <Search size={20} />}
                    {loading ? "Searching..." : "Search"}
                  </button>
                  {searchPerformed && (
                    <button
                      type="button"
                      onClick={handleClear}
                      className="btn btn-ghost btn-lg"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>

          {/* Results */}
          {searchPerformed && studentData && (
            <>
              {/* Student Info */}
              <div className="card bg-base-100 shadow-xl mb-6">
                <div className="card-body">
                  <h2 className="card-title text-2xl mb-4">
                    Student Information
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-base-content/70">Name</p>
                      <p className="text-lg font-semibold">
                        {studentData.student.name}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-base-content/70">
                        Roll Number
                      </p>
                      <p className="text-lg font-semibold">
                        {studentData.student.roll_number}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-base-content/70">Email</p>
                      <p className="text-lg font-semibold">
                        {studentData.student.email}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-base-content/70">
                        Branch & Section
                      </p>
                      <p className="text-lg font-semibold">
                        {studentData.student.branch} -{" "}
                        {studentData.student.section}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Card */}
              <div className="card bg-base-100 shadow-xl mb-6">
                <div className="card-body">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="card-title text-2xl mb-2">Due Status</h2>
                      <p className="text-base-content/70">
                        Total Active: {studentData.summary.totalActiveDues} |
                        Total Cleared: {studentData.summary.totalClearedDues}
                      </p>
                    </div>
                    <div>
                      {studentData.summary.hasActiveDues ? (
                        <div className="badge badge-error badge-lg gap-2 p-4 whitespace-nowrap">
                          <XCircle size={20} />
                          <span className="text-base font-bold">HAS DUE</span>
                        </div>
                      ) : (
                        <div className="badge badge-success badge-lg gap-2 p-4 whitespace-nowrap">
                          <CheckCircle size={20} />
                          <span className="text-base font-bold">
                            NO ACTIVE DUE
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  {studentData.summary.totalActiveAmount > 0 && (
                    <div className="mt-4 p-4 bg-warning/10 rounded-lg">
                      <p className="text-sm text-base-content/70">
                        Total Payable Amount
                      </p>
                      <p className="text-2xl font-bold text-warning">
                        {formatCurrency(studentData.summary.totalActiveAmount)}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* No Dues Form */}
              <div className="card bg-base-100 shadow-xl mb-6">
                <div className="card-body">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                    <div>
                      <h2 className="card-title text-2xl mb-1">No Dues Form</h2>
                      <p className="text-base-content/70">
                        Tick means no due, cross means due exists
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => downloadNoDuesForm("template")}
                        className="btn btn-outline btn-sm"
                      >
                        Download Main Table
                      </button>
                      <button
                        onClick={() => downloadNoDuesForm("extra")}
                        className="btn btn-outline btn-sm"
                      >
                        Download Extra Table
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="table table-bordered w-full">
                      <thead className="bg-base-200">
                        <tr>
                          <th className="w-16">S. No.</th>
                          <th>Name of the Department/Section</th>
                          <th className="w-28">Dues</th>
                          <th className="w-40">Signature with date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {studentData.noDuesForm.templateRows.map(
                          (row, index) => (
                            <tr key={`${row.label}-${index}`}>
                              <td></td>
                              <td>{row.label}</td>
                              <td>
                                {row.hasDue ? (
                                  <span
                                    title="Has Due"
                                    className="text-error inline-flex"
                                  >
                                    <XCircle size={18} />
                                  </span>
                                ) : (
                                  <span
                                    title="No Due"
                                    className="text-success inline-flex"
                                  >
                                    <CheckCircle size={18} />
                                  </span>
                                )}
                              </td>
                              <td></td>
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="divider my-6"></div>

                  <div className="mb-3">
                    <h3 className="text-lg font-semibold">
                      Additional Departments/Sections (Not in Form)
                    </h3>
                  </div>
                  {studentData.noDuesForm.extraRows.length === 0 ? (
                    <p className="text-base-content/70">
                      No additional departments or sections with dues.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="table table-bordered w-full">
                        <thead className="bg-base-200">
                          <tr>
                            <th className="w-16">S. No.</th>
                            <th>Name of the Department/Section</th>
                            <th className="w-28">Dues</th>
                            <th className="w-40">Signature with date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {studentData.noDuesForm.extraRows.map(
                            (row, index) => (
                              <tr key={`${row.label}-${index}`}>
                                <td></td>
                                <td>{row.label}</td>
                                <td>
                                  <span
                                    title="Has Due"
                                    className="text-error inline-flex"
                                  >
                                    <XCircle size={18} />
                                  </span>
                                </td>
                                <td></td>
                              </tr>
                            ),
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* Active Dues */}
              {studentData.activeDues.length > 0 && (
                <div className="card bg-base-100 shadow-xl mb-6">
                  <div className="card-body">
                    <h2 className="card-title text-2xl mb-4 text-error">
                      Active Dues ({studentData.activeDues.length})
                    </h2>
                    <div className="overflow-x-auto">
                      <table className="table table-zebra">
                        <thead>
                          <tr>
                            <th>Due Type</th>
                            <th>Type</th>
                            <th>Amount</th>
                            <th>Due Date</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {studentData.activeDues.map((due) => (
                            <tr key={due.id}>
                              <td>
                                <div>
                                  <div className="font-bold">
                                    {due.due_type}
                                  </div>
                                  {due.due_description && (
                                    <div className="text-sm text-base-content/70">
                                      {due.due_description}
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td>
                                <span
                                  className={`badge whitespace-nowrap ${
                                    due.is_payable
                                      ? "badge-warning"
                                      : "badge-info"
                                  }`}
                                >
                                  {due.is_payable ? "Payable" : "Non-Payable"}
                                </span>
                              </td>
                              <td>
                                {due.is_payable ? (
                                  <div>
                                    <div className="font-semibold">
                                      {formatCurrency(
                                        (due.current_amount || 0) -
                                          (due.amount_paid || 0),
                                      )}
                                    </div>
                                    {due.amount_paid && due.amount_paid > 0 && (
                                      <div className="text-xs text-base-content/70">
                                        Paid: {formatCurrency(due.amount_paid)}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-base-content/50">
                                    N/A
                                  </span>
                                )}
                              </td>
                              <td>{formatDate(due.due_clear_by_date)}</td>
                              <td>
                                {due.requires_permission &&
                                due.permission_granted ? (
                                  <span className="badge badge-success whitespace-nowrap">
                                    Permission Granted
                                  </span>
                                ) : (
                                  <span className="badge badge-error whitespace-nowrap">
                                    Active
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Cleared Dues */}
              {studentData.clearedDues.length > 0 && (
                <div className="card bg-base-100 shadow-xl">
                  <div className="card-body">
                    <h2 className="card-title text-2xl mb-4 text-success">
                      Cleared Dues ({studentData.clearedDues.length})
                    </h2>
                    <div className="overflow-x-auto">
                      <table className="table table-zebra">
                        <thead>
                          <tr>
                            <th>Due Type</th>
                            <th>Type</th>
                            <th>Amount</th>
                            <th>Due Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {studentData.clearedDues.map((due) => (
                            <tr key={due.id}>
                              <td>
                                <div>
                                  <div className="font-bold">
                                    {due.due_type}
                                  </div>
                                  {due.due_description && (
                                    <div className="text-sm text-base-content/70">
                                      {due.due_description}
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td>
                                <span
                                  className={`badge whitespace-nowrap ${
                                    due.is_payable
                                      ? "badge-warning"
                                      : "badge-info"
                                  }`}
                                >
                                  {due.is_payable ? "Payable" : "Non-Payable"}
                                </span>
                              </td>
                              <td>
                                {due.is_payable ? (
                                  formatCurrency(due.current_amount)
                                ) : (
                                  <span className="text-base-content/50">
                                    N/A
                                  </span>
                                )}
                              </td>
                              <td>{formatDate(due.due_clear_by_date)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* No Results */}
          {searchPerformed && !studentData && (
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <div className="flex flex-col items-center justify-center py-12">
                  <AlertCircle
                    size={64}
                    className="text-base-content/30 mb-4"
                  />
                  <h3 className="text-2xl font-bold mb-2">No Student Found</h3>
                  <p className="text-base-content/70">
                    No student found with roll number: {rollNumber}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default CheckDue;
