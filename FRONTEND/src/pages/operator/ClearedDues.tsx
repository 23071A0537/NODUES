import { Download, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import * as XLSX from "xlsx";
import DashboardLayout from "../../components/DashboardLayout";

interface DueType {
  id: number;
  type_name: string;
  is_payable: boolean;
  requires_permission: boolean;
}

interface ClearedDue {
  id: number;
  due_unique_id?: string;
  due_source?: string;
  student_roll_number: string;
  student_name: string;
  due_type: string;
  is_payable: boolean;
  current_amount: number | null;
  amount_paid: number;
  due_description: string;
  due_clear_by_date: string;
  created_at: string;
  cleared_at: string;
  cleared_by: string;
  is_cleared: boolean;
  overall_status: boolean;
  permission_granted: boolean;
  needs_original: boolean;
  needs_pdf: boolean;
  academic_year_label?: string | null;
  is_form_submitted?: boolean | null;
  submitted_at?: string | null;
  status_of_registration_with_alumni_portal?: "Y" | "N" | null;
  linkedin_profile_link?: string | null;
  placement_status?: "Y" | "N" | null;
  proof_of_placement?: string | null;
  planning_for_higher_education?: "Y" | "N" | null;
  proof_of_higher_education?: string | null;
  campaign_key?: string | null;
}

const ClearedDues = () => {
  const [dues, setDues] = useState<ClearedDue[]>([]);
  const [filteredDues, setFilteredDues] = useState<ClearedDue[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [payableFilter, setPayableFilter] = useState<
    "all" | "payable" | "non-payable"
  >("all");
  const [dueTypeFilter, setDueTypeFilter] = useState("all");
  const [alumniAcademicYearFilter, setAlumniAcademicYearFilter] =
    useState<string>("all");
  const [alumniRegistrationFilter, setAlumniRegistrationFilter] = useState<
    "all" | "Y" | "N"
  >("all");
  const [alumniPlacementFilter, setAlumniPlacementFilter] = useState<
    "all" | "Y" | "N"
  >("all");
  const [alumniHigherEducationFilter, setAlumniHigherEducationFilter] =
    useState<"all" | "Y" | "N">("all");
  const [dueTypes, setDueTypes] = useState<DueType[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const DUES_PER_PAGE = 50;

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
    departmentId: userData.department_id,
    sectionId: userData.section_id,
    sectionName: userData.section_name || userData.sectionName || "",
  };

  const isAlumniSectionOperator = /alumni|alumini/i.test(
    String(user.sectionName || ""),
  );

  const formatYesNoFlag = (value?: "Y" | "N" | null) => {
    if (!value) {
      return "N/A";
    }

    return value === "Y" ? "Yes" : "No";
  };

  const renderYesNoBadge = (value?: "Y" | "N" | null) => {
    if (value === "Y") {
      return <span className="badge badge-success badge-sm">Yes</span>;
    }

    if (value === "N") {
      return <span className="badge badge-warning badge-sm">No</span>;
    }

    return <span className="text-base-content/50">N/A</span>;
  };

  const fetchDueTypes = async () => {
    try {
      const response = await fetch("/api/operator/due-types", {
        credentials: "include" as RequestCredentials,
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setDueTypes(data.data);
        }
      }
    } catch (error) {
      console.error("Error fetching due types:", error);
    }
  };

  useEffect(() => {
    fetchClearedDues();
    fetchDueTypes();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [
    dues,
    searchTerm,
    startDate,
    endDate,
    payableFilter,
    dueTypeFilter,
    alumniAcademicYearFilter,
    alumniRegistrationFilter,
    alumniPlacementFilter,
    alumniHigherEducationFilter,
    isAlumniSectionOperator,
  ]);

  const fetchClearedDues = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/operator/dues/cleared", {
        credentials: "include" as RequestCredentials,
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setDues(data.data);
        }
      }
    } catch (error) {
      console.error("Error fetching cleared dues:", error);
      toast.error("Failed to fetch cleared dues");
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...dues];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (due) =>
          due.student_roll_number
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          due.student_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          due.due_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
          due.academic_year_label
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          due.linkedin_profile_link
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()),
      );
    }

    // Payable filter
    if (payableFilter !== "all") {
      filtered = filtered.filter((due) =>
        payableFilter === "payable" ? due.is_payable : !due.is_payable,
      );
    }

    // Due type filter
    if (dueTypeFilter !== "all") {
      filtered = filtered.filter((due) => due.due_type === dueTypeFilter);
    }

    // Date range filter (based on cleared date)
    if (startDate && endDate) {
      filtered = filtered.filter((due) => {
        const clearedDate = new Date(due.cleared_at);
        return (
          clearedDate >= new Date(startDate) && clearedDate <= new Date(endDate)
        );
      });
    }

    if (isAlumniSectionOperator) {
      if (alumniAcademicYearFilter !== "all") {
        filtered = filtered.filter(
          (due) => due.academic_year_label === alumniAcademicYearFilter,
        );
      }

      if (alumniRegistrationFilter !== "all") {
        filtered = filtered.filter(
          (due) =>
            due.status_of_registration_with_alumni_portal ===
            alumniRegistrationFilter,
        );
      }

      if (alumniPlacementFilter !== "all") {
        filtered = filtered.filter(
          (due) => due.placement_status === alumniPlacementFilter,
        );
      }

      if (alumniHigherEducationFilter !== "all") {
        filtered = filtered.filter(
          (due) =>
            due.planning_for_higher_education === alumniHigherEducationFilter,
        );
      }
    }

    setFilteredDues(filtered);
    setCurrentPage(1);
  };

  const downloadData = () => {
    const exportData = isAlumniSectionOperator
      ? filteredDues.map((due, index) => ({
          "S.No": index + 1,
          "Due ID": due.due_unique_id || due.id,
          "Roll Number": due.student_roll_number,
          "Student Name": due.student_name || "N/A",
          "Academic Year": due.academic_year_label || "N/A",
          "Form Submitted": due.is_form_submitted ? "Yes" : "No",
          "Submitted At": due.submitted_at
            ? new Date(due.submitted_at).toLocaleString("en-IN")
            : "N/A",
          "Alumni Portal Registration": formatYesNoFlag(
            due.status_of_registration_with_alumni_portal,
          ),
          "LinkedIn Profile": due.linkedin_profile_link || "N/A",
          "Placement Status": formatYesNoFlag(due.placement_status),
          "Proof of Placement": due.proof_of_placement || "N/A",
          "Higher Education Planning": formatYesNoFlag(
            due.planning_for_higher_education,
          ),
          "Proof of Higher Education": due.proof_of_higher_education || "N/A",
          "Due Date": new Date(due.due_clear_by_date).toLocaleDateString(
            "en-IN",
          ),
          "Cleared On": new Date(due.cleared_at).toLocaleDateString("en-IN"),
          "Cleared By": due.cleared_by || "System",
        }))
      : filteredDues.map((due, index) => ({
          "S.No": index + 1,
          "Roll Number": due.student_roll_number,
          "Student Name": due.student_name || "N/A",
          "Due Type": due.due_type,
          Payable: due.is_payable ? "Yes" : "No",
          Amount: due.current_amount
            ? `₹${due.current_amount.toLocaleString("en-IN")}`
            : "N/A",
          "Amount Paid": due.amount_paid
            ? `₹${due.amount_paid.toLocaleString("en-IN")}`
            : "₹0",
          Description: due.due_description || "N/A",
          "Due Date": new Date(due.due_clear_by_date).toLocaleDateString(
            "en-IN",
          ),
          "Added On": new Date(due.created_at).toLocaleDateString("en-IN"),
          "Cleared On": new Date(due.cleared_at).toLocaleDateString("en-IN"),
          "Cleared By": due.cleared_by || "System",
          Method: due.is_cleared ? "Cleared" : "Permission Granted",
        }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cleared Dues");
    XLSX.writeFile(
      wb,
      `cleared_dues_${new Date().toISOString().split("T")[0]}.xlsx`,
    );
    toast.success("Data exported successfully");
  };

  // Pagination
  const totalPages = Math.ceil(filteredDues.length / DUES_PER_PAGE);
  const startIndex = (currentPage - 1) * DUES_PER_PAGE;
  const endIndex = startIndex + DUES_PER_PAGE;
  const currentDues = filteredDues.slice(startIndex, endIndex);

  const alumniAcademicYearOptions = Array.from(
    new Set(
      dues
        .map((due) => due.academic_year_label || "")
        .filter((value) => value.length > 0),
    ),
  ).sort((a, b) => b.localeCompare(a));

  if (loading) {
    return (
      <DashboardLayout
        role={user.role}
        username={user.username}
        email={user.email}
      >
        <div className="flex items-center justify-center min-h-screen">
          <div className="loading loading-spinner loading-lg"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      role={user.role}
      username={user.username}
      email={user.email}
    >
      <Toaster position="top-right" />
      <div className="space-y-6 official-enter">
        {/* Page Header */}
        <div className="official-card p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-3xl font-bold text-primary mb-2">
                Cleared Dues
              </h2>
              <p className="text-base-content/70">
                Total: {filteredDues.length} cleared dues
              </p>
            </div>
            <button
              onClick={downloadData}
              className="btn btn-primary btn-sm sm:btn-md gap-2"
              disabled={filteredDues.length === 0}
            >
              <Download size={20} />
              Export Data
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="official-card p-6">
          <h3 className="text-xl font-bold text-primary mb-4">Filters</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text">Search by Roll Number/Name</span>
              </label>
              <div className="input-group">
                <span>
                  <Search size={20} />
                </span>
                <input
                  type="text"
                  placeholder="Search..."
                  className="input input-bordered input-md w-full"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Payable Status</span>
              </label>
              <select
                className="select select-bordered select-md w-full"
                value={payableFilter}
                onChange={(e) =>
                  setPayableFilter(
                    e.target.value as "all" | "payable" | "non-payable",
                  )
                }
              >
                <option value="all">All</option>
                <option value="payable">Payable</option>
                <option value="non-payable">Non-Payable</option>
              </select>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Due Type</span>
              </label>
              <select
                className="select select-bordered select-md w-full"
                value={dueTypeFilter}
                onChange={(e) => setDueTypeFilter(e.target.value)}
              >
                <option value="all">All Types</option>
                {dueTypes.map((type) => (
                  <option key={type.id} value={type.type_name}>
                    {type.type_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Start Date (Cleared)</span>
              </label>
              <input
                type="date"
                className="input input-bordered input-md w-full"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">End Date (Cleared)</span>
              </label>
              <input
                type="date"
                className="input input-bordered input-md w-full"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            {isAlumniSectionOperator && (
              <>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Academic Year</span>
                  </label>
                  <select
                    className="select select-bordered select-md w-full"
                    value={alumniAcademicYearFilter}
                    onChange={(e) =>
                      setAlumniAcademicYearFilter(e.target.value)
                    }
                  >
                    <option value="all">All Academic Years</option>
                    {alumniAcademicYearOptions.map((label) => (
                      <option key={label} value={label}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">
                      Alumni Portal Registration
                    </span>
                  </label>
                  <select
                    className="select select-bordered select-md w-full"
                    value={alumniRegistrationFilter}
                    onChange={(e) =>
                      setAlumniRegistrationFilter(
                        e.target.value as "all" | "Y" | "N",
                      )
                    }
                  >
                    <option value="all">All</option>
                    <option value="Y">Yes</option>
                    <option value="N">No</option>
                  </select>
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Placement Status</span>
                  </label>
                  <select
                    className="select select-bordered select-md w-full"
                    value={alumniPlacementFilter}
                    onChange={(e) =>
                      setAlumniPlacementFilter(
                        e.target.value as "all" | "Y" | "N",
                      )
                    }
                  >
                    <option value="all">All</option>
                    <option value="Y">Placed</option>
                    <option value="N">Not Placed</option>
                  </select>
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Higher Education</span>
                  </label>
                  <select
                    className="select select-bordered select-md w-full"
                    value={alumniHigherEducationFilter}
                    onChange={(e) =>
                      setAlumniHigherEducationFilter(
                        e.target.value as "all" | "Y" | "N",
                      )
                    }
                  >
                    <option value="all">All</option>
                    <option value="Y">Planning</option>
                    <option value="N">Not Planning</option>
                  </select>
                </div>
              </>
            )}
          </div>

          {(searchTerm ||
            startDate ||
            endDate ||
            payableFilter !== "all" ||
            dueTypeFilter !== "all" ||
            alumniAcademicYearFilter !== "all" ||
            alumniRegistrationFilter !== "all" ||
            alumniPlacementFilter !== "all" ||
            alumniHigherEducationFilter !== "all") && (
            <div className="mt-4">
              <button
                onClick={() => {
                  setSearchTerm("");
                  setStartDate("");
                  setEndDate("");
                  setPayableFilter("all");
                  setDueTypeFilter("all");
                  setAlumniAcademicYearFilter("all");
                  setAlumniRegistrationFilter("all");
                  setAlumniPlacementFilter("all");
                  setAlumniHigherEducationFilter("all");
                }}
                className="btn btn-sm btn-ghost gap-2"
              >
                <X size={16} />
                Clear Filters
              </button>
            </div>
          )}
        </div>

        {/* Cleared Dues Table */}
        <div className="official-card p-6">
          <div className="table-shell">
            <table className="table table-zebra w-full">
              <thead>
                {isAlumniSectionOperator ? (
                  <tr>
                    <th className="text-center">S.No</th>
                    <th className="text-center">Due ID</th>
                    <th className="text-center">Roll Number</th>
                    <th className="text-center">Name</th>
                    <th className="text-center">Academic Year</th>
                    <th className="text-center">Portal Reg</th>
                    <th className="text-center">Placement</th>
                    <th className="text-center">Higher Education</th>
                    <th className="text-center">LinkedIn</th>
                    <th className="text-center">Submitted On</th>
                    <th className="text-center">Cleared On</th>
                  </tr>
                ) : (
                  <tr>
                    <th className="text-center">S.No</th>
                    <th className="text-center">Due ID</th>
                    <th className="text-center">Roll Number</th>
                    <th className="text-center">Name</th>
                    <th className="text-center">Due Type</th>
                    <th className="text-center">Payable</th>
                    <th className="text-center">Amount</th>
                    <th className="text-center">Amount Paid</th>
                    <th className="text-center">Due Date</th>
                    <th className="text-center">Cleared On</th>
                    <th className="text-center">Cleared By</th>
                    <th className="text-center">Method</th>
                  </tr>
                )}
              </thead>
              <tbody>
                {currentDues.length === 0 ? (
                  <tr>
                    <td
                      colSpan={isAlumniSectionOperator ? 11 : 12}
                      className="text-center py-8"
                    >
                      No cleared dues found
                    </td>
                  </tr>
                ) : (
                  currentDues.map((due, index) =>
                    isAlumniSectionOperator ? (
                      <tr key={due.id}>
                        <td className="text-center">
                          {startIndex + index + 1}
                        </td>
                        <td className="text-center font-mono text-xs">
                          {due.due_unique_id || due.id}
                        </td>
                        <td className="text-center font-semibold">
                          {due.student_roll_number}
                        </td>
                        <td className="text-center">
                          {due.student_name || "N/A"}
                        </td>
                        <td className="text-center">
                          {due.academic_year_label || "N/A"}
                        </td>
                        <td className="text-center">
                          {renderYesNoBadge(
                            due.status_of_registration_with_alumni_portal,
                          )}
                        </td>
                        <td className="text-center">
                          {renderYesNoBadge(due.placement_status)}
                        </td>
                        <td className="text-center">
                          {renderYesNoBadge(due.planning_for_higher_education)}
                        </td>
                        <td className="text-center">
                          {due.linkedin_profile_link ? (
                            <a
                              href={due.linkedin_profile_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="link link-primary text-xs"
                            >
                              Open
                            </a>
                          ) : (
                            "N/A"
                          )}
                        </td>
                        <td className="text-center">
                          {due.submitted_at
                            ? new Date(due.submitted_at).toLocaleDateString(
                                "en-IN",
                              )
                            : "N/A"}
                        </td>
                        <td className="text-center">
                          {new Date(due.cleared_at).toLocaleDateString("en-IN")}
                        </td>
                      </tr>
                    ) : (
                      <tr key={due.id}>
                        <td className="text-center">
                          {startIndex + index + 1}
                        </td>
                        <td className="text-center font-mono text-xs">
                          {due.id}
                        </td>
                        <td className="text-center font-semibold">
                          {due.student_roll_number}
                        </td>
                        <td className="text-center">
                          {due.student_name || "N/A"}
                        </td>
                        <td className="text-center">{due.due_type}</td>
                        <td className="text-center">
                          {due.is_payable ? (
                            <span className="badge badge-success badge-sm whitespace-nowrap">
                              Yes
                            </span>
                          ) : (
                            <span className="badge badge-warning badge-sm whitespace-nowrap">
                              No
                            </span>
                          )}
                        </td>
                        <td className="text-center">
                          {due.current_amount ? (
                            <span className="font-semibold">
                              ₹{due.current_amount.toLocaleString("en-IN")}
                            </span>
                          ) : (
                            "N/A"
                          )}
                        </td>
                        <td className="text-center">
                          {due.amount_paid > 0 ? (
                            <span className="font-semibold text-success">
                              ₹{due.amount_paid.toLocaleString("en-IN")}
                            </span>
                          ) : (
                            "₹0"
                          )}
                        </td>
                        <td className="text-center">
                          {new Date(due.due_clear_by_date).toLocaleDateString(
                            "en-IN",
                          )}
                        </td>
                        <td className="text-center">
                          {new Date(due.cleared_at).toLocaleDateString("en-IN")}
                        </td>
                        <td className="text-center">
                          {due.cleared_by || "System"}
                        </td>
                        <td className="text-center">
                          {due.is_cleared ? (
                            <span className="badge badge-success whitespace-nowrap">
                              Cleared
                            </span>
                          ) : due.permission_granted ? (
                            <span className="badge badge-info whitespace-nowrap">
                              Permission Granted
                            </span>
                          ) : (
                            <span className="badge badge-ghost whitespace-nowrap">
                              Unknown
                            </span>
                          )}
                        </td>
                      </tr>
                    ),
                  )
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center mt-6">
              <div className="btn-group">
                <button
                  className="btn btn-sm sm:btn-md"
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(prev - 1, 1))
                  }
                  disabled={currentPage === 1}
                >
                  «
                </button>
                <button className="btn btn-sm sm:btn-md">
                  Page {currentPage} of {totalPages}
                </button>
                <button
                  className="btn btn-sm sm:btn-md"
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                  }
                  disabled={currentPage === totalPages}
                >
                  »
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ClearedDues;
