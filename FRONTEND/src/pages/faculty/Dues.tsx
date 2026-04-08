import {
  AlertCircle,
  CheckCircle,
  ExternalLink,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { useLocation } from "react-router-dom";
import DashboardLayout from "../../components/DashboardLayout";

interface FacultyDue {
  id: string;
  due_description: string;
  principal_amount: number;
  current_amount: number;
  is_payable: boolean;
  is_cleared: boolean;
  due_clear_by_date: string | null;
  due_type_name: string;
  remarks: string | null;
  needs_original: boolean;
  needs_pdf: boolean;
  proof_drive_link: string | null;
  permission_granted: boolean;
  interest_rate: number;
  created_at: string;
}

interface ClearedDue extends FacultyDue {
  cleared_by: string | null;
  updated_at: string;
}

const FacultyDues = () => {
  const location = useLocation();
  const [activeDues, setActiveDues] = useState<FacultyDue[]>([]);
  const [clearedDues, setClearedDues] = useState<ClearedDue[]>([]);
  const [tab, setTab] = useState<"payable" | "non-payable" | "cleared">(
    location.pathname.includes("cleared") ? "cleared" : "payable",
  );
  const [loading, setLoading] = useState(true);
  const [proofModal, setProofModal] = useState<{
    open: boolean;
    dueId: string;
    description: string;
  } | null>(null);
  const [showNeedsProofOnly, setShowNeedsProofOnly] = useState(false);
  const [proofLink, setProofLink] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const userData = JSON.parse(localStorage.getItem("user") || "{}");
  const user = {
    username: userData.username || "Faculty",
    email: userData.email || "",
    role: "faculty" as const,
  };

  useEffect(() => {
    fetchDues();
  }, []);

  const fetchDues = async () => {
    setLoading(true);
    try {
      const [activeRes, clearedRes] = await Promise.all([
        fetch("/api/faculty/dues", { credentials: "include" }),
        fetch("/api/faculty/dues/cleared", { credentials: "include" }),
      ]);
      if (!activeRes.ok || !clearedRes.ok)
        throw new Error("Failed to fetch dues");
      const activeData = await activeRes.json();
      const clearedData = await clearedRes.json();
      setActiveDues(activeData.data || []);
      setClearedDues(clearedData.data || []);
    } catch (error) {
      console.error("Error fetching dues:", error);
      toast.error("Failed to load dues");
    } finally {
      setLoading(false);
    }
  };

  const openProofModal = (due: FacultyDue) => {
    setProofLink(due.proof_drive_link || "");
    setProofModal({
      open: true,
      dueId: due.id,
      description: due.due_description,
    });
  };

  const submitProof = async () => {
    if (!proofModal || !proofLink.trim()) return;
    // Basic URL validation
    try {
      new URL(proofLink.trim());
    } catch {
      toast.error("Please enter a valid URL");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/faculty/dues/${proofModal.dueId}/upload-document`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ proof_drive_link: proofLink.trim() }),
        },
      );
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || "Failed to submit proof");
      }
      toast.success("Payment proof submitted successfully!");
      setProofModal(null);
      setProofLink("");
      fetchDues();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to submit proof",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const payableDues = activeDues.filter((d) => d.is_payable);
  const nonPayableDues = activeDues.filter((d) => !d.is_payable);
  const pendingProofCount = payableDues.filter(
    (d) => !d.proof_drive_link,
  ).length;
  const submittedProofCount = payableDues.filter(
    (d) => !!d.proof_drive_link,
  ).length;

  const tabs = [
    {
      key: "payable" as const,
      label: "Payable",
      count: payableDues.length,
      subtitle: "Requires payment and proof",
    },
    {
      key: "non-payable" as const,
      label: "Document / Non-Payable",
      count: nonPayableDues.length,
      subtitle: "Information and document items",
    },
    {
      key: "cleared" as const,
      label: "Cleared",
      count: clearedDues.length,
      subtitle: "Completed and verified",
    },
  ];

  const renderDueCard = (due: FacultyDue | ClearedDue) => {
    const isCleared = "cleared_by" in due;
    const hasProof = !!due.proof_drive_link;
    const needsDocs = due.needs_original || due.needs_pdf;

    const statusTone = isCleared
      ? "border-success/40 bg-success/10"
      : due.is_payable
        ? hasProof
          ? "border-info/40 bg-info/10"
          : "border-warning/40 bg-warning/10"
        : "border-base-300 bg-base-200/55";

    const statusText = isCleared
      ? "Cleared"
      : due.is_payable
        ? hasProof
          ? "Proof Submitted - Awaiting HR Review"
          : "Pending Proof Submission"
        : "Document / Information Due";

    return (
      <div key={due.id} className="official-surface-plain p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-base-content sm:text-lg">
                  {due.due_description}
                </h3>
                <p className="mt-1 text-xs uppercase tracking-[0.1em] text-base-content/55">
                  Due Type: {due.due_type_name}
                </p>
              </div>
              <div
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${statusTone}`}
              >
                {statusText}
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-base-300 bg-base-100 px-3 py-2">
                <p className="text-[11px] uppercase tracking-[0.09em] text-base-content/55">
                  Principal
                </p>
                <p className="mt-0.5 font-semibold text-base-content">
                  ₹{Number(due.principal_amount).toLocaleString("en-IN")}
                </p>
              </div>
              <div className="rounded-lg border border-base-300 bg-base-100 px-3 py-2">
                <p className="text-[11px] uppercase tracking-[0.09em] text-base-content/55">
                  Current
                </p>
                <p className="mt-0.5 font-semibold text-base-content">
                  ₹{Number(due.current_amount).toLocaleString("en-IN")}
                </p>
              </div>
              <div className="rounded-lg border border-base-300 bg-base-100 px-3 py-2">
                <p className="text-[11px] uppercase tracking-[0.09em] text-base-content/55">
                  Interest
                </p>
                <p className="mt-0.5 font-semibold text-base-content">
                  {due.interest_rate > 0
                    ? `${due.interest_rate}%`
                    : "Not Applicable"}
                </p>
              </div>
              <div className="rounded-lg border border-base-300 bg-base-100 px-3 py-2">
                <p className="text-[11px] uppercase tracking-[0.09em] text-base-content/55">
                  Due Date
                </p>
                <p className="mt-0.5 font-semibold text-base-content">
                  {due.due_clear_by_date
                    ? new Date(due.due_clear_by_date).toLocaleDateString(
                        "en-IN",
                      )
                    : "Not Set"}
                </p>
              </div>
            </div>

            {due.remarks && (
              <div className="rounded-lg border border-warning/35 bg-warning/10 px-3 py-2 text-sm text-base-content/80">
                <span className="font-semibold">Remarks: </span>
                {due.remarks}
              </div>
            )}

            {needsDocs && !isCleared && (
              <div className="rounded-lg border border-base-300 bg-base-100 px-3 py-2 text-xs text-base-content/75">
                Required: {due.needs_original ? "Original document" : ""}
                {due.needs_original && due.needs_pdf ? " + " : ""}
                {due.needs_pdf ? "PDF proof" : ""}
              </div>
            )}

            {due.proof_drive_link && !isCleared && (
              <div className="flex flex-wrap items-center gap-2 text-sm text-info">
                <CheckCircle size={14} />
                <span>Proof link already submitted.</span>
                <a
                  href={due.proof_drive_link}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-ghost btn-xs gap-1"
                >
                  View Link
                  <ExternalLink size={12} />
                </a>
              </div>
            )}
          </div>

          <aside className="w-full rounded-xl border border-base-300 bg-base-200/50 p-3 lg:w-56">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-base-content/55">
              Action
            </p>
            {isCleared ? (
              <div className="mt-2 rounded-md border border-success/30 bg-success/10 px-2 py-1 text-sm font-semibold text-success">
                Cleared
                {(due as ClearedDue).cleared_by
                  ? ` by ${(due as ClearedDue).cleared_by}`
                  : ""}
              </div>
            ) : due.is_payable ? (
              <button
                onClick={() => openProofModal(due)}
                className="btn btn-primary btn-sm mt-2 w-full gap-2"
              >
                <Upload size={14} />
                {hasProof ? "Update Proof" : "Submit Proof"}
              </button>
            ) : (
              <p className="mt-2 text-sm text-base-content/70">
                No payment action required. Complete the required document
                process.
              </p>
            )}
          </aside>
        </div>
      </div>
    );
  };

  const baseDues =
    tab === "payable"
      ? payableDues
      : tab === "non-payable"
        ? nonPayableDues
        : clearedDues;

  const currentDues =
    tab === "payable" && showNeedsProofOnly
      ? baseDues.filter((due) => !due.proof_drive_link)
      : baseDues;

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
      <div className="space-y-5 sm:space-y-6">
        <section className="official-surface p-5 sm:p-6 lg:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="official-kicker">Faculty Dues Management</p>
              <h1 className="official-title mt-2">
                Payments and Proof Submission
              </h1>
              <p className="mt-2 text-sm text-base-content/72 max-w-2xl">
                Track payable dues, submit or update payment proof links, and
                monitor clearance status from one workspace.
              </p>
            </div>
            <button
              onClick={fetchDues}
              className="btn btn-outline btn-sm sm:btn-md"
            >
              Refresh Data
            </button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <article className="official-surface-plain p-4">
              <p className="text-xs uppercase tracking-[0.1em] text-base-content/55 font-semibold">
                Payable Dues
              </p>
              <p className="mt-2 text-2xl font-bold text-warning">
                {payableDues.length}
              </p>
            </article>
            <article className="official-surface-plain p-4">
              <p className="text-xs uppercase tracking-[0.1em] text-base-content/55 font-semibold">
                Proof Pending
              </p>
              <p className="mt-2 text-2xl font-bold text-error">
                {pendingProofCount}
              </p>
            </article>
            <article className="official-surface-plain p-4">
              <p className="text-xs uppercase tracking-[0.1em] text-base-content/55 font-semibold">
                Proof Submitted
              </p>
              <p className="mt-2 text-2xl font-bold text-info">
                {submittedProofCount}
              </p>
            </article>
            <article className="official-surface-plain p-4">
              <p className="text-xs uppercase tracking-[0.1em] text-base-content/55 font-semibold">
                Cleared Dues
              </p>
              <p className="mt-2 text-2xl font-bold text-success">
                {clearedDues.length}
              </p>
            </article>
          </div>
        </section>

        <section className="official-grid sm:grid-cols-3">
          <article className="official-surface-plain p-4">
            <p className="text-xs uppercase tracking-[0.1em] text-base-content/55 font-semibold">
              Step 1
            </p>
            <p className="mt-1 text-sm font-semibold text-base-content">
              Complete payment
            </p>
            <p className="mt-1 text-xs text-base-content/65">
              Pay the due through your authorized channel.
            </p>
          </article>
          <article className="official-surface-plain p-4">
            <p className="text-xs uppercase tracking-[0.1em] text-base-content/55 font-semibold">
              Step 2
            </p>
            <p className="mt-1 text-sm font-semibold text-base-content">
              Submit proof link
            </p>
            <p className="mt-1 text-xs text-base-content/65">
              Paste a valid Google Drive or document link as proof.
            </p>
          </article>
          <article className="official-surface-plain p-4">
            <p className="text-xs uppercase tracking-[0.1em] text-base-content/55 font-semibold">
              Step 3
            </p>
            <p className="mt-1 text-sm font-semibold text-base-content">
              Wait for HR verification
            </p>
            <p className="mt-1 text-xs text-base-content/65">
              HR validates proof and moves dues to cleared status.
            </p>
          </article>
        </section>

        <section className="official-surface-plain p-2">
          <div className="grid gap-2 md:grid-cols-3">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`rounded-xl border px-3 py-3 text-left transition-all ${
                  tab === t.key
                    ? "border-primary/40 bg-primary/10 shadow-sm"
                    : "border-base-300 bg-base-100 hover:border-primary/30"
                }`}
              >
                <p className="text-sm font-semibold text-base-content">
                  {t.label}
                </p>
                <p className="mt-0.5 text-xs text-base-content/65">
                  {t.subtitle}
                </p>
                <p className="mt-2 text-lg font-bold text-primary">{t.count}</p>
              </button>
            ))}
          </div>
        </section>

        {tab === "payable" && (
          <section className="official-surface-plain p-3 sm:p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2 text-sm text-base-content/75">
                <AlertCircle size={16} className="mt-0.5 text-info" />
                <p>
                  Submit a valid proof link for each payable due. HR will review
                  and clear eligible dues.
                </p>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-base-300 bg-base-100 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-base-content/70">
                <input
                  type="checkbox"
                  checked={showNeedsProofOnly}
                  onChange={(e) => setShowNeedsProofOnly(e.target.checked)}
                  className="checkbox checkbox-sm"
                />
                Show only dues needing proof
              </label>
            </div>
          </section>
        )}

        <div className="space-y-4">
          {currentDues.length === 0 ? (
            <div className="official-surface-plain py-12 text-center text-base-content/60">
              <CheckCircle size={48} className="mx-auto mb-3 text-success" />
              <p className="font-medium">No {tab} dues found.</p>
            </div>
          ) : (
            currentDues.map((due) => renderDueCard(due))
          )}
        </div>
      </div>

      {proofModal?.open && (
        <div className="modal modal-open">
          <div className="modal-box max-w-md official-surface-plain">
            <div className="flex items-start justify-between mb-4">
              <h3 className="font-bold text-lg">Submit Payment Proof</h3>
              <button
                className="btn btn-sm btn-ghost btn-circle"
                onClick={() => {
                  setProofModal(null);
                  setProofLink("");
                }}
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-sm text-base-content/70 mb-4">
              Due: <strong>{proofModal.description}</strong>
            </p>
            <div className="space-y-3">
              <label className="block text-sm font-medium">
                Google Drive / Document Link
              </label>
              <input
                type="url"
                value={proofLink}
                onChange={(e) => setProofLink(e.target.value)}
                className="input input-bordered w-full text-sm"
                placeholder="https://drive.google.com/file/d/..."
              />
              <p className="text-xs text-base-content/50">
                Upload your payment proof (receipt/screenshot), ensure sharing
                is set to "Anyone with link", then paste the URL above.
              </p>
            </div>
            <div className="modal-action">
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setProofModal(null);
                  setProofLink("");
                }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={submitProof}
                disabled={submitting || !proofLink.trim()}
              >
                {submitting ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : null}
                Submit Proof
              </button>
            </div>
          </div>
          <div
            className="modal-backdrop"
            onClick={() => {
              setProofModal(null);
              setProofLink("");
            }}
          />
        </div>
      )}
    </DashboardLayout>
  );
};

export default FacultyDues;
