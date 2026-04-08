import { CheckCircle, Clock, ExternalLink, Upload, X } from "lucide-react";
import { useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import DashboardLayout from "../../components/DashboardLayout";

interface PendingDue {
  id: string;
  due_description: string;
  current_amount: number;
  due_type_name: string;
  needs_original: boolean;
  needs_pdf: boolean;
  proof_drive_link: string | null;
  due_clear_by_date: string | null;
}

interface PendingUploads {
  pending_upload: PendingDue[];
  pending_approval: PendingDue[];
}

const FacultyUploadDocument = () => {
  const [data, setData] = useState<PendingUploads>({
    pending_upload: [],
    pending_approval: [],
  });
  const [tab, setTab] = useState<"pending_upload" | "pending_approval">(
    "pending_upload",
  );
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; due: PendingDue } | null>(
    null,
  );
  const [driveLink, setDriveLink] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const userData = JSON.parse(localStorage.getItem("user") || "{}");
  const user = {
    username: userData.username || "Faculty",
    email: userData.email || "",
    role: "faculty" as const,
  };

  useEffect(() => {
    fetchPendingUploads();
  }, []);

  const fetchPendingUploads = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/faculty/pending-uploads", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch uploads");
      const json = await res.json();
      setData(json.data || { pending_upload: [], pending_approval: [] });
    } catch (error) {
      console.error("Error fetching pending uploads:", error);
      toast.error("Failed to load documents");
    } finally {
      setLoading(false);
    }
  };

  const openModal = (due: PendingDue) => {
    setDriveLink(due.proof_drive_link || "");
    setModal({ open: true, due });
  };

  const submitLink = async () => {
    if (!modal || !driveLink.trim()) return;
    try {
      new URL(driveLink.trim());
    } catch {
      toast.error("Please enter a valid URL");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/faculty/dues/${modal.due.id}/upload-document`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ proof_drive_link: driveLink.trim() }),
        },
      );
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || "Failed to submit");
      }
      toast.success("Document link submitted!");
      setModal(null);
      setDriveLink("");
      fetchPendingUploads();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  const currentItems = data[tab];

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
      <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5">
        <h1 className="text-2xl font-bold">Upload Documents</h1>

        {/* Tabs */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setTab("pending_upload")}
            className={`btn btn-sm gap-2 ${tab === "pending_upload" ? "btn-primary" : "btn-ghost border border-base-300"}`}
          >
            <Upload size={14} /> Pending Upload
            <span className="badge badge-sm badge-warning">
              {data.pending_upload.length}
            </span>
          </button>
          <button
            onClick={() => setTab("pending_approval")}
            className={`btn btn-sm gap-2 ${tab === "pending_approval" ? "btn-primary" : "btn-ghost border border-base-300"}`}
          >
            <Clock size={14} /> Pending Approval
            <span className="badge badge-sm badge-info">
              {data.pending_approval.length}
            </span>
          </button>
        </div>

        {/* List */}
        <div className="space-y-4">
          {currentItems.length === 0 ? (
            <div className="text-center py-12 text-base-content/50">
              <CheckCircle size={48} className="mx-auto mb-3 text-green-400" />
              <p className="font-medium">
                {tab === "pending_upload"
                  ? "No documents pending upload."
                  : "No documents awaiting approval."}
              </p>
            </div>
          ) : (
            currentItems.map((due) => (
              <div
                key={due.id}
                className={`bg-base-100 rounded-xl shadow p-5 border-l-4 ${
                  tab === "pending_upload"
                    ? "border-orange-400"
                    : "border-blue-400"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-semibold">{due.due_description}</h3>
                      <span className="badge badge-sm badge-outline">
                        {due.due_type_name}
                      </span>
                    </div>
                    <p className="text-sm text-base-content/70">
                      Amount:{" "}
                      <strong>
                        ₹{Number(due.current_amount).toLocaleString("en-IN")}
                      </strong>
                      {due.due_clear_by_date && (
                        <>
                          {" "}
                          &nbsp;·&nbsp; Due by:{" "}
                          <strong>
                            {new Date(due.due_clear_by_date).toLocaleDateString(
                              "en-IN",
                            )}
                          </strong>
                        </>
                      )}
                    </p>
                    <div className="flex gap-2 flex-wrap mt-2">
                      {due.needs_original && (
                        <span className="badge badge-sm badge-info">
                          Original required
                        </span>
                      )}
                      {due.needs_pdf && (
                        <span className="badge badge-sm badge-secondary">
                          PDF required
                        </span>
                      )}
                    </div>
                    {tab === "pending_approval" && due.proof_drive_link && (
                      <div className="mt-2 flex items-center gap-2 text-sm text-blue-600">
                        <CheckCircle size={14} />
                        <span>Proof submitted</span>
                        <a
                          href={due.proof_drive_link}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:underline flex items-center gap-1"
                        >
                          View <ExternalLink size={12} />
                        </a>
                      </div>
                    )}
                  </div>
                  <div>
                    {tab === "pending_upload" ? (
                      <button
                        onClick={() => openModal(due)}
                        className="btn btn-sm btn-warning gap-2"
                      >
                        <Upload size={14} /> Upload Link
                      </button>
                    ) : (
                      <button
                        onClick={() => openModal(due)}
                        className="btn btn-sm btn-outline gap-2"
                      >
                        Update Link
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal */}
      {modal?.open && (
        <div className="modal modal-open">
          <div className="modal-box max-w-md">
            <div className="flex items-start justify-between mb-4">
              <h3 className="font-bold text-lg">Submit Document Link</h3>
              <button
                className="btn btn-sm btn-ghost btn-circle"
                onClick={() => {
                  setModal(null);
                  setDriveLink("");
                }}
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-sm text-base-content/70 mb-4">
              Due: <strong>{modal.due.due_description}</strong>
            </p>
            <div className="space-y-3">
              <label className="block text-sm font-medium">
                Google Drive Link
              </label>
              <input
                type="url"
                value={driveLink}
                onChange={(e) => setDriveLink(e.target.value)}
                className="input input-bordered w-full text-sm"
                placeholder="https://drive.google.com/file/d/..."
              />
              <p className="text-xs text-base-content/50">
                Upload the required document to Google Drive, set sharing to
                "Anyone with link", then paste the link above.
              </p>
            </div>
            <div className="modal-action">
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setModal(null);
                  setDriveLink("");
                }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={submitLink}
                disabled={submitting || !driveLink.trim()}
              >
                {submitting ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : null}
                Submit
              </button>
            </div>
          </div>
          <div
            className="modal-backdrop"
            onClick={() => {
              setModal(null);
              setDriveLink("");
            }}
          />
        </div>
      )}
    </DashboardLayout>
  );
};

export default FacultyUploadDocument;
