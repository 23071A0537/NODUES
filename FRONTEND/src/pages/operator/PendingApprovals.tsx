import {
  AlertCircle,
  CheckCircle,
  Clock,
  ExternalLink,
  FileText,
  User,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import DashboardLayout from "../../components/DashboardLayout";

interface PendingApproval {
  id: number;
  student_roll_number: string;
  student_name: string;
  branch: string;
  section: string;
  student_email: string;
  student_mobile: string;
  due_type_id: number;
  type_name: string;
  type_description: string;
  is_payable: boolean;
  needs_original: boolean;
  needs_pdf: boolean;
  due_clear_by_date: string;
  due_description: string;
  proof_drive_link: string;
  overall_status: string;
  remarks: string | null;
  created_at: string;
  updated_at: string;
  added_by_entity: string;
}

export default function PendingApprovals() {
  const [loading, setLoading] = useState(true);
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingDueId, setRejectingDueId] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  // Get user data from localStorage
  const userData = JSON.parse(localStorage.getItem("user") || "{}");
  const user = {
    username: userData.username || "Operator",
    email: userData.email || "operator@vnrvjiet.in",
    role: (userData.role || "operator") as
      | "admin"
      | "operator"
      | "hod"
      | "student",
    sectionName: userData.section_name || "",
  };

  useEffect(() => {
    fetchPendingApprovals();
  }, []);

  const fetchPendingApprovals = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/operator/pending-approvals", {
        credentials: "include" as RequestCredentials,
      });

      if (!response.ok) {
        throw new Error("Failed to fetch pending approvals");
      }

      const result = await response.json();
      setApprovals(result.data || []);
    } catch (error) {
      console.error("Error fetching pending approvals:", error);
      toast.error("Failed to load pending approvals");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (dueId: number) => {
    if (
      !confirm(
        "Are you sure you want to approve this document and clear the due?",
      )
    ) {
      return;
    }

    try {
      setProcessingId(dueId);
      const response = await fetch(`/api/operator/dues/${dueId}/approve`, {
        method: "POST",
        credentials: "include" as RequestCredentials,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to approve document");
      }

      const result = await response.json();
      toast.success(result.message || "Document approved successfully!");

      setApprovals((prev) => prev.filter((a) => a.id !== dueId));
    } catch (error) {
      console.error("Error approving document:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to approve document",
      );
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectClick = (dueId: number) => {
    setRejectingDueId(dueId);
    setRejectionReason("");
    setShowRejectModal(true);
  };

  const handleRejectSubmit = async () => {
    if (!rejectionReason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }

    if (!rejectingDueId) {
      return;
    }

    try {
      setProcessingId(rejectingDueId);
      const response = await fetch(
        `/api/operator/dues/${rejectingDueId}/reject`,
        {
          method: "POST",
          credentials: "include" as RequestCredentials,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ rejection_reason: rejectionReason }),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to reject document");
      }

      const result = await response.json();
      toast.success(result.message || "Document rejected successfully");

      setApprovals((prev) => prev.filter((a) => a.id !== rejectingDueId));
      setShowRejectModal(false);
      setRejectionReason("");
      setRejectingDueId(null);
    } catch (error) {
      console.error("Error rejecting document:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to reject document",
      );
    } finally {
      setProcessingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getDocumentType = (approval: PendingApproval) => {
    if (approval.needs_original) return "Original Document";
    if (approval.needs_pdf) return "PDF Copy";
    return "Document";
  };

  if (loading) {
    return (
      <DashboardLayout
        role={user.role}
        username={user.username}
        email={user.email}
        sectionName={user.sectionName}
      >
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-base-content/60">
              Loading pending approvals...
            </p>
          </div>
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

      <div className="min-h-screen bg-base-200 pb-8">
        {/* Header */}
        <div className="bg-base-100 shadow-sm border-b border-base-300 mb-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-base-content">
                  Pending Document Approvals
                </h1>
                <p className="mt-1 text-sm text-base-content/60">
                  Review and approve student-uploaded documents
                </p>
              </div>
              <div className="flex items-center px-4 py-2 bg-primary/20 rounded-lg">
                <Clock className="text-primary mr-2" size={20} />
                <span className="text-lg font-bold text-primary">
                  {approvals.length}
                </span>
                <span className="ml-2 text-sm text-primary/80">Pending</span>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {approvals.length > 0 ? (
            <div className="space-y-4">
              {approvals.map((approval) => (
                <div
                  key={approval.id}
                  className="bg-base-100 rounded-lg shadow-md p-6 border-l-4 border-primary"
                >
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Student Info */}
                    <div className="lg:col-span-1">
                      <h3 className="text-sm font-medium text-base-content/60 mb-3 flex items-center">
                        <User className="mr-2" size={16} />
                        Student Information
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="font-semibold text-base-content">
                            {approval.student_name}
                          </span>
                        </div>
                        <div className="text-base-content/70">
                          Roll No:{" "}
                          <span className="font-medium text-base-content">
                            {approval.student_roll_number}
                          </span>
                        </div>
                        <div className="text-base-content/70">
                          Branch:{" "}
                          <span className="font-medium text-base-content">
                            {approval.branch}
                          </span>{" "}
                          | Section:{" "}
                          <span className="font-medium text-base-content">
                            {approval.section}
                          </span>
                        </div>
                        <div className="text-base-content/70">
                          Email:{" "}
                          <span className="font-medium text-base-content">
                            {approval.student_email}
                          </span>
                        </div>
                        <div className="text-base-content/70">
                          Mobile:{" "}
                          <span className="font-medium text-base-content">
                            {approval.student_mobile}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Due Info */}
                    <div className="lg:col-span-1">
                      <h3 className="text-sm font-medium text-base-content/60 mb-3 flex items-center">
                        <FileText className="mr-2" size={16} />
                        Due Information
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="font-semibold text-base-content">
                            {approval.type_name}
                          </span>
                        </div>
                        <div className="text-base-content/70">
                          {approval.type_description}
                        </div>
                        {approval.due_description && (
                          <div className="text-base-content/80 italic">
                            {approval.due_description}
                          </div>
                        )}
                        <div className="text-base-content/70">
                          Department:{" "}
                          <span className="font-medium text-base-content">
                            {approval.added_by_entity}
                          </span>
                        </div>
                        <div className="text-base-content/70">
                          Required:{" "}
                          <span className="font-medium text-primary">
                            {getDocumentType(approval)}
                          </span>
                        </div>
                        <div className="text-base-content/70">
                          Due Date:{" "}
                          <span className="font-medium text-error">
                            {formatDate(approval.due_clear_by_date)}
                          </span>
                        </div>
                        <div className="text-base-content/70">
                          Uploaded:{" "}
                          <span className="font-medium text-success">
                            {formatDateTime(approval.updated_at)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Section */}
                    <div className="lg:col-span-1">
                      <h3 className="text-sm font-medium text-base-content/60 mb-3">
                        Document & Actions
                      </h3>

                      {/* Document Link */}
                      <a
                        href={approval.proof_drive_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full mb-4 px-4 py-3 bg-base-200 border border-base-300 rounded-lg hover:bg-base-300 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <FileText className="text-primary mr-2" size={18} />
                            <span className="text-sm font-medium text-base-content">
                              View Document
                            </span>
                          </div>
                          <ExternalLink
                            className="text-base-content/40"
                            size={16}
                          />
                        </div>
                        <p className="text-xs text-base-content/50 mt-1 truncate">
                          {approval.proof_drive_link}
                        </p>
                      </a>

                      {/* Action Buttons */}
                      <div className="space-y-2">
                        <button
                          onClick={() => handleApprove(approval.id)}
                          disabled={processingId === approval.id}
                          className="btn btn-success btn-sm w-full"
                        >
                          {processingId === approval.id ? (
                            <>
                              <span className="loading loading-spinner loading-xs"></span>
                              Processing...
                            </>
                          ) : (
                            <>
                              <CheckCircle size={16} />
                              Approve & Clear Due
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => handleRejectClick(approval.id)}
                          disabled={processingId === approval.id}
                          className="btn btn-error btn-sm w-full"
                        >
                          <XCircle size={16} />
                          Reject Document
                        </button>
                      </div>

                      <div className="mt-4 p-3 bg-warning/10 border border-warning/30 rounded-lg">
                        <div className="flex items-start">
                          <AlertCircle
                            className="text-warning mr-2 mt-0.5"
                            size={16}
                          />
                          <p className="text-xs text-warning">
                            Review the document carefully before approval. Once
                            approved, the due will be marked as cleared.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-base-100 rounded-lg shadow-md">
              <CheckCircle className="mx-auto h-16 w-16 text-success" />
              <h3 className="mt-4 text-xl font-semibold text-base-content">
                All Caught Up!
              </h3>
              <p className="mt-2 text-base-content/60">
                No documents pending approval at this time.
              </p>
            </div>
          )}
        </div>

        {/* Reject Modal */}
        {showRejectModal && (
          <div className="modal modal-open">
            <div className="modal-box max-w-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-base-content">
                  Reject Document
                </h3>
                <button
                  onClick={() => setShowRejectModal(false)}
                  className="btn btn-ghost btn-sm btn-circle"
                >
                  <XCircle size={24} />
                </button>
              </div>

              <div className="mb-4">
                <p className="text-sm text-base-content/70 mb-4">
                  Please provide a clear reason for rejection so the student can
                  reupload with corrections.
                </p>

                <label className="label">
                  <span className="label-text font-medium">
                    Rejection Reason <span className="text-error">*</span>
                  </span>
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={4}
                  placeholder="E.g., Document is not clear, wrong file uploaded, signature missing, etc."
                  className="textarea textarea-bordered w-full focus:textarea-error"
                />
              </div>

              <div className="modal-action">
                <button
                  onClick={() => setShowRejectModal(false)}
                  className="btn btn-ghost"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRejectSubmit}
                  disabled={!rejectionReason.trim()}
                  className="btn btn-error"
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
