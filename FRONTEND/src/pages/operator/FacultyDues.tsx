import { AlertCircle, FileText } from "lucide-react";
import { useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import DashboardLayout from "../../components/DashboardLayout";

interface FacultyDue {
  id: number;
  due_type: string;
  is_payable: boolean;
  current_amount: number | null;
  amount_paid: number;
  due_description: string;
  due_clear_by_date: string;
  created_at: string;
  is_cleared: boolean;
  permission_granted: boolean;
  overall_status: boolean;
}

const FacultyDues = () => {
  const [dues, setDues] = useState<FacultyDue[]>([]);
  const [loading, setLoading] = useState(true);

  // Get user data from localStorage
  const userData = JSON.parse(localStorage.getItem("user") || "{}");
  const user = {
    username: userData.name || userData.username || "Faculty",
    email: userData.email || "faculty@vnrvjiet.in",
    role: (userData.role || "operator") as
      | "admin"
      | "operator"
      | "hod"
      | "student",
  };

  useEffect(() => {
    fetchFacultyDues();
  }, []);

  const fetchFacultyDues = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/faculty/dues", {
        credentials: "include" as RequestCredentials,
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setDues(data.data);
        }
      }
    } catch (error) {
      console.error("Error fetching faculty dues:", error);
      toast.error("Failed to fetch your dues");
    } finally {
      setLoading(false);
    }
  };

  const activeDues = dues.filter((due) => !due.overall_status);
  const clearedDues = dues.filter((due) => due.overall_status);

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
          <h2 className="text-2xl sm:text-3xl font-bold text-primary mb-2">
            Your Dues
          </h2>
          <p className="text-base-content/70">
            View and manage your pending and cleared dues
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="official-card p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-base-content/70">
                Total Dues
              </div>
              <FileText className="text-info" size={24} />
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-info">
              {dues.length}
            </div>
          </div>

          <div className="official-card p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-base-content/70">
                Active Dues
              </div>
              <AlertCircle className="text-error" size={24} />
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-error">
              {activeDues.length}
            </div>
          </div>

          <div className="official-card p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-base-content/70">
                Cleared Dues
              </div>
              <FileText className="text-success" size={24} />
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-success">
              {clearedDues.length}
            </div>
          </div>
        </div>

        {/* Active Dues Section */}
        <div className="official-card p-6">
          <h3 className="text-xl sm:text-2xl font-bold text-primary mb-4">
            Active Dues ({activeDues.length})
          </h3>

          {activeDues.length === 0 ? (
            <div className="alert alert-success">
              <AlertCircle size={20} />
              <span>Great! You have no active dues.</span>
            </div>
          ) : (
            <div className="table-shell">
              <table className="table table-zebra w-full">
                <thead>
                  <tr>
                    <th className="text-center">S.No</th>
                    <th className="text-center">Due ID</th>
                    <th className="text-center">Due Type</th>
                    <th className="text-center">Payable</th>
                    <th className="text-center">Amount</th>
                    <th className="text-center">Amount Paid</th>
                    <th className="text-center">Description</th>
                    <th className="text-center">Due Date</th>
                    <th className="text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {activeDues.map((due, index) => (
                    <tr key={due.id}>
                      <td className="text-center">{index + 1}</td>
                      <td className="text-center font-mono text-xs">
                        {due.id}
                      </td>
                      <td className="text-center font-semibold">
                        {due.due_type}
                      </td>
                      <td className="text-center">
                        {due.is_payable ? (
                          <span className="badge badge-success whitespace-nowrap">
                            Payable
                          </span>
                        ) : (
                          <span className="badge badge-warning whitespace-nowrap">
                            Non-Payable
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
                          <span className="text-success font-semibold">
                            ₹{due.amount_paid.toLocaleString("en-IN")}
                          </span>
                        ) : (
                          "₹0"
                        )}
                      </td>
                      <td className="text-center">
                        {due.due_description || "N/A"}
                      </td>
                      <td className="text-center">
                        {new Date(due.due_clear_by_date).toLocaleDateString(
                          "en-IN",
                        )}
                      </td>
                      <td className="text-center">
                        {due.permission_granted ? (
                          <span className="badge badge-info whitespace-nowrap">
                            Permission Granted
                          </span>
                        ) : (
                          <span className="badge badge-error whitespace-nowrap">
                            Pending
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Cleared Dues Section */}
        <div className="official-card p-6">
          <h3 className="text-xl sm:text-2xl font-bold text-primary mb-4">
            Cleared Dues ({clearedDues.length})
          </h3>

          {clearedDues.length === 0 ? (
            <div className="alert alert-info">
              <AlertCircle size={20} />
              <span>No cleared dues to display.</span>
            </div>
          ) : (
            <div className="table-shell">
              <table className="table table-zebra w-full">
                <thead>
                  <tr>
                    <th className="text-center">S.No</th>
                    <th className="text-center">Due ID</th>
                    <th className="text-center">Due Type</th>
                    <th className="text-center">Payable</th>
                    <th className="text-center">Amount</th>
                    <th className="text-center">Amount Paid</th>
                    <th className="text-center">Description</th>
                    <th className="text-center">Due Date</th>
                    <th className="text-center">Method</th>
                  </tr>
                </thead>
                <tbody>
                  {clearedDues.map((due, index) => (
                    <tr key={due.id}>
                      <td className="text-center">{index + 1}</td>
                      <td className="text-center font-mono text-xs">
                        {due.id}
                      </td>
                      <td className="text-center font-semibold">
                        {due.due_type}
                      </td>
                      <td className="text-center">
                        {due.is_payable ? (
                          <span className="badge badge-success whitespace-nowrap">
                            Payable
                          </span>
                        ) : (
                          <span className="badge badge-warning whitespace-nowrap">
                            Non-Payable
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
                          <span className="text-success font-semibold">
                            ₹{due.amount_paid.toLocaleString("en-IN")}
                          </span>
                        ) : (
                          "₹0"
                        )}
                      </td>
                      <td className="text-center">
                        {due.due_description || "N/A"}
                      </td>
                      <td className="text-center">
                        {new Date(due.due_clear_by_date).toLocaleDateString(
                          "en-IN",
                        )}
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
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Info Alert */}
        <div className="alert alert-info">
          <AlertCircle size={20} />
          <div>
            <p className="font-semibold">Important Information</p>
            <ul className="list-disc list-inside text-sm mt-2">
              <li>
                For payable dues, please ensure payment is made before the due
                date.
              </li>
              <li>
                For non-payable dues, submit required documents to the
                respective department.
              </li>
              <li>
                Contact your department operator for any queries regarding your
                dues.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default FacultyDues;
