import {
  ChevronDown,
  ChevronUp,
  Download,
  Filter,
  Search,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import DashboardLayout from "../../components/DashboardLayout";

interface Due {
  dueId: number;
  amount: number | null;
  isPayable: boolean;
  status: string;
  issuingDepartment: string;
  dueType: string;
  createdDate: string;
  dueDate: string;
  description: string;
}

interface Student {
  rollNumber: string;
  name: string;
  academicYear: string;
  branch: string;
  section: string;
  mobile: string;
  fatherName: string;
  fatherMobile: string;
  activeDuesCount: number;
  dues: Due[];
}

interface Pagination {
  currentPage: number;
  totalPages: number;
  totalRecords: number;
  recordsPerPage: number;
}

interface AcademicYear {
  id: number;
  label: string;
}

const StudentsWithDues = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    currentPage: 1,
    totalPages: 1,
    totalRecords: 0,
    recordsPerPage: 50,
  });
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [rollNumberFilter, setRollNumberFilter] = useState("");
  const [academicYearFilter, setAcademicYearFilter] = useState("");
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");

  const userData = JSON.parse(localStorage.getItem("user") || "{}");
  const user = {
    username: userData.username || "HOD",
    email: userData.email || "hod@vnrvjiet.in",
    role: (userData.role || "hod") as "admin" | "operator" | "hod" | "student",
    departmentName: userData.department_name || "Department",
  };

  useEffect(() => {
    fetchAcademicYears();
    fetchStudentsWithDues();
  }, [pagination.currentPage]);

  const fetchAcademicYears = async () => {
    try {
      const response = await fetch("/api/hod/academic-years", {
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        setAcademicYears(data.data);
      }
    } catch (err) {
      console.error("Error fetching academic years:", err);
    }
  };

  const fetchStudentsWithDues = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: pagination.currentPage.toString(),
        limit: pagination.recordsPerPage.toString(),
      });

      if (rollNumberFilter) params.append("rollNumber", rollNumberFilter);
      if (academicYearFilter) params.append("academicYear", academicYearFilter);
      if (startDateFilter) params.append("startDate", startDateFilter);
      if (endDateFilter) params.append("endDate", endDateFilter);

      const response = await fetch(`/api/hod/students-with-dues?${params}`, {
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch students");
      }

      const data = await response.json();
      setStudents(data.data.students);
      setPagination(data.data.pagination);
    } catch (err) {
      console.error("Error fetching students:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load students";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (rollNumberFilter) params.append("rollNumber", rollNumberFilter);
      if (academicYearFilter) params.append("academicYear", academicYearFilter);
      if (startDateFilter) params.append("startDate", startDateFilter);
      if (endDateFilter) params.append("endDate", endDateFilter);

      const response = await fetch(
        `/api/hod/students-with-dues/export?${params}`,
        {
          credentials: "include",
        },
      );

      if (!response.ok) {
        throw new Error("Failed to export data");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `students-with-dues-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Export successful");
    } catch (err) {
      console.error("Error exporting:", err);
      toast.error("Failed to export data");
    }
  };

  const toggleRow = (rollNumber: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(rollNumber)) {
      newExpanded.delete(rollNumber);
    } else {
      newExpanded.add(rollNumber);
    }
    setExpandedRows(newExpanded);
  };

  const applyFilters = () => {
    setPagination({ ...pagination, currentPage: 1 });
    fetchStudentsWithDues();
  };

  const clearFilters = () => {
    setRollNumberFilter("");
    setAcademicYearFilter("");
    setStartDateFilter("");
    setEndDateFilter("");
    setPagination({ ...pagination, currentPage: 1 });
    setTimeout(fetchStudentsWithDues, 0);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-IN");
  };

  const formatAmount = (amount: number | null) => {
    if (amount === null) return "N/A";
    return `₹${amount.toLocaleString("en-IN")}`;
  };

  return (
    <DashboardLayout
      role={user.role}
      username={user.username}
      email={user.email}
    >
      <Toaster position="top-right" />
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-primary">
              Students with Active Dues
            </h1>
            <p className="text-base-content/70 mt-1">
              View and track students with pending dues in {user.departmentName}
            </p>
          </div>
          <button
            className="btn btn-primary gap-2"
            onClick={handleExport}
            disabled={students.length === 0}
          >
            <Download size={20} />
            Export CSV
          </button>
        </div>

        {/* Filters */}
        <div className="bg-base-100 rounded-lg shadow-md p-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter size={20} className="text-primary" />
            <h3 className="text-lg font-semibold">Filters</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text">Roll Number</span>
              </label>
              <input
                type="text"
                placeholder="Search by roll number"
                className="input input-bordered"
                value={rollNumberFilter}
                onChange={(e) => setRollNumberFilter(e.target.value)}
              />
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text">Academic Year</span>
              </label>
              <select
                className="select select-bordered"
                value={academicYearFilter}
                onChange={(e) => setAcademicYearFilter(e.target.value)}
              >
                <option value="">All Years</option>
                {academicYears.map((year) => (
                  <option key={year.id} value={year.id}>
                    {year.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text">From Date</span>
              </label>
              <input
                type="date"
                className="input input-bordered"
                value={startDateFilter}
                onChange={(e) => setStartDateFilter(e.target.value)}
              />
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text">To Date</span>
              </label>
              <input
                type="date"
                className="input input-bordered"
                value={endDateFilter}
                onChange={(e) => setEndDateFilter(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button className="btn btn-primary gap-2" onClick={applyFilters}>
              <Search size={16} />
              Apply Filters
            </button>
            <button className="btn btn-outline gap-2" onClick={clearFilters}>
              Clear Filters
            </button>
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="loading loading-spinner loading-lg text-primary"></div>
          </div>
        ) : error ? (
          <div className="bg-error/10 border border-error rounded-lg p-6 text-center">
            <p className="text-error">{error}</p>
          </div>
        ) : students.length === 0 ? (
          <div className="bg-base-100 rounded-lg shadow-md p-12 text-center">
            <Users className="mx-auto text-base-content/30 mb-4" size={64} />
            <h3 className="text-xl font-bold text-base-content/70 mb-2">
              No Students Found
            </h3>
            <p className="text-base-content/50">
              No students with active dues match your search criteria.
            </p>
          </div>
        ) : (
          <>
            {/* Table */}
            <div className="bg-base-100 rounded-lg shadow-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="table table-zebra w-full">
                  <thead className="bg-base-200">
                    <tr>
                      <th className="w-12"></th>
                      <th>Roll Number</th>
                      <th>Student Name</th>
                      <th>Academic Year</th>
                      <th>Section</th>
                      <th>Mobile</th>
                      <th>Active Dues</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student) => (
                      <>
                        <tr key={student.rollNumber} className="hover">
                          <td>
                            <button
                              className="btn btn-sm btn-ghost"
                              onClick={() => toggleRow(student.rollNumber)}
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
                          <td>{student.section}</td>
                          <td>{student.mobile}</td>
                          <td>
                            <span className="badge badge-error badge-lg">
                              {student.activeDuesCount}
                            </span>
                          </td>
                        </tr>
                        {expandedRows.has(student.rollNumber) && (
                          <tr>
                            <td colSpan={7} className="bg-base-200/50">
                              <div className="p-4 space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                                  <div>
                                    <p className="text-sm text-base-content/70">
                                      Father's Name
                                    </p>
                                    <p className="font-semibold">
                                      {student.fatherName}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-base-content/70">
                                      Father's Mobile
                                    </p>
                                    <p className="font-semibold">
                                      {student.fatherMobile}
                                    </p>
                                  </div>
                                </div>
                                <div>
                                  <h4 className="font-bold text-lg mb-3">
                                    Active Dues
                                  </h4>
                                  <div className="overflow-x-auto">
                                    <table className="table table-compact w-full">
                                      <thead>
                                        <tr>
                                          <th>Due Type</th>
                                          <th>Issuing Department</th>
                                          <th>Amount</th>
                                          <th>Payable</th>
                                          <th>Created Date</th>
                                          <th>Due Date</th>
                                          <th>Description</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {student.dues.map((due) => (
                                          <tr key={due.dueId}>
                                            <td>{due.dueType}</td>
                                            <td>{due.issuingDepartment}</td>
                                            <td className="font-semibold">
                                              {formatAmount(due.amount)}
                                            </td>
                                            <td>
                                              <span
                                                className={`badge badge-sm ${due.isPayable ? "badge-warning" : "badge-info"}`}
                                              >
                                                {due.isPayable ? "Yes" : "No"}
                                              </span>
                                            </td>
                                            <td>
                                              {formatDate(due.createdDate)}
                                            </td>
                                            <td>{formatDate(due.dueDate)}</td>
                                            <td className="max-w-xs truncate">
                                              {due.description || "N/A"}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            <div className="flex justify-between items-center">
              <div className="text-sm text-base-content/70">
                Showing{" "}
                {(pagination.currentPage - 1) * pagination.recordsPerPage + 1}{" "}
                to{" "}
                {Math.min(
                  pagination.currentPage * pagination.recordsPerPage,
                  pagination.totalRecords,
                )}{" "}
                of {pagination.totalRecords} students
              </div>
              <div className="join">
                <button
                  className="join-item btn btn-sm"
                  onClick={() =>
                    setPagination({
                      ...pagination,
                      currentPage: pagination.currentPage - 1,
                    })
                  }
                  disabled={pagination.currentPage === 1}
                >
                  «
                </button>
                <button className="join-item btn btn-sm">
                  Page {pagination.currentPage} of {pagination.totalPages}
                </button>
                <button
                  className="join-item btn btn-sm"
                  onClick={() =>
                    setPagination({
                      ...pagination,
                      currentPage: pagination.currentPage + 1,
                    })
                  }
                  disabled={pagination.currentPage === pagination.totalPages}
                >
                  »
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
