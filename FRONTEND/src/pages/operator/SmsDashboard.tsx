import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  DollarSign,
  FileText,
  MessageSquare,
  Phone,
  RefreshCw,
  Search,
  Send,
  Users,
  Wallet,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import DashboardLayout from "../../components/DashboardLayout";

interface DueItem {
  due_id: number;
  current_amount: number;
  amount_paid: number;
  type_name: string;
  due_clear_by_date: string;
  is_payable?: boolean;
}

interface StudentWithDues {
  name: string;
  roll_number: string;
  mobile: string | null;
  branch: string;
  section: string;
  dues: DueItem[];
  total_amount: number;
  last_sms_sent: string | null;
  sms_count: number;
}

interface SmsStats {
  totalSent: number;
  totalFailed: number;
  uniqueStudents: number;
  totalBatches: number;
  periodDays: number;
}

const SmsDashboard = () => {
  const [activeTab, setActiveTab] = useState<"all" | "pending">("all");
  const [students, setStudents] = useState<StudentWithDues[]>([]);
  const [pendingStudents, setPendingStudents] = useState<StudentWithDues[]>([]);
  const [stats, setStats] = useState<SmsStats | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [sendingBulk, setSendingBulk] = useState(false);

  // Test SMS modal state
  const [showTestModal, setShowTestModal] = useState(false);
  const [testMobile, setTestMobile] = useState("");
  const [testName, setTestName] = useState("");
  const [sendingTest, setSendingTest] = useState(false);

  const userData = JSON.parse(localStorage.getItem("user") || "{}");
  const user = {
    username: userData.name || userData.username || "Operator",
    email: userData.email || "operator@vnrvjiet.in",
    role: (userData.role || "operator") as
      | "admin"
      | "operator"
      | "hod"
      | "student",
    sectionName: userData.section_name || "",
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const creds = { credentials: "include" as RequestCredentials };

      const [duesRes, pendingRes, statsRes, balanceRes] = await Promise.all([
        fetch("/api/sms/active-dues", creds),
        fetch("/api/sms/students-needing-reminder", creds),
        fetch("/api/sms/stats?days=7", creds),
        fetch("/api/sms/balance", creds),
      ]);

      if (duesRes.ok) {
        const data = await duesRes.json();
        if (data.success) setStudents(data.data);
      }
      if (pendingRes.ok) {
        const data = await pendingRes.json();
        if (data.success) setPendingStudents(data.data);
      }
      if (statsRes.ok) {
        const data = await statsRes.json();
        if (data.success) setStats(data.data);
      }
      if (balanceRes.ok) {
        const data = await balanceRes.json();
        if (data.success) setBalance(data.balance);
      }
    } catch (error) {
      console.error("Error fetching SMS data:", error);
      toast.error("Failed to fetch dashboard data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const toggleRow = (rollNumber: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rollNumber)) next.delete(rollNumber);
      else next.add(rollNumber);
      return next;
    });
  };

  const handleSendReminder = async (rollNumber: string) => {
    setSendingTo(rollNumber);
    try {
      const res = await fetch("/api/sms/send-reminder", {
        method: "POST",
        credentials: "include" as RequestCredentials,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rollNumber }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        fetchData();
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error("Failed to send SMS");
    } finally {
      setSendingTo(null);
    }
  };

  const handleBulkSend = async () => {
    if (
      !confirm(`Send SMS to all ${pendingStudents.length} eligible students?`)
    )
      return;
    setSendingBulk(true);
    try {
      const res = await fetch("/api/sms/send-bulk-reminders", {
        method: "POST",
        credentials: "include" as RequestCredentials,
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        fetchData();
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error("Failed to send bulk SMS");
    } finally {
      setSendingBulk(false);
    }
  };

  const handleTestSms = async () => {
    if (!testMobile) {
      toast.error("Please enter a mobile number");
      return;
    }
    setSendingTest(true);
    try {
      const res = await fetch("/api/sms/test-sms", {
        method: "POST",
        credentials: "include" as RequestCredentials,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mobile: testMobile,
          name: testName || "Test User",
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setShowTestModal(false);
        setTestMobile("");
        setTestName("");
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error("Failed to send test SMS");
    } finally {
      setSendingTest(false);
    }
  };

  const formatCurrency = (amount: number) =>
    `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 0 })}`;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const currentList = activeTab === "all" ? students : pendingStudents;
  const filteredList = currentList.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.roll_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.branch?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const totalOutstanding = students.reduce(
    (sum, s) => sum + (s.total_amount || 0),
    0,
  );

  if (loading) {
    return (
      <DashboardLayout
        role={user.role}
        username={user.username}
        email={user.email}
        sectionName={user.sectionName}
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
      sectionName={user.sectionName}
    >
      <Toaster position="top-right" />
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-base-100 rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-primary mb-1">
                SMS Notifications
              </h2>
              <p className="text-base-content/70">
                Manage SMS dues reminders for students
              </p>
            </div>
            <div className="flex gap-2">
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setShowTestModal(true)}
              >
                <Phone size={16} /> Test SMS
              </button>
              <button className="btn btn-outline btn-sm" onClick={fetchData}>
                <RefreshCw size={16} /> Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-base-100 rounded-lg shadow-md p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-base-content/70">
                Active Dues
              </span>
              <FileText className="text-info" size={22} />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-info">
              {students.reduce((sum, s) => sum + (s.dues?.length || 0), 0)}
            </div>
            <p className="text-xs text-base-content/50 mt-1">
              {students.length} students
            </p>
          </div>

          <div className="bg-base-100 rounded-lg shadow-md p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-base-content/70">
                Outstanding Amount
              </span>
              <DollarSign className="text-success" size={22} />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-success">
              {formatCurrency(totalOutstanding)}
            </div>
            <p className="text-xs text-base-content/50 mt-1">Total payable</p>
          </div>

          <div className="bg-base-100 rounded-lg shadow-md p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-base-content/70">
                Pending SMS
              </span>
              <MessageSquare className="text-warning" size={22} />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-warning">
              {pendingStudents.length}
            </div>
            <p className="text-xs text-base-content/50 mt-1">Need reminders</p>
          </div>

          <div className="bg-base-100 rounded-lg shadow-md p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-base-content/70">
                SMS Balance
              </span>
              <Wallet className="text-primary" size={22} />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-primary">
              {balance !== null ? `₹${balance}` : "N/A"}
            </div>
            <p className="text-xs text-base-content/50 mt-1">
              {stats ? `${stats.totalSent} sent (7 days)` : ""}
            </p>
          </div>
        </div>

        {/* Tabs + Search + Bulk Send */}
        <div className="bg-base-100 rounded-lg shadow-md p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div className="tabs tabs-boxed">
              <button
                className={`tab ${activeTab === "all" ? "tab-active" : ""}`}
                onClick={() => setActiveTab("all")}
              >
                <Users size={16} className="mr-2" /> All Active Dues (
                {students.length})
              </button>
              <button
                className={`tab ${activeTab === "pending" ? "tab-active" : ""}`}
                onClick={() => setActiveTab("pending")}
              >
                <AlertCircle size={16} className="mr-2" /> Pending SMS (
                {pendingStudents.length})
              </button>
            </div>

            <div className="flex gap-2">
              <div className="form-control">
                <div className="input-group">
                  <span className="bg-base-200 px-3 flex items-center">
                    <Search size={16} />
                  </span>
                  <input
                    type="text"
                    className="input input-bordered input-sm w-60"
                    placeholder="Search by name, roll no, branch..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              {activeTab === "pending" && pendingStudents.length > 0 && (
                <button
                  className={`btn btn-primary btn-sm ${sendingBulk ? "loading" : ""}`}
                  onClick={handleBulkSend}
                  disabled={sendingBulk}
                >
                  {!sendingBulk && <Send size={14} />}
                  Send All ({pendingStudents.length})
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="table table-zebra w-full">
              <thead>
                <tr>
                  <th className="w-8"></th>
                  <th>Roll No</th>
                  <th>Name</th>
                  <th>Mobile</th>
                  <th>Branch</th>
                  <th>Dues</th>
                  <th>Amount</th>
                  {activeTab === "all" && <th>Last SMS</th>}
                  {activeTab === "all" && <th>SMS Count</th>}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredList.length === 0 && (
                  <tr>
                    <td
                      colSpan={activeTab === "all" ? 10 : 8}
                      className="text-center py-12"
                    >
                      <div className="flex flex-col items-center gap-2 text-base-content/50">
                        <Users size={48} />
                        <p className="text-lg font-medium">
                          {searchTerm
                            ? "No students match your search"
                            : activeTab === "pending"
                              ? "No students need SMS reminders right now"
                              : "No active dues found"}
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
                {filteredList.map((student) => {
                  const isExpanded = expandedRows.has(student.roll_number);
                  const dues = student.dues || [];
                  const totalAmt = dues.reduce(
                    (sum: number, d: DueItem) =>
                      sum +
                      (parseFloat(String(d.current_amount)) -
                        parseFloat(String(d.amount_paid || 0))),
                    0,
                  );

                  return (
                    <>
                      <tr
                        key={student.roll_number}
                        className="cursor-pointer hover"
                        onClick={() => toggleRow(student.roll_number)}
                      >
                        <td>
                          {isExpanded ? (
                            <ChevronDown size={16} />
                          ) : (
                            <ChevronRight size={16} />
                          )}
                        </td>
                        <td className="font-mono font-bold">
                          {student.roll_number}
                        </td>
                        <td>{student.name}</td>
                        <td>
                          {student.mobile ? (
                            <span className="font-mono text-sm">
                              {student.mobile}
                            </span>
                          ) : (
                            <span className="badge badge-error badge-sm whitespace-nowrap">
                              No Mobile
                            </span>
                          )}
                        </td>
                        <td>
                          <span className="text-sm">
                            {student.branch} - {student.section}
                          </span>
                        </td>
                        <td>
                          <span className="badge badge-primary badge-sm whitespace-nowrap">
                            {dues.length}
                          </span>
                        </td>
                        <td className="font-semibold">
                          {formatCurrency(totalAmt)}
                        </td>
                        {activeTab === "all" && (
                          <td className="text-sm">
                            {formatDate(student.last_sms_sent)}
                          </td>
                        )}
                        {activeTab === "all" && (
                          <td>
                            <span className="badge badge-ghost badge-sm">
                              {student.sms_count || 0}
                            </span>
                          </td>
                        )}
                        <td>
                          <button
                            className={`btn btn-primary btn-xs ${sendingTo === student.roll_number ? "loading" : ""}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSendReminder(student.roll_number);
                            }}
                            disabled={
                              !student.mobile ||
                              sendingTo === student.roll_number
                            }
                          >
                            {sendingTo !== student.roll_number && (
                              <Send size={12} />
                            )}
                            SMS
                          </button>
                        </td>
                      </tr>

                      {/* Expanded dues details */}
                      {isExpanded && (
                        <tr key={`${student.roll_number}-details`}>
                          <td
                            colSpan={activeTab === "all" ? 10 : 8}
                            className="bg-base-200/50 p-0"
                          >
                            <div className="p-4">
                              <h4 className="font-semibold mb-3 text-sm">
                                Individual Dues for {student.name}
                              </h4>
                              <div className="overflow-x-auto">
                                <table className="table table-compact w-full">
                                  <thead>
                                    <tr>
                                      <th>Due ID</th>
                                      <th>Type</th>
                                      <th>Total Amount</th>
                                      <th>Paid</th>
                                      <th>Outstanding</th>
                                      <th>Due Date</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {dues.map((due: DueItem) => {
                                      const outstanding =
                                        parseFloat(String(due.current_amount)) -
                                        parseFloat(
                                          String(due.amount_paid || 0),
                                        );
                                      return (
                                        <tr key={due.due_id}>
                                          <td className="font-mono text-xs">
                                            #{due.due_id}
                                          </td>
                                          <td>
                                            <span className="badge badge-outline badge-sm">
                                              {due.type_name}
                                            </span>
                                          </td>
                                          <td>
                                            {formatCurrency(
                                              parseFloat(
                                                String(due.current_amount),
                                              ),
                                            )}
                                          </td>
                                          <td className="text-success">
                                            {formatCurrency(
                                              parseFloat(
                                                String(due.amount_paid || 0),
                                              ),
                                            )}
                                          </td>
                                          <td className="font-semibold text-error">
                                            {formatCurrency(outstanding)}
                                          </td>
                                          <td>{due.due_clear_by_date}</td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Test SMS Modal */}
      {showTestModal && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">Send Test SMS</h3>
            <div className="form-control mb-3">
              <label className="label">
                <span className="label-text">Mobile Number *</span>
              </label>
              <input
                type="text"
                className="input input-bordered"
                placeholder="e.g., 9876543210"
                value={testMobile}
                onChange={(e) => setTestMobile(e.target.value)}
              />
            </div>
            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">Name (optional)</span>
              </label>
              <input
                type="text"
                className="input input-bordered"
                placeholder="Test User"
                value={testName}
                onChange={(e) => setTestName(e.target.value)}
              />
            </div>
            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={() => setShowTestModal(false)}
              >
                Cancel
              </button>
              <button
                className={`btn btn-primary ${sendingTest ? "loading" : ""}`}
                onClick={handleTestSms}
                disabled={sendingTest}
              >
                {!sendingTest && <Send size={16} />} Send Test
              </button>
            </div>
          </div>
          <div
            className="modal-backdrop"
            onClick={() => setShowTestModal(false)}
          ></div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default SmsDashboard;
