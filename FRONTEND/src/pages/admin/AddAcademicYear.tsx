import { AlertCircle, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import DashboardLayout from "../../components/DashboardLayout";

interface AcademicYear {
  id: number;
  beginning_year: number;
  ending_year: number;
  created_at: string;
}

const AddAcademicYear = () => {
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [beginningYear, setBeginningYear] = useState("");
  const [endingYear, setEndingYear] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

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
    fetchAcademicYears();
  }, []);

  const fetchAcademicYears = async () => {
    try {
      const response = await fetch("/api/admin/academic-years", {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch academic years");
      }

      const data = await response.json();
      if (data.success) {
        setAcademicYears(data.data);
      }
    } catch (error) {
      console.error("Error fetching academic years:", error);
      toast.error("Failed to fetch academic years");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const beginning = parseInt(beginningYear);
    const ending = parseInt(endingYear);

    if (!beginning || !ending) {
      toast.error("Please enter valid years");
      return;
    }

    if (ending <= beginning) {
      toast.error("Ending year must be greater than beginning year");
      return;
    }

    if (ending - beginning !== 4) {
      toast.error(
        "Academic year should span exactly 4 years (e.g., 2022-2026)",
      );
      return;
    }

    // Check for duplicates
    const exists = academicYears.some(
      (year) =>
        year.beginning_year === beginning && year.ending_year === ending,
    );

    if (exists) {
      toast.error("This academic year already exists");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/admin/academic-years", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          beginningYear: beginning,
          endingYear: ending,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to add academic year");
      }

      const data = await response.json();

      if (data.success) {
        await fetchAcademicYears();
        setBeginningYear("");
        setEndingYear("");
        toast.success("Academic year added successfully");
      } else {
        throw new Error(data.message || "Failed to add academic year");
      }
    } catch (error) {
      console.error("Error adding academic year:", error);
      toast.error("Failed to add academic year");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (
    id: number,
    beginningYear: number,
    endingYear: number,
  ) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete the academic year ${beginningYear}-${endingYear}?\n\n` +
        `WARNING: This will also delete:\n` +
        `- All students enrolled in this academic year\n` +
        `- All dues associated with those students\n` +
        `- All faculty and users from affected departments\n\n` +
        `This action cannot be undone!`,
    );

    if (!confirmed) return;

    setDeleting(id);
    try {
      const response = await fetch(`/api/admin/academic-years/${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to delete academic year");
      }

      const data = await response.json();

      if (data.success) {
        await fetchAcademicYears();
        toast.success("Academic year deleted successfully");
      } else {
        throw new Error(data.message || "Failed to delete academic year");
      }
    } catch (error) {
      console.error("Error deleting academic year:", error);
      toast.error("Failed to delete academic year");
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
            Add Academic Year
          </h2>

          {/* Add Academic Year Form */}
          <form onSubmit={handleSubmit} className="mb-8">
            <div className="bg-base-200 p-6 rounded-lg mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="form-control w-full">
                  <label className="label pb-3">
                    <span className="label-text font-semibold text-lg">
                      Beginning Year *
                    </span>
                  </label>
                  <input
                    type="number"
                    placeholder="e.g., 2024"
                    className="input input-bordered input-md w-full border-b-4 border-b-primary focus:border-b-accent focus:outline-primary"
                    value={beginningYear}
                    onChange={(e) => setBeginningYear(e.target.value)}
                    min="2000"
                    max="2100"
                    required
                  />
                  <label className="label mt-1">
                    <span className="label-text-alt text-base-content/60">
                      Start year of the academic period
                    </span>
                  </label>
                </div>

                <div className="form-control w-full">
                  <label className="label pb-3">
                    <span className="label-text font-semibold text-lg">
                      Ending Year *
                    </span>
                  </label>
                  <input
                    type="number"
                    placeholder="e.g., 2025"
                    className="input input-bordered input-md w-full border-b-4 border-b-primary focus:border-b-accent focus:outline-primary"
                    value={endingYear}
                    onChange={(e) => setEndingYear(e.target.value)}
                    min="2000"
                    max="2100"
                    required
                  />
                  <label className="label mt-1">
                    <span className="label-text-alt text-base-content/60">
                      End year of the academic period
                    </span>
                  </label>
                </div>
              </div>

              <div className="alert alert-info mt-6">
                <AlertCircle size={20} />
                <span>
                  Academic year should span exactly 4 years (e.g., 2022-2026).
                  The ending year will be automatically validated.
                </span>
              </div>
            </div>

            <div className="flex justify-center">
              <button
                type="submit"
                className={`btn btn-primary btn-sm sm:btn-md w-full sm:w-auto sm:px-14 gap-2 shadow-lg hover:shadow-xl transition-all ${
                  loading ? "loading" : ""
                }`}
                disabled={loading}
              >
                {!loading && <Plus size={20} />}
                <span>Add Academic Year</span>
              </button>
            </div>
          </form>

          {/* Academic Years List */}
          <div>
            <h3 className="text-2xl font-bold mb-4">Existing Academic Years</h3>

            {academicYears.length === 0 ? (
              <div className="alert alert-warning">
                <AlertCircle size={20} />
                <span>
                  No academic years found. Add your first academic year above.
                </span>
              </div>
            ) : (
              <div className="table-shell">
                <table className="table table-zebra w-full">
                  <thead>
                    <tr>
                      <th className="text-center">Academic Year</th>
                      <th className="text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {academicYears.map((year) => (
                      <tr key={year.id}>
                        <td className="text-center font-semibold text-lg">
                          {year.beginning_year}-{year.ending_year}
                        </td>
                        <td className="text-center">
                          <button
                            onClick={() =>
                              handleDelete(
                                year.id,
                                year.beginning_year,
                                year.ending_year,
                              )
                            }
                            className={`btn btn-error btn-xs sm:btn-sm gap-2 ${
                              deleting === year.id ? "loading" : ""
                            }`}
                            disabled={deleting !== null}
                          >
                            {deleting !== year.id && <Trash2 size={16} />}
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
              Deleting an academic year will permanently remove all associated
              data including:
              <ul className="list-disc list-inside mt-2">
                <li>All students enrolled in that academic year</li>
                <li>All dues assigned to those students</li>
                <li>Faculty and users from affected departments</li>
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

export default AddAcademicYear;
