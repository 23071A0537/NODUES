import { useState } from "react";
import {
  type Due,
  formatCurrency,
  formatDate,
} from "../../store/useStudentDuesStore";

interface DueCardProps {
  due: Due;
  selected: boolean;
  onToggle: (id: number) => void;
  selectable: boolean;
  onPay?: (dueId: number) => void;
}

type YesNo = "Y" | "N";

const statusConfig: Record<
  string,
  { bg: string; text: string; label: string; icon: string }
> = {
  payable: {
    bg: "bg-success/10",
    text: "text-success",
    label: "Payable",
    icon: "INR",
  },
  scholarship_approved: {
    bg: "bg-info/10",
    text: "text-info",
    label: "Scholarship Approved",
    icon: "OK",
  },
  partial: {
    bg: "bg-warning/10",
    text: "text-warning",
    label: "Partially Paid",
    icon: "PP",
  },
  cleared: {
    bg: "bg-base-300/70",
    text: "text-base-content",
    label: "Cleared",
    icon: "CL",
  },
  info: {
    bg: "bg-base-200",
    text: "text-base-content",
    label: "Info",
    icon: "IF",
  },
};

export default function DueCard({
  due,
  selected,
  onToggle,
  selectable,
  onPay,
}: DueCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [showAlumniFormModal, setShowAlumniFormModal] = useState(false);
  const [alumniSubmitting, setAlumniSubmitting] = useState(false);
  const [alumniForm, setAlumniForm] = useState({
    registrationWithAlumniPortal: "N" as YesNo,
    linkedinProfileLink: "",
    placementStatus: "N" as YesNo,
    proofOfPlacement: "",
    planningHigherEducation: "N" as YesNo,
    proofOfHigherEducation: "",
  });

  const status = statusConfig[due.status_badge] || statusConfig.info;
  const isOverdue =
    new Date(due.due_clear_by_date) < new Date() && !due.is_cleared;

  // Determine if this due is payable (show pay button even if not selectable)
  const isPayableDue =
    selectable &&
    due.is_payable &&
    !due.is_cleared &&
    due.outstanding_amount > 0;
  const needsPermission = due.requires_permission && !due.permission_granted;

  const isAlumniFormDue =
    Boolean(due.is_alumni_due) ||
    due.type_name?.toLowerCase().includes("alumini form") ||
    due.type_name?.toLowerCase().includes("alumni form");

  const isInternalAlumniBulkMetadata = (value?: string | null) => {
    if (!value) {
      return false;
    }

    const trimmed = value.trim();
    if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
      return false;
    }

    try {
      const parsed = JSON.parse(trimmed);
      return parsed?.form_type === "alumni_bulk_due";
    } catch {
      return false;
    }
  };

  const sanitizedRemarks =
    isAlumniFormDue && isInternalAlumniBulkMetadata(due.remarks)
      ? null
      : due.remarks;

  const needsAlumniFormSubmission =
    isAlumniFormDue && !due.is_form_submitted && !due.is_cleared;
  const hasSubmittedAlumniForm =
    isAlumniFormDue && (Boolean(due.is_form_submitted) || due.is_cleared);

  const isValidHttpUrl = (value: string) => {
    if (!value) {
      return true;
    }

    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  };

  const openAlumniFormModal = () => {
    setAlumniForm({
      registrationWithAlumniPortal:
        due.status_of_registration_with_alumni_portal === "Y" ? "Y" : "N",
      linkedinProfileLink: due.linkedin_profile_link || "",
      placementStatus: due.placement_status === "Y" ? "Y" : "N",
      proofOfPlacement: due.proof_of_placement || "",
      planningHigherEducation:
        due.planning_for_higher_education === "Y" ? "Y" : "N",
      proofOfHigherEducation: due.proof_of_higher_education || "",
    });
    setShowAlumniFormModal(true);
  };

  const handleSubmitAlumniForm = async () => {
    if (!alumniForm.linkedinProfileLink.trim()) {
      alert("LinkedIn Profile Link is required");
      return;
    }

    if (!isValidHttpUrl(alumniForm.linkedinProfileLink.trim())) {
      alert("LinkedIn Profile Link must be a valid URL");
      return;
    }

    if (
      alumniForm.placementStatus === "Y" &&
      !alumniForm.proofOfPlacement.trim()
    ) {
      alert("Proof of Placement is required when Placement Status is Y");
      return;
    }

    if (
      alumniForm.proofOfPlacement.trim() &&
      !isValidHttpUrl(alumniForm.proofOfPlacement.trim())
    ) {
      alert("Proof of Placement must be a valid URL");
      return;
    }

    if (
      alumniForm.planningHigherEducation === "Y" &&
      !alumniForm.proofOfHigherEducation.trim()
    ) {
      alert(
        "Proof of Higher Education is required when Planning for Higher Education is Y",
      );
      return;
    }

    if (
      alumniForm.proofOfHigherEducation.trim() &&
      !isValidHttpUrl(alumniForm.proofOfHigherEducation.trim())
    ) {
      alert("Proof of Higher Education must be a valid URL");
      return;
    }

    try {
      setAlumniSubmitting(true);

      const response = await fetch(`/api/student/dues/${due.id}/alumni-form`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          registration_with_alumni_portal:
            alumniForm.registrationWithAlumniPortal,
          linkedin_profile_link: alumniForm.linkedinProfileLink.trim(),
          placement_status: alumniForm.placementStatus,
          proof_of_placement: alumniForm.proofOfPlacement.trim() || null,
          planning_higher_education: alumniForm.planningHigherEducation,
          proof_of_higher_education:
            alumniForm.proofOfHigherEducation.trim() || null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to submit alumni form");
      }

      alert("Alumni form submitted successfully.");
      setShowAlumniFormModal(false);
      window.location.reload();
    } catch (error) {
      console.error("Error submitting alumni form:", error);
      alert(
        error instanceof Error ? error.message : "Failed to submit alumni form",
      );
    } finally {
      setAlumniSubmitting(false);
    }
  };

  const handleUploadDocument = async () => {
    if (!selectedFile) {
      alert("Please select a file to upload");
      return;
    }

    // Validate file type
    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
    ];
    if (!allowedTypes.includes(selectedFile.type)) {
      alert(
        "Invalid file type. Please upload PDF or image files (JPG, PNG, WEBP).",
      );
      return;
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024;
    if (selectedFile.size > maxSize) {
      alert("File size exceeds 10MB. Please choose a smaller file.");
      return;
    }

    try {
      setUploading(true);
      setUploadProgress("Uploading to Google Drive...");

      // Create FormData for file upload
      const formData = new FormData();
      formData.append("document", selectedFile);

      const response = await fetch(
        `/api/student/dues/${due.id}/upload-document`,
        {
          method: "POST",
          credentials: "include" as RequestCredentials,
          body: formData,
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to upload document");
      }

      const result = await response.json();

      setUploadProgress("Upload successful!");
      setTimeout(() => {
        alert(
          `Document uploaded successfully to Google Drive!\nFile: ${result.upload?.fileName || "Document"}\nAwaiting operator approval.`,
        );
        setShowUploadModal(false);
        setSelectedFile(null);
        setUploadProgress("");

        // Refresh the page to show updated status
        window.location.reload();
      }, 500);
    } catch (error) {
      console.error("Error uploading document:", error);
      setUploadProgress("");
      alert(
        error instanceof Error ? error.message : "Failed to upload document",
      );
    } finally {
      setUploading(false);
    }
  };

  const hasRejection =
    !isAlumniFormDue && sanitizedRemarks && !due.proof_drive_link;
  const needsUpload =
    !due.is_payable &&
    due.needs_pdf &&
    !due.proof_drive_link &&
    !due.is_cleared;
  const awaitingApproval =
    !due.is_payable && due.needs_pdf && due.proof_drive_link && !due.is_cleared;

  return (
    <div
      className={`official-surface-plain transition-all ${
        selected
          ? "border-primary shadow-md ring-2 ring-primary/20"
          : "hover:border-primary/35 hover:shadow-md"
      }`}
    >
      <div className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-3">
              {isPayableDue ? (
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => onToggle(due.id)}
                  className="checkbox checkbox-primary mt-1 h-6 w-6 border-base-300"
                  aria-label={`Select ${due.type_name} for ${formatCurrency(due.outstanding_amount)}`}
                />
              ) : (
                <div className="mt-1 flex h-6 w-6 items-center justify-center rounded border-2 border-base-300 bg-base-200">
                  <svg
                    className="h-4 w-4 text-base-content/35"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="break-words text-base font-semibold text-base-content sm:text-lg">
                      {due.type_name}
                    </h3>
                    {due.due_description && (
                      <p className="mt-1 text-sm text-base-content/70">
                        {due.due_description}
                      </p>
                    )}
                  </div>

                  {due.is_payable ? (
                    <div className="text-right">
                      <p className="text-xl font-bold text-success sm:text-2xl">
                        {formatCurrency(due.outstanding_amount)}
                      </p>
                      {due.amount_paid > 0 && (
                        <p className="mt-0.5 text-xs text-base-content/60">
                          Paid: {formatCurrency(due.amount_paid)}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-base-300 bg-base-200 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-base-content/70">
                      {due.needs_original
                        ? "Original Required"
                        : due.needs_pdf
                          ? "PDF Required"
                          : "Document Required"}
                    </div>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${status.bg} ${status.text}`}
                  >
                    <span className="mr-1 font-semibold tracking-wide">
                      {status.icon}
                    </span>
                    {status.label}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-base-200 px-2.5 py-0.5 text-xs font-medium text-base-content">
                    {due.added_by_entity}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      isOverdue
                        ? "bg-error/10 text-error"
                        : "bg-info/10 text-info"
                    }`}
                  >
                    {isOverdue ? "Overdue: " : "Due: "}
                    {formatDate(due.due_clear_by_date)}
                  </span>
                  {due.is_compounded && (
                    <span className="inline-flex items-center rounded-full bg-warning/10 px-2.5 py-0.5 text-xs font-medium text-warning">
                      Compound Interest
                    </span>
                  )}
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-lg border border-base-300 bg-base-100 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-[0.1em] text-base-content/55">
                      Reference
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-base-content">
                      #{due.id}
                    </p>
                  </div>
                  <div className="rounded-lg border border-base-300 bg-base-100 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-[0.1em] text-base-content/55">
                      Due Date
                    </p>
                    <p
                      className={`mt-0.5 text-sm font-semibold ${isOverdue ? "text-error" : "text-base-content"}`}
                    >
                      {formatDate(due.due_clear_by_date)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-base-300 bg-base-100 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-[0.1em] text-base-content/55">
                      Action Type
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-base-content">
                      {due.is_payable
                        ? "Payment"
                        : needsAlumniFormSubmission
                          ? "Alumni Form Submission"
                          : "Document Submission"}
                    </p>
                  </div>
                </div>

                {needsAlumniFormSubmission && (
                  <div className="mt-3 rounded-lg border border-primary/35 bg-primary/10 p-3">
                    <p className="text-sm font-semibold text-base-content">
                      Alumni Form Pending
                    </p>
                    <p className="mt-1 text-xs text-base-content/75">
                      Fill the alumni details to complete this due.
                    </p>
                    <button
                      onClick={openAlumniFormModal}
                      className="btn btn-primary btn-sm mt-2"
                    >
                      Fill Alumni Form
                    </button>
                  </div>
                )}

                {hasSubmittedAlumniForm && (
                  <div className="mt-3 rounded-lg border border-success/35 bg-success/10 p-3">
                    <p className="text-sm font-semibold text-base-content">
                      Alumni Form Submitted
                    </p>
                    <p className="mt-1 text-xs text-base-content/75">
                      Submitted{" "}
                      {due.submitted_at
                        ? formatDate(due.submitted_at)
                        : "successfully"}
                      .
                    </p>
                  </div>
                )}

                {needsUpload && (
                  <div className="mt-3 rounded-lg border border-info/35 bg-info/10 p-3">
                    <p className="text-sm font-semibold text-base-content">
                      Document Upload Required
                    </p>
                    <p className="mt-1 text-xs text-base-content/75">
                      Upload the required {due.needs_pdf ? "PDF" : "document"}{" "}
                      for operator review.
                    </p>
                    <button
                      onClick={() => setShowUploadModal(true)}
                      className="btn btn-primary btn-sm mt-2"
                    >
                      Upload Document
                    </button>
                  </div>
                )}

                {hasRejection && (
                  <div className="mt-3 rounded-lg border border-error/35 bg-error/10 p-3">
                    <p className="text-sm font-semibold text-error">
                      Document Rejected
                    </p>
                    <p className="mt-1 text-xs text-base-content/75">
                      Reason: {sanitizedRemarks}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-base-content/80">
                      Please correct and upload again.
                    </p>
                    <button
                      onClick={() => setShowUploadModal(true)}
                      className="btn btn-error btn-sm mt-2"
                    >
                      Reupload Document
                    </button>
                  </div>
                )}

                {awaitingApproval && (
                  <div className="mt-3 rounded-lg border border-secondary/35 bg-secondary/10 p-3">
                    <p className="text-sm font-semibold text-base-content">
                      Document Under Review
                    </p>
                    <p className="mt-1 text-xs text-base-content/75">
                      Your uploaded document is awaiting operator approval.
                    </p>
                    {due.proof_drive_link && (
                      <a
                        href={due.proof_drive_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-ghost btn-sm mt-2"
                      >
                        View Uploaded Document
                      </a>
                    )}
                  </div>
                )}

                {needsPermission && isPayableDue && (
                  <div className="mt-3 rounded-lg border border-warning/35 bg-warning/10 p-3">
                    <p className="text-sm font-semibold text-base-content">
                      Permission Required
                    </p>
                    <p className="mt-1 text-xs text-base-content/75">
                      This due requires approval before payment completion.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-3 inline-flex items-center text-sm font-medium text-primary hover:text-primary-focus"
            >
              {expanded ? (
                <>
                  <svg
                    className="mr-1 h-4 w-4"
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
                  Hide Due Details
                </>
              ) : (
                <>
                  <svg
                    className="mr-1 h-4 w-4"
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
                  Show Due Details
                </>
              )}
            </button>
          </div>

          <aside className="w-full rounded-xl border border-base-300 bg-base-200/45 p-3 lg:w-60">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-base-content/55">
              Primary Action
            </p>
            {isPayableDue && onPay ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPay(due.id);
                }}
                className="btn btn-primary btn-sm mt-2 w-full"
              >
                Pay {formatCurrency(due.outstanding_amount)}
              </button>
            ) : (
              <p className="mt-2 text-sm text-base-content/70">
                {due.is_payable
                  ? "This due is not payable right now."
                  : needsAlumniFormSubmission
                    ? "Complete the alumni form to finish this due."
                    : "Complete required document workflow."}
              </p>
            )}

            {selected && (
              <p className="mt-2 rounded-md border border-primary/25 bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                Included in payment selection
              </p>
            )}
          </aside>
        </div>

        {expanded && (
          <div className="mt-4 border-t border-base-300 pt-4 text-sm">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-base-300 bg-base-100 p-3">
                <p className="text-xs uppercase tracking-[0.09em] text-base-content/55">
                  Due Type
                </p>
                <p className="mt-1 font-semibold text-base-content">
                  {due.type_name}
                </p>
                {due.type_description && (
                  <p className="mt-1 text-xs text-base-content/60">
                    {due.type_description}
                  </p>
                )}
              </div>

              <div className="rounded-lg border border-base-300 bg-base-100 p-3">
                <p className="text-xs uppercase tracking-[0.09em] text-base-content/55">
                  Issued By
                </p>
                <p className="mt-1 font-semibold text-base-content">
                  {due.added_by_entity}
                </p>
              </div>

              <div className="rounded-lg border border-base-300 bg-base-100 p-3">
                <p className="text-xs uppercase tracking-[0.09em] text-base-content/55">
                  Created
                </p>
                <p className="mt-1 font-semibold text-base-content">
                  {formatDate(due.created_at)}
                </p>
              </div>

              <div className="rounded-lg border border-base-300 bg-base-100 p-3">
                <p className="text-xs uppercase tracking-[0.09em] text-base-content/55">
                  Last Updated
                </p>
                <p className="mt-1 font-semibold text-base-content">
                  {formatDate(due.updated_at)}
                </p>
              </div>
            </div>

            {due.is_payable && (
              <div className="mt-3 rounded-lg border border-base-300 bg-base-100 p-3">
                <p className="text-xs uppercase tracking-[0.09em] text-base-content/55">
                  Payment Breakdown
                </p>
                <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <p className="text-xs text-base-content/55">Total Amount</p>
                    <p className="font-semibold text-base-content">
                      {formatCurrency(due.current_amount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-base-content/55">Amount Paid</p>
                    <p className="font-semibold text-info">
                      {formatCurrency(due.amount_paid)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-base-content/55">Outstanding</p>
                    <p className="font-semibold text-success">
                      {formatCurrency(due.outstanding_amount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-base-content/55">Interest</p>
                    <p className="font-semibold text-base-content">
                      {due.is_compounded === null
                        ? "Not Applicable"
                        : due.is_compounded
                          ? "Compounded"
                          : "Simple"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {!due.is_payable && (
              <div className="mt-3 rounded-lg border border-base-300 bg-base-100 p-3">
                <p className="text-xs uppercase tracking-[0.09em] text-base-content/55">
                  {isAlumniFormDue
                    ? "Alumni Form Requirement"
                    : "Document Requirement"}
                </p>
                <p className="mt-1 font-semibold text-base-content">
                  {isAlumniFormDue
                    ? "Submit Alumni form details from your student portal."
                    : due.needs_original
                      ? "Original document submission is required"
                      : due.needs_pdf
                        ? "PDF submission is required"
                        : "Document submission is required"}
                </p>
              </div>
            )}

            {sanitizedRemarks && (
              <div className="mt-3 rounded-lg border border-base-300 bg-base-100 p-3">
                <p className="text-xs uppercase tracking-[0.09em] text-base-content/55">
                  Remarks
                </p>
                <p className="mt-1 font-medium text-base-content">
                  {sanitizedRemarks}
                </p>
              </div>
            )}

            {due.supporting_document_link && (
              <div className="mt-3">
                <a
                  href={due.supporting_document_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-sm btn-primary"
                >
                  View Supporting Document
                </a>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Alumni Form Modal */}
      {showAlumniFormModal && (
        <div className="modal modal-open">
          <div className="modal-box max-w-2xl">
            <h3 className="font-bold text-lg mb-4">Submit Alumni Form</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text">
                    Status of Registration with Alumni Portal (Y/N)
                  </span>
                </label>
                <select
                  className="select select-bordered"
                  value={alumniForm.registrationWithAlumniPortal}
                  onChange={(event) =>
                    setAlumniForm((prev) => ({
                      ...prev,
                      registrationWithAlumniPortal: event.target.value as YesNo,
                    }))
                  }
                  disabled={alumniSubmitting}
                >
                  <option value="Y">Y</option>
                  <option value="N">N</option>
                </select>
              </div>

              <div className="form-control md:col-span-2">
                <label className="label">
                  <span className="label-text">LinkedIn Profile Link *</span>
                </label>
                <input
                  type="url"
                  className="input input-bordered"
                  placeholder="https://www.linkedin.com/in/..."
                  value={alumniForm.linkedinProfileLink}
                  onChange={(event) =>
                    setAlumniForm((prev) => ({
                      ...prev,
                      linkedinProfileLink: event.target.value,
                    }))
                  }
                  disabled={alumniSubmitting}
                  required
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Placement Status (Y/N)</span>
                </label>
                <select
                  className="select select-bordered"
                  value={alumniForm.placementStatus}
                  onChange={(event) =>
                    setAlumniForm((prev) => ({
                      ...prev,
                      placementStatus: event.target.value as YesNo,
                    }))
                  }
                  disabled={alumniSubmitting}
                >
                  <option value="Y">Y</option>
                  <option value="N">N</option>
                </select>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">
                    Proof of Placement
                    {alumniForm.placementStatus === "Y" ? " *" : ""}
                  </span>
                </label>
                <input
                  type="url"
                  className="input input-bordered"
                  placeholder="https://..."
                  value={alumniForm.proofOfPlacement}
                  onChange={(event) =>
                    setAlumniForm((prev) => ({
                      ...prev,
                      proofOfPlacement: event.target.value,
                    }))
                  }
                  disabled={alumniSubmitting}
                  required={alumniForm.placementStatus === "Y"}
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">
                    Planning for Higher Education (Y/N)
                  </span>
                </label>
                <select
                  className="select select-bordered"
                  value={alumniForm.planningHigherEducation}
                  onChange={(event) =>
                    setAlumniForm((prev) => ({
                      ...prev,
                      planningHigherEducation: event.target.value as YesNo,
                    }))
                  }
                  disabled={alumniSubmitting}
                >
                  <option value="Y">Y</option>
                  <option value="N">N</option>
                </select>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">
                    Proof of Higher Education
                    {alumniForm.planningHigherEducation === "Y" ? " *" : ""}
                  </span>
                </label>
                <input
                  type="url"
                  className="input input-bordered"
                  placeholder="https://..."
                  value={alumniForm.proofOfHigherEducation}
                  onChange={(event) =>
                    setAlumniForm((prev) => ({
                      ...prev,
                      proofOfHigherEducation: event.target.value,
                    }))
                  }
                  disabled={alumniSubmitting}
                  required={alumniForm.planningHigherEducation === "Y"}
                />
              </div>
            </div>

            <div className="modal-action">
              <button
                onClick={handleSubmitAlumniForm}
                className={`btn btn-primary ${alumniSubmitting ? "loading" : ""}`}
                disabled={alumniSubmitting}
              >
                {alumniSubmitting ? "Submitting..." : "Submit Alumni Form"}
              </button>
              <button
                onClick={() => setShowAlumniFormModal(false)}
                className="btn"
                disabled={alumniSubmitting}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Document Modal */}
      {showUploadModal && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">
              {hasRejection ? "Reupload Document" : "Upload Document"}
            </h3>

            {hasRejection && (
              <div className="alert alert-error mb-4">
                <div>
                  <p className="font-semibold">Previous Rejection Reason:</p>
                  <p className="text-sm">{sanitizedRemarks}</p>
                </div>
              </div>
            )}

            <div className="alert alert-info mb-4">
              <div>
                <p className="font-semibold">Due: {due.type_name}</p>
                <p className="text-sm">
                  Required: {due.needs_pdf ? "PDF Document" : "Document"}
                </p>
              </div>
            </div>

            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text font-semibold">
                  Select File <span className="text-error">*</span>
                </span>
              </label>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                className="file-input file-input-bordered w-full"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setSelectedFile(file);
                }}
                disabled={uploading}
              />
              <label className="label">
                <span className="label-text-alt text-base-content/70">
                  Accepted formats: PDF, JPG, PNG, WEBP, DOC, DOCX (Max 10MB)
                </span>
              </label>
              {selectedFile && (
                <div className="mt-2 p-2 bg-base-200 rounded-md">
                  <p className="text-sm font-medium text-base-content">
                    Selected: {selectedFile.name}
                  </p>
                  <p className="text-xs text-base-content/60">
                    Size: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              )}
              {uploadProgress && (
                <div className="mt-2 p-2 bg-info/10 border border-info/30 rounded-md">
                  <p className="text-sm text-info font-medium">
                    {uploadProgress}
                  </p>
                </div>
              )}
            </div>

            <div className="alert alert-warning mb-4">
              <div>
                <p className="text-sm">
                  <strong>Auto-upload to Google Drive</strong>
                </p>
                <p className="text-xs mt-1">
                  Your file will be automatically uploaded to a secure Google
                  Drive folder with filename: <br />
                  <code className="text-xs bg-base-300 px-1 rounded">
                    {due.id}_[roll_number].[ext]
                  </code>
                </p>
              </div>
            </div>

            <div className="modal-action">
              <button
                onClick={handleUploadDocument}
                className={`btn btn-primary ${uploading ? "loading" : ""}`}
                disabled={uploading || !selectedFile}
              >
                {uploading
                  ? "Uploading..."
                  : hasRejection
                    ? "Resubmit"
                    : "Submit"}
              </button>
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setSelectedFile(null);
                  setUploadProgress("");
                }}
                className="btn"
                disabled={uploading}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
