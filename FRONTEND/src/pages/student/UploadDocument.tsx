import {
  AlertCircle,
  CheckCircle,
  Clock,
  FileText,
  Upload,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import DashboardLayout from "../../components/DashboardLayout";
import { apiFetch } from "../../utils/api";

interface PendingUpload {
  id: number;
  type_name: string;
  due_description: string;
  needs_original: boolean;
  needs_pdf: boolean;
  proof_drive_link: string | null;
  status: "pending_upload" | "pending_approval" | "rejected";
  rejection_reason?: string;
}

type PendingUploadsApiResponse =
  | PendingUpload[]
  | {
      uploads?: PendingUpload[];
      pending_upload?: Array<Omit<PendingUpload, "status">>;
      pending_approval?: Array<Omit<PendingUpload, "status">>;
      rejected?: Array<Omit<PendingUpload, "status">>;
    };

const normalizePendingUploads = (
  payload: PendingUploadsApiResponse,
): PendingUpload[] => {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload.uploads)) {
    return payload.uploads;
  }

  const pendingUpload = (payload.pending_upload || []).map((item) => ({
    ...(item as PendingUpload),
    status: "pending_upload" as const,
  }));

  const pendingApproval = (payload.pending_approval || []).map((item) => ({
    ...(item as PendingUpload),
    status: "pending_approval" as const,
  }));

  const rejected = (payload.rejected || []).map((item) => ({
    ...(item as PendingUpload),
    status: "rejected" as const,
  }));

  return [...pendingUpload, ...pendingApproval, ...rejected];
};

export default function UploadDocument() {
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "pending_upload" | "pending_approval" | "rejected"
  >("pending_upload");
  const [uploadLinks, setUploadLinks] = useState<Record<number, string>>({});

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

  const fetchPendingUploads = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<PendingUploadsApiResponse>(
        "/api/student/pending-uploads",
      );
      setPendingUploads(normalizePendingUploads(data));
    } catch {
      toast.error("Failed to fetch pending uploads");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingUploads();
  }, []);

  const handleUpload = async (dueId: number) => {
    const link = uploadLinks[dueId];
    if (!link || !link.trim()) {
      toast.error("Please enter a document link");
      return;
    }

    try {
      await apiFetch(`/api/student/dues/${dueId}/upload-document`, {
        method: "POST",
        body: JSON.stringify({ proof_drive_link: link.trim() }),
      });
      toast.success("Document link submitted successfully");
      setUploadLinks((prev) => ({ ...prev, [dueId]: "" }));
      fetchPendingUploads();
    } catch {
      toast.error("Failed to submit document link");
    }
  };

  const filteredUploads = pendingUploads.filter((u) => u.status === activeTab);

  const tabs = [
    {
      key: "pending_upload" as const,
      label: "Pending Upload",
      icon: Upload,
      count: pendingUploads.filter((u) => u.status === "pending_upload").length,
    },
    {
      key: "pending_approval" as const,
      label: "Pending Approval",
      icon: Clock,
      count: pendingUploads.filter((u) => u.status === "pending_approval")
        .length,
    },
    {
      key: "rejected" as const,
      label: "Rejected",
      icon: XCircle,
      count: pendingUploads.filter((u) => u.status === "rejected").length,
    },
  ];

  return (
    <DashboardLayout
      role={user.role}
      username={user.username}
      email={user.email}
    >
      <Toaster position="top-right" />
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-3">
          <FileText className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">Upload Documents</h1>
        </div>

        {/* Tabs */}
        <div className="tabs tabs-boxed">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              className={`tab gap-2 ${activeTab === tab.key ? "tab-active" : ""}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <tab.icon size={16} />
              {tab.label}
              {tab.count > 0 && (
                <span className="badge badge-sm">{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-12">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        ) : filteredUploads.length === 0 ? (
          <div className="text-center py-12 text-base-content/60">
            <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-lg">
              No {activeTab.replace(/_/g, " ")} documents
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredUploads.map((item) => (
              <div
                key={item.id}
                className="card bg-base-100 shadow-md border border-base-300"
              >
                <div className="card-body">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">
                        {item.type_name}
                      </h3>
                      <p className="text-sm text-base-content/70">
                        {item.due_description}
                      </p>
                      <div className="flex gap-2 mt-2">
                        {item.needs_original && (
                          <span className="badge badge-outline badge-info badge-sm">
                            Original Required
                          </span>
                        )}
                        {item.needs_pdf && (
                          <span className="badge badge-outline badge-warning badge-sm">
                            PDF Required
                          </span>
                        )}
                      </div>
                    </div>
                    {activeTab === "pending_approval" && (
                      <span className="badge badge-warning gap-1">
                        <Clock size={12} /> Awaiting Review
                      </span>
                    )}
                    {activeTab === "rejected" && (
                      <span className="badge badge-error gap-1">
                        <AlertCircle size={12} /> Rejected
                      </span>
                    )}
                  </div>

                  {/* Rejection reason */}
                  {item.status === "rejected" && item.rejection_reason && (
                    <div className="alert alert-error mt-3">
                      <AlertCircle size={16} />
                      <span className="text-sm">
                        Reason: {item.rejection_reason}
                      </span>
                    </div>
                  )}

                  {/* Upload input (for pending_upload and rejected) */}
                  {(activeTab === "pending_upload" ||
                    activeTab === "rejected") && (
                    <div className="flex gap-2 mt-4">
                      <input
                        type="url"
                        placeholder="Paste Google Drive / cloud storage link"
                        className="input input-bordered flex-1"
                        value={uploadLinks[item.id] || ""}
                        onChange={(e) =>
                          setUploadLinks((prev) => ({
                            ...prev,
                            [item.id]: e.target.value,
                          }))
                        }
                      />
                      <button
                        className="btn btn-primary"
                        onClick={() => handleUpload(item.id)}
                      >
                        <Upload size={16} />
                        Submit
                      </button>
                    </div>
                  )}

                  {/* Show submitted link for pending_approval */}
                  {activeTab === "pending_approval" &&
                    item.proof_drive_link && (
                      <div className="mt-3 text-sm">
                        <span className="font-medium">Submitted Link: </span>
                        <a
                          href={item.proof_drive_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="link link-primary"
                        >
                          {item.proof_drive_link}
                        </a>
                      </div>
                    )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
