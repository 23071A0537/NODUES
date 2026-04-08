import { AlertCircle, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import DashboardLayout from "../../components/DashboardLayout";

interface Department {
  id: number;
  name: string;
  created_at: string;
}

interface Section {
  id: number;
  name: string;
  created_at: string;
}

type EntityType = "department" | "section";

const AddDepartmentSection = () => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [name, setName] = useState("");
  const [type, setType] = useState<EntityType>("department");
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<{
    type: EntityType;
    id: number;
  } | null>(null);

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
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to fetch data");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Please enter a name");
      return;
    }

    // Check for duplicates
    const exists =
      type === "department"
        ? departments.some(
            (dept) => dept.name.toLowerCase() === name.toLowerCase(),
          )
        : sections.some((sec) => sec.name.toLowerCase() === name.toLowerCase());

    if (exists) {
      toast.error(`This ${type} already exists`);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/admin/${type}s`, {
        method: "POST",
        credentials: "include" as RequestCredentials,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: name.trim() }),
      });

      if (!response.ok) {
        throw new Error(`Failed to add ${type}`);
      }

      const data = await response.json();

      if (data.success) {
        await fetchData();
        setName("");
        toast.success(
          `${type.charAt(0).toUpperCase() + type.slice(1)} added successfully`,
        );
      } else {
        throw new Error(data.message || `Failed to add ${type}`);
      }
    } catch (error) {
      console.error(`Error adding ${type}:`, error);
      toast.error(`Failed to add ${type}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (
    entityType: EntityType,
    id: number,
    itemName: string,
  ) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete the ${entityType} "${itemName}"?\n\n` +
        `WARNING: This will also delete:\n` +
        `- All students belonging to this ${entityType}\n` +
        `- All faculty members from this ${entityType}\n` +
        `- All users associated with this ${entityType}\n` +
        `- All dues related to this ${entityType}\n\n` +
        `This action cannot be undone!`,
    );

    if (!confirmed) return;

    setDeleting({ type: entityType, id });
    try {
      const response = await fetch(`/api/admin/${entityType}s/${id}`, {
        method: "DELETE",
        credentials: "include" as RequestCredentials,
      });

      if (!response.ok) {
        throw new Error(`Failed to delete ${entityType}`);
      }

      const data = await response.json();

      if (data.success) {
        await fetchData();
        toast.success(
          `${entityType.charAt(0).toUpperCase() + entityType.slice(1)} deleted successfully`,
        );
      } else {
        throw new Error(data.message || `Failed to delete ${entityType}`);
      }
    } catch (error) {
      console.error(`Error deleting ${entityType}:`, error);
      toast.error(`Failed to delete ${entityType}`);
    } finally {
      setDeleting(null);
    }
  };

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
            Add Department/Section
          </h2>

          {/* Add Form */}
          <form onSubmit={handleSubmit} className="mb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="form-control">
                <label className="label pb-3">
                  <span className="label-text font-semibold text-base">
                    Type *
                  </span>
                </label>
                <select
                  className="select select-bordered select-md border-b-4 border-b-primary focus:border-b-accent"
                  value={type}
                  onChange={(e) => setType(e.target.value as EntityType)}
                >
                  <option value="department">Department</option>
                  <option value="section">Section</option>
                </select>
              </div>

              <div className="form-control">
                <label className="label pb-3">
                  <span className="label-text font-semibold text-base">
                    Name *
                  </span>
                </label>
                <input
                  type="text"
                  placeholder={`Enter ${type} name`}
                  className="input input-bordered input-md border-b-4 border-b-primary focus:border-b-accent"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className={`btn btn-primary btn-sm sm:btn-md w-full md:w-auto md:px-12 gap-2 shadow-lg hover:shadow-xl transition-all ${
                loading ? "loading" : ""
              }`}
              disabled={loading}
            >
              {!loading && <Plus size={20} />}
              <span>Add {type.charAt(0).toUpperCase() + type.slice(1)}</span>
            </button>
          </form>

          {/* Departments List */}
          <div className="mb-8">
            <h3 className="text-2xl font-bold mb-4">Departments</h3>
            {departments.length === 0 ? (
              <div className="alert alert-warning">
                <AlertCircle size={20} />
                <span>
                  No departments found. Add your first department above.
                </span>
              </div>
            ) : (
              <div className="table-shell">
                <table className="table table-zebra w-full">
                  <thead>
                    <tr>
                      <th className="text-center">Department Name</th>
                      <th className="text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {departments.map((dept) => (
                      <tr key={dept.id}>
                        <td className="text-center font-semibold text-lg">
                          {dept.name}
                        </td>
                        <td className="text-center">
                          <button
                            onClick={() =>
                              handleDelete("department", dept.id, dept.name)
                            }
                            className={`btn btn-error btn-xs sm:btn-sm gap-2 ${
                              deleting?.type === "department" &&
                              deleting?.id === dept.id
                                ? "loading"
                                : ""
                            }`}
                            disabled={deleting !== null}
                          >
                            {!(
                              deleting?.type === "department" &&
                              deleting?.id === dept.id
                            ) && <Trash2 size={16} />}
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Sections List */}
          <div>
            <h3 className="text-2xl font-bold mb-4">Sections</h3>
            {sections.length === 0 ? (
              <div className="alert alert-warning">
                <AlertCircle size={20} />
                <span>No sections found. Add your first section above.</span>
              </div>
            ) : (
              <div className="table-shell">
                <table className="table table-zebra w-full">
                  <thead>
                    <tr>
                      <th className="text-center">Section Name</th>
                      <th className="text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sections.map((sec) => (
                      <tr key={sec.id}>
                        <td className="text-center font-semibold text-lg">
                          {sec.name}
                        </td>
                        <td className="text-center">
                          <button
                            onClick={() =>
                              handleDelete("section", sec.id, sec.name)
                            }
                            className={`btn btn-error btn-xs sm:btn-sm gap-2 ${
                              deleting?.type === "section" &&
                              deleting?.id === sec.id
                                ? "loading"
                                : ""
                            }`}
                            disabled={deleting !== null}
                          >
                            {!(
                              deleting?.type === "section" &&
                              deleting?.id === sec.id
                            ) && <Trash2 size={16} />}
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Warning Alert */}
        <div className="alert alert-warning">
          <AlertCircle size={24} />
          <div>
            <h3 className="font-bold">Important Warning!</h3>
            <div className="text-sm">
              Deleting a department or section will permanently remove all
              associated data including:
              <ul className="list-disc list-inside mt-2">
                <li>All students belonging to that department/section</li>
                <li>All faculty members from that department/section</li>
                <li>All users associated with that department/section</li>
                <li>
                  All dues related to students from that department/section
                </li>
              </ul>
              Please ensure you have a backup before performing delete
              operations.
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AddDepartmentSection;
