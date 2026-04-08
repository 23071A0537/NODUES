import {
  AlertCircle,
  KeyRound,
  Plus,
  Power,
  PowerOff,
  Search,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import DashboardLayout from "../../components/DashboardLayout";

interface User {
  user_id: string;
  username: string;
  email: string;
  role: string;
  department_name?: string;
  section_name?: string;
  created_at: string;
  active: boolean;
}

interface Department {
  id: number;
  name: string;
}

interface Section {
  id: number;
  name: string;
}

type UserRole = "admin" | "operator" | "hod";
type OperatorType = "department" | "section";
type OperatorAccessLevel =
  | "all_students"
  | "department_students"
  | "all_faculty";

const AddUser = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);

  // Form states
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("admin");
  const [operatorType, setOperatorType] = useState<OperatorType>("department");
  const [operatorAccessLevel, setOperatorAccessLevel] =
    useState<OperatorAccessLevel>("all_students");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedSection, setSelectedSection] = useState("");

  // Password change modal
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState("");

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

      // Fetch users
      const usersResponse = await fetch("/api/admin/users", fetchOpts);
      if (usersResponse.ok) {
        const usersData = await usersResponse.json();
        if (usersData.success) {
          setUsers(usersData.data);
        }
      }

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
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to fetch data");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!username.trim() || !email.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (!email.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }

    // Check if email already exists
    if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
      toast.error("This email already exists");
      return;
    }

    // HOD validation - only one HOD per department
    if (role === "hod") {
      if (!selectedDepartment) {
        toast.error("Please select a department for HOD");
        return;
      }
      const dept = departments.find(
        (d) => d.id === parseInt(selectedDepartment),
      );
      if (
        users.some((u) => u.role === "hod" && u.department_name === dept?.name)
      ) {
        toast.error("This department already has an HOD");
        return;
      }
    }

    // Operator validation
    if (role === "operator") {
      if (operatorType === "department" && !selectedDepartment) {
        toast.error("Please select a department for the operator");
        return;
      }
      if (operatorType === "section" && !selectedSection) {
        toast.error("Please select a section for the operator");
        return;
      }
    }

    setLoading(true);
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: username.trim(),
          email: email.trim(),
          password: password.trim() || "pass123",
          role,
          department_id:
            role === "hod" ||
            (role === "operator" && operatorType === "department")
              ? parseInt(selectedDepartment)
              : null,
          section_id:
            role === "operator" && operatorType === "section"
              ? parseInt(selectedSection)
              : null,
          operator_type: role === "operator" ? operatorType : null,
          access_level: role === "operator" ? operatorAccessLevel : null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to add user");
      }

      if (data.success) {
        await fetchData();
        // Reset form
        setUsername("");
        setEmail("");
        setPassword("");
        setRole("admin");
        setOperatorType("department");
        setOperatorAccessLevel("all_students");
        setSelectedDepartment("");
        setSelectedSection("");

        toast.success("User added successfully");
      } else {
        throw new Error(data.message || "Failed to add user");
      }
    } catch (error) {
      console.error("Error adding user:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to add user",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (userId: string, userEmail: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete the user "${userEmail}"?\n\nThis action cannot be undone!`,
    );

    if (!confirmed) return;

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
        credentials: "include" as RequestCredentials,
      });

      if (!response.ok) {
        throw new Error("Failed to delete user");
      }

      const data = await response.json();

      if (data.success) {
        await fetchData();
        toast.success("User deleted successfully");
      } else {
        throw new Error(data.message || "Failed to delete user");
      }
    } catch (error) {
      console.error("Error deleting user:", error);
      toast.error("Failed to delete user");
    }
  };

  const handleToggleActive = async (
    userId: string,
    username: string,
    currentStatus: boolean,
  ) => {
    const action = currentStatus ? "deactivate" : "activate";
    const confirmed = window.confirm(
      `Are you sure you want to ${action} the account for "${username}"?\n\n${
        currentStatus
          ? "The user will not be able to log in or access the system."
          : "The user will be able to log in and access the system again."
      }`,
    );

    if (!confirmed) return;

    try {
      const response = await fetch(`/api/admin/users/${userId}/toggle-active`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include" as RequestCredentials,
        body: JSON.stringify({ active: !currentStatus }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update user status");
      }

      const data = await response.json();

      if (data.success) {
        await fetchData();
        toast.success(
          `User ${!currentStatus ? "activated" : "deactivated"} successfully`,
        );
      } else {
        throw new Error(data.message || "Failed to update user status");
      }
    } catch (error) {
      console.error("Error toggling user status:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update user status",
      );
    }
  };

  const handlePasswordChange = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error("Password must be at least 6 characters long");
      return;
    }

    try {
      const response = await fetch(
        `/api/admin/users/${selectedUser?.user_id}/password`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include" as RequestCredentials,
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
        setSelectedUser(null);
        setNewPassword("");
      } else {
        throw new Error(data.message || "Failed to update password");
      }
    } catch (error) {
      console.error("Error updating password:", error);
      toast.error("Failed to update password");
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.department_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.section_name?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <DashboardLayout
      role={user.role}
      username={user.username}
      email={user.email}
    >
      <Toaster position="top-right" />
      <div className="space-y-6 official-enter">
        <div className="official-card p-6">
          <h2 className="official-title text-2xl sm:text-3xl mb-6">Add User</h2>

          {/* Add User Form */}
          <form onSubmit={handleSubmit} className="mb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="form-control">
                <label className="label pb-3">
                  <span className="label-text font-semibold text-base">
                    Username *
                  </span>
                </label>
                <input
                  type="text"
                  placeholder="Enter username"
                  className="input input-bordered input-md border-b-4 border-b-primary focus:border-b-accent"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>

              <div className="form-control">
                <label className="label pb-3">
                  <span className="label-text font-semibold text-base">
                    Email *
                  </span>
                </label>
                <input
                  type="email"
                  placeholder="Enter email"
                  className="input input-bordered input-md border-b-4 border-b-primary focus:border-b-accent"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="form-control">
                <label className="label pb-3">
                  <span className="label-text font-semibold text-base">
                    Password
                  </span>
                </label>
                <input
                  type="password"
                  placeholder="Enter password (default: pass123)"
                  className="input input-bordered input-md border-b-4 border-b-primary focus:border-b-accent"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <label className="label mt-1">
                  <span className="label-text-alt text-gray-500">
                    Leave empty to use default password: pass123
                  </span>
                </label>
              </div>

              <div className="form-control">
                <label className="label pb-3">
                  <span className="label-text font-semibold text-base">
                    Role *
                  </span>
                </label>
                <select
                  className="select select-bordered select-md border-b-4 border-b-primary focus:border-b-accent"
                  value={role}
                  onChange={(e) => {
                    setRole(e.target.value as UserRole);
                    setSelectedDepartment("");
                    setSelectedSection("");
                  }}
                >
                  <option value="admin">Admin</option>
                  <option value="operator">Operator</option>
                  <option value="hod">HOD</option>
                </select>
              </div>
            </div>

            {role === "operator" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="form-control">
                  <label className="label pb-3">
                    <span className="label-text font-semibold text-base">
                      Operator Type *
                    </span>
                  </label>
                  <select
                    className="select select-bordered select-md border-b-4 border-b-primary focus:border-b-accent"
                    value={operatorType}
                    onChange={(e) => {
                      setOperatorType(e.target.value as OperatorType);
                      setOperatorAccessLevel("all_students");
                      setSelectedDepartment("");
                      setSelectedSection("");
                    }}
                  >
                    <option value="department">Department Operator</option>
                    <option value="section">Section Operator</option>
                  </select>
                </div>

                <div className="form-control">
                  <label className="label pb-3">
                    <span className="label-text font-semibold text-base">
                      Access Level *
                    </span>
                  </label>
                  <select
                    className="select select-bordered select-md border-b-4 border-b-primary focus:border-b-accent"
                    value={operatorAccessLevel}
                    onChange={(e) =>
                      setOperatorAccessLevel(
                        e.target.value as OperatorAccessLevel,
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
                  <label className="label mt-1">
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
              </div>
            )}

            {role === "hod" && (
              <div className="form-control mb-6">
                <label className="label pb-3">
                  <span className="label-text font-semibold text-base">
                    Department *
                  </span>
                </label>
                <select
                  className="select select-bordered select-md border-b-4 border-b-primary focus:border-b-accent"
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  required
                >
                  <option value="">Select Department</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {role === "operator" && operatorType === "department" && (
              <div className="form-control mb-6">
                <label className="label pb-3">
                  <span className="label-text font-semibold text-base">
                    Department *
                  </span>
                </label>
                <select
                  className="select select-bordered select-md border-b-4 border-b-primary focus:border-b-accent"
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  required
                >
                  <option value="">Select Department</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {role === "operator" && operatorType === "section" && (
              <div className="form-control mb-6">
                <label className="label pb-3">
                  <span className="label-text font-semibold text-base">
                    Section *
                  </span>
                </label>
                <select
                  className="select select-bordered select-md border-b-4 border-b-primary focus:border-b-accent"
                  value={selectedSection}
                  onChange={(e) => setSelectedSection(e.target.value)}
                  required
                >
                  <option value="">Select Section</option>
                  {sections.map((sec) => (
                    <option key={sec.id} value={sec.id}>
                      {sec.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="alert alert-info mb-6">
              <AlertCircle size={20} />
              <span>
                Default passwords: <strong>Admin - admin123</strong> |{" "}
                <strong>Operator/HOD - pass123</strong>
              </span>
            </div>

            <button
              type="submit"
              className={`btn btn-primary btn-sm sm:btn-md w-full md:w-auto md:px-12 gap-2 shadow-lg hover:shadow-xl transition-all ${
                loading ? "loading" : ""
              }`}
              disabled={loading}
            >
              {!loading && <Plus size={20} />}
              <span>Add User</span>
            </button>
          </form>

          {/* Search */}
          <div className="form-control mb-4">
            <div className="input-group">
              <span>
                <Search size={20} />
              </span>
              <input
                type="text"
                placeholder="Search users by name, email, role, department..."
                className="input input-bordered input-md w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Users List */}
          <div className="table-shell">
            <table className="table table-zebra w-full">
              <thead>
                <tr>
                  <th className="text-center">Username</th>
                  <th className="text-center">Email</th>
                  <th className="text-center">Role</th>
                  <th className="text-center">Department/Section</th>
                  <th className="text-center">Status</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8">
                      No users found
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr
                      key={u.user_id}
                      className={!u.active ? "opacity-60" : ""}
                    >
                      <td className="text-center font-semibold">
                        {u.username}
                      </td>
                      <td className="text-center">{u.email}</td>
                      <td className="text-center">
                        <span className="badge badge-primary capitalize">
                          {u.role}
                        </span>
                      </td>
                      <td className="text-center">
                        {u.department_name || u.section_name || "-"}
                      </td>
                      <td className="text-center">
                        <span
                          className={`badge ${u.active ? "badge-success" : "badge-error"}`}
                        >
                          {u.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="text-center">
                        <div className="flex gap-2 justify-center flex-wrap">
                          <button
                            onClick={() =>
                              handleToggleActive(
                                u.user_id,
                                u.username,
                                u.active,
                              )
                            }
                            className={`btn btn-xs sm:btn-sm gap-2 ${u.active ? "btn-warning" : "btn-success"}`}
                            title={
                              u.active
                                ? "Deactivate account"
                                : "Activate account"
                            }
                          >
                            {u.active ? (
                              <PowerOff size={16} />
                            ) : (
                              <Power size={16} />
                            )}
                            {u.active ? "Deactivate" : "Activate"}
                          </button>
                          <button
                            onClick={() => {
                              setSelectedUser(u);
                              setShowPasswordModal(true);
                            }}
                            className="btn btn-warning btn-xs sm:btn-sm gap-2"
                          >
                            <KeyRound size={16} />
                            Change Password
                          </button>
                          <button
                            onClick={() => handleDelete(u.user_id, u.email)}
                            className="btn btn-error btn-xs sm:btn-sm gap-2"
                          >
                            <Trash2 size={16} />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">
              Change Password for {selectedUser?.username}
            </h3>
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
                  setSelectedUser(null);
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
    </DashboardLayout>
  );
};

export default AddUser;
