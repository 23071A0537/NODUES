import { AlertCircle, CheckCircle2, Download, Users } from "lucide-react";
import { useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import * as XLSX from "xlsx";
import DashboardLayout from "../DashboardLayout";

interface AlumniBulkDueFormUser {
  username: string;
  email: string;
  role: "admin" | "operator" | "hod" | "student";
  sectionName?: string;
}

interface AlumniBulkDueFormProps {
  user: AlumniBulkDueFormUser;
}

interface AcademicYearOption {
  id: number;
  label: string;
}

interface AlumniBulkResult {
  academic_year_id: number;
  academic_year_label: string;
  total_students: number;
  created_count: number;
  skipped_count: number;
  campaign_key: string;
  due_type_id: number;
}

interface AlumniExportRow {
  id: number;
  student_roll_number: string;
  student_name: string | null;
  student_email: string | null;
  student_mobile: string | null;
  branch: string | null;
  section: string | null;
  academic_year: string | null;
  due_clear_by_date: string | null;
  is_form_submitted: boolean;
  submitted_at: string | null;
  status_of_registration_with_alumni_portal: string | null;
  linkedin_profile_link: string | null;
  placement_status: string | null;
  proof_of_placement: string | null;
  planning_for_higher_education: string | null;
  proof_of_higher_education: string | null;
  campaign_key: string | null;
  created_at: string | null;
  updated_at: string | null;
}

const AlumniBulkDueForm = ({ user }: AlumniBulkDueFormProps) => {
  const [academicYears, setAcademicYears] = useState<AcademicYearOption[]>([]);
  const [loadingYears, setLoadingYears] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [result, setResult] = useState<AlumniBulkResult | null>(null);
  const [academicYearId, setAcademicYearId] = useState("");

  useEffect(() => {
    fetchAcademicYears();
  }, []);

  const fetchAcademicYears = async () => {
    try {
      setLoadingYears(true);
      const response = await fetch("/api/operator/academic-years", {
        credentials: "include",
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to fetch academic years");
      }

      setAcademicYears(data.data || []);
    } catch (error) {
      console.error("Error fetching academic years:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to fetch academic years",
      );
    } finally {
      setLoadingYears(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!academicYearId) {
      toast.error("Please select academic year");
      return;
    }

    const selectedYear = academicYears.find(
      (year) => year.id === Number.parseInt(academicYearId, 10),
    );

    const confirmed = window.confirm(
      `Create Alumni dues for every student in ${selectedYear?.label || "selected year"}?`,
    );

    if (!confirmed) {
      return;
    }

    setSubmitting(true);
    setResult(null);

    try {
      const response = await fetch("/api/operator/dues/alumni/bulk-create", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          academic_year_id: Number.parseInt(academicYearId, 10),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to create Alumni dues");
      }

      setResult(data.data as AlumniBulkResult);
      toast.success(data.message || "Alumni dues created successfully");
    } catch (error) {
      console.error("Error creating Alumni dues:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to create Alumni dues",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadExcel = async () => {
    if (!academicYearId) {
      toast.error("Please select academic year to download Excel");
      return;
    }

    try {
      setDownloading(true);
      const response = await fetch(
        `/api/operator/dues/alumni/export-data?academic_year_id=${academicYearId}`,
        {
          credentials: "include",
        },
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to fetch alumni export data");
      }

      const rows: AlumniExportRow[] = Array.isArray(data.data) ? data.data : [];

      if (rows.length === 0) {
        toast.error("No alumni due data found for selected academic year");
        return;
      }

      const exportRows = rows.map((row, index) => ({
        "S.No": index + 1,
        "Due ID": row.id,
        "Roll Number": row.student_roll_number,
        "Student Name": row.student_name || "",
        Email: row.student_email || "",
        Mobile: row.student_mobile || "",
        Branch: row.branch || "",
        Section: row.section || "",
        "Academic Year": row.academic_year || "",
        "Due Date": row.due_clear_by_date || "",
        "Form Submitted": row.is_form_submitted ? "Yes" : "No",
        "Submitted At": row.submitted_at || "",
        "Registration With Alumni Portal":
          row.status_of_registration_with_alumni_portal || "",
        "LinkedIn Profile Link": row.linkedin_profile_link || "",
        "Placement Status": row.placement_status || "",
        "Proof Of Placement": row.proof_of_placement || "",
        "Planning Higher Education": row.planning_for_higher_education || "",
        "Proof Of Higher Education": row.proof_of_higher_education || "",
        "Campaign Key": row.campaign_key || "",
        "Created At": row.created_at || "",
        "Updated At": row.updated_at || "",
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Alumni Dues");
      XLSX.writeFile(workbook, `alumni_dues_${academicYearId}.xlsx`);
      toast.success("Excel downloaded successfully");
    } catch (error) {
      console.error("Error downloading alumni Excel:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to download alumni Excel",
      );
    } finally {
      setDownloading(false);
    }
  };

  return (
    <DashboardLayout
      role={user.role}
      username={user.username}
      email={user.email}
      sectionName={user.sectionName}
    >
      <Toaster position="top-right" />
      <div className="space-y-6">
        <div className="bg-base-100 rounded-lg shadow-md p-6">
          <h2 className="text-3xl font-bold text-primary mb-2">
            Alumni Bulk Due Creation
          </h2>
          <p className="text-base-content/70">
            Choose an academic year and create Alumni due for every student in
            one click.
          </p>
        </div>

        <div className="alert alert-info">
          <AlertCircle size={20} />
          <span>
            Operator only creates due entries. Students will fill Alumni form
            details from their own login.
          </span>
        </div>

        <div className="bg-base-100 rounded-lg shadow-md p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="form-control max-w-md">
              <label className="label">
                <span className="label-text">Academic Year *</span>
              </label>
              <select
                className="select select-bordered"
                value={academicYearId}
                onChange={(event) => setAcademicYearId(event.target.value)}
                disabled={loadingYears || submitting || downloading}
                required
              >
                <option value="">Select Academic Year</option>
                {academicYears.map((year) => (
                  <option key={year.id} value={year.id}>
                    {year.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                className={`btn btn-primary btn-lg gap-2 ${submitting ? "loading" : ""}`}
                disabled={submitting || loadingYears || downloading}
              >
                {!submitting && <Users size={18} />}
                Create Dues For All Students
              </button>

              <button
                type="button"
                onClick={handleDownloadExcel}
                className={`btn btn-outline btn-lg gap-2 ${downloading ? "loading" : ""}`}
                disabled={submitting || loadingYears || downloading}
              >
                {!downloading && <Download size={18} />}
                Download Excel
              </button>
            </div>
          </form>
        </div>

        {result && (
          <div className="alert alert-success">
            <CheckCircle2 size={20} />
            <div>
              <p className="font-semibold">
                Alumni dues created for {result.academic_year_label}
              </p>
              <p className="text-sm">
                Total Students: {result.total_students} | Created:{" "}
                {result.created_count} | Skipped: {result.skipped_count}
              </p>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AlumniBulkDueForm;
