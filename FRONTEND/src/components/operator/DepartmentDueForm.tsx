import { AlertCircle, CheckCircle2, Link as LinkIcon } from "lucide-react";
import { useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import DashboardLayout from "../DashboardLayout";

interface DepartmentDueFormUser {
  username: string;
  email: string;
  role: "admin" | "operator" | "hod" | "student";
  sectionName?: string;
}

interface DepartmentDueFormProps {
  user: DepartmentDueFormUser;
}

interface PersonLookup {
  name: string;
  roll_number?: string;
  branch?: string;
  section?: string;
  department_name?: string;
}

interface FacultyLookup {
  name: string;
  employee_code?: string;
  designation?: string;
  department_name?: string;
  section_name?: string;
}

interface DepartmentDueFormState {
  duePaymentType: "" | "payable" | "non_payable";
  date: string;
  rollNumber: string;
  studentName: string;
  program: string;
  branch: string;
  year: string;
  semester: string;
  section: string;
  locationType: string;
  locationName: string;
  roomNo: string;
  courseActivityUsageContext: string;
  staffReportingName: string;
  employeeId: string;
  designation: string;
  itemEquipment: string;
  issueType: string;
  approxValue: string;
  remarks: string;
  documentationType: string;
  documentationTypeOther: string;
  proofLink: string;
}

const DOCUMENTATION_TYPE_OPTIONS = [
  "Non-Documentation",
  "Internship Letter",
  "Offer Letter",
  "Bonafide Certificate",
  "Lab Record",
  "Course Registration",
  "Other",
];

const BRANCH_OPTIONS = [
  "CSE",
  "CSD",
  "CSM",
  "CSBS",
  "ECE",
  "EEE",
  "EIE",
  "MECH",
  "CIVIL",
  "IT",
  "AIML",
  "OTHER",
];

const PROGRAM_OPTIONS = ["B.Tech", "M.Tech", "MBA"];
const LOCATION_TYPE_OPTIONS = [
  "Laboratory",
  "Department Office",
  "Classroom",
  "Common Area/Facilities - Washroom etc.",
];

const YEAR_OPTIONS = ["1", "2", "3", "4"];
const SEMESTER_OPTIONS = ["1", "2"];
const NON_DOCUMENTATION_VALUE = "Non-Documentation";
const PAYABLE_DUE_TYPE_OPTIONS = [
  { label: "Payable", value: "payable" as const },
  { label: "Non-Payable", value: "non_payable" as const },
];

const initialState: DepartmentDueFormState = {
  duePaymentType: "",
  date: "",
  rollNumber: "",
  studentName: "",
  program: "",
  branch: "",
  year: "",
  semester: "",
  section: "",
  locationType: "",
  locationName: "",
  roomNo: "",
  courseActivityUsageContext: "",
  staffReportingName: "",
  employeeId: "",
  designation: "",
  itemEquipment: "",
  issueType: "",
  approxValue: "",
  remarks: "",
  documentationType: "",
  documentationTypeOther: "",
  proofLink: "",
};

const DepartmentDueForm = ({ user }: DepartmentDueFormProps) => {
  const [form, setForm] = useState<DepartmentDueFormState>(initialState);
  const [submitting, setSubmitting] = useState(false);
  const [lookupStatus, setLookupStatus] = useState<
    "idle" | "loading" | "found" | "not_found" | "error"
  >("idle");
  const [personLookup, setPersonLookup] = useState<PersonLookup | null>(null);
  const [staffLookupStatus, setStaffLookupStatus] = useState<
    "idle" | "loading" | "found" | "not_found" | "error"
  >("idle");
  const [staffLookup, setStaffLookup] = useState<FacultyLookup | null>(null);
  const isPayableDue = form.duePaymentType === "payable";
  const isNonPayableDue = form.duePaymentType === "non_payable";
  const documentationTypeOptions = isPayableDue
    ? [NON_DOCUMENTATION_VALUE]
    : DOCUMENTATION_TYPE_OPTIONS.filter(
        (option) => option !== NON_DOCUMENTATION_VALUE,
      );
  const normalizedBranch = form.branch.trim().toUpperCase();
  const branchOptions =
    normalizedBranch && !BRANCH_OPTIONS.includes(normalizedBranch)
      ? [...BRANCH_OPTIONS, normalizedBranch]
      : BRANCH_OPTIONS;

  useEffect(() => {
    let isCancelled = false;
    const code = form.rollNumber.trim().toUpperCase();
    if (!code) {
      setLookupStatus("idle");
      setPersonLookup(null);
      setForm((prev) => ({
        ...prev,
        studentName: "",
      }));
      return;
    }

    const timer = setTimeout(async () => {
      setLookupStatus("loading");
      try {
        const response = await fetch(
          `/api/operator/lookup-person/${encodeURIComponent(code)}`,
          { credentials: "include" },
        );
        const data = await response.json();

        if (isCancelled) {
          return;
        }

        if (response.ok && data.success) {
          const lookup = data.data as PersonLookup;
          setPersonLookup(lookup);
          setLookupStatus("found");
          setForm((prev) => ({
            ...prev,
            studentName: lookup.name || "",
            branch: lookup.branch ? lookup.branch.toUpperCase() : prev.branch,
            section: lookup.section
              ? lookup.section.toUpperCase()
              : prev.section,
          }));
          return;
        }

        if (response.status === 404) {
          setPersonLookup(null);
          setLookupStatus("not_found");
          setForm((prev) => ({
            ...prev,
            studentName: "",
          }));
          return;
        }

        setPersonLookup(null);
        setLookupStatus("error");
        setForm((prev) => ({
          ...prev,
          studentName: "",
        }));
      } catch (error) {
        console.error("Error looking up student:", error);
        if (isCancelled) {
          return;
        }
        setPersonLookup(null);
        setLookupStatus("error");
        setForm((prev) => ({
          ...prev,
          studentName: "",
        }));
      }
    }, 400);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [form.rollNumber]);

  useEffect(() => {
    let isCancelled = false;
    const code = form.employeeId.trim().toUpperCase();

    if (!code) {
      setStaffLookupStatus("idle");
      setStaffLookup(null);
      setForm((prev) => ({
        ...prev,
        staffReportingName: "",
        designation: "",
      }));
      return;
    }

    const timer = setTimeout(async () => {
      setStaffLookupStatus("loading");
      try {
        const response = await fetch(
          `/api/operator/lookup-faculty/${encodeURIComponent(code)}`,
          { credentials: "include" },
        );
        const data = await response.json();

        if (isCancelled) {
          return;
        }

        if (response.ok && data.success) {
          const lookup = data.data as FacultyLookup;
          setStaffLookup(lookup);
          setStaffLookupStatus("found");
          setForm((prev) => ({
            ...prev,
            staffReportingName: lookup.name || "",
            designation: lookup.designation || "",
          }));
          return;
        }

        if (response.status === 404) {
          setStaffLookup(null);
          setStaffLookupStatus("not_found");
          setForm((prev) => ({
            ...prev,
            staffReportingName: "",
            designation: "",
          }));
          return;
        }

        setStaffLookup(null);
        setStaffLookupStatus("error");
        setForm((prev) => ({
          ...prev,
          staffReportingName: "",
          designation: "",
        }));
      } catch (error) {
        console.error("Error looking up staff:", error);
        if (isCancelled) {
          return;
        }

        setStaffLookup(null);
        setStaffLookupStatus("error");
        setForm((prev) => ({
          ...prev,
          staffReportingName: "",
          designation: "",
        }));
      }
    }, 400);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [form.employeeId]);

  const updateField = <K extends keyof DepartmentDueFormState>(
    field: K,
    value: DepartmentDueFormState[K],
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    const mandatoryFields: Array<keyof DepartmentDueFormState> = [
      "duePaymentType",
      "date",
      "rollNumber",
      "studentName",
      "program",
      "branch",
      "year",
      "semester",
      "section",
      "locationType",
      "locationName",
      "roomNo",
      "courseActivityUsageContext",
      "staffReportingName",
      "employeeId",
      "designation",
      "itemEquipment",
      "issueType",
      "remarks",
      "documentationType",
    ];

    for (const field of mandatoryFields) {
      const value = String(form[field] ?? "").trim();
      if (!value) {
        toast.error(`Please fill ${field}`);
        return false;
      }
    }

    if (isPayableDue && !form.approxValue.trim()) {
      toast.error("Price is required for payable dues");
      return false;
    }

    if (isPayableDue) {
      const parsedPrice = Number.parseFloat(
        form.approxValue.replace(/,/g, "").trim(),
      );
      if (Number.isNaN(parsedPrice) || parsedPrice <= 0) {
        toast.error("Price must be a positive number");
        return false;
      }
    }

    if (isPayableDue && form.documentationType !== NON_DOCUMENTATION_VALUE) {
      toast.error("Payable dues must use Non-Documentation type");
      return false;
    }

    if (isNonPayableDue && form.documentationType === NON_DOCUMENTATION_VALUE) {
      toast.error("Select a documentation type for non-payable dues");
      return false;
    }

    if (
      form.documentationType === "Other" &&
      !form.documentationTypeOther.trim()
    ) {
      toast.error("Please provide Documentation Type when selecting Other");
      return false;
    }

    return true;
  };

  const resetForm = () => {
    setForm(initialState);
    setLookupStatus("idle");
    setPersonLookup(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        roll_number: form.rollNumber.trim().toUpperCase(),
        is_payable: isPayableDue,
        incident_date: form.date,
        due_date: form.date,
        student_name: form.studentName.trim(),
        program: form.program.trim(),
        branch: form.branch.trim().toUpperCase(),
        year: form.year.trim(),
        semester: form.semester.trim(),
        section_name: form.section.trim().toUpperCase(),
        location_type: form.locationType.trim(),
        location_name: form.locationName.trim(),
        room_no: form.roomNo.trim(),
        course_activity_usage_context: form.courseActivityUsageContext.trim(),
        staff_reporting_name: form.staffReportingName.trim(),
        staff_employee_id: form.employeeId.trim(),
        staff_designation: form.designation.trim(),
        item_equipment: form.itemEquipment.trim(),
        issue_type: form.issueType.trim(),
        approx_value: isPayableDue ? form.approxValue.trim() : "N/A",
        form_remarks: form.remarks.trim(),
        documentation_type: isPayableDue
          ? NON_DOCUMENTATION_VALUE
          : form.documentationType.trim(),
        documentation_type_other:
          form.documentationType === "Other"
            ? form.documentationTypeOther.trim()
            : null,
        proof_link: form.proofLink.trim() || null,
      };

      const response = await fetch("/api/operator/dues", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to add department due");
      }

      const generatedDueId = result?.data?.due_unique_id;
      toast.success(
        generatedDueId
          ? `Department due added successfully (${generatedDueId})`
          : "Department due added successfully",
      );
      resetForm();
    } catch (error) {
      console.error("Error adding department due:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to add department due",
      );
    } finally {
      setSubmitting(false);
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
            Department Due Form
          </h2>
          <p className="text-base-content/70">
            Fill all mandatory fields exactly in the department due format.
          </p>
        </div>

        <div className="alert alert-info">
          <AlertCircle size={20} />
          <span>
            All form fields below are mandatory. Due ID is auto-generated on
            submit. Select Due Type first: payable requires price, non-payable
            requires documentation type.
          </span>
        </div>

        <div className="bg-base-100 rounded-lg shadow-md p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Due Type *</span>
                </label>
                <select
                  className="select select-bordered"
                  value={form.duePaymentType}
                  onChange={(event) => {
                    const nextDueType = event.target.value as
                      | ""
                      | "payable"
                      | "non_payable";

                    setForm((prev) => ({
                      ...prev,
                      duePaymentType: nextDueType,
                      documentationType:
                        nextDueType === "payable"
                          ? NON_DOCUMENTATION_VALUE
                          : prev.documentationType === NON_DOCUMENTATION_VALUE
                            ? ""
                            : prev.documentationType,
                      documentationTypeOther:
                        nextDueType === "payable"
                          ? ""
                          : prev.documentationTypeOther,
                      approxValue:
                        nextDueType === "payable" ? prev.approxValue : "",
                    }));
                  }}
                  required
                >
                  <option value="">Select Due Type</option>
                  {PAYABLE_DUE_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Date *</span>
                </label>
                <input
                  type="date"
                  className="input input-bordered"
                  value={form.date}
                  onChange={(event) => updateField("date", event.target.value)}
                  required
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Roll No. *</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={form.rollNumber}
                  onChange={(event) =>
                    updateField("rollNumber", event.target.value.toUpperCase())
                  }
                  required
                />
                {lookupStatus === "loading" && (
                  <span className="label-text-alt text-info">
                    Looking up student...
                  </span>
                )}
                {lookupStatus === "found" && personLookup && (
                  <span className="label-text-alt text-success">
                    Found: {personLookup.name}
                  </span>
                )}
                {lookupStatus === "not_found" && (
                  <span className="label-text-alt text-error">
                    Student not found
                  </span>
                )}
                {lookupStatus === "error" && (
                  <span className="label-text-alt text-error">
                    Could not verify student right now
                  </span>
                )}
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Student Name *</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={form.studentName}
                  onChange={(event) =>
                    updateField("studentName", event.target.value)
                  }
                  required
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Program *</span>
                </label>
                <select
                  className="select select-bordered"
                  value={form.program}
                  onChange={(event) =>
                    updateField("program", event.target.value)
                  }
                  required
                >
                  <option value="">Select Program</option>
                  {PROGRAM_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Branch *</span>
                </label>
                <select
                  className="select select-bordered"
                  value={form.branch}
                  onChange={(event) =>
                    updateField("branch", event.target.value.toUpperCase())
                  }
                  required
                >
                  <option value="">Select Branch</option>
                  {branchOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Year *</span>
                </label>
                <select
                  className="select select-bordered"
                  value={form.year}
                  onChange={(event) => updateField("year", event.target.value)}
                  required
                >
                  <option value="">Select Year</option>
                  {YEAR_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Sem *</span>
                </label>
                <select
                  className="select select-bordered"
                  value={form.semester}
                  onChange={(event) =>
                    updateField("semester", event.target.value)
                  }
                  required
                >
                  <option value="">Select Semester</option>
                  {SEMESTER_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Section *</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={form.section}
                  onChange={(event) =>
                    updateField("section", event.target.value.toUpperCase())
                  }
                  required
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Location Type *</span>
                </label>
                <select
                  className="select select-bordered"
                  value={form.locationType}
                  onChange={(event) =>
                    updateField("locationType", event.target.value)
                  }
                  required
                >
                  <option value="">Select Location Type</option>
                  {LOCATION_TYPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Location Name *</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={form.locationName}
                  onChange={(event) =>
                    updateField("locationName", event.target.value)
                  }
                  required
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Room No. *</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={form.roomNo}
                  onChange={(event) =>
                    updateField("roomNo", event.target.value)
                  }
                  required
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Name of Staff Reporting *</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={form.staffReportingName}
                  onChange={(event) =>
                    updateField("staffReportingName", event.target.value)
                  }
                  required
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Employee ID *</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={form.employeeId}
                  onChange={(event) =>
                    updateField("employeeId", event.target.value.toUpperCase())
                  }
                  required
                />
                {staffLookupStatus === "loading" && (
                  <span className="label-text-alt text-info">
                    Looking up staff...
                  </span>
                )}
                {staffLookupStatus === "found" && staffLookup && (
                  <span className="label-text-alt text-success">
                    Found: {staffLookup.name}
                    {staffLookup.designation
                      ? ` (${staffLookup.designation})`
                      : ""}
                  </span>
                )}
                {staffLookupStatus === "not_found" && (
                  <span className="label-text-alt text-error">
                    Faculty not found
                  </span>
                )}
                {staffLookupStatus === "error" && (
                  <span className="label-text-alt text-error">
                    Could not verify faculty right now
                  </span>
                )}
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Designation *</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={form.designation}
                  onChange={(event) =>
                    updateField("designation", event.target.value)
                  }
                  required
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">
                    {isPayableDue ? "Price (INR) *" : "Price (INR)"}
                  </span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="input input-bordered"
                  value={form.approxValue}
                  onChange={(event) =>
                    updateField("approxValue", event.target.value)
                  }
                  required={isPayableDue}
                  disabled={!isPayableDue}
                />
                {!isPayableDue && (
                  <span className="label-text-alt text-base-content/70">
                    Price is not required for non-payable dues.
                  </span>
                )}
              </div>

              <div className="form-control md:col-span-2">
                <label className="label">
                  <span className="label-text">
                    Documentation Type
                    {isNonPayableDue ? " *" : ""}
                  </span>
                </label>
                <select
                  className="select select-bordered"
                  value={form.documentationType}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setForm((prev) => ({
                      ...prev,
                      documentationType: nextValue,
                      documentationTypeOther:
                        nextValue === "Other"
                          ? prev.documentationTypeOther
                          : "",
                      approxValue:
                        nextValue === NON_DOCUMENTATION_VALUE
                          ? prev.approxValue
                          : "",
                    }));
                  }}
                  required={isNonPayableDue}
                  disabled={!form.duePaymentType}
                >
                  <option value="">
                    {isPayableDue
                      ? "Auto-set to Non-Documentation"
                      : "Select Documentation Type"}
                  </option>
                  {documentationTypeOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              {form.documentationType === "Other" && (
                <div className="form-control md:col-span-2">
                  <label className="label">
                    <span className="label-text">
                      Documentation Type (Other) *
                    </span>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered"
                    value={form.documentationTypeOther}
                    onChange={(event) =>
                      updateField("documentationTypeOther", event.target.value)
                    }
                    required
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text">
                    Course / Activity / Usage Context *
                  </span>
                </label>
                <textarea
                  className="textarea textarea-bordered min-h-[88px]"
                  value={form.courseActivityUsageContext}
                  onChange={(event) =>
                    updateField(
                      "courseActivityUsageContext",
                      event.target.value,
                    )
                  }
                  required
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Item / Equipment *</span>
                </label>
                <textarea
                  className="textarea textarea-bordered min-h-[72px]"
                  value={form.itemEquipment}
                  onChange={(event) =>
                    updateField("itemEquipment", event.target.value)
                  }
                  required
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Type of Issue *</span>
                </label>
                <textarea
                  className="textarea textarea-bordered min-h-[72px]"
                  value={form.issueType}
                  onChange={(event) =>
                    updateField("issueType", event.target.value)
                  }
                  required
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Remarks *</span>
                </label>
                <textarea
                  className="textarea textarea-bordered min-h-[72px]"
                  value={form.remarks}
                  onChange={(event) =>
                    updateField("remarks", event.target.value)
                  }
                  required
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Supporting Link (Optional)</span>
                </label>
                <div className="join w-full">
                  <span className="join-item flex items-center bg-base-200 px-4">
                    <LinkIcon size={18} />
                  </span>
                  <input
                    type="url"
                    placeholder="https://drive.google.com/..."
                    className="input input-bordered join-item flex-1"
                    value={form.proofLink}
                    onChange={(event) =>
                      updateField("proofLink", event.target.value)
                    }
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className={`btn btn-primary btn-lg gap-2 ${submitting ? "loading" : ""}`}
                disabled={submitting}
              >
                {!submitting && <CheckCircle2 size={18} />}
                <span>Submit Department Due</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default DepartmentDueForm;
