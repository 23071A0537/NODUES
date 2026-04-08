import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Download,
  FileSpreadsheet,
  FileText,
  Link as LinkIcon,
  Trash2,
  Upload,
  User,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import * as XLSX from "xlsx";
import DashboardLayout from "../../components/DashboardLayout";

interface DueType {
  id: number;
  type_name: string;
  description: string;
  is_for_student: number;
  requires_permission: boolean;
}

interface BulkRow {
  index: number;
  rollNumber: string;
  dueTypeId: string;
  dueTypeName: string;
  dueDescription: string;
  paymentType: string;
  amount: string;
  dueDate: string;
  interestCompounded: string;
  interestRate: string;
  documentType: string;
  proofLink: string;
  status: "pending" | "success" | "error";
  errorMsg?: string;
}

interface PersonLookup {
  name: string;
  roll_number?: string;
  employee_code?: string;
  branch?: string;
  section?: string;
  department_name?: string;
}

type FormStep = 1 | 2 | 3 | 4;

const AddDue = () => {
  // Form step state
  const [currentStep, setCurrentStep] = useState<FormStep>(1);

  // Form field states
  const [rollNumber, setRollNumber] = useState("");
  const [dueTypes, setDueTypes] = useState<DueType[]>([]);
  const [selectedDueType, setSelectedDueType] = useState("");
  const [dueDescription, setDueDescription] = useState("");
  const [isPayable, setIsPayable] = useState<boolean | null>(null);
  const [amount, setAmount] = useState("");
  const [needsOriginal, setNeedsOriginal] = useState<boolean | null>(null);
  const [needsPdf, setNeedsPdf] = useState<boolean | null>(null);
  const [dueDate, setDueDate] = useState("");
  const [isCompounded, setIsCompounded] = useState<boolean | null>(null);
  const [interestRate, setInterestRate] = useState("");
  const [proofLink, setProofLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [lookupStatus, setLookupStatus] = useState<
    "idle" | "loading" | "found" | "not_found" | "error"
  >("idle");
  const [personLookup, setPersonLookup] = useState<PersonLookup | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  // Bulk upload state
  const fileRef = useRef<HTMLInputElement>(null);
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([]);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  // Get user data from localStorage
  const userData = JSON.parse(localStorage.getItem("user") || "{}");
  const user = {
    username: userData.name || userData.username || "Operator",
    email: userData.email || "operator@vnrvjiet.in",
    role: (userData.role || "operator") as
      | "admin"
      | "operator"
      | "hod"
      | "student",
    departmentId: userData.department_id,
    sectionId: userData.section_id,
    operatorType: userData.operator_type || "department",
    accessLevel: userData.access_level || "all_students",
  };

  const isForFaculty = user.accessLevel === "all_faculty";

  useEffect(() => {
    fetchDueTypes();
  }, []);

  useEffect(() => {
    const code = rollNumber.trim().toUpperCase();
    if (!code) {
      setLookupStatus("idle");
      setPersonLookup(null);
      return;
    }

    const timer = setTimeout(async () => {
      setLookupStatus("loading");
      try {
        const response = await fetch(
          `/api/operator/lookup-person/${encodeURIComponent(code)}`,
          {
            credentials: "include",
          },
        );
        const data = await response.json();

        if (response.ok && data.success) {
          setPersonLookup(data.data);
          setLookupStatus("found");
        } else if (response.status === 404) {
          setPersonLookup(null);
          setLookupStatus("not_found");
        } else {
          setPersonLookup(null);
          setLookupStatus("error");
        }
      } catch (error) {
        console.error("Error looking up person:", error);
        setPersonLookup(null);
        setLookupStatus("error");
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [rollNumber]);

  const fetchDueTypes = async () => {
    try {
      const response = await fetch("/api/operator/due-types", {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setDueTypes(data.data);
        }
      }
    } catch (error) {
      console.error("Error fetching due types:", error);
      toast.error("Failed to fetch due types");
    }
  };

  const validateFormBeforeSubmit = () => {
    if (!rollNumber.trim()) {
      toast.error(
        `Please enter ${isForFaculty ? "employee code" : "roll number"}`,
      );
      return false;
    }

    if (!selectedDueType) {
      toast.error("Please select a due type");
      return false;
    }

    if (isPayable === null) {
      toast.error("Please select if due is payable or non-payable");
      return false;
    }

    if (isPayable && !amount) {
      toast.error("Please enter the amount for payable due");
      return false;
    }

    if (isPayable && isCompounded === null) {
      toast.error("Please specify if interest will be compounded");
      return false;
    }

    if (isPayable && isCompounded && !interestRate) {
      toast.error("Please enter interest rate for compounded dues");
      return false;
    }

    if (isPayable && isCompounded && interestRate) {
      const rate = parseFloat(interestRate);
      if (isNaN(rate) || rate < 0 || rate > 1) {
        toast.error(
          "Interest rate must be a decimal between 0 and 1 (e.g., 0.001 for 0.1% daily)",
        );
        return false;
      }
    }

    const selectedType = dueTypes.find(
      (dt) => dt.id === parseInt(selectedDueType),
    );
    if (
      !isPayable &&
      selectedType?.type_name.toLowerCase().includes("documentation")
    ) {
      if (needsOriginal === null && needsPdf === null) {
        toast.error("Please select document requirement");
        return false;
      }
    }

    if (!dueDate) {
      toast.error("Please select a due date");
      return false;
    }

    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateFormBeforeSubmit()) {
      return;
    }

    setIsConfirmModalOpen(true);
  };

  const handleConfirmAddDue = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/operator/dues", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roll_number: rollNumber.trim(),
          due_type_id: parseInt(selectedDueType),
          is_payable: isPayable,
          amount: isPayable ? parseFloat(amount) : null,
          due_description: dueDescription.trim() || null,
          needs_original: needsOriginal,
          needs_pdf: needsPdf,
          due_date: dueDate,
          is_compounded: isPayable ? isCompounded : null,
          interest_rate:
            isPayable && isCompounded ? parseFloat(interestRate) : null,
          proof_link: proofLink.trim() || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to add due");
      }

      const data = await response.json();

      if (data.success) {
        toast.success("Due added successfully");
        // Reset form
        resetForm();
      } else {
        throw new Error(data.message || "Failed to add due");
      }
    } catch (error) {
      console.error("Error adding due:", error);
      toast.error(error instanceof Error ? error.message : "Failed to add due");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setCurrentStep(1);
    setRollNumber("");
    setSelectedDueType("");
    setDueDescription("");
    setIsPayable(null);
    setAmount("");
    setNeedsOriginal(null);
    setNeedsPdf(null);
    setDueDate("");
    setIsCompounded(null);
    setInterestRate("");
    setProofLink("");
    setLookupStatus("idle");
    setPersonLookup(null);
    setIsConfirmModalOpen(false);
  };

  const downloadTemplate = () => {
    const template = [
      {
        "S.No": 1,
        [isForFaculty ? "Employee Code" : "Roll Number"]: isForFaculty
          ? "EMP0001"
          : "21B81A0501",
        "Due Type ID": 1,
        "Due Type Name": "Library Fine",
        "Due Description": "Library fine for late submission",
        "Payment Type": "Payable",
        Amount: 1000,
        "Due Date (YYYY-MM-DD)": "2026-03-31",
        "Interest Compounded": "No",
        "Interest Rate (decimal)": "",
        "Document Type": "",
        "Proof Link": "https://drive.google.com/...",
      },
      {
        "S.No": 2,
        [isForFaculty ? "Employee Code" : "Roll Number"]: isForFaculty
          ? "EMP0002"
          : "21B81A0502",
        "Due Type ID": 2,
        "Due Type Name": "Documentation",
        "Due Description": "Document submission pending",
        "Payment Type": "Non-Payable",
        Amount: "",
        "Due Date (YYYY-MM-DD)": "2026-04-15",
        "Interest Compounded": "",
        "Interest Rate (decimal)": "",
        "Document Type": "Original",
        "Proof Link": "",
      },
      {
        "S.No": 3,
        [isForFaculty ? "Employee Code" : "Roll Number"]: isForFaculty
          ? "EMP0003"
          : "21B81A0503",
        "Due Type ID": 1,
        "Due Type Name": "Lab Equipment",
        "Due Description": "Lab equipment damage fee",
        "Payment Type": "Payable",
        Amount: 5000,
        "Due Date (YYYY-MM-DD)": "2026-05-01",
        "Interest Compounded": "Yes",
        "Interest Rate (decimal)": 0.001,
        "Document Type": "",
        "Proof Link": "https://drive.google.com/...",
      },
    ];

    // Add column notes
    const ws = XLSX.utils.json_to_sheet(template);

    // Set column widths for better readability
    ws["!cols"] = [
      { wch: 6 }, // S.No
      { wch: 15 }, // Roll/Employee
      { wch: 12 }, // Due Type ID
      { wch: 20 }, // Due Type Name
      { wch: 35 }, // Description
      { wch: 15 }, // Payment Type
      { wch: 10 }, // Amount
      { wch: 18 }, // Due Date
      { wch: 20 }, // Interest Compounded
      { wch: 20 }, // Interest Rate (decimal)
      { wch: 15 }, // Document Type
      { wch: 40 }, // Proof Link
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Due Upload Template");

    // Add instructions sheet
    const instructions = [
      {
        Field: "S.No",
        Description: "Serial number for reference",
        Required: "Yes",
        "Valid Values": "Numbers starting from 1",
      },
      {
        Field: isForFaculty ? "Employee Code" : "Roll Number",
        Description: isForFaculty
          ? "Faculty employee code"
          : "Student roll number",
        Required: "Yes",
        "Valid Values": isForFaculty ? "e.g., EMP0001" : "e.g., 21B81A0501",
      },
      {
        Field: "Due Type ID",
        Description: "ID of the due type (see Due Types sheet)",
        Required: "Yes",
        "Valid Values": "Valid due type ID from database",
      },
      {
        Field: "Due Type Name",
        Description: "Name of due type (for reference only)",
        Required: "No",
        "Valid Values": "Any text",
      },
      {
        Field: "Due Description",
        Description: "Additional details about the due",
        Required: "No",
        "Valid Values": "Any descriptive text",
      },
      {
        Field: "Payment Type",
        Description: "Whether due requires payment",
        Required: "Yes",
        "Valid Values": "Payable or Non-Payable",
      },
      {
        Field: "Amount",
        Description: "Amount in rupees (if payable)",
        Required: "If Payable",
        "Valid Values": "Positive numbers (e.g., 1000, 2500.50)",
      },
      {
        Field: "Due Date",
        Description: "Last date to clear the due",
        Required: "Yes",
        "Valid Values": "YYYY-MM-DD format (e.g., 2026-03-31)",
      },
      {
        Field: "Interest Compounded",
        Description: "Whether interest applies (payable dues only)",
        Required: "If Payable",
        "Valid Values": "Yes or No",
      },
      {
        Field: "Interest Rate (decimal)",
        Description: "Daily interest rate as decimal (if compounded)",
        Required: "If Compounded",
        "Valid Values": "Decimal 0-1 (e.g., 0.001 for 0.1% daily)",
      },
      {
        Field: "Document Type",
        Description:
          "Document requirement (for non-payable documentation dues)",
        Required: "If Non-Payable Doc",
        "Valid Values": "Original, PDF, or leave blank",
      },
      {
        Field: "Proof Link",
        Description: "Link to supporting documents",
        Required: "No",
        "Valid Values": "Valid URL (e.g., Google Drive link)",
      },
    ];

    const wsInstructions = XLSX.utils.json_to_sheet(instructions);
    wsInstructions["!cols"] = [
      { wch: 25 }, // Field
      { wch: 50 }, // Description
      { wch: 20 }, // Required
      { wch: 40 }, // Valid Values
    ];
    XLSX.utils.book_append_sheet(wb, wsInstructions, "Instructions");

    // Add Due Types reference sheet
    if (dueTypes.length > 0) {
      const filteredTypes = dueTypes.filter((dt) =>
        isForFaculty ? dt.is_for_student === 0 : dt.is_for_student === 1,
      );
      const dueTypesData = filteredTypes.map((dt) => ({
        "Due Type ID": dt.id,
        "Type Name": dt.type_name,
        Description: dt.description,
        "Requires Permission": dt.requires_permission ? "Yes" : "No",
      }));
      const wsDueTypes = XLSX.utils.json_to_sheet(dueTypesData);
      wsDueTypes["!cols"] = [
        { wch: 12 },
        { wch: 25 },
        { wch: 45 },
        { wch: 20 },
      ];
      XLSX.utils.book_append_sheet(wb, wsDueTypes, "Due Types Reference");
    }

    XLSX.writeFile(
      wb,
      `due_upload_template_${isForFaculty ? "faculty" : "student"}.xlsx`,
    );
    toast.success("Template downloaded with instructions");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      toast.error("Please upload an Excel file (.xlsx or .xls)");
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data: Record<string, string>[] = XLSX.utils.sheet_to_json(ws, {
          defval: "",
        });

        if (data.length === 0) {
          toast.error("Excel file is empty");
          return;
        }

        const idCol = isForFaculty ? "Employee Code" : "Roll Number";
        const mapped: BulkRow[] = data.map((row, i) => ({
          index: i,
          rollNumber: String(row[idCol] || "").toUpperCase(),
          dueTypeId: String(row["Due Type ID"] || ""),
          dueTypeName: String(row["Due Type Name"] || ""),
          dueDescription: String(row["Due Description"] || ""),
          paymentType: String(row["Payment Type"] || ""),
          amount: String(row["Amount"] || ""),
          dueDate: String(row["Due Date (YYYY-MM-DD)"] || ""),
          interestCompounded: String(row["Interest Compounded"] || ""),
          interestRate: String(row["Interest Rate (decimal)"] || ""),
          documentType: String(row["Document Type"] || ""),
          proofLink: String(row["Proof Link"] || ""),
          status: "pending",
        }));

        setBulkRows(mapped);
        toast.success(`Loaded ${mapped.length} rows from Excel`);
      } catch (error) {
        console.error("Error processing file:", error);
        toast.error("Failed to read Excel file");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  };

  const removeBulkRow = (index: number) => {
    setBulkRows((prev) => prev.filter((r) => r.index !== index));
  };

  const submitBulk = async () => {
    if (bulkRows.length === 0) return toast.error("No rows to upload");
    setBulkSubmitting(true);

    try {
      // Reconstruct the data in the format the backend expects
      const idCol = isForFaculty ? "Employee Code" : "Roll Number";
      const dues = bulkRows.map((r) => ({
        [idCol]: r.rollNumber,
        "Due Type ID": r.dueTypeId,
        "Due Type Name": r.dueTypeName,
        "Due Description": r.dueDescription,
        "Payment Type": r.paymentType,
        Amount: r.amount,
        "Due Date (YYYY-MM-DD)": r.dueDate,
        "Interest Compounded": r.interestCompounded,
        "Interest Rate (decimal)": r.interestRate,
        "Document Type": r.documentType,
        "Proof Link": r.proofLink,
      }));

      const response = await fetch("/api/operator/dues/bulk-upload", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dues }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success(
          `Successfully uploaded ${result.data.successCount} dues. Failed: ${result.data.failedCount}`,
        );

        // Build error set from backend response (backend returns row numbers as 1-based with +2 offset for header)
        const errMap = new Map<number, string>();
        if (result.data.errors) {
          for (const err of result.data.errors) {
            // Backend sends row (Excel row = index+2), convert back to 0-based index
            errMap.set(err.row - 2, err.error);
          }
        }

        setBulkRows((prev) =>
          prev.map((r) => ({
            ...r,
            status: errMap.has(r.index) ? "error" : "success",
            errorMsg: errMap.get(r.index),
          })),
        );
      } else {
        toast.error(result.message || "Bulk upload failed");
      }
    } catch (error) {
      console.error("Error during bulk upload:", error);
      toast.error("Error during bulk upload");
    } finally {
      setBulkSubmitting(false);
    }
  };

  const selectedDueTypeObj = dueTypes.find(
    (dt) => dt.id === parseInt(selectedDueType),
  );
  const isDocumentationType = selectedDueTypeObj?.type_name
    .toLowerCase()
    .includes("documentation");

  // Filter due types based on user access
  const filteredDueTypes = dueTypes.filter((dt) =>
    isForFaculty ? dt.is_for_student === 0 : dt.is_for_student === 1,
  );

  // Step validation functions
  const isStep1Valid = () => {
    return rollNumber.trim().length > 0;
  };

  const isStep2Valid = () => {
    return selectedDueType !== "" && isPayable !== null;
  };

  const isStep3Valid = () => {
    if (isPayable === true) {
      return (
        amount !== "" &&
        parseFloat(amount) > 0 &&
        dueDate !== "" &&
        isCompounded !== null
      );
    } else if (isPayable === false) {
      if (isDocumentationType) {
        return dueDate !== "" && (needsOriginal !== null || needsPdf !== null);
      }
      return dueDate !== "";
    }
    return false;
  };

  // Navigation functions
  const goToNextStep = () => {
    if (currentStep === 1 && !isStep1Valid()) {
      toast.error(
        `Please enter ${isForFaculty ? "employee code" : "roll number"}`,
      );
      return;
    }
    if (currentStep === 2 && !isStep2Valid()) {
      toast.error("Please complete all required fields in this step");
      return;
    }
    if (currentStep === 3 && !isStep3Valid()) {
      toast.error("Please complete all required fields in this step");
      return;
    }

    setCurrentStep((prev) => Math.min(4, prev + 1) as FormStep);
  };

  const goToPreviousStep = () => {
    setCurrentStep((prev) => Math.max(1, prev - 1) as FormStep);
  };

  const getStepStatus = (step: FormStep) => {
    if (step < currentStep) return "completed";
    if (step === currentStep) return "active";
    return "pending";
  };

  return (
    <DashboardLayout
      role={user.role}
      username={user.username}
      email={user.email}
    >
      <Toaster position="top-right" />
      <div className="space-y-6">
        {/* Page Header */}
        <div className="bg-gradient-to-r from-primary to-secondary rounded-lg shadow-lg p-6 text-primary-content">
          <h2 className="text-3xl font-bold mb-2">Add Due</h2>
          <p className="text-base-100/90">
            Add {isForFaculty ? "faculty" : "student"} dues with our simple
            step-by-step process
          </p>
        </div>

        {/* Manual Entry Form */}
        <div className="bg-base-100 rounded-lg shadow-md p-6">
          {/* Progress Steps */}
          <div className="mb-8">
            <ul className="steps steps-horizontal w-full">
              <li
                className={`step ${getStepStatus(1) === "completed" || getStepStatus(1) === "active" ? "step-primary" : ""}`}
              >
                <div className="flex flex-col items-center gap-1">
                  <User
                    className={
                      getStepStatus(1) === "completed" ? "text-primary" : ""
                    }
                    size={20}
                  />
                  <span className="text-xs md:text-sm font-medium">
                    Identify
                  </span>
                </div>
              </li>
              <li
                className={`step ${getStepStatus(2) === "completed" || getStepStatus(2) === "active" ? "step-primary" : ""}`}
              >
                <div className="flex flex-col items-center gap-1">
                  <FileText
                    className={
                      getStepStatus(2) === "completed" ? "text-primary" : ""
                    }
                    size={20}
                  />
                  <span className="text-xs md:text-sm font-medium">
                    Due Type
                  </span>
                </div>
              </li>
              <li
                className={`step ${getStepStatus(3) === "completed" || getStepStatus(3) === "active" ? "step-primary" : ""}`}
              >
                <div className="flex flex-col items-center gap-1">
                  <CreditCard
                    className={
                      getStepStatus(3) === "completed" ? "text-primary" : ""
                    }
                    size={20}
                  />
                  <span className="text-xs md:text-sm font-medium">
                    Details
                  </span>
                </div>
              </li>
              <li
                className={`step ${getStepStatus(4) === "active" || getStepStatus(4) === "completed" ? "step-primary" : ""}`}
              >
                <div className="flex flex-col items-center gap-1">
                  <CheckCircle2
                    className={
                      getStepStatus(4) === "completed" ? "text-primary" : ""
                    }
                    size={20}
                  />
                  <span className="text-xs md:text-sm font-medium">Review</span>
                </div>
              </li>
            </ul>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Step 1: Student/Faculty Identification */}
            {currentStep === 1 && (
              <div className="space-y-6 animate-fadeIn">
                <div className="flex items-center gap-3 mb-6">
                  <div className="bg-primary text-primary-content rounded-full p-3">
                    <User size={24} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-primary">
                      Step 1: Identify {isForFaculty ? "Faculty" : "Student"}
                    </h3>
                    <p className="text-base-content/70">
                      Enter the {isForFaculty ? "employee code" : "roll number"}{" "}
                      to continue
                    </p>
                  </div>
                </div>

                <div className="form-control max-w-md">
                  <label className="label mb-3">
                    <span className="label-text font-semibold text-lg">
                      {isForFaculty ? "Employee Code" : "Roll Number"} *
                    </span>
                  </label>
                  <input
                    type="text"
                    placeholder={
                      isForFaculty ? "e.g., EMP0001" : "e.g., 21B81A0501"
                    }
                    className="input input-bordered input-lg border-2 focus:border-primary"
                    value={rollNumber}
                    onChange={(e) =>
                      setRollNumber(e.target.value.toUpperCase())
                    }
                    autoFocus
                  />
                  <label className="label">
                    <span className="label-text-alt text-gray-500">
                      {isForFaculty
                        ? "Enter the unique employee code"
                        : "Enter the student's roll number"}
                    </span>
                  </label>
                  {lookupStatus === "loading" && (
                    <div className="mt-1 flex items-center gap-2 text-sm text-info">
                      <span className="loading loading-spinner loading-xs" />
                      Looking up {isForFaculty ? "faculty" : "student"}...
                    </div>
                  )}
                  {lookupStatus === "found" && personLookup && (
                    <div className="mt-1 text-sm text-success">
                      {isForFaculty ? "Faculty Name" : "Student Name"}:{" "}
                      <span className="font-semibold">{personLookup.name}</span>
                      {personLookup.department_name && (
                        <span> • {personLookup.department_name}</span>
                      )}
                      {personLookup.branch && (
                        <span>
                          {personLookup.section
                            ? ` • ${personLookup.branch}-${personLookup.section}`
                            : ` • ${personLookup.branch}`}
                        </span>
                      )}
                    </div>
                  )}
                  {lookupStatus === "not_found" && (
                    <div className="mt-1 text-sm text-error">
                      {isForFaculty ? "Faculty" : "Student"} not found for{" "}
                      {rollNumber.trim()}.
                    </div>
                  )}
                  {lookupStatus === "error" && (
                    <div className="mt-1 text-sm text-error">
                      Unable to fetch {isForFaculty ? "faculty" : "student"}{" "}
                      details. Please try again.
                    </div>
                  )}
                </div>

                <div className="alert alert-info">
                  <AlertCircle size={20} />
                  <span>
                    Make sure the{" "}
                    {isForFaculty ? "employee code" : "roll number"} is correct.
                    A notification will be sent to their registered mobile
                    number.
                  </span>
                </div>
              </div>
            )}

            {/* Step 2: Due Type Selection */}
            {currentStep === 2 && (
              <div className="space-y-6 animate-fadeIn">
                <div className="flex items-center gap-3 mb-6">
                  <div className="bg-primary text-primary-content rounded-full p-3">
                    <FileText size={24} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-primary">
                      Step 2: Select Due Type
                    </h3>
                    <p className="text-base-content/70">
                      Choose the type of due and payment method
                    </p>
                  </div>
                </div>

                <div className="grid gap-6">
                  <div className="form-control">
                    <label className="label mb-3">
                      <span className="label-text font-semibold text-lg">
                        Due Type *
                      </span>
                    </label>
                    <select
                      className="select select-bordered select-lg border-2 focus:border-primary"
                      value={selectedDueType}
                      onChange={(e) => {
                        setSelectedDueType(e.target.value);
                        setNeedsOriginal(null);
                        setNeedsPdf(null);
                      }}
                      required
                    >
                      <option value="">-- Select a Due Type --</option>
                      {filteredDueTypes.map((dt) => (
                        <option key={dt.id} value={dt.id}>
                          {dt.type_name}
                        </option>
                      ))}
                    </select>
                    {selectedDueTypeObj && (
                      <label className="label">
                        <span className="label-text-alt text-gray-600 bg-base-200 p-2 rounded mt-1">
                          ℹ️ {selectedDueTypeObj.description}
                        </span>
                      </label>
                    )}
                  </div>

                  <div className="form-control">
                    <label className="label mb-3">
                      <span className="label-text font-semibold text-lg">
                        Payment Type *
                      </span>
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <label
                        className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                          isPayable === true
                            ? "border-primary bg-primary/10"
                            : "border-base-300 hover:border-primary/50"
                        }`}
                      >
                        <input
                          type="radio"
                          name="payable"
                          className="radio radio-primary hidden"
                          checked={isPayable === true}
                          onChange={() => {
                            setIsPayable(true);
                            setNeedsOriginal(null);
                            setNeedsPdf(null);
                          }}
                        />
                        <div className="flex flex-col items-center gap-2">
                          <CreditCard
                            size={32}
                            className={
                              isPayable === true
                                ? "text-primary"
                                : "text-base-content/50"
                            }
                          />
                          <span className="font-semibold">Payable</span>
                          <span className="text-xs text-center text-base-content/70">
                            Requires payment
                          </span>
                        </div>
                      </label>

                      <label
                        className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                          isPayable === false
                            ? "border-primary bg-primary/10"
                            : "border-base-300 hover:border-primary/50"
                        }`}
                      >
                        <input
                          type="radio"
                          name="payable"
                          className="radio radio-primary hidden"
                          checked={isPayable === false}
                          onChange={() => {
                            setIsPayable(false);
                            setAmount("");
                            setIsCompounded(null);
                          }}
                        />
                        <div className="flex flex-col items-center gap-2">
                          <FileText
                            size={32}
                            className={
                              isPayable === false
                                ? "text-primary"
                                : "text-base-content/50"
                            }
                          />
                          <span className="font-semibold">Non-Payable</span>
                          <span className="text-xs text-center text-base-content/70">
                            Document/task based
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="form-control">
                    <label className="label mb-3">
                      <span className="label-text font-semibold text-lg">
                        Additional Description (Optional)
                      </span>
                    </label>
                    <textarea
                      className="textarea textarea-bordered border-2 focus:border-primary h-24"
                      placeholder="Add any additional details about this due..."
                      value={dueDescription}
                      onChange={(e) => setDueDescription(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Payment/Document Details */}
            {currentStep === 3 && (
              <div className="space-y-6 animate-fadeIn">
                <div className="flex items-center gap-3 mb-6">
                  <div className="bg-primary text-primary-content rounded-full p-3">
                    <CreditCard size={24} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-primary">
                      Step 3: {isPayable ? "Payment" : "Document"} Details
                    </h3>
                    <p className="text-base-content/70">
                      Specify the{" "}
                      {isPayable
                        ? "amount and payment terms"
                        : "document requirements"}
                    </p>
                  </div>
                </div>

                <div className="grid gap-6">
                  {isPayable === true ? (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="form-control">
                          <label className="label mb-3">
                            <span className="label-text font-semibold text-lg">
                              Amount (₹) *
                            </span>
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            className="input input-bordered input-lg border-2 focus:border-primary"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            required
                          />
                        </div>

                        <div className="form-control">
                          <label className="label mb-3">
                            <span className="label-text font-semibold text-lg">
                              Due Date *
                            </span>
                          </label>
                          <input
                            type="date"
                            className="input input-bordered input-lg border-2 focus:border-primary"
                            value={dueDate}
                            onChange={(e) => setDueDate(e.target.value)}
                            min={new Date().toISOString().split("T")[0]}
                            required
                          />
                        </div>
                      </div>

                      <div className="form-control">
                        <label className="label mb-3">
                          <span className="label-text font-semibold text-lg">
                            Interest Compounding *
                          </span>
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <label
                            className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                              isCompounded === true
                                ? "border-primary bg-primary/10"
                                : "border-base-300 hover:border-primary/50"
                            }`}
                          >
                            <input
                              type="radio"
                              name="compounded"
                              className="radio radio-primary hidden"
                              checked={isCompounded === true}
                              onChange={() => setIsCompounded(true)}
                            />
                            <div className="flex items-center justify-center gap-2">
                              <span className="font-semibold">Yes</span>
                              <span className="text-xs text-base-content/70">
                                (Interest will apply)
                              </span>
                            </div>
                          </label>

                          <label
                            className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                              isCompounded === false
                                ? "border-primary bg-primary/10"
                                : "border-base-300 hover:border-primary/50"
                            }`}
                          >
                            <input
                              type="radio"
                              name="compounded"
                              className="radio radio-primary hidden"
                              checked={isCompounded === false}
                              onChange={() => setIsCompounded(false)}
                            />
                            <div className="flex items-center justify-center gap-2">
                              <span className="font-semibold">No</span>
                              <span className="text-xs text-base-content/70">
                                (Fixed amount)
                              </span>
                            </div>
                          </label>
                        </div>
                      </div>

                      {/* Interest Rate Field - Conditionally shown when compounded */}
                      {isCompounded === true && (
                        <div className="form-control">
                          <label className="label">
                            <span className="label-text font-semibold text-lg">
                              Interest Rate (Daily) *
                            </span>
                          </label>
                          <input
                            type="number"
                            step="0.0001"
                            min="0"
                            max="1"
                            className="input input-bordered input-lg border-2 focus:border-primary"
                            placeholder="e.g., 0.001 for 0.1% daily"
                            value={interestRate}
                            onChange={(e) => setInterestRate(e.target.value)}
                            required
                          />
                          <label className="label">
                            <span className="label-text-alt text-base-content/70">
                              Enter as decimal (0.001 = 0.1% daily interest)
                            </span>
                          </label>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="form-control">
                        <label className="label">
                          <span className="label-text font-semibold text-lg">
                            Due Date *
                          </span>
                        </label>
                        <input
                          type="date"
                          className="input input-bordered input-lg border-2 focus:border-primary"
                          value={dueDate}
                          onChange={(e) => setDueDate(e.target.value)}
                          min={new Date().toISOString().split("T")[0]}
                          required
                        />
                      </div>

                      {isDocumentationType && (
                        <div className="form-control">
                          <label className="label mb-3">
                            <span className="label-text font-semibold text-lg">
                              Document Type Required *
                            </span>
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <label
                              className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                                needsOriginal === true
                                  ? "border-primary bg-primary/10"
                                  : "border-base-300 hover:border-primary/50"
                              }`}
                            >
                              <input
                                type="radio"
                                name="documentType"
                                className="radio radio-primary hidden"
                                checked={needsOriginal === true}
                                onChange={() => {
                                  setNeedsOriginal(true);
                                  setNeedsPdf(false);
                                }}
                              />
                              <div className="flex flex-col items-center gap-2">
                                <FileText
                                  size={28}
                                  className={
                                    needsOriginal === true
                                      ? "text-primary"
                                      : "text-base-content/50"
                                  }
                                />
                                <span className="font-semibold">
                                  Original Document
                                </span>
                              </div>
                            </label>

                            <label
                              className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                                needsPdf === true
                                  ? "border-primary bg-primary/10"
                                  : "border-base-300 hover:border-primary/50"
                              }`}
                            >
                              <input
                                type="radio"
                                name="documentType"
                                className="radio radio-primary hidden"
                                checked={needsPdf === true}
                                onChange={() => {
                                  setNeedsOriginal(false);
                                  setNeedsPdf(true);
                                }}
                              />
                              <div className="flex flex-col items-center gap-2">
                                <FileSpreadsheet
                                  size={28}
                                  className={
                                    needsPdf === true
                                      ? "text-primary"
                                      : "text-base-content/50"
                                  }
                                />
                                <span className="font-semibold">
                                  PDF Document
                                </span>
                              </div>
                            </label>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  <div className="form-control">
                    <label className="label mb-3">
                      <span className="label-text font-semibold text-lg">
                        Proof/Supporting Document Link (Optional)
                      </span>
                    </label>
                    <div className="join w-full">
                      <span className="join-item flex items-center bg-base-200 px-4">
                        <LinkIcon size={20} />
                      </span>
                      <input
                        type="url"
                        placeholder="https://drive.google.com/..."
                        className="input input-bordered input-lg border-2 focus:border-primary join-item flex-1"
                        value={proofLink}
                        onChange={(e) => setProofLink(e.target.value)}
                      />
                    </div>
                    <label className="label">
                      <span className="label-text-alt text-gray-500">
                        Google Drive, OneDrive, or any accessible link
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Review & Submit */}
            {currentStep === 4 && (
              <div className="space-y-6 animate-fadeIn">
                <div className="flex items-center gap-3 mb-6">
                  <div className="bg-primary text-primary-content rounded-full p-3">
                    <CheckCircle2 size={24} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-primary">
                      Step 4: Review & Confirm
                    </h3>
                    <p className="text-base-content/70">
                      Please verify all details before submitting
                    </p>
                  </div>
                </div>

                <div className="bg-base-200 rounded-lg p-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-base-100 p-4 rounded-lg">
                      <p className="text-sm text-base-content/70 mb-1">
                        {isForFaculty ? "Employee Code" : "Roll Number"}
                      </p>
                      <p className="text-lg font-bold">{rollNumber}</p>
                    </div>

                    <div className="bg-base-100 p-4 rounded-lg">
                      <p className="text-sm text-base-content/70 mb-1">
                        Due Type
                      </p>
                      <p className="text-lg font-bold">
                        {selectedDueTypeObj?.type_name}
                      </p>
                    </div>

                    <div className="bg-base-100 p-4 rounded-lg">
                      <p className="text-sm text-base-content/70 mb-1">
                        Payment Type
                      </p>
                      <p className="text-lg font-bold">
                        {isPayable ? "Payable" : "Non-Payable"}
                      </p>
                    </div>

                    {isPayable && (
                      <>
                        <div className="bg-base-100 p-4 rounded-lg">
                          <p className="text-sm text-base-content/70 mb-1">
                            Amount
                          </p>
                          <p className="text-lg font-bold text-primary">
                            ₹{amount}
                          </p>
                        </div>

                        <div className="bg-base-100 p-4 rounded-lg">
                          <p className="text-sm text-base-content/70 mb-1">
                            Interest Compounded
                          </p>
                          <p className="text-lg font-bold">
                            {isCompounded ? "Yes" : "No"}
                          </p>
                        </div>

                        {isCompounded && interestRate && (
                          <div className="bg-base-100 p-4 rounded-lg">
                            <p className="text-sm text-base-content/70 mb-1">
                              Interest Rate (Daily)
                            </p>
                            <p className="text-lg font-bold text-accent">
                              {(parseFloat(interestRate) * 100).toFixed(4)}%
                            </p>
                            <p className="text-xs text-base-content/50 mt-1">
                              Decimal: {interestRate}
                            </p>
                          </div>
                        )}
                      </>
                    )}

                    {!isPayable && isDocumentationType && (
                      <div className="bg-base-100 p-4 rounded-lg">
                        <p className="text-sm text-base-content/70 mb-1">
                          Document Type
                        </p>
                        <p className="text-lg font-bold">
                          {needsOriginal
                            ? "Original"
                            : needsPdf
                              ? "PDF"
                              : "Not specified"}
                        </p>
                      </div>
                    )}

                    <div className="bg-base-100 p-4 rounded-lg">
                      <p className="text-sm text-base-content/70 mb-1">
                        Due Date
                      </p>
                      <p className="text-lg font-bold">
                        {new Date(dueDate).toLocaleDateString("en-IN", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                  </div>

                  {dueDescription && (
                    <div className="bg-base-100 p-4 rounded-lg">
                      <p className="text-sm text-base-content/70 mb-1">
                        Description
                      </p>
                      <p className="text-base">{dueDescription}</p>
                    </div>
                  )}

                  {proofLink && (
                    <div className="bg-base-100 p-4 rounded-lg">
                      <p className="text-sm text-base-content/70 mb-1">
                        Proof Link
                      </p>
                      <a
                        href={proofLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-base link link-primary"
                      >
                        {proofLink}
                      </a>
                    </div>
                  )}
                </div>

                <div className="alert alert-warning">
                  <AlertCircle size={20} />
                  <div>
                    <p className="font-semibold">Important Notice</p>
                    <p className="text-sm">
                      Once submitted, a notification will be sent to the{" "}
                      {isForFaculty ? "faculty's" : "student's"} registered
                      mobile number. Please ensure all information is accurate.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-8 pt-6 border-t">
              <button
                type="button"
                onClick={goToPreviousStep}
                className={`btn btn-outline gap-2 ${currentStep === 1 ? "invisible" : ""}`}
                disabled={currentStep === 1}
              >
                <ChevronLeft size={20} />
                Previous
              </button>

              {currentStep < 4 ? (
                <button
                  type="button"
                  onClick={goToNextStep}
                  className="btn btn-primary gap-2"
                >
                  Next
                  <ChevronRight size={20} />
                </button>
              ) : (
                <button
                  type="submit"
                  className={`btn btn-primary btn-lg gap-2 ${loading ? "loading" : ""}`}
                  disabled={loading}
                >
                  {!loading && <CheckCircle2 size={24} />}
                  <span>Add Due</span>
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Bulk Upload Section */}
        <div className="bg-base-100 rounded-lg shadow-md p-6">
          <h3 className="text-2xl font-bold text-primary mb-6">
            Bulk Upload via Excel
          </h3>

          <div className="space-y-4">
            <div className="alert alert-warning">
              <AlertCircle size={20} />
              <div>
                <p className="font-semibold">Important:</p>
                <ul className="list-disc list-inside text-sm mt-2">
                  <li>Download the template and fill in your data</li>
                  <li>Do not modify the template column headers</li>
                  <li>
                    Check the <strong>Due Types Reference</strong> sheet in the
                    template for valid Due Type IDs
                  </li>
                  <li>Ensure all required fields are filled</li>
                  <li>Review the preview table before submitting</li>
                </ul>
              </div>
            </div>

            <div className="flex gap-4 flex-wrap">
              <button onClick={downloadTemplate} className="btn btn-info gap-2">
                <Download size={20} />
                Download Template
              </button>

              <button
                className="btn btn-primary gap-2"
                onClick={() => fileRef.current?.click()}
              >
                <Upload size={20} />
                Upload Excel
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFileUpload}
              />

              {bulkRows.length > 0 && (
                <button
                  className="btn btn-ghost btn-sm gap-1 text-error self-center"
                  onClick={() => setBulkRows([])}
                >
                  <X size={16} />
                  Clear All
                </button>
              )}
            </div>

            {/* Preview Table */}
            {bulkRows.length > 0 && (
              <div className="space-y-4 mt-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-lg">
                    Preview ({bulkRows.length} rows)
                  </p>
                  <div className="flex gap-2 text-sm">
                    {bulkRows.some((r) => r.status === "success") && (
                      <span className="badge badge-success gap-1">
                        <CheckCircle2 size={12} />
                        {
                          bulkRows.filter((r) => r.status === "success").length
                        }{" "}
                        success
                      </span>
                    )}
                    {bulkRows.some((r) => r.status === "error") && (
                      <span className="badge badge-error gap-1">
                        <AlertCircle size={12} />
                        {
                          bulkRows.filter((r) => r.status === "error").length
                        }{" "}
                        failed
                      </span>
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto max-h-96 border rounded-lg">
                  <table className="table table-sm table-pin-rows">
                    <thead>
                      <tr className="bg-base-200">
                        <th>#</th>
                        <th>
                          {isForFaculty ? "Employee Code" : "Roll Number"}
                        </th>
                        <th>Due Type</th>
                        <th>Payment</th>
                        <th>Amount</th>
                        <th>Due Date</th>
                        <th>Description</th>
                        <th>Status</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkRows.map((row) => (
                        <tr
                          key={row.index}
                          className={
                            row.status === "success"
                              ? "bg-success/10"
                              : row.status === "error"
                                ? "bg-error/10"
                                : ""
                          }
                        >
                          <td>{row.index + 1}</td>
                          <td className="font-mono font-semibold">
                            {row.rollNumber}
                          </td>
                          <td>
                            <span className="text-xs text-base-content/60">
                              ID: {row.dueTypeId}
                            </span>
                            {row.dueTypeName && (
                              <span className="block text-xs">
                                {row.dueTypeName}
                              </span>
                            )}
                          </td>
                          <td>
                            <span
                              className={`badge badge-sm ${row.paymentType.toLowerCase() === "payable" ? "badge-warning" : "badge-info"}`}
                            >
                              {row.paymentType || "—"}
                            </span>
                          </td>
                          <td>{row.amount ? `₹${row.amount}` : "—"}</td>
                          <td className="whitespace-nowrap">{row.dueDate}</td>
                          <td className="max-w-xs truncate text-xs">
                            {row.dueDescription || "—"}
                          </td>
                          <td>
                            {row.status === "success" && (
                              <span className="badge badge-success badge-sm gap-1">
                                <CheckCircle2 size={10} />
                                OK
                              </span>
                            )}
                            {row.status === "error" && (
                              <div
                                className="tooltip tooltip-left"
                                data-tip={row.errorMsg}
                              >
                                <span className="badge badge-error badge-sm gap-1 cursor-help">
                                  <AlertCircle size={10} />
                                  Error
                                </span>
                              </div>
                            )}
                            {row.status === "pending" && (
                              <span className="badge badge-ghost badge-sm">
                                Pending
                              </span>
                            )}
                          </td>
                          <td>
                            {row.status === "pending" && (
                              <button
                                className="btn btn-ghost btn-xs text-error"
                                onClick={() => removeBulkRow(row.index)}
                                title="Remove row"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Submit button */}
                {bulkRows.some((r) => r.status === "pending") && (
                  <div className="flex justify-end">
                    <button
                      className="btn btn-primary gap-2"
                      onClick={submitBulk}
                      disabled={bulkSubmitting}
                    >
                      {bulkSubmitting ? (
                        <span className="loading loading-spinner loading-sm" />
                      ) : (
                        <Upload size={18} />
                      )}
                      Upload{" "}
                      {bulkRows.filter((r) => r.status === "pending").length}{" "}
                      Dues
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Confirmation Modal */}
        {isConfirmModalOpen && (
          <div className="modal modal-open">
            <div className="modal-box max-w-3xl">
              <h3 className="font-bold text-2xl text-primary">
                Confirm Due Addition
              </h3>
              <p className="py-2 text-base-content/70">
                Verify the details once before adding this due.
              </p>

              <div className="bg-base-200 rounded-lg p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-base-100 rounded-lg p-3">
                    <p className="text-sm text-base-content/70 mb-1">
                      {isForFaculty ? "Employee Code" : "Roll Number"}
                    </p>
                    <p className="font-bold">{rollNumber}</p>
                  </div>

                  <div className="bg-base-100 rounded-lg p-3">
                    <p className="text-sm text-base-content/70 mb-1">
                      {isForFaculty ? "Faculty Name" : "Student Name"}
                    </p>
                    <p className="font-bold">
                      {personLookup?.name || "Not available"}
                    </p>
                  </div>

                  <div className="bg-base-100 rounded-lg p-3">
                    <p className="text-sm text-base-content/70 mb-1">
                      Due Type
                    </p>
                    <p className="font-bold">
                      {selectedDueTypeObj?.type_name || "-"}
                    </p>
                  </div>

                  <div className="bg-base-100 rounded-lg p-3">
                    <p className="text-sm text-base-content/70 mb-1">
                      Payment Type
                    </p>
                    <p className="font-bold">
                      {isPayable ? "Payable" : "Non-Payable"}
                    </p>
                  </div>

                  <div className="bg-base-100 rounded-lg p-3">
                    <p className="text-sm text-base-content/70 mb-1">
                      Due Date
                    </p>
                    <p className="font-bold">
                      {new Date(dueDate).toLocaleDateString("en-IN", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>

                  {isPayable && (
                    <div className="bg-base-100 rounded-lg p-3">
                      <p className="text-sm text-base-content/70 mb-1">
                        Amount
                      </p>
                      <p className="font-bold text-primary">₹{amount}</p>
                    </div>
                  )}

                  {isPayable && (
                    <div className="bg-base-100 rounded-lg p-3">
                      <p className="text-sm text-base-content/70 mb-1">
                        Interest Compounded
                      </p>
                      <p className="font-bold">{isCompounded ? "Yes" : "No"}</p>
                    </div>
                  )}

                  {isPayable && isCompounded && interestRate && (
                    <div className="bg-base-100 rounded-lg p-3">
                      <p className="text-sm text-base-content/70 mb-1">
                        Interest Rate (Daily)
                      </p>
                      <p className="font-bold">
                        {(parseFloat(interestRate) * 100).toFixed(4)}%
                      </p>
                    </div>
                  )}

                  {!isPayable && isDocumentationType && (
                    <div className="bg-base-100 rounded-lg p-3">
                      <p className="text-sm text-base-content/70 mb-1">
                        Document Type
                      </p>
                      <p className="font-bold">
                        {needsOriginal
                          ? "Original"
                          : needsPdf
                            ? "PDF"
                            : "Not specified"}
                      </p>
                    </div>
                  )}
                </div>

                {dueDescription && (
                  <div className="bg-base-100 rounded-lg p-3">
                    <p className="text-sm text-base-content/70 mb-1">
                      Description
                    </p>
                    <p>{dueDescription}</p>
                  </div>
                )}

                {proofLink && (
                  <div className="bg-base-100 rounded-lg p-3">
                    <p className="text-sm text-base-content/70 mb-1">
                      Proof Link
                    </p>
                    <a
                      href={proofLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="link link-primary break-all"
                    >
                      {proofLink}
                    </a>
                  </div>
                )}
              </div>

              <div className="modal-action">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setIsConfirmModalOpen(false)}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={`btn btn-primary gap-2 ${loading ? "loading" : ""}`}
                  onClick={handleConfirmAddDue}
                  disabled={loading}
                >
                  {!loading && <CheckCircle2 size={18} />}
                  <span>Confirm & Add Due</span>
                </button>
              </div>
            </div>
            <div
              className="modal-backdrop"
              onClick={() => {
                if (!loading) {
                  setIsConfirmModalOpen(false);
                }
              }}
            />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AddDue;
