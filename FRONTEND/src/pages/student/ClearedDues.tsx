import { useEffect, useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import {
  downloadForm,
  downloadReceipt,
  formatCurrency,
  formatDateTime,
  useStudentDuesStore,
  type ClearedDue,
} from "../../store/useStudentDuesStore";

export default function ClearedDues() {
  const { history, historyLoading, historyError, fetchHistory } =
    useStudentDuesStore();
  const [filters, setFilters] = useState({
    start_date: "",
    end_date: "",
  });

  // Get user data from localStorage
  const userData = JSON.parse(localStorage.getItem("user") || "{}");
  const user = {
    username: userData.username || "Student",
    email: userData.email || "student@vnrvjiet.in",
    role: (userData.role || "student") as
      | "admin"
      | "operator"
      | "hod"
      | "student",
  };

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleApplyFilters = () => {
    fetchHistory(filters);
  };

  const handleClearFilters = () => {
    setFilters({ start_date: "", end_date: "" });
    fetchHistory();
  };

  const handleDownloadReceipt = (dueId: number) => {
    downloadReceipt(dueId);
  };

  const handleDownloadForm = (dueId: number) => {
    downloadForm(dueId);
  };

  const exportToCSV = () => {
    const headers = [
      "Due ID",
      "Type",
      "Amount",
      "Paid",
      "Cleared Date",
      "Department/Section",
      "Payment Reference",
    ];
    const rows = history.map((due) => [
      due.id,
      due.type_name,
      due.current_amount,
      due.amount_paid,
      formatDateTime(due.updated_at),
      due.added_by_entity,
      due.payments?.[0]?.payment_reference || "N/A",
    ]);

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cleared-dues-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout
      role={user.role}
      username={user.username}
      email={user.email}
    >
      <div className="min-h-screen bg-base-200 official-enter">
        {/* Header */}
        <div className="bg-base-100 shadow-sm border-b border-base-300">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-base-content">
                  Payment History
                </h1>
                <p className="mt-1 text-sm text-base-content/70">
                  View your cleared dues and download receipts
                </p>
              </div>
              {history.length > 0 && (
                <button
                  onClick={exportToCSV}
                  className="btn btn-outline btn-sm sm:btn-md gap-2"
                >
                  <svg
                    className="w-4 h-4 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  Export CSV
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Filters */}
          <div className="official-card p-4 mb-6">
            <h3 className="text-sm font-semibold text-base-content mb-3">
              Filters
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-base-content/70 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={filters.start_date}
                  onChange={(e) =>
                    setFilters({ ...filters, start_date: e.target.value })
                  }
                  className="input input-bordered input-md w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-base-content/70 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={filters.end_date}
                  onChange={(e) =>
                    setFilters({ ...filters, end_date: e.target.value })
                  }
                  className="input input-bordered input-md w-full"
                />
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2">
                <button
                  onClick={handleApplyFilters}
                  className="btn btn-primary btn-sm sm:btn-md w-full sm:flex-1"
                >
                  Apply
                </button>
                <button
                  onClick={handleClearFilters}
                  className="btn btn-outline btn-sm sm:btn-md w-full sm:w-auto"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>

          {/* Loading State */}
          {historyLoading && (
            <div className="flex justify-center items-center py-12">
              <div className="loading loading-spinner loading-lg text-primary"></div>
            </div>
          )}

          {/* Error State */}
          {historyError && (
            <div className="alert alert-error shadow-lg">
              <div className="flex">
                <svg
                  className="h-5 w-5 text-red-400 mt-0.5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
                <div className="ml-3">
                  <p className="font-semibold">Unable to load history</p>
                  <p className="text-sm mt-1">{historyError}</p>
                </div>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!historyLoading && !historyError && history.length === 0 && (
            <div className="text-center py-12">
              <svg
                className="w-20 h-20 mx-auto text-base-content/30"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <p className="mt-4 text-lg font-semibold text-base-content">
                No payment history
              </p>
              <p className="text-base-content/60">
                You haven't cleared any dues yet
              </p>
            </div>
          )}

          {/* History List */}
          {!historyLoading && !historyError && history.length > 0 && (
            <div className="space-y-4">
              {history.map((due) => (
                <HistoryCard
                  key={due.id}
                  due={due}
                  onDownloadReceipt={handleDownloadReceipt}
                  onDownloadForm={handleDownloadForm}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

interface HistoryCardProps {
  due: ClearedDue;
  onDownloadReceipt: (id: number) => void;
  onDownloadForm: (id: number) => void;
}

function HistoryCard({
  due,
  onDownloadReceipt,
  onDownloadForm,
}: HistoryCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="official-card">
      <div className="p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-1">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base sm:text-lg font-semibold text-base-content">
                  {due.type_name}
                </h3>
                <p className="text-sm text-base-content/60 mt-1">
                  {due.added_by_entity}
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className="badge badge-success gap-1">Cleared</span>
                  <span className="text-xs text-base-content/50">
                    Cleared on {formatDateTime(due.updated_at)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Amount */}
          <div className="text-right sm:ml-4">
            <p className="text-sm text-base-content/60">Amount</p>
            <p className="text-xl sm:text-2xl font-bold text-base-content">
              {formatCurrency(due.current_amount)}
            </p>
            {due.amount_paid < due.current_amount && (
              <p className="text-xs text-base-content/50 mt-0.5">
                Paid: {formatCurrency(due.amount_paid)}
              </p>
            )}
          </div>
        </div>

        {/* Payment Details (if expanded) */}
        {expanded && due.payments && due.payments.length > 0 && (
          <div className="mt-4 pt-4 border-t border-base-300">
            <h4 className="text-sm font-semibold text-base-content mb-3">
              Payment Transactions
            </h4>
            <div className="space-y-2">
              {due.payments.map((payment, index) => (
                <div key={payment.id} className="bg-base-200 rounded-lg p-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium text-base-content">
                        Payment {index + 1}
                      </p>
                      <p className="text-xs text-base-content/60 mt-0.5">
                        Ref: {payment.payment_reference}
                      </p>
                      <p className="text-xs text-base-content/60">
                        {payment.payment_method} •{" "}
                        {formatDateTime(payment.paid_at)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-success">
                        {formatCurrency(payment.paid_amount)}
                      </p>
                      <span
                        className={`badge mt-1 ${
                          payment.payment_status === "SUCCESS"
                            ? "badge-success"
                            : payment.payment_status === "FAILED"
                              ? "badge-error"
                              : "badge-warning"
                        }`}
                      >
                        {payment.payment_status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Remarks */}
        {expanded && due.remarks && (
          <div className="mt-4 pt-4 border-t border-base-300">
            <h4 className="text-sm font-semibold text-base-content mb-2">
              Remarks
            </h4>
            <p className="text-sm text-base-content/70">{due.remarks}</p>
          </div>
        )}

        {/* Actions */}
        <div className="mt-4 flex flex-wrap gap-3">
          {due.payments && due.payments.length > 0 && (
            <button
              onClick={() => onDownloadReceipt(due.id)}
              className="btn btn-primary btn-sm gap-2"
            >
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Download Receipt
            </button>
          )}
          <button
            onClick={() => onDownloadForm(due.id)}
            className="btn btn-outline btn-sm gap-2"
          >
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Download Form
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="btn btn-ghost btn-sm gap-1"
          >
            {expanded ? (
              <>
                <svg
                  className="w-4 h-4 mr-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 15l7-7 7 7"
                  />
                </svg>
                Show Less
              </>
            ) : (
              <>
                <svg
                  className="w-4 h-4 mr-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
                Show More
              </>
            )}
          </button>
        </div>

        {/* Proof Link */}
        {due.proof_drive_link && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <a
              href={due.proof_drive_link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-blue-700 hover:text-blue-800 flex items-center"
            >
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                />
              </svg>
              View Clearance Proof
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
