import {
  AlertCircle,
  Download,
  Edit,
  FileSpreadsheet,
  KeyRound,
  Search,
  Upload,
  UserX,
} from "lucide-react";
import { useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import * as XLSX from "xlsx";
import DashboardLayout from "../../components/DashboardLayout";

interface Student {
  student_id: string;
  name: string;
  roll_number: string;
  branch: string;
  section: string;
  email: string;
  mobile: string;
  father_name: string;
  father_mobile: string;
  academic_year: string;
  academic_year_id?: number;
  active?: boolean;
}

interface AcademicYear {
  id: number;
  beginning_year: number;
  ending_year: number;
}

const AddStudents = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedAcademicYear, setSelectedAcademicYear] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Password modal
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [newPassword, setNewPassword] = useState("");

  // Edit modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState<Student | null>(null);

  const STUDENTS_PER_PAGE = 50;

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

      // Fetch academic years
      const yearResponse = await fetch("/api/admin/academic-years", fetchOpts);
      if (yearResponse.ok) {
        const yearData = await yearResponse.json();
        if (yearData.success) {
          setAcademicYears(yearData.data);
        }
      }

      // Fetch students
      const studentsResponse = await fetch("/api/admin/students", fetchOpts);
      if (studentsResponse.ok) {
        const studentsData = await studentsResponse.json();
        if (studentsData.success) {
          setStudents(studentsData.data);
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
        "S.No.": 1,
        "Name of the Student": "John Doe",
        "H.T.No.": "20CSE0001",
        Branch: "Computer Science Engineering",
        Section: "A",
        Email: "john.doe@vnrvjiet.in",
        Mobile: "9876543210",
        "Father Name": "Father Name",
        "Father Mobile": "9876543211",
      },
      {
        "S.No.": 2,
        "Name of the Student": "Jane Smith",
        "H.T.No.": "20CSE0002",
        Branch: "Electronics and Communication Engineering",
        Section: "B",
        Email: "jane.smith@vnrvjiet.in",
        Mobile: "9876543212",
        "Father Name": "Father Name",
        "Father Mobile": "9876543213",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Students Template");
    XLSX.writeFile(wb, "students_upload_template.xlsx");
    toast.success("Template downloaded successfully");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!selectedAcademicYear) {
      toast.error("Please select an academic year first");
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        setUploadingFile(true);
        const fileData = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(fileData, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        // Validate and process data
        const processedStudents: Array<{
          name: string;
          roll_number: string;
          branch: string;
          section: string;
          email: string;
          mobile: string;
          father_name: string;
          father_mobile: string;
        }> = [];
        const errors: string[] = [];

        // Helper to safely pull a string value from a row
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
          const rowNum = index + 2; // Excel row number (header is row 1)

          // Validate required fields
          const name = getString(row, "Name of the Student");
          const htno = getString(row, "H.T.No.");
          const branch = getString(row, "Branch");
          const section = getString(row, "Section");
          const emailVal = getString(row, "Email");

          let rowValid = true;
          if (!name) {
            errors.push(`Row ${rowNum}: Missing student name`);
            rowValid = false;
          }
          if (!htno) {
            errors.push(`Row ${rowNum}: Missing Hall Ticket Number`);
            rowValid = false;
          }
          if (!branch) {
            errors.push(`Row ${rowNum}: Missing branch`);
            rowValid = false;
          }
          if (!section) {
            errors.push(`Row ${rowNum}: Missing section`);
            rowValid = false;
          }
          if (!emailVal) {
            errors.push(`Row ${rowNum}: Missing email`);
            rowValid = false;
          }

          if (rowValid) {
            processedStudents.push({
              name,
              roll_number: htno,
              branch,
              section,
              email: emailVal,
              mobile: getString(row, "Mobile"),
              father_name: getString(row, "Father Name"),
              father_mobile: getString(row, "Father Mobile"),
            });
          }
        });

        if (errors.length > 0) {
          toast.error(
            `Found ${errors.length} validation errors. Please check the file.`,
          );
          console.error("Validation errors:", errors);
          setUploadingFile(false);
          setUploadProgress(0);
          e.target.value = "";
          return;
        }

        // Show upload progress
        setUploadProgress(10);
        const toastId = toast.loading(
          `Uploading ${processedStudents.length} students...`,
        );

        try {
          setUploadProgress(30);

          // Make API call
          const response = await fetch("/api/admin/students/bulk-upload", {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              students: processedStudents,
              academic_year_id: parseInt(selectedAcademicYear),
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
                `Successfully uploaded ${responseData.count} students. ${responseData.failed.length} failed.`,
                { duration: 5000 },
              );
              console.log("Failed records:", responseData.failed);
            } else {
              toast.success(
                `Successfully uploaded ${responseData.count} students!`,
                { duration: 4000 },
              );
            }
          } else {
            toast.dismiss(toastId);
            throw new Error(responseData.message || "Upload failed");
          }

          e.target.value = "";
        } catch (error) {
          console.error("Error uploading file:", error);
          toast.dismiss(toastId);
          toast.error(
            error instanceof Error
              ? error.message
              : "Upload failed. Please try again.",
            { duration: 5000 },
          );
          e.target.value = "";
        } finally {
          setUploadingFile(false);
          setUploadProgress(0);
        }
      } catch (parseError) {
        console.error("Error parsing file:", parseError);
        toast.error("Failed to parse Excel file. Please check the format.");
        setUploadingFile(false);
        setUploadProgress(0);
        e.target.value = "";
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const handlePasswordChange = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error("Password must be at least 6 characters long");
      return;
    }

    try {
      const response = await fetch(
        `/api/admin/students/${selectedStudent?.student_id}/password`,
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
        setSelectedStudent(null);
        setNewPassword("");
      } else {
        throw new Error(data.message || "Failed to update password");
      }
    } catch (err) {
      console.error("Password update error:", err);
      toast.error("Failed to update password");
    }
  };

  const handleToggleStudentStatus = async (student: Student) => {
    const newActive = !student.active;
    try {
      const response = await fetch(
        `/api/admin/students/${student.student_id}/toggle-active`,
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
        setStudents((prev) =>
          prev.map((s) =>
            s.student_id === student.student_id
              ? { ...s, active: newActive }
              : s,
          ),
        );
      } else {
        toast.error(data.message || "Failed to update status");
      }
    } catch {
      toast.error("Failed to update student status");
    }
  };

  const handleEditStudent = async () => {
    if (!editFormData) return;
    if (
      !editFormData.name ||
      !editFormData.roll_number ||
      !editFormData.email
    ) {
      toast.error("Name, Roll Number, and Email are required");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editFormData.email)) {
      toast.error("Invalid email format");
      return;
    }

    try {
      const response = await fetch(
        `/api/admin/students/${editFormData.student_id}`,
        {
          method: "PUT",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: editFormData.name,
            roll_number: editFormData.roll_number,
            email: editFormData.email,
            mobile: editFormData.mobile,
            father_name: editFormData.father_name,
            father_mobile: editFormData.father_mobile,
            branch: editFormData.branch,
            section: editFormData.section,
            academic_year_id: editFormData.academic_year_id,
          }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to update student");
      }

      const data = await response.json();

      if (data.success) {
        toast.success("Student details updated successfully");
        setShowEditModal(false);
        setEditFormData(null);
        await fetchData(); // Refresh the list
      } else {
        throw new Error(data.message || "Failed to update student");
      }
    } catch (err) {
      console.error("Student update error:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to update student",
      );
    }
  };

  // Pagination logic
  const filteredStudents = students.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.roll_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.branch.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.email.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const totalPages = Math.ceil(filteredStudents.length / STUDENTS_PER_PAGE);
  const startIndex = (currentPage - 1) * STUDENTS_PER_PAGE;
  const endIndex = startIndex + STUDENTS_PER_PAGE;
  const currentStudents = filteredStudents.slice(startIndex, endIndex);

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
            Add Students
          </h2>

          {/* Upload Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="form-control">
              <label className="label pb-3">
                <span className="label-text font-semibold text-base">
                  Academic Year *
                </span>
              </label>
              <select
                className="select select-bordered select-md border-b-4 border-b-primary focus:border-b-accent"
                value={selectedAcademicYear}
                onChange={(e) => setSelectedAcademicYear(e.target.value)}
              >
                <option value="">Select Academic Year</option>
                {academicYears.map((year) => (
                  <option key={year.id} value={year.id}>
                    {year.beginning_year}-{year.ending_year}
                  </option>
                ))}
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
                className={`btn btn-primary btn-sm sm:btn-md gap-2 shadow-lg hover:shadow-xl transition-all ${uploadingFile ? "loading" : ""}`}
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
                Processing students... Please wait, this may take a few moments
                for large files.
              </p>
            </div>
          )}

          <div className="alert alert-info mb-6">
            <AlertCircle size={20} />
            <div>
              <p className="font-semibold">Important Notes:</p>
              <ul className="text-sm list-disc list-inside mt-1">
                <li>Download the template and fill in student details</li>
                <li>
                  If a branch name doesn't exist, it will be automatically added
                  as a department
                </li>
                <li>
                  Default password for all students: <strong>pass123</strong>
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
                placeholder="Search by name, roll number, branch, or email..."
                className="input input-bordered input-md w-full"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
          </div>

          {/* Students Table */}
          <div className="table-shell mb-4">
            <table className="table table-zebra w-full">
              <thead>
                <tr>
                  <th className="text-center">Roll No</th>
                  <th className="text-center">Name</th>
                  <th className="text-center">Branch</th>
                  <th className="text-center">Section</th>
                  <th className="text-center">Email</th>
                  <th className="text-center">Year</th>
                  <th className="text-center">Status</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentStudents.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8">
                      <FileSpreadsheet
                        size={48}
                        className="mx-auto mb-2 opacity-50"
                      />
                      <p>
                        No students found. Upload an Excel file to add students.
                      </p>
                    </td>
                  </tr>
                ) : (
                  currentStudents.map((student) => (
                    <tr
                      key={student.student_id}
                      className={student.active === false ? "opacity-60" : ""}
                    >
                      <td className="text-center font-semibold">
                        <div
                          className="max-w-[100px] truncate"
                          title={student.roll_number}
                        >
                          {student.roll_number}
                        </div>
                      </td>
                      <td className="text-center">
                        <div
                          className="max-w-[150px] truncate"
                          title={student.name}
                        >
                          {student.name}
                        </div>
                      </td>
                      <td className="text-center">
                        <div
                          className="max-w-[80px] truncate"
                          title={student.branch}
                        >
                          {student.branch}
                        </div>
                      </td>
                      <td className="text-center">{student.section}</td>
                      <td className="text-center">
                        <div
                          className="max-w-[180px] truncate"
                          title={student.email}
                        >
                          {student.email}
                        </div>
                      </td>
                      <td className="text-center">
                        <div
                          className="max-w-[80px] truncate"
                          title={student.academic_year}
                        >
                          {student.academic_year}
                        </div>
                      </td>
                      <td className="text-center">
                        {student.active === false ? (
                          <span className="badge badge-error badge-sm">
                            Inactive
                          </span>
                        ) : (
                          <span className="badge badge-success badge-sm">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="text-center">
                        <div className="flex flex-col gap-2 items-center">
                          <button
                            onClick={() => handleToggleStudentStatus(student)}
                            className={`btn btn-xs sm:btn-sm gap-1 w-full max-w-[130px] ${
                              student.active === false
                                ? "btn-success"
                                : "btn-error"
                            }`}
                            title={
                              student.active === false
                                ? "Activate account"
                                : "Deactivate account"
                            }
                          >
                            <UserX size={14} />
                            {student.active === false
                              ? "Activate"
                              : "Deactivate"}
                          </button>
                          <button
                            onClick={() => {
                              setSelectedStudent(student);
                              setShowPasswordModal(true);
                            }}
                            className="btn btn-warning btn-xs sm:btn-sm gap-1 w-full max-w-[130px]"
                            title="Change Password"
                          >
                            <KeyRound size={14} />
                            <span className="hidden sm:inline">Password</span>
                            <span className="sm:hidden">Pass</span>
                          </button>
                          <button
                            onClick={() => {
                              setEditFormData(student);
                              setShowEditModal(true);
                            }}
                            className="btn btn-info btn-xs sm:btn-sm gap-1 w-full max-w-[130px]"
                            title="Edit Profile"
                          >
                            <Edit size={14} />
                            <span className="hidden sm:inline">Edit</span>
                            <span className="sm:hidden">Edit</span>
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
          {filteredStudents.length > 0 && (
            <div className="flex justify-between items-center">
              <div className="text-sm">
                Showing {startIndex + 1} to{" "}
                {Math.min(endIndex, filteredStudents.length)} of{" "}
                {filteredStudents.length} students
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
              Change Password for {selectedStudent?.name}
            </h3>
            <p className="text-sm mb-4">
              Roll Number: {selectedStudent?.roll_number}
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
                  setSelectedStudent(null);
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

      {/* Edit Student Modal */}
      {showEditModal && editFormData && (
        <div className="modal modal-open">
          <div className="modal-box max-w-2xl">
            <h3 className="font-bold text-lg mb-4">Edit Student Details</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-control">
                <label className="label mb-2">
                  <span className="label-text">Name *</span>
                </label>
                <input
                  type="text"
                  placeholder="Student Name"
                  className="input input-bordered input-md border-b-4 border-b-primary focus:border-b-accent"
                  value={editFormData.name}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, name: e.target.value })
                  }
                />
              </div>

              <div className="form-control">
                <label className="label mb-2">
                  <span className="label-text">Roll Number *</span>
                </label>
                <input
                  type="text"
                  placeholder="Roll Number"
                  className="input input-bordered input-md border-b-4 border-b-primary focus:border-b-accent"
                  value={editFormData.roll_number}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      roll_number: e.target.value,
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
                  <span className="label-text">Branch</span>
                </label>
                <input
                  type="text"
                  placeholder="Branch"
                  className="input input-bordered input-md border-b-4 border-b-primary focus:border-b-accent"
                  value={editFormData.branch}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, branch: e.target.value })
                  }
                />
              </div>

              <div className="form-control">
                <label className="label mb-2">
                  <span className="label-text">Section</span>
                </label>
                <input
                  type="text"
                  placeholder="Section"
                  className="input input-bordered input-md border-b-4 border-b-primary focus:border-b-accent"
                  value={editFormData.section}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      section: e.target.value,
                    })
                  }
                />
              </div>

              <div className="form-control">
                <label className="label mb-2">
                  <span className="label-text">Academic Year</span>
                </label>
                <select
                  className="select select-bordered select-md border-b-4 border-b-primary focus:border-b-accent"
                  value={editFormData.academic_year_id || ""}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      academic_year_id: parseInt(e.target.value),
                    })
                  }
                >
                  <option value="">Select Academic Year</option>
                  {academicYears.map((year) => (
                    <option key={year.id} value={year.id}>
                      {year.beginning_year}-{year.ending_year}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-control">
                <label className="label mb-2">
                  <span className="label-text">Father's Name</span>
                </label>
                <input
                  type="text"
                  placeholder="Father's Name"
                  className="input input-bordered input-md border-b-4 border-b-primary focus:border-b-accent"
                  value={editFormData.father_name}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      father_name: e.target.value,
                    })
                  }
                />
              </div>

              <div className="form-control">
                <label className="label mb-2">
                  <span className="label-text">Father's Mobile</span>
                </label>
                <input
                  type="text"
                  placeholder="Father's Mobile"
                  className="input input-bordered input-md border-b-4 border-b-primary focus:border-b-accent"
                  value={editFormData.father_mobile}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      father_mobile: e.target.value,
                    })
                  }
                />
              </div>
            </div>

            <div className="modal-action">
              <button
                onClick={handleEditStudent}
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

export default AddStudents;
