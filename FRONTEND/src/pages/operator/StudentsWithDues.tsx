import { ChevronDown, ChevronUp, Filter, Search, Users } from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import DashboardLayout from "../../components/DashboardLayout";

interface Due {
  dueId: number;
  dueType: string;
  issuingEntity: string | null;
  issuingScope: "department" | "section" | "unknown";
  isPayable: boolean;
  status: string;
  currentAmount: number | null;
  outstandingAmount: number | null;
  amountPaid: number;
  createdDate: string;
  dueDate: string;
  description: string | null;
}

interface StudentWithDues {
  rollNumber: string;
  name: string;
  academicYear: string;
  branch: string;
  section: string;
  mobile: string;
  activeDuesCount: number;
  dues: Due[];
}

interface Pagination {
  currentPage: number;
  totalPages: number;
  totalRecords: number;
  recordsPerPage: number;
}

interface Summary {
  departmentId: number;
  departmentName: string;
  totalStudentsWithDues: number;
  totalActiveDuesOnPage: number;
}

interface FilterState {
  rollNumber: string;
  startDate: string;
  endDate: string;
}

const StudentsWithDues = () => {
  const [students, setStudents] = useState<StudentWithDues[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [pagination, setPagination] = useState<Pagination>({
    currentPage: 1,
    totalPages: 1,
    totalRecords: 0,
    recordsPerPage: 50,
  });
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noAccessMessage, setNoAccessMessage] = useState<string | null>(null);

  const [filters, setFilters] = useState<FilterState>({
    rollNumber: "",
    startDate: "",
    endDate: "",
  });
  const [appliedFilters, setAppliedFilters] = useState<FilterState>({
    rollNumber: "",
    startDate: "",
    endDate: "",
  });

  const userData = JSON.parse(localStorage.getItem("user") || "{}");
  const user = {
    username: userData.name || userData.username || "Operator",
    email: userData.email || "operator@vnrvjiet.in",
    role: (userData.role || "operator") as
      | "admin"
      | "operator"
      | "hod"
      | "student"
      | "hr"
      | "faculty",
    sectionName: userData.section_name || "",
  };

  useEffect(() => {
    fetchStudentsWithDues();
  }, [pagination.currentPage, appliedFilters]);

  const fetchStudentsWithDues = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: pagination.currentPage.toString(),
        limit: pagination.recordsPerPage.toString(),
      });

      if (appliedFilters.rollNumber.trim()) {
        params.append("rollNumber", appliedFilters.rollNumber.trim());
      }
      if (appliedFilters.startDate) {
        params.append("startDate", appliedFilters.startDate);
      }
      if (appliedFilters.endDate) {
        params.append("endDate", appliedFilters.endDate);
      }

      const response = await fetch(
        `/api/operator/students-with-dues?${params.toString()}`,
        {
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      const data = (await response.json()) as {
        success?: boolean;
        message?: string;
        data?: {
          students?: StudentWithDues[];
          summary?: Summary;
          pagination?: Pagination;
        };
      };

      if (response.status === 403) {
        setNoAccessMessage(
          data.message || "You do not have access to this view",
        );
        setStudents([]);
        setSummary(null);
        setPagination((prev) => ({
          ...prev,
          totalPages: 1,
          totalRecords: 0,
        }));
        return;
      }

      if (!response.ok || !data.success || !data.data) {
        throw new Error(data.message || "Failed to fetch students with dues");
      }

      setNoAccessMessage(null);
      setStudents(data.data.students || []);
      setSummary(data.data.summary || null);
      if (data.data.pagination) {
        setPagination(data.data.pagination);
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to load students with dues";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    setExpandedRows(new Set());
    setPagination((prev) => ({ ...prev, currentPage: 1 }));
    setAppliedFilters({ ...filters });
  };

  const clearFilters = () => {
    const clearedFilters = {
      rollNumber: "",
      startDate: "",
      endDate: "",
    };
    setFilters(clearedFilters);
    setExpandedRows(new Set());
    setPagination((prev) => ({ ...prev, currentPage: 1 }));
    setAppliedFilters(clearedFilters);
  };

  const toggleRow = (rollNumber: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rollNumber)) {
        next.delete(rollNumber);
      } else {
        next.add(rollNumber);
      }
      return next;
    });
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-IN");
  };

  const formatAmount = (amount: number | null) => {
    if (amount === null) return "N/A";
    return `INR ${amount.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  return (
    <DashboardLayout
      role={user.role}
      username={user.username}
      email={user.email}
      sectionName={user.sectionName}
    >
      <Toaster position="top-right" />
      <div className="space-y-6">
        <div className="official-card p-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-primary">
            Department Students With Dues
          </h1>
          <p className="text-base-content/70 mt-2">
            Read-only view of students in your department and all their active
            dues, including dues issued by other departments or sections.
          </p>
          {summary && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="official-surface-plain px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-base-content/60">
                  Department
                </p>
                <p className="font-semibold text-primary mt-1">
                  {summary.departmentName || "Department"}
                </p>
              </div>
              <div className="official-surface-plain px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-base-content/60">
                  Students With Dues
                </p>
                <p className="font-semibold mt-1">
                  {summary.totalStudentsWithDues}
                </p>
              </div>
              <div className="official-surface-plain px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-base-content/60">
                  Active Dues In Page
                </p>
                <p className="font-semibold mt-1">
                  {summary.totalActiveDuesOnPage}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="alert alert-info">
          <span>This page is read-only. You can only view dues from here.</span>
        </div>

        <div className="official-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter size={20} className="text-primary" />
            <h3 className="text-lg font-semibold">Filters</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text">Roll Number</span>
              </label>
              <input
                type="text"
                placeholder="Search by roll number"
                className="input input-bordered"
                value={filters.rollNumber}
                onChange={(event) =>
                  setFilters((prev) => ({
                    ...prev,
                    rollNumber: event.target.value.toUpperCase(),
                  }))
                }
              />
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text">From Date</span>
              </label>
              <input
                type="date"
                className="input input-bordered"
                value={filters.startDate}
                onChange={(event) =>
                  setFilters((prev) => ({
                    ...prev,
                    startDate: event.target.value,
                  }))
                }
              />
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text">To Date</span>
              </label>
              <input
                type="date"
                className="input input-bordered"
                value={filters.endDate}
                onChange={(event) =>
                  setFilters((prev) => ({
                    ...prev,
                    endDate: event.target.value,
                  }))
                }
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button className="btn btn-primary gap-2" onClick={applyFilters}>
              <Search size={16} />
              Apply Filters
            </button>
            <button className="btn btn-outline" onClick={clearFilters}>
              Clear
            </button>
          </div>
        </div>

        {loading ? (
          <div className="official-card p-10 flex justify-center">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        ) : noAccessMessage ? (
          <div className="official-card p-10 text-center">
            <Users className="mx-auto text-base-content/35 mb-3" size={60} />
            <p className="text-warning font-semibold">{noAccessMessage}</p>
          </div>
        ) : error ? (
          <div className="official-card p-10 text-center">
            <p className="text-error">{error}</p>
          </div>
        ) : students.length === 0 ? (
          <div className="official-card p-10 text-center">
            <Users className="mx-auto text-base-content/35 mb-3" size={60} />
            <p className="text-base-content/70">
              No students with active dues found for the selected filters.
            </p>
          </div>
        ) : (
          <>
            <div className="official-card p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="table table-zebra w-full">
                  <thead className="bg-base-200">
                    <tr>
                      <th className="w-12"></th>
                      <th>Roll Number</th>
                      <th>Name</th>
                      <th>Academic Year</th>
                      <th>Branch</th>
                      <th>Section</th>
                      <th>Mobile</th>
                      <th>Active Dues</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student) => (
                      <Fragment key={student.rollNumber}>
                        <tr className="hover">
                          <td>
                            <button
                              className="btn btn-sm btn-ghost"
                              onClick={() => toggleRow(student.rollNumber)}
                              aria-label={`Toggle due details for ${student.rollNumber}`}
                            >
                              {expandedRows.has(student.rollNumber) ? (
                                <ChevronUp size={16} />
                              ) : (
                                <ChevronDown size={16} />
                              )}
                            </button>
                          </td>
                          <td className="font-semibold">
                            {student.rollNumber}
                          </td>
                          <td>{student.name}</td>
                          <td>{student.academicYear}</td>
                          <td>{student.branch}</td>
                          <td>{student.section}</td>
                          <td>{student.mobile || "N/A"}</td>
                          <td>
                            <span className="badge badge-error badge-lg">
                              {student.activeDuesCount}
                            </span>
                          </td>
                        </tr>
                        {expandedRows.has(student.rollNumber) && (
                          <tr>
                            <td colSpan={8} className="bg-base-200/50">
                              <div className="p-4">
                                <h4 className="font-semibold mb-3">
                                  All Active Dues
                                </h4>
                                <div className="overflow-x-auto">
                                  <table className="table table-sm w-full">
                                    <thead>
                                      <tr>
                                        <th>Due Type</th>
                                        <th>Issued By</th>
                                        <th>Payable</th>
                                        <th>Status</th>
                                        <th>Current Amount</th>
                                        <th>Outstanding Amount</th>
                                        <th>Amount Paid</th>
                                        <th>Added On</th>
                                        <th>Due Date</th>
                                        <th>Description</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {student.dues.map((due) => (
                                        <tr key={due.dueId}>
                                          <td>{due.dueType}</td>
                                          <td>
                                            {due.issuingEntity || "Unknown"}
                                            <span className="text-xs text-base-content/60 ml-1">
                                              ({due.issuingScope})
                                            </span>
                                          </td>
                                          <td>
                                            <span
                                              className={`badge ${
                                                due.isPayable
                                                  ? "badge-warning"
                                                  : "badge-info"
                                              }`}
                                            >
                                              {due.isPayable ? "Yes" : "No"}
                                            </span>
                                          </td>
                                          <td>
                                            <span
                                              className={`badge ${
                                                due.status ===
                                                "Permission Granted"
                                                  ? "badge-success"
                                                  : "badge-error"
                                              }`}
                                            >
                                              {due.status}
                                            </span>
                                          </td>
                                          <td>
                                            {formatAmount(due.currentAmount)}
                                          </td>
                                          <td>
                                            {formatAmount(
                                              due.outstandingAmount,
                                            )}
                                          </td>
                                          <td>
                                            {formatAmount(due.amountPaid)}
                                          </td>
                                          <td>{formatDate(due.createdDate)}</td>
                                          <td>{formatDate(due.dueDate)}</td>
                                          <td>{due.description || "N/A"}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="official-card p-4 flex items-center justify-between">
              <p className="text-sm text-base-content/70">
                Showing page {pagination.currentPage} of {pagination.totalPages}{" "}
                ({pagination.totalRecords} students)
              </p>
              <div className="flex gap-2">
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() =>
                    setPagination((prev) => ({
                      ...prev,
                      currentPage: Math.max(1, prev.currentPage - 1),
                    }))
                  }
                  disabled={pagination.currentPage <= 1}
                >
                  Previous
                </button>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() =>
                    setPagination((prev) => ({
                      ...prev,
                      currentPage: Math.min(
                        prev.totalPages,
                        prev.currentPage + 1,
                      ),
                    }))
                  }
                  disabled={pagination.currentPage >= pagination.totalPages}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default StudentsWithDues;
