import {
  AlertCircle,
  Download,
  Edit,
  FileSpreadsheet,
  KeyRound,
  Search,
  Upload,
  UserCog,
  UserX,
} from "lucide-react";
import { useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import * as XLSX from "xlsx";
import DashboardLayout from "../../components/DashboardLayout";

interface Faculty {
  faculty_id: string;
  employee_code: string;
  name: string;
  department?: string;
  section?: string;
  department_id?: number;
  section_id?: number;
  designation: string;
  email: string;
  mobile: string;
  staff_type: "teaching" | "non-teaching";
  assigned_role?: string;
  active?: boolean;
}

interface Department {
  id: number;
  name: string;
}

interface Section {
  id: number;
  name: string;
}

const AddFaculty = () => {
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [_sections, setSections] = useState<Section[]>([]);
  const [staffType, setStaffType] = useState<"teaching" | "non-teaching">(
    "teaching",
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Modals
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedFaculty, setSelectedFaculty] = useState<Faculty | null>(null);
  const [editFormData, setEditFormData] = useState<Faculty | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [operatorType, setOperatorType] = useState<"department" | "section">(
    "department",
  );
  const [operatorAccessLevel, setOperatorAccessLevel] = useState<
    "all_students" | "department_students" | "all_faculty"
  >("all_students");

  const FACULTY_PER_PAGE = 50;

  // Get user data from localStorage
  const userData = JSON.parse(localStorage.getItem("user") || "{}");
  const user = {
    username: userData.name || userData.username || "Admin User",
    email: userData.email || "admin@vnrvjiet.in",
    role: (userData.role || "admin") as
      | "admin"
      | "operator"
      | "hod"
      | "student",
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const fetchOpts = { credentials: "include" as RequestCredentials };

      // Fetch departments
      const deptResponse = await fetch("/api/admin/departments", fetchOpts);
      if (deptResponse.ok) {
        const deptData = await deptResponse.json();
        if (deptData.success) {
          setDepartments(deptData.data);
        }
      }

      // Fetch sections
      const sectResponse = await fetch("/api/admin/sections", fetchOpts);
      if (sectResponse.ok) {
        const sectData = await sectResponse.json();
        if (sectData.success) {
          setSections(sectData.data);
        }
      }

      // Fetch faculty
      const facultyResponse = await fetch("/api/admin/faculty", fetchOpts);
      if (facultyResponse.ok) {
        const facultyData = await facultyResponse.json();
        if (facultyData.success) {
          setFaculty(facultyData.data);
        }
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to fetch data");
    }
  };

  const downloadTemplate = () => {
    const template = [
      {
        "S.No": 1,
        "Employee Code": "EMP0001",
        "Employee Name": "John Doe",
        Department: "Computer Science Engineering",
        Designation: "Professor",
        Email: "john.doe@vnrvjiet.in",
        Mobile: "9876543210",
      },
      {
        "S.No": 2,
        "Employee Code": "EMP0002",
        "Employee Name": "Jane Smith",
        Department: "Library",
        Designation: "Librarian",
        Email: "jane.smith@vnrvjiet.in",
        Mobile: "9876543211",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Faculty Template");
    XLSX.writeFile(wb, "faculty_upload_template.xlsx");
    toast.success("Template downloaded successfully");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        setUploadingFile(true);
        const fileData = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(fileData, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        const processedFaculty: Array<{
          employee_code: string;
          name: string;
          department?: string;
          section?: string;
          designation: string;
          email: string;
          mobile: string;
          staff_type: "teaching" | "non-teaching";
        }> = [];
        const errors: string[] = [];
        const newSections: string[] = [];

        const getString = (
          row: Record<string, unknown>,
          key: string,
        ): string => {
          const value = row[key];
          if (typeof value === "string") return value.trim();
          if (value === undefined || value === null) return "";
          return String(value).trim();
        };

        jsonData.forEach((rowValue, index: number) => {
          const row = rowValue as Record<string, unknown>;
          const rowNum = index + 2;

          const employeeCode = getString(row, "Employee Code");
          const employeeName = getString(row, "Employee Name");
          const departmentVal = getString(row, "Department");
          const designation = getString(row, "Designation");
          const emailVal = getString(row, "Email");
          const mobile = getString(row, "Mobile");

          if (!employeeCode) {
            errors.push(`Row ${rowNum}: Missing employee code`);
          }
          if (!employeeName) {
            errors.push(`Row ${rowNum}: Missing employee name`);
          }
          if (!departmentVal) {
            errors.push(`Row ${rowNum}: Missing department`);
          }
          if (!emailVal) {
            errors.push(`Row ${rowNum}: Missing email`);
          }

          if (errors.length === 0 || errors.length < 5) {
            const department = departmentVal;

            // Check if department exists in departments list
            const deptExists = departments.some(
              (d) => d.name.toLowerCase() === department.toLowerCase(),
            );

            // If not in departments, it should be added to sections
            if (
              !deptExists &&
              department &&
              !newSections.includes(department)
            ) {
              newSections.push(department);
            }

            processedFaculty.push({
              employee_code: employeeCode,
              name: employeeName,
              department: deptExists ? department : undefined,
              section: !deptExists ? department : undefined,
              designation,
              email: emailVal,
              mobile,
              staff_type: staffType,
            });
          }
        });

        if (errors.length > 0) {
          toast.error(
            `Found ${errors.length} validation errors. Please check the file.`,
          );
          console.error("Validation errors:", errors);
          setUploadingFile(false);
          e.target.value = "";
          return;
        }

        // Show upload progress
        setUploadProgress(10);
        const toastId = toast.loading(
          `Uploading ${processedFaculty.length} faculty members...`,
        );

        // Show info about new sections
        if (newSections.length > 0) {
          toast.success(
            `${newSections.length} new section(s) will be added: ${newSections.join(", ")}`,
          );
        }

        try {
          setUploadProgress(30);

          // Make API call
          const response = await fetch("/api/admin/faculty/bulk-upload", {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              faculty: processedFaculty,
              staff_type: staffType,
            }),
          });

          setUploadProgress(70);
          const responseData = await response.json();

          if (!response.ok) {
            toast.dismiss(toastId);
            throw new Error(responseData.message || "Upload failed");
          }

          if (responseData.success) {
            setUploadProgress(90);
            await fetchData();
            setUploadProgress(100);

            toast.dismiss(toastId);

            // Show detailed success message
            if (responseData.failed && responseData.failed.length > 0) {
              toast.success(
                `Successfully uploaded ${responseData.count} faculty. ${responseData.failed.length} failed.`,
                { duration: 5000 },
              );
              console.log("Failed records:", responseData.failed);
            } else {
              toast.success(
                `Successfully uploaded ${responseData.count} faculty members!`,
                { duration: 4000 },
              );
            }
          } else {
            toast.dismiss(toastId);
            throw new Error(responseData.message || "Upload failed");
          }

          e.target.value = "";
        } catch (uploadError) {
          console.error("Error uploading file:", uploadError);
          toast.dismiss(toastId);
          toast.error(
            uploadError instanceof Error
              ? uploadError.message
              : "Upload failed. Please try again.",
            { duration: 5000 },
          );
          e.target.value = "";
        } finally {
          setUploadingFile(false);
          setUploadProgress(0);
        }
      } catch (error) {
        console.error("Error uploading file:", error);
        toast.error("Upload failed. Database rolled back to previous state.");
        setUploadingFile(false);
        setUploadProgress(0);
        e.target.value = "";
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const handleToggleFacultyStatus = async (f: Faculty) => {
    const newActive = !f.active;
    try {
      const response = await fetch(
        `/api/admin/faculty/${f.faculty_id}/toggle-active`,
        {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active: newActive }),
        },
      );
      const data = await response.json();
      if (data.success) {
        toast.success(data.message);
        setFaculty((prev) =>
          prev.map((item) =>
            item.faculty_id === f.faculty_id
              ? { ...item, active: newActive }
              : item,
          ),
        );
      } else {
        toast.error(data.message || "Failed to update status");
      }
    } catch {
      toast.error("Failed to update faculty status");
    }
  };

  const handlePasswordChange = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error("Password must be at least 6 characters long");
      return;
    }

    try {
      const response = await fetch(
        `/api/admin/faculty/${selectedFaculty?.faculty_id}/password`,
        {
          method: "PUT",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ password: newPassword }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to update password");
      }

      const data = await response.json();

      if (data.success) {
        toast.success("Password updated successfully");
        setShowPasswordModal(false);
        setSelectedFaculty(null);
        setNewPassword("");
      } else {
        throw new Error(data.message || "Failed to update password");
      }
    } catch (err) {
      console.error("Password update error:", err);
      toast.error("Failed to update password");
    }
  };

  const handleRoleAssignment = async () => {
    if (!selectedRole) {
      toast.error("Please select a role");
      return;
    }

    try {
      const response = await fetch(
        `/api/admin/faculty/${selectedFaculty?.faculty_id}/role`,
        {
          method: "PUT",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ role: selectedRole }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to assign role");
      }

      const data = await response.json();

      if (data.success) {
        await fetchData();
        toast.success("Role assigned successfully");
        setShowRoleModal(false);
        setSelectedFaculty(null);
        setSelectedRole("");
      } else {
        throw new Error(data.message || "Failed to assign role");
      }

      // Update faculty list
      setFaculty(
        faculty.map((f) =>
          f.faculty_id === selectedFaculty?.faculty_id
            ? { ...f, assigned_role: selectedRole }
            : f,
        ),
      );

      toast.success("Role assigned successfully");
      setShowRoleModal(false);
      setSelectedFaculty(null);
      setSelectedRole("");
    } catch (err) {
      console.error("Role assignment error:", err);
      toast.error("Failed to assign role");
    }
  };

  const handleEditFaculty = async () => {
    if (!editFormData) return;

    // Validation
    if (
      !editFormData.name ||
      !editFormData.employee_code ||
      !editFormData.email
    ) {
      toast.error("Name, Employee Code, and Email are required");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editFormData.email)) {
      toast.error("Invalid email format");
      return;
    }

    try {
      const response = await fetch(
        `/api/admin/faculty/${editFormData.faculty_id}`,
        {
          method: "PUT",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: editFormData.name,
            employee_code: editFormData.employee_code,
            email: editFormData.email,
            mobile: editFormData.mobile,
            designation: editFormData.designation,
            staff_type: editFormData.staff_type,
            department_id: editFormData.department_id,
            section_id: editFormData.section_id,
          }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to update faculty");
      }

      const data = await response.json();

      if (data.success) {
        toast.success("Faculty details updated successfully");
        setShowEditModal(false);
        setEditFormData(null);
        await fetchData(); // Refresh the list
      } else {
        throw new Error(data.message || "Failed to update faculty");
      }
    } catch (err) {
      console.error("Faculty update error:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to update faculty",
      );
    }
  };

  // Pagination
  const filteredFaculty = faculty.filter(
    (f) =>
      f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.employee_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.department?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.section?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const totalPages = Math.ceil(filteredFaculty.length / FACULTY_PER_PAGE);
  const startIndex = (currentPage - 1) * FACULTY_PER_PAGE;
  const endIndex = startIndex + FACULTY_PER_PAGE;
  const currentFaculty = filteredFaculty.slice(startIndex, endIndex);

  return (
    <DashboardLayout
      role={user.role}
      username={user.username}
      email={user.email}
    >
      <Toaster position="top-right" />
      <div className="space-y-6 official-enter">
        <div className="official-card p-6">
          <h2 className="official-title text-2xl sm:text-3xl mb-6">
            Add Faculty
          </h2>

          {/* Upload Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="form-control">
              <label className="label pb-3">
                <span className="label-text font-semibold text-base">
                  Staff Type *
                </span>
              </label>
              <select
                className="select select-bordered select-md border-b-4 border-b-primary focus:border-b-accent"
                value={staffType}
                onChange={(e) =>
                  setStaffType(e.target.value as "teaching" | "non-teaching")
                }
              >
                <option value="teaching">Teaching</option>
                <option value="non-teaching">Non-Teaching</option>
              </select>
            </div>

            <div className="form-control">
              <label className="label pb-3">
                <span className="label-text font-semibold text-base">
                  Download Template
                </span>
              </label>
              <button
                onClick={downloadTemplate}
                className="btn btn-secondary btn-sm sm:btn-md gap-2 shadow hover:shadow-lg transition-all"
              >
                <Download size={20} />
                Download Template
              </button>
            </div>

            <div className="form-control">
              <label className="label pb-3">
                <span className="label-text font-semibold text-base">
                  Upload File
                </span>
              </label>
              <label
                className={`btn btn-primary btn-sm sm:btn-md gap-2 shadow-lg hover:shadow-xl transition-all ${
                  uploadingFile ? "loading" : ""
                }`}
              >
                {!uploadingFile && <Upload size={20} />}
                Upload Excel File
                <input
                  type="file"
                  className="hidden"
                  accept=".xlsx,.xls"
                  onChange={handleFileUpload}
                  disabled={uploadingFile}
                />
              </label>
            </div>
          </div>

          {/* Upload Progress Bar */}
          {uploadingFile && uploadProgress > 0 && (
            <div className="bg-primary/10 border-2 border-primary p-6 rounded-lg mb-6 animate-pulse">
              <div className="flex justify-between mb-3">
                <span className="text-base font-bold flex items-center gap-2">
                  <FileSpreadsheet size={20} className="text-primary" />
                  Upload Progress
                </span>
                <span className="text-2xl font-bold text-primary">
                  {uploadProgress}%
                </span>
              </div>
              <progress
                className="progress progress-primary w-full h-6 shadow-lg"
                value={uploadProgress}
                max="100"
              ></progress>
              <p className="text-sm text-base-content/80 mt-3 font-medium">
                Processing faculty members... Please wait, this may take a few
                moments for large files.
              </p>
            </div>
          )}

          <div className="alert alert-info mb-6">
            <AlertCircle size={20} />
            <div>
              <p className="font-semibold">Important Notes:</p>
              <ul className="text-sm list-disc list-inside mt-1">
                <li>Download the template and fill in faculty details</li>
                <li>
                  If department name doesn't exist in departments table, it will
                  be added to sections
                </li>
                <li>
                  Default password for all faculty: <strong>pass123</strong>
                </li>
                <li>
                  You can assign roles (admin, operator, hod) to faculty after
                  upload
                </li>
                <li>Upload will be rolled back if any error occurs</li>
              </ul>
            </div>
          </div>

          {/* Search */}
          <div className="form-control mb-4">
            <div className="input-group">
              <span>
                <Search size={20} />
              </span>
              <input
                type="text"
                placeholder="Search by name, employee code, email, department..."
                className="input input-bordered input-md w-full"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
          </div>

          {/* Faculty Table */}
          <div className="table-shell mb-4">
            <table className="table table-zebra w-full">
              <thead>
                <tr>
                  <th className="text-center">Employee Code</th>
                  <th className="text-center">Name</th>
                  <th className="text-center">Dept/Section</th>
                  <th className="text-center">Designation</th>
                  <th className="text-center">Email</th>
                  <th className="text-center">Staff Type</th>
                  <th className="text-center">Assigned Role</th>
                  <th className="text-center">Status</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentFaculty.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-8">
                      <FileSpreadsheet
                        size={48}
                        className="mx-auto mb-2 opacity-50"
                      />
                      <p>
                        No faculty found. Upload an Excel file to add faculty.
                      </p>
                    </td>
                  </tr>
                ) : (
                  currentFaculty.map((f) => (
                    <tr
                      key={f.faculty_id}
                      className={f.active === false ? "opacity-60" : ""}
                    >
                      <td className="text-center font-semibold">
                        {f.employee_code}
                      </td>
                      <td className="text-center">{f.name}</td>
                      <td className="text-center">
                        {f.department || f.section}
                        <br />
                        <span className="badge badge-xs">
                          {f.department ? "Dept" : "Section"}
                        </span>
                      </td>
                      <td className="text-center">
                        <div
                          className="max-w-[120px] truncate"
                          title={f.designation}
                        >
                          {f.designation}
                        </div>
                      </td>
                      <td className="text-center">
                        <div className="max-w-[180px] truncate" title={f.email}>
                          {f.email}
                        </div>
                      </td>
                      <td className="text-center px-3">
                        <span
                          className={`badge badge-sm whitespace-nowrap ${
                            f.staff_type === "teaching"
                              ? "badge-success"
                              : "badge-info"
                          }`}
                        >
                          {f.staff_type === "teaching"
                            ? "Teaching"
                            : "Non-Teaching"}
                        </span>
                      </td>
                      <td className="text-center">
                        {f.assigned_role ? (
                          <span className="badge badge-primary badge-sm capitalize">
                            {f.assigned_role}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="text-center">
                        {f.active === false ? (
                          <span className="badge badge-error badge-sm">
                            Inactive
                          </span>
                        ) : (
                          <span className="badge badge-success badge-sm">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="text-center px-2">
                        <div className="flex gap-1 justify-center flex-wrap">
                          <button
                            onClick={() => handleToggleFacultyStatus(f)}
                            className={`btn btn-xs sm:btn-sm gap-1 ${
                              f.active === false ? "btn-success" : "btn-error"
                            }`}
                            title={
                              f.active === false
                                ? "Activate account"
                                : "Deactivate account"
                            }
                          >
                            <UserX size={12} />
                            {f.active === false ? "Activate" : "Deactivate"}
                          </button>
                          <button
                            onClick={() => {
                              setEditFormData(f);
                              setShowEditModal(true);
                            }}
                            className="btn btn-info btn-xs sm:btn-sm gap-1"
                            title="Edit Profile"
                          >
                            <Edit size={12} />
                            <span className="hidden lg:inline">Edit</span>
                          </button>
                          <button
                            onClick={() => {
                              setSelectedFaculty(f);
                              setShowRoleModal(true);
                            }}
                            className="btn btn-secondary btn-xs sm:btn-sm gap-1"
                            title="Assign Role"
                          >
                            <UserCog size={12} />
                            <span className="hidden lg:inline">Role</span>
                          </button>
                          <button
                            onClick={() => {
                              setSelectedFaculty(f);
                              setShowPasswordModal(true);
                            }}
                            className="btn btn-warning btn-xs sm:btn-sm gap-1"
                            title="Change Password"
                          >
                            <KeyRound size={12} />
                            <span className="hidden lg:inline">Pass</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {filteredFaculty.length > 0 && (
            <div className="flex justify-between items-center">
              <div className="text-sm">
                Showing {startIndex + 1} to{" "}
                {Math.min(endIndex, filteredFaculty.length)} of{" "}
                {filteredFaculty.length} faculty members
              </div>
              <div className="btn-group">
                <button
                  className="btn btn-xs sm:btn-sm"
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  «
                </button>
                <button className="btn btn-xs sm:btn-sm">
                  Page {currentPage} of {totalPages}
                </button>
                <button
                  className="btn btn-xs sm:btn-sm"
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  »
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">
              Change Password for {selectedFaculty?.name}
            </h3>
            <p className="text-sm mb-4">
              Employee Code: {selectedFaculty?.employee_code}
            </p>
            <div className="form-control">
              <label className="label mb-2">
                <span className="label-text">New Password</span>
              </label>
              <input
                type="password"
                placeholder="Enter new password (min 6 characters)"
                className="input input-bordered input-md border-b-4 border-b-primary focus:border-b-accent"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="modal-action">
              <button
                onClick={handlePasswordChange}
                className="btn btn-primary btn-sm sm:btn-md border-2 border-primary-focus shadow-lg hover:shadow-xl"
              >
                Update Password
              </button>
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setSelectedFaculty(null);
                  setNewPassword("");
                }}
                className="btn btn-sm sm:btn-md"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Role Assignment Modal */}
      {showRoleModal && (
        <div className="modal modal-open">
          <div className="modal-box max-w-2xl">
            <h3 className="font-bold text-lg mb-4">
              Assign Role to {selectedFaculty?.name}
            </h3>
            <p className="text-sm mb-4">
              Employee Code: {selectedFaculty?.employee_code}
            </p>
            <p className="text-sm mb-4">
              Current Role: {selectedFaculty?.assigned_role || "None"}
            </p>
            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">Select Role</span>
              </label>
              <select
                className="select select-bordered select-md border-b-4 border-b-primary focus:border-b-accent"
                value={selectedRole}
                onChange={(e) => {
                  setSelectedRole(e.target.value);
                  if (e.target.value !== "operator") {
                    setOperatorType("department");
                    setOperatorAccessLevel("all_students");
                  }
                }}
              >
                <option value="">No Role (Faculty Only)</option>
                <option value="admin">Admin</option>
                <option value="operator">Operator</option>
                <option value="hod">HOD</option>
              </select>
            </div>

            {selectedRole === "operator" && (
              <>
                <div className="form-control mb-4">
                  <label className="label">
                    <span className="label-text">Operator Type *</span>
                  </label>
                  <select
                    className="select select-bordered select-md border-b-4 border-b-primary focus:border-b-accent"
                    value={operatorType}
                    onChange={(e) => {
                      setOperatorType(
                        e.target.value as "department" | "section",
                      );
                      setOperatorAccessLevel("all_students");
                    }}
                  >
                    <option value="department">Department Operator</option>
                    <option value="section">Section Operator</option>
                  </select>
                </div>

                <div className="form-control mb-4">
                  <label className="label">
                    <span className="label-text">Access Level *</span>
                  </label>
                  <select
                    className="select select-bordered select-md border-b-4 border-b-primary focus:border-b-accent"
                    value={operatorAccessLevel}
                    onChange={(e) =>
                      setOperatorAccessLevel(
                        e.target.value as
                          | "all_students"
                          | "department_students"
                          | "all_faculty",
                      )
                    }
                  >
                    {operatorType === "department" ? (
                      <>
                        <option value="all_students">
                          All Students (Any Department)
                        </option>
                        <option value="department_students">
                          Department Students Only
                        </option>
                      </>
                    ) : (
                      <>
                        <option value="all_students">
                          All Students (Any Section)
                        </option>
                        <option value="all_faculty">
                          All Faculty (Section Only)
                        </option>
                      </>
                    )}
                  </select>
                  <label className="label">
                    <span className="label-text-alt text-gray-500">
                      {operatorType === "department"
                        ? operatorAccessLevel === "all_students"
                          ? "Can add dues to any student in the database"
                          : "Can add dues only to students in their department"
                        : operatorAccessLevel === "all_students"
                          ? "Can add dues to any student in the database"
                          : "Can add dues to faculty in their section"}
                    </span>
                  </label>
                </div>

                <div className="alert alert-info mb-4 text-sm">
                  <AlertCircle size={16} />
                  <span>
                    Faculty's department/section will be used as the operator's
                    department/section
                  </span>
                </div>
              </>
            )}

            <div className="modal-action">
              <button
                onClick={handleRoleAssignment}
                className="btn btn-primary btn-sm sm:btn-md border-2 border-primary-focus shadow-lg hover:shadow-xl"
              >
                Assign Role
              </button>
              <button
                onClick={() => {
                  setShowRoleModal(false);
                  setSelectedFaculty(null);
                  setSelectedRole("");
                  setOperatorType("department");
                  setOperatorAccessLevel("all_students");
                }}
                className="btn btn-sm sm:btn-md"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Faculty Modal */}
      {showEditModal && editFormData && (
        <div className="modal modal-open">
          <div className="modal-box max-w-2xl">
            <h3 className="font-bold text-lg mb-4">Edit Faculty Details</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-control">
                <label className="label mb-2">
                  <span className="label-text">Name *</span>
                </label>
                <input
                  type="text"
                  placeholder="Faculty Name"
                  className="input input-bordered input-md border-b-4 border-b-primary focus:border-b-accent"
                  value={editFormData.name}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, name: e.target.value })
                  }
                />
              </div>

              <div className="form-control">
                <label className="label mb-2">
                  <span className="label-text">Employee Code *</span>
                </label>
                <input
                  type="text"
                  placeholder="Employee Code"
                  className="input input-bordered input-md border-b-4 border-b-primary focus:border-b-accent"
                  value={editFormData.employee_code}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      employee_code: e.target.value,
                    })
                  }
                />
              </div>

              <div className="form-control">
                <label className="label mb-2">
                  <span className="label-text">Email *</span>
                </label>
                <input
                  type="email"
                  placeholder="Email"
                  className="input input-bordered input-md border-b-4 border-b-primary focus:border-b-accent"
                  value={editFormData.email}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, email: e.target.value })
                  }
                />
              </div>

              <div className="form-control">
                <label className="label mb-2">
                  <span className="label-text">Mobile</span>
                </label>
                <input
                  type="text"
                  placeholder="Mobile Number"
                  className="input input-bordered input-md border-b-4 border-b-primary focus:border-b-accent"
                  value={editFormData.mobile}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, mobile: e.target.value })
                  }
                />
              </div>

              <div className="form-control">
                <label className="label mb-2">
                  <span className="label-text">Designation</span>
                </label>
                <input
                  type="text"
                  placeholder="Designation"
                  className="input input-bordered input-md border-b-4 border-b-primary focus:border-b-accent"
                  value={editFormData.designation}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      designation: e.target.value,
                    })
                  }
                />
              </div>

              <div className="form-control">
                <label className="label mb-2">
                  <span className="label-text">Staff Type</span>
                </label>
                <select
                  className="select select-bordered select-md border-b-4 border-b-primary focus:border-b-accent"
                  value={editFormData.staff_type}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      staff_type: e.target.value as "teaching" | "non-teaching",
                    })
                  }
                >
                  <option value="teaching">Teaching</option>
                  <option value="non-teaching">Non-Teaching</option>
                </select>
              </div>

              <div className="form-control">
                <label className="label mb-2">
                  <span className="label-text">Department</span>
                </label>
                <select
                  className="select select-bordered select-md border-b-4 border-b-primary focus:border-b-accent"
                  value={editFormData.department_id || ""}
                  onChange={(e) => {
                    setEditFormData({
                      ...editFormData,
                      department_id: e.target.value
                        ? parseInt(e.target.value)
                        : undefined,
                      section_id: undefined, // Clear section when department is selected
                    });
                  }}
                >
                  <option value="">Select Department</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-control">
                <label className="label mb-2">
                  <span className="label-text">Section</span>
                </label>
                <select
                  className="select select-bordered select-md border-b-4 border-b-primary focus:border-b-accent"
                  value={editFormData.section_id || ""}
                  onChange={(e) => {
                    setEditFormData({
                      ...editFormData,
                      section_id: e.target.value
                        ? parseInt(e.target.value)
                        : undefined,
                      department_id: undefined, // Clear department when section is selected
                    });
                  }}
                >
                  <option value="">Select Section</option>
                  {_sections.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="modal-action">
              <button
                onClick={handleEditFaculty}
                className="btn btn-primary btn-sm sm:btn-md border-2 border-primary-focus shadow-lg hover:shadow-xl"
              >
                Save Changes
              </button>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditFormData(null);
                }}
                className="btn btn-sm sm:btn-md"
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

export default AddFaculty;
