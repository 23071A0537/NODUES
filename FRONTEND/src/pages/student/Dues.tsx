import { useEffect, useMemo, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { useNavigate, useSearchParams } from "react-router-dom";
import DashboardLayout from "../../components/DashboardLayout";
import {
  DueCard,
  PaymentConfirmModal,
  StickyCartBar,
} from "../../components/student";
import {
  formatCurrency,
  useStudentDuesStore,
} from "../../store/useStudentDuesStore";

type DuesTab = "payable" | "permission-granted" | "non-payable";

export default function StudentDues() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<DuesTab>("payable");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);

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

  const {
    dues,
    totals,
    loading,
    error,
    selectedDues,
    toggleDue,
    clearSelection,
    fetchDues,
    refreshDues,
    createPaymentSession,
  } = useStudentDuesStore();

  // Load dues on mount
  useEffect(() => {
    // Fetch all dues and filter on client side
    fetchDues("all");
  }, [fetchDues]);

  // Handle payment callback
  useEffect(() => {
    const paymentStatus = searchParams.get("payment");
    const paymentRef = searchParams.get("ref");
    const failureReason = searchParams.get("reason");

    if (paymentStatus === "success") {
      toast.success(
        `Payment successful${paymentRef ? ` - Ref ${paymentRef}` : ""}`,
      );
      refreshDues();
    } else if (paymentStatus === "failed") {
      toast.error(`Payment failed: ${failureReason || "Unknown error"}`);
    }

    if (paymentStatus) {
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, refreshDues, setSearchParams]);

  const payableDues = useMemo(
    () =>
      dues.filter(
        (due) =>
          due.is_payable &&
          !due.is_cleared &&
          (!due.requires_permission || !due.permission_granted),
      ),
    [dues],
  );

  const permissionGrantedDues = useMemo(
    () =>
      dues.filter(
        (due) => due.permission_granted && !due.is_cleared && due.is_payable,
      ),
    [dues],
  );

  const nonPayableDues = useMemo(
    () => dues.filter((due) => !due.is_payable && !due.is_cleared),
    [dues],
  );

  const overdueCount = useMemo(() => {
    const now = Date.now();
    return dues.filter(
      (due) =>
        !due.is_cleared && new Date(due.due_clear_by_date).getTime() < now,
    ).length;
  }, [dues]);

  const dueSoonCount = useMemo(() => {
    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    return dues.filter((due) => {
      if (due.is_cleared) return false;
      const dueTime = new Date(due.due_clear_by_date).getTime();
      return dueTime >= now && dueTime <= now + sevenDaysMs;
    }).length;
  }, [dues]);

  const filteredDues = useMemo(() => {
    const source =
      activeTab === "payable"
        ? payableDues
        : activeTab === "permission-granted"
          ? permissionGrantedDues
          : nonPayableDues;

    return [...source].sort(
      (a, b) =>
        new Date(a.due_clear_by_date).getTime() -
        new Date(b.due_clear_by_date).getTime(),
    );
  }, [activeTab, payableDues, permissionGrantedDues, nonPayableDues]);

  const selectableInView = useMemo(
    () =>
      filteredDues.filter(
        (due) =>
          due.is_payable && !due.is_cleared && due.outstanding_amount > 0,
      ),
    [filteredDues],
  );

  const selectedCount = selectedDues.length;

  const selectedTotal = useMemo(
    () =>
      filteredDues
        .filter((due) => selectedDues.includes(due.id))
        .reduce((sum, due) => sum + due.outstanding_amount, 0),
    [filteredDues, selectedDues],
  );

  const allSelectableInViewSelected =
    selectableInView.length > 0 &&
    selectableInView.every((due) => selectedDues.includes(due.id));

  // Handle tab change
  const handleTabChange = (tab: DuesTab) => {
    setActiveTab(tab);
    clearSelection();
  };

  // Handle payment initiation (from sticky bar - multiple selected)
  const handlePayClick = () => {
    if (selectedCount === 0) return;
    setShowConfirmModal(true);
  };

  // Handle single due pay button click
  const handleSinglePay = (dueId: number) => {
    // Select only the clicked due and open confirm modal
    clearSelection();
    toggleDue(dueId);
    setShowConfirmModal(true);
  };

  // Handle payment confirmation
  const handlePaymentConfirm = async () => {
    setPaymentProcessing(true);

    try {
      const session = await createPaymentSession("/student/dues");

      // Navigate to the payment page with QR code
      navigate(`/student/payment`, {
        state: { session },
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to create payment session",
      );
      setPaymentProcessing(false);
      setShowConfirmModal(false);
      return;
    }

    setPaymentProcessing(false);
  };

  const handleSelectAllInView = () => {
    if (allSelectableInViewSelected) {
      selectableInView.forEach((due) => {
        if (selectedDues.includes(due.id)) {
          toggleDue(due.id);
        }
      });
      return;
    }

    selectableInView.forEach((due) => {
      if (!selectedDues.includes(due.id)) {
        toggleDue(due.id);
      }
    });
  };

  const tabInfo: Array<{
    key: DuesTab;
    title: string;
    subtitle: string;
    count: number;
  }> = [
    {
      key: "payable",
      title: "Payable",
      subtitle: "Ready for payment",
      count: payableDues.length,
    },
    {
      key: "permission-granted",
      title: "Permission Granted",
      subtitle: "Approved for payment",
      count: permissionGrantedDues.length,
    },
    {
      key: "non-payable",
      title: "Document / Info",
      subtitle: "Action or information items",
      count: nonPayableDues.length,
    },
  ];

  return (
    <DashboardLayout
      role={user.role}
      username={user.username}
      email={user.email}
    >
      <Toaster position="top-right" />
      <div className="min-h-screen pb-24 sm:pb-32">
        <section className="official-surface p-5 sm:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="official-kicker">Student Dues Console</p>
              <h1 className="official-title mt-2">My Dues and Payments</h1>
              <p className="mt-2 text-sm text-base-content/72 max-w-2xl">
                Review dues by action type, prioritize urgent items, and pay
                multiple dues in one transaction.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={refreshDues}
                className="btn btn-outline btn-sm sm:btn-md"
              >
                Refresh Data
              </button>
              <button
                onClick={handlePayClick}
                disabled={selectedCount === 0}
                className="btn btn-primary btn-sm sm:btn-md"
              >
                Pay Selected ({selectedCount})
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <article className="official-surface-plain p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.11em] text-base-content/60">
                Total Active Dues
              </p>
              <p className="mt-2 text-2xl font-bold text-primary">
                {totals.total_dues}
              </p>
            </article>
            <article className="official-surface-plain p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.11em] text-base-content/60">
                Outstanding Amount
              </p>
              <p className="mt-2 text-2xl font-bold text-error">
                {formatCurrency(totals.total_outstanding)}
              </p>
            </article>
            <article className="official-surface-plain p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.11em] text-base-content/60">
                Payable Balance
              </p>
              <p className="mt-2 text-2xl font-bold text-success">
                {formatCurrency(totals.payable_total)}
              </p>
            </article>
            <article className="official-surface-plain p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.11em] text-base-content/60">
                Priority Alerts
              </p>
              <p className="mt-2 text-lg font-bold text-warning">
                {overdueCount} overdue, {dueSoonCount} due soon
              </p>
            </article>
          </div>
        </section>

        <div className="mx-auto max-w-7xl px-0 py-4 sm:px-2 lg:px-4 sm:py-6 space-y-4 sm:space-y-5">
          <section className="official-grid sm:grid-cols-3">
            <article className="official-surface-plain p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-base-content/55">
                Step 1
              </p>
              <p className="mt-1 text-sm font-semibold text-base-content">
                Review tab-wise dues
              </p>
              <p className="mt-1 text-xs text-base-content/65">
                Separate payable dues from document-only or permission-based
                items.
              </p>
            </article>
            <article className="official-surface-plain p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-base-content/55">
                Step 2
              </p>
              <p className="mt-1 text-sm font-semibold text-base-content">
                Select items to pay
              </p>
              <p className="mt-1 text-xs text-base-content/65">
                Use bulk selection for fast checkout or pay individual dues.
              </p>
            </article>
            <article className="official-surface-plain p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-base-content/55">
                Step 3
              </p>
              <p className="mt-1 text-sm font-semibold text-base-content">
                Confirm and complete payment
              </p>
              <p className="mt-1 text-xs text-base-content/65">
                Review selected items in the payment confirmation modal before
                proceeding.
              </p>
            </article>
          </section>

          <section className="official-surface-plain p-2">
            <div className="grid gap-2 md:grid-cols-3">
              {tabInfo.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => handleTabChange(tab.key)}
                  className={`rounded-xl border px-3 py-3 text-left transition-all ${
                    activeTab === tab.key
                      ? "border-primary/40 bg-primary/10 shadow-sm"
                      : "border-base-300 bg-base-100 hover:border-primary/30"
                  }`}
                >
                  <p className="text-sm font-semibold text-base-content">
                    {tab.title}
                  </p>
                  <p className="text-xs text-base-content/65 mt-0.5">
                    {tab.subtitle}
                  </p>
                  <p className="mt-2 text-lg font-bold text-primary">
                    {tab.count}
                  </p>
                </button>
              ))}
            </div>
          </section>

          {(activeTab === "payable" || activeTab === "permission-granted") &&
            filteredDues.length > 0 && (
              <section className="official-surface-plain p-3 sm:p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-base-content">
                      Selection Workspace
                    </p>
                    <p className="text-xs text-base-content/65 mt-0.5">
                      {selectedCount} selected - {formatCurrency(selectedTotal)}{" "}
                      in current view
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={handleSelectAllInView}
                      className="btn btn-outline btn-sm"
                    >
                      {allSelectableInViewSelected
                        ? "Deselect Visible"
                        : "Select Visible"}
                    </button>
                    <button
                      onClick={clearSelection}
                      disabled={selectedCount === 0}
                      className="btn btn-ghost btn-sm"
                    >
                      Clear Selection
                    </button>
                  </div>
                </div>
              </section>
            )}

          {loading && (
            <div className="official-surface-plain mx-4 flex items-center justify-center py-12 sm:mx-0">
              <div className="loading loading-spinner loading-lg text-primary" />
            </div>
          )}

          {error && (
            <div className="official-surface-plain border-error/40 bg-error/10 mx-4 sm:mx-0 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-semibold text-error">
                    Unable to load dues
                  </p>
                  <p className="text-sm mt-1 text-base-content/75">{error}</p>
                </div>
                <button onClick={() => fetchDues("all")} className="btn btn-sm">
                  Retry
                </button>
              </div>
            </div>
          )}

          {!loading && !error && filteredDues.length === 0 && (
            <div className="official-surface-plain text-center py-12 mx-4 sm:mx-0 px-4">
              <p className="text-lg font-semibold text-base-content">
                No dues in this section
              </p>
              <p className="text-base-content/70 mt-1 text-sm">
                {activeTab === "payable"
                  ? "No payable dues are pending right now."
                  : activeTab === "permission-granted"
                    ? "No permission-granted dues available at the moment."
                    : "No document or information-only dues found."}
              </p>
              {activeTab === "payable" && dues.length === 0 && (
                <div className="mt-5 rounded-xl border border-info/30 bg-info/10 p-4 text-left max-w-md mx-auto">
                  <p className="text-sm font-semibold text-info">
                    No dues assigned yet
                  </p>
                  <p className="mt-1 text-xs text-base-content/65">
                    Dues are published by department operators. Contact your
                    department office if you expected dues to be listed here.
                  </p>
                </div>
              )}
            </div>
          )}

          {!loading && !error && filteredDues.length > 0 && (
            <div className="space-y-3 px-4 sm:px-1">
              {filteredDues.map((due) => (
                <DueCard
                  key={due.id}
                  due={due}
                  selected={selectedDues.includes(due.id)}
                  onToggle={toggleDue}
                  selectable={
                    due.is_payable &&
                    !due.is_cleared &&
                    due.outstanding_amount > 0
                  }
                  onPay={handleSinglePay}
                />
              ))}
            </div>
          )}
        </div>

        <StickyCartBar
          selectedCount={selectedCount}
          totalAmount={selectedTotal}
          onPay={handlePayClick}
          disabled={selectedCount === 0 || paymentProcessing}
        />

        <PaymentConfirmModal
          isOpen={showConfirmModal}
          selectedDues={dues.filter((due) => selectedDues.includes(due.id))}
          totalAmount={selectedTotal}
          onConfirm={handlePaymentConfirm}
          onCancel={() => setShowConfirmModal(false)}
          processing={paymentProcessing}
        />
      </div>
    </DashboardLayout>
  );
}
