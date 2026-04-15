import {
  AlertCircle,
  CheckCircle,
  Download,
  Eye,
  Search,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import * as XLSX from "xlsx";
import DashboardLayout from "../../components/DashboardLayout";

interface ActiveDue {
  id: number;
  due_unique_id?: string;
  due_source?: string;
  student_roll_number: string;
  student_name?: string;
  student_name_snapshot?: string | null;
  due_type: string;
  is_payable: boolean;
  principal_amount?: number | null;
  current_amount: number | null;
  outstanding_amount?: number | null;
  amount_paid: number;
  due_description?: string | null;
  due_clear_by_date: string;
  incident_date?: string | null;
  serial_no?: number | null;
  added_by_department_id?: number | null;
  added_by_section_id?: number | null;
  added_by_department_name?: string | null;
  added_by_section_name?: string | null;
  added_by_entity?: string | null;
  program_name?: string | null;
  branch_name?: string | null;
  academic_year_label?: string | null;
  semester_label?: string | null;
  section_label?: string | null;
  location_type?: string | null;
  location_name?: string | null;
  room_no?: string | null;
  course_activity_usage_context?: string | null;
  staff_reporting_name?: string | null;
  staff_employee_id?: string | null;
  staff_designation?: string | null;
  item_equipment?: string | null;
  issue_type?: string | null;
  approx_value?: string | null;
  form_remarks?: string | null;
  documentation_type?: string | null;
  documentation_type_other?: string | null;
  proof_drive_link?: string | null;
  supporting_document_link?: string | null;
  remarks?: string | null;
  created_at: string;
  updated_at?: string;
  is_cleared: boolean;
  overall_status: boolean;
  permission_granted: boolean;
  requires_permission: boolean;
  needs_original?: boolean | null;
  needs_pdf?: boolean | null;
  is_compounded?: boolean | null;
  interest_rate?: number | null;
  academic_year_id?: number | null;
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

interface DueType {
  id: number;
  type_name: string;
}

const ActiveDues = () => {
  const [dues, setDues] = useState<ActiveDue[]>([]);
  const [filteredDues, setFilteredDues] = useState<ActiveDue[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [payableFilter, setPayableFilter] = useState<
    "all" | "payable" | "non-payable"
  >("all");
  const [dueTypeFilter, setDueTypeFilter] = useState<string>("all");
  const [alumniAcademicYearFilter, setAlumniAcademicYearFilter] =
    useState<string>("all");
  const [alumniFormStatusFilter, setAlumniFormStatusFilter] = useState<
    "all" | "submitted" | "pending"
  >("all");
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
  const [selectedDue, setSelectedDue] = useState<ActiveDue | null>(null);
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearingDue, setClearingDue] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailsDue, setDetailsDue] = useState<ActiveDue | null>(null);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [permissionDueId, setPermissionDueId] = useState<number | null>(null);
  const [supportingDocLink, setSupportingDocLink] = useState("");
  const [grantingPermission, setGrantingPermission] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");

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

  const formatDate = (value?: string | null) => {
    if (!value) return "N/A";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? value
      : date.toLocaleDateString("en-IN");
  };

  const formatDateTime = (value?: string | null) => {
    if (!value) return "N/A";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en-IN");
  };

  const formatCurrency = (value?: number | null) => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
      return "N/A";
    }
    return `₹${Number(value).toLocaleString("en-IN")}`;
  };

  const formatBoolean = (value?: boolean | null) => {
    if (value === null || value === undefined) {
      return "N/A";
    }
    return value ? "Yes" : "No";
  };

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

  const getDueStatusLabel = (due: ActiveDue) => {
    if (due.is_cleared) {
      return "Cleared";
    }
    if (due.requires_permission && due.permission_granted) {
      return "Permission Granted";
    }
    if (due.requires_permission && !due.permission_granted) {
      return "Pending Permission";
    }
    return "Active";
  };

  const getFieldLabel = (key: string) =>
    key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

  const getFieldValue = (key: string, value: unknown) => {
    if (value === null || value === undefined || value === "") {
      return "N/A";
    }

    if (typeof value === "boolean") {
      return value ? "Yes" : "No";
    }

    if (typeof value === "number") {
      if (
        key.includes("amount") ||
        key.includes("value") ||
        key === "current_amount" ||
        key === "principal_amount" ||
        key === "outstanding_amount"
      ) {
        return `₹${value.toLocaleString("en-IN")}`;
      }
      return value.toString();
    }

    if (typeof value === "string") {
      if (key.includes("_at")) {
        return formatDateTime(value);
      }
      if (key.includes("date")) {
        return formatDate(value);
      }
      return value;
    }

    return String(value);
  };

  const openDetailsModal = (due: ActiveDue) => {
    setDetailsDue(due);
    setShowDetailsModal(true);
  };

  useEffect(() => {
    fetchActiveDues();
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
    alumniFormStatusFilter,
    alumniRegistrationFilter,
    alumniPlacementFilter,
    alumniHigherEducationFilter,
    isAlumniSectionOperator,
  ]);

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

  const fetchActiveDues = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/operator/dues/active", {
        credentials: "include" as RequestCredentials,
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setDues(data.data);
        }
      }
    } catch (error) {
      console.error("Error fetching active dues:", error);
      toast.error("Failed to fetch active dues");
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
          (due.due_unique_id || String(due.id))
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
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
            .includes(searchTerm.toLowerCase()) ||
          due.due_description?.toLowerCase().includes(searchTerm.toLowerCase()),
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

    // Date range filter
    if (startDate && endDate) {
      filtered = filtered.filter((due) => {
        const dueDate = new Date(due.created_at);
        return dueDate >= new Date(startDate) && dueDate <= new Date(endDate);
      });
    }

    if (isAlumniSectionOperator) {
      if (alumniAcademicYearFilter !== "all") {
        filtered = filtered.filter(
          (due) => due.academic_year_label === alumniAcademicYearFilter,
        );
      }

      if (alumniFormStatusFilter !== "all") {
        filtered = filtered.filter((due) => {
          const isSubmitted = Boolean(due.is_form_submitted);
          return alumniFormStatusFilter === "submitted"
            ? isSubmitted
            : !isSubmitted;
        });
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

  const handleClearDue = async () => {
    if (!selectedDue) return;

    setClearingDue(true);
    try {
      const response = await fetch(
        `/api/operator/dues/${selectedDue.id}/clear`,
        {
          method: "PUT",
          credentials: "include" as RequestCredentials,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to clear due");
      }

      const data = await response.json();

      if (data.success) {
        toast.success("Due cleared successfully");
        setShowClearModal(false);
        setSelectedDue(null);
        await fetchActiveDues();
      } else {
        throw new Error(data.message || "Failed to clear due");
      }
    } catch (error) {
      console.error("Error clearing due:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to clear due",
      );
    } finally {
      setClearingDue(false);
    }
  };

  const handleGrantPermission = (dueId: number) => {
    setPermissionDueId(dueId);
    setSupportingDocLink("");
    setSelectedFile(null);
    setUploadProgress("");
    setShowPermissionModal(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (10MB max)
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        toast.error("File size exceeds 10MB. Please choose a smaller file.");
        return;
      }
      setSelectedFile(file);
      setSupportingDocLink(""); // Clear manual link if file is selected
    }
  };

  const handleUploadToGoogleDrive = async () => {
    if (!selectedFile || !permissionDueId) {
      toast.error("Please select a file to upload");
      return;
    }

    try {
      setUploadingFile(true);
      setUploadProgress("Uploading to Google Drive...");

      const formData = new FormData();
      formData.append("document", selectedFile);

      const response = await fetch(
        `/api/operator/dues/${permissionDueId}/upload-permission-document`,
        {
          method: "POST",
          credentials: "include" as RequestCredentials,
          body: formData,
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to upload document");
      }

      const result = await response.json();

      setUploadProgress("Upload successful! Permission granted.");
      setSupportingDocLink(result.webViewLink);
      toast.success("Document uploaded & permission granted successfully!");
      setSelectedFile(null);
      // Auto-close modal and refresh dues list since permission is now granted
      setTimeout(() => {
        setUploadProgress("");
        setShowPermissionModal(false);
        setSupportingDocLink("");
        setPermissionDueId(null);
        fetchActiveDues();
      }, 1500);
    } catch (error) {
      console.error("Error uploading document:", error);
      setUploadProgress("");
      toast.error(
        error instanceof Error ? error.message : "Failed to upload document",
      );
    } finally {
      setUploadingFile(false);
    }
  };

  const handleGrantPermissionSubmit = async () => {
    if (!supportingDocLink.trim()) {
      toast.error(
        "Please provide a Google Drive link for the supporting document",
      );
      return;
    }

    if (!permissionDueId) {
      return;
    }

    try {
      setGrantingPermission(true);
      const response = await fetch(
        `/api/operator/dues/${permissionDueId}/grant-permission`,
        {
          method: "POST",
          credentials: "include" as RequestCredentials,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ supporting_document_link: supportingDocLink }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to grant permission");
      }

      const data = await response.json();

      if (data.success) {
        toast.success("Permission granted successfully");
        setShowPermissionModal(false);
        setSupportingDocLink("");
        setPermissionDueId(null);
        await fetchActiveDues();
      } else {
        throw new Error(data.message || "Failed to grant permission");
      }
    } catch (error) {
      console.error("Error granting permission:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to grant permission",
      );
    } finally {
      setGrantingPermission(false);
    }
  };

  const downloadData = () => {
    const exportData = filteredDues.map((due, index) => ({
      "S.No": index + 1,
      "Due ID": due.due_unique_id || due.id,
      "Database ID": due.id,
      Source: due.due_source || "N/A",
      "Roll Number": due.student_roll_number,
      "Student Name": due.student_name || "N/A",
      "Student Name Snapshot": due.student_name_snapshot || "N/A",
      "Due Type": due.due_type,
      Payable: due.is_payable ? "Yes" : "No",
      "Principal Amount": formatCurrency(due.principal_amount),
      "Current Amount": formatCurrency(due.current_amount),
      "Outstanding Amount": formatCurrency(due.outstanding_amount),
      "Amount Paid": due.amount_paid
        ? `₹${due.amount_paid.toLocaleString("en-IN")}`
        : "₹0",
      "Interest Compounded": formatBoolean(due.is_compounded),
      "Interest Rate":
        due.interest_rate === null || due.interest_rate === undefined
          ? "N/A"
          : due.interest_rate,
      Description: due.due_description || "N/A",
      "Due Date": formatDate(due.due_clear_by_date),
      "Incident Date": formatDate(due.incident_date),
      "Added On": formatDateTime(due.created_at),
      "Last Updated": formatDateTime(due.updated_at),
      Status: getDueStatusLabel(due),
      "Requires Permission": formatBoolean(due.requires_permission),
      "Permission Granted": formatBoolean(due.permission_granted),
      "Needs Original": formatBoolean(due.needs_original),
      "Needs PDF": formatBoolean(due.needs_pdf),
      "Proof Link": due.proof_drive_link || "N/A",
      "Supporting Document Link": due.supporting_document_link || "N/A",
      Remarks: due.remarks || "N/A",
      "Department ID": due.added_by_department_id ?? "N/A",
      "Section ID": due.added_by_section_id ?? "N/A",
      "Department Name": due.added_by_department_name || "N/A",
      "Section Name": due.added_by_section_name || "N/A",
      "Added By Entity": due.added_by_entity || "N/A",
      "Department Serial No": due.serial_no ?? "N/A",
      Program: due.program_name || "N/A",
      Branch: due.branch_name || "N/A",
      "Academic Year": due.academic_year_label || "N/A",
      Semester: due.semester_label || "N/A",
      Section: due.section_label || "N/A",
      "Location Type": due.location_type || "N/A",
      "Location Name": due.location_name || "N/A",
      "Room No": due.room_no || "N/A",
      "Course / Activity / Usage": due.course_activity_usage_context || "N/A",
      "Staff Reporting Name": due.staff_reporting_name || "N/A",
      "Staff Employee ID": due.staff_employee_id || "N/A",
      "Staff Designation": due.staff_designation || "N/A",
      "Item / Equipment": due.item_equipment || "N/A",
      "Issue Type": due.issue_type || "N/A",
      "Approx Value": due.approx_value || "N/A",
      "Form Remarks": due.form_remarks || "N/A",
      "Documentation Type": due.documentation_type || "N/A",
      "Documentation Type Other": due.documentation_type_other || "N/A",
      "Alumni Form Submitted": formatBoolean(due.is_form_submitted),
      "Alumni Form Submitted At": formatDateTime(due.submitted_at),
      "Alumni Portal Registration": formatYesNoFlag(
        due.status_of_registration_with_alumni_portal,
      ),
      "Alumni LinkedIn": due.linkedin_profile_link || "N/A",
      "Alumni Placement Status": formatYesNoFlag(due.placement_status),
      "Alumni Placement Proof": due.proof_of_placement || "N/A",
      "Alumni Higher Education": formatYesNoFlag(
        due.planning_for_higher_education,
      ),
      "Alumni Higher Education Proof": due.proof_of_higher_education || "N/A",
      "Alumni Campaign Key": due.campaign_key || "N/A",
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Active Dues");
    XLSX.writeFile(
      wb,
      `active_dues_${new Date().toISOString().split("T")[0]}.xlsx`,
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
                Active Dues
              </h2>
              <p className="text-base-content/70">
                Total: {filteredDues.length} active dues
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
                <span className="label-text">Start Date</span>
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
                <span className="label-text">End Date</span>
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
                    <span className="label-text">Form Status</span>
                  </label>
                  <select
                    className="select select-bordered select-md w-full"
                    value={alumniFormStatusFilter}
                    onChange={(e) =>
                      setAlumniFormStatusFilter(
                        e.target.value as "all" | "submitted" | "pending",
                      )
                    }
                  >
                    <option value="all">All</option>
                    <option value="submitted">Submitted</option>
                    <option value="pending">Pending</option>
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
            alumniFormStatusFilter !== "all" ||
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
                  setAlumniFormStatusFilter("all");
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

        {/* Active Dues Table */}
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
                    <th className="text-center">Form Status</th>
                    <th className="text-center">Due Date</th>
                    <th className="text-center">Actions</th>
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
                    <th className="text-center">Due Date</th>
                    <th className="text-center">Status</th>
                    <th className="text-center">Actions</th>
                  </tr>
                )}
              </thead>
              <tbody>
                {currentDues.length === 0 ? (
                  <tr>
                    <td
                      colSpan={isAlumniSectionOperator ? 12 : 10}
                      className="text-center py-8"
                    >
                      No active dues found
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
                          {due.is_form_submitted ? (
                            <span className="badge badge-success badge-sm whitespace-nowrap">
                              Submitted
                            </span>
                          ) : (
                            <span className="badge badge-warning badge-sm whitespace-nowrap">
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="text-center">
                          {new Date(due.due_clear_by_date).toLocaleDateString(
                            "en-IN",
                          )}
                        </td>
                        <td className="text-center">
                          <div className="flex gap-2 justify-center">
                            <button
                              onClick={() => openDetailsModal(due)}
                              className="btn btn-outline btn-sm gap-2"
                            >
                              <Eye size={16} />
                              View
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
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
                          {due.current_amount !== null &&
                          due.current_amount !== undefined ? (
                            <span className="font-semibold">
                              ₹{due.current_amount.toLocaleString("en-IN")}
                            </span>
                          ) : (
                            "N/A"
                          )}
                          {due.amount_paid > 0 && (
                            <div className="text-xs text-success">
                              Paid: ₹{due.amount_paid.toLocaleString("en-IN")}
                            </div>
                          )}
                        </td>
                        <td className="text-center">
                          {new Date(due.due_clear_by_date).toLocaleDateString(
                            "en-IN",
                          )}
                        </td>
                        <td className="text-center">
                          {due.requires_permission && due.permission_granted ? (
                            <span className="badge badge-success gap-2 whitespace-nowrap">
                              <CheckCircle size={14} />
                              Permission Granted
                            </span>
                          ) : due.requires_permission &&
                            !due.permission_granted ? (
                            <span className="badge badge-warning gap-2 whitespace-nowrap">
                              <AlertCircle size={14} />
                              Pending Permission
                            </span>
                          ) : (
                            <span className="badge badge-error whitespace-nowrap">
                              Active
                            </span>
                          )}
                        </td>
                        <td className="text-center">
                          <div className="flex gap-2 justify-center">
                            <button
                              onClick={() => openDetailsModal(due)}
                              className="btn btn-outline btn-sm gap-2"
                            >
                              <Eye size={16} />
                              View
                            </button>
                            {!due.is_payable &&
                              due.needs_original &&
                              !due.permission_granted && (
                                <button
                                  onClick={() => {
                                    setSelectedDue(due);
                                    setShowClearModal(true);
                                  }}
                                  className="btn btn-success btn-sm gap-2"
                                >
                                  <CheckCircle size={16} />
                                  Clear
                                </button>
                              )}
                            {due.requires_permission &&
                              !due.permission_granted && (
                                <button
                                  onClick={() => handleGrantPermission(due.id)}
                                  className="btn btn-primary btn-sm gap-2"
                                >
                                  <CheckCircle size={16} />
                                  Grant Permission
                                </button>
                              )}
                          </div>
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

      {/* Full Due Details Modal */}
      {showDetailsModal && detailsDue && (
        <div className="modal modal-open">
          <div className="modal-box max-w-5xl">
            <h3 className="font-bold text-xl mb-4">Complete Due Information</h3>
            <div className="alert alert-info mb-4">
              <AlertCircle size={20} />
              <div>
                <p className="font-semibold">
                  Showing every available field for this due
                </p>
                <p className="text-sm">
                  Due ID: {detailsDue.due_unique_id || detailsDue.id} | Roll
                  Number: {detailsDue.student_roll_number}
                </p>
              </div>
            </div>

            <div className="max-h-[60vh] overflow-auto border border-base-300 rounded-lg">
              <table className="table table-zebra w-full">
                <thead>
                  <tr>
                    <th className="w-1/3">Field</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(detailsDue).map(([key, value]) => (
                    <tr key={key}>
                      <td className="font-semibold align-top">
                        {getFieldLabel(key)}
                      </td>
                      <td className="break-words whitespace-pre-wrap">
                        {getFieldValue(key, value)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="modal-action">
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setDetailsDue(null);
                }}
                className="btn"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Due Modal */}
      {showClearModal && selectedDue && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">Clear Non-Payable Due</h3>
            <div className="alert alert-info mb-4">
              <AlertCircle size={20} />
              <div>
                <p className="font-semibold">Due Details:</p>
                <p className="text-sm">
                  Roll Number: {selectedDue.student_roll_number}
                </p>
                <p className="text-sm">Due Type: {selectedDue.due_type}</p>
                <p className="text-sm">
                  Description: {selectedDue.due_description || "N/A"}
                </p>
              </div>
            </div>
            <p className="mb-4">
              Are you sure you want to clear this non-payable due? This action
              confirms that the required documents/verification have been
              completed.
            </p>
            <div className="modal-action">
              <button
                onClick={handleClearDue}
                className={`btn btn-success ${clearingDue ? "loading" : ""}`}
                disabled={clearingDue}
              >
                {!clearingDue && <CheckCircle size={16} />}
                Confirm Clear
              </button>
              <button
                onClick={() => {
                  setShowClearModal(false);
                  setSelectedDue(null);
                }}
                className="btn"
                disabled={clearingDue}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Grant Permission Modal */}
      {showPermissionModal && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">Grant Permission</h3>
            <div className="alert alert-info mb-4">
              <AlertCircle size={20} />
              <div>
                <p className="text-sm font-semibold">
                  Upload supporting document directly to Google Drive or provide
                  a link
                </p>
              </div>
            </div>

            {/* File Upload Section */}
            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text font-semibold">
                  📁 Upload Document to Google Drive
                </span>
              </label>
              <div className="flex gap-2">
                <input
                  type="file"
                  className="file-input file-input-bordered file-input-md w-full"
                  onChange={handleFileSelect}
                  disabled={uploadingFile || !!supportingDocLink}
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                />
                {selectedFile && (
                  <button
                    onClick={handleUploadToGoogleDrive}
                    className={`btn btn-primary ${uploadingFile ? "loading" : ""}`}
                    disabled={uploadingFile}
                  >
                    {!uploadingFile && "📤"}
                    {uploadingFile ? "Uploading..." : "Upload"}
                  </button>
                )}
              </div>
              {selectedFile && (
                <label className="label">
                  <span className="label-text-alt text-success">
                    ✓ Selected: {selectedFile.name} (
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                </label>
              )}
              {uploadProgress && (
                <label className="label">
                  <span className="label-text-alt text-info font-semibold">
                    {uploadProgress}
                  </span>
                </label>
              )}
              <label className="label">
                <span className="label-text-alt text-base-content/70">
                  Max file size: 10MB. Supported: PDF, Images, Word docs
                </span>
              </label>
            </div>

            {/* Divider */}
            <div className="divider">OR</div>

            {/* Manual Link Input */}
            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text font-semibold">
                  🔗 Supporting Document Link
                </span>
              </label>
              <input
                type="url"
                placeholder="https://drive.google.com/..."
                className="input input-bordered input-md"
                value={supportingDocLink}
                onChange={(e) => setSupportingDocLink(e.target.value)}
                disabled={!!selectedFile}
              />
              <label className="label">
                <span className="label-text-alt text-base-content/70">
                  Or paste an existing Google Drive link here
                </span>
              </label>
            </div>
            <div className="modal-action">
              <button
                onClick={handleGrantPermissionSubmit}
                className={`btn btn-primary ${grantingPermission ? "loading" : ""}`}
                disabled={
                  grantingPermission ||
                  !supportingDocLink.trim() ||
                  uploadingFile
                }
              >
                {!grantingPermission && <CheckCircle size={16} />}
                Grant Permission
              </button>
              <button
                onClick={() => {
                  setShowPermissionModal(false);
                  setSupportingDocLink("");
                  setPermissionDueId(null);
                  setSelectedFile(null);
                  setUploadProgress("");
                }}
                className="btn"
                disabled={grantingPermission || uploadingFile}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default ActiveDues;
