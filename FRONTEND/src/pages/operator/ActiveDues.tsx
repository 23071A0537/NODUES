import { AlertCircle, CheckCircle, Download, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import * as XLSX from "xlsx";
import DashboardLayout from "../../components/DashboardLayout";

interface ActiveDue {
  id: number;
  student_roll_number: string;
  student_name: string;
  due_type: string;
  is_payable: boolean;
  current_amount: number | null;
  amount_paid: number;
  due_description: string;
  due_clear_by_date: string;
  created_at: string;
  is_cleared: boolean;
  overall_status: boolean;
  permission_granted: boolean;
  requires_permission: boolean;
  needs_original: boolean;
  needs_pdf: boolean;
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
  const [dueTypes, setDueTypes] = useState<DueType[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedDue, setSelectedDue] = useState<ActiveDue | null>(null);
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearingDue, setClearingDue] = useState(false);
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
  };

  useEffect(() => {
    fetchActiveDues();
    fetchDueTypes();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [dues, searchTerm, startDate, endDate, payableFilter, dueTypeFilter]);

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
          due.student_roll_number
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          due.student_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          due.due_type.toLowerCase().includes(searchTerm.toLowerCase()),
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
      "Due Date": new Date(due.due_clear_by_date).toLocaleDateString("en-IN"),
      "Added On": new Date(due.created_at).toLocaleDateString("en-IN"),
      Status: due.is_cleared
        ? "Cleared"
        : due.permission_granted
          ? "Permission Granted"
          : "Active",
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
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
          </div>

          {(searchTerm ||
            startDate ||
            endDate ||
            payableFilter !== "all" ||
            dueTypeFilter !== "all") && (
            <div className="mt-4">
              <button
                onClick={() => {
                  setSearchTerm("");
                  setStartDate("");
                  setEndDate("");
                  setPayableFilter("all");
                  setDueTypeFilter("all");
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
              </thead>
              <tbody>
                {currentDues.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-8">
                      No active dues found
                    </td>
                  </tr>
                ) : (
                  currentDues.map((due, index) => (
                    <tr key={due.id}>
                      <td className="text-center">{startIndex + index + 1}</td>
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
                  ))
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
