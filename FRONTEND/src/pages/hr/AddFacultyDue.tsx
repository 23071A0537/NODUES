import { ArrowLeft, ArrowRight, Check, Search, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import * as XLSX from "xlsx";
import DashboardLayout from "../../components/DashboardLayout";

interface Faculty {
  id: number;
  employee_code: string;
  name: string;
  department_name: string;
  section_name: string;
  designation: string;
  email: string;
}

interface DueType {
  id: number;
  type_name: string;
  is_payable: boolean;
}

interface BulkRow {
  index: number;
  employee_code: string;
  due_type_id: number | string;
  is_payable: boolean;
  current_amount: string;
  due_description: string;
  due_clear_by_date: string;
  status?: "pending" | "success" | "error";
  errorMsg?: string;
}

const AddFacultyDue = () => {
  const [mode, setMode] = useState<"single" | "bulk">("single");

  // Single mode state
  const [step, setStep] = useState(1);
  const [empCodeInput, setEmpCodeInput] = useState("");
  const [faculty, setFaculty] = useState<Faculty | null>(null);
  const [dueTypes, setDueTypes] = useState<DueType[]>([]);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    due_type_id: "",
    is_payable: true,
    current_amount: "",
    principal_amount: "",
    interest_rate: "",
    is_compounded: false,
    due_description: "",
    due_clear_by_date: "",
    needs_original: false,
    needs_pdf: false,
    remarks: "",
  });

  // Bulk mode state
  const fileRef = useRef<HTMLInputElement>(null);
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([]);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  const userData = JSON.parse(localStorage.getItem("user") || "{}");
  const user = {
    username: userData.name || userData.username || "HR",
    email: userData.email || "",
    role: "hr" as const,
  };

  useEffect(() => {
    fetch("/api/hr/due-types", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setDueTypes(d.data);
      })
      .catch(() => {});
  }, []);

  const searchFaculty = async () => {
    const code = empCodeInput.trim().toUpperCase();
    if (!code) return toast.error("Enter an employee code");
    setSearching(true);
    try {
      const res = await fetch(`/api/hr/check/${code}`, {
        credentials: "include",
      });
      const data = await res.json();
      if (data.success && data.data.faculty) {
        setFaculty(data.data.faculty);
        setStep(2);
      } else {
        toast.error(data.message || "Faculty not found");
        setFaculty(null);
      }
    } catch {
      toast.error("Error searching faculty");
    } finally {
      setSearching(false);
    }
  };

  const submitSingle = async () => {
    if (!faculty) return;
    if (!form.due_type_id) return toast.error("Select a due type");
    if (form.is_payable && !form.current_amount)
      return toast.error("Enter the amount");
    if (!form.due_clear_by_date) return toast.error("Select a clear-by date");

    setSubmitting(true);
    try {
      const res = await fetch("/api/hr/dues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          employee_code: faculty.employee_code,
          due_type_id: Number(form.due_type_id),
          is_payable: form.is_payable,
          current_amount: form.current_amount
            ? Number(form.current_amount)
            : null,
          principal_amount: form.principal_amount
            ? Number(form.principal_amount)
            : null,
          interest_rate: form.interest_rate ? Number(form.interest_rate) : null,
          is_compounded: form.is_compounded,
          due_description: form.due_description,
          due_clear_by_date: form.due_clear_by_date,
          needs_original: form.needs_original,
          needs_pdf: form.needs_pdf,
          remarks: form.remarks,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Faculty due added successfully");
        setStep(3);
      } else {
        toast.error(data.message || "Failed to add due");
      }
    } catch {
      toast.error("Error adding due");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setStep(1);
    setFaculty(null);
    setEmpCodeInput("");
    setForm({
      due_type_id: "",
      is_payable: true,
      current_amount: "",
      principal_amount: "",
      interest_rate: "",
      is_compounded: false,
      due_description: "",
      due_clear_by_date: "",
      needs_original: false,
      needs_pdf: false,
      remarks: "",
    });
  };

  // Bulk helpers
  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      [
        "employee_code",
        "due_type_id",
        "is_payable",
        "current_amount",
        "due_description",
        "due_clear_by_date",
      ],
      ["EMP001", "1", "true", "500", "Library fine", "2025-06-30"],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "faculty_due_bulk_template.xlsx");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const wb = XLSX.read(ev.target?.result, { type: "binary" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(ws, {
        defval: "",
      });
      const mapped: BulkRow[] = rows.map((r, i) => ({
        index: i,
        employee_code: String(r.employee_code || "").toUpperCase(),
        due_type_id: r.due_type_id || "",
        is_payable: String(r.is_payable).toLowerCase() !== "false",
        current_amount: String(r.current_amount || ""),
        due_description: String(r.due_description || ""),
        due_clear_by_date: String(r.due_clear_by_date || ""),
        status: "pending",
      }));
      setBulkRows(mapped);
    };
    reader.readAsBinaryString(file);
  };

  const submitBulk = async () => {
    if (bulkRows.length === 0) return toast.error("Upload a file first");
    setBulkSubmitting(true);
    try {
      const res = await fetch("/api/hr/dues/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          dues: bulkRows.map((r) => ({
            employee_code: r.employee_code,
            due_type_id: Number(r.due_type_id),
            is_payable: r.is_payable,
            current_amount: r.current_amount ? Number(r.current_amount) : null,
            due_description: r.due_description,
            due_clear_by_date: r.due_clear_by_date,
          })),
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(
          `Added ${data.data.successCount} dues. ${data.data.errors?.length || 0} errors.`,
        );
        const errSet = new Set<number>(
          (data.data.errors || []).map((e: { index: number }) => e.index),
        );
        setBulkRows((prev) =>
          prev.map((r) => ({
            ...r,
            status: errSet.has(r.index) ? "error" : "success",
            errorMsg: data.data.errors?.find(
              (e: { index: number; message: string }) => e.index === r.index,
            )?.message,
          })),
        );
      } else {
        toast.error(data.message || "Bulk upload failed");
      }
    } catch {
      toast.error("Error during bulk upload");
    } finally {
      setBulkSubmitting(false);
    }
  };

  return (
    <DashboardLayout
      role={user.role}
      username={user.username}
      email={user.email}
    >
      <Toaster position="top-right" />
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Add Faculty Due</h1>
          <p className="text-base-content/60 mt-1">
            Add dues for faculty members
          </p>
        </div>

        {/* Mode tabs */}
        <div className="tabs tabs-boxed w-fit">
          <button
            className={`tab ${mode === "single" ? "tab-active" : ""}`}
            onClick={() => setMode("single")}
          >
            Single Entry
          </button>
          <button
            className={`tab ${mode === "bulk" ? "tab-active" : ""}`}
            onClick={() => setMode("bulk")}
          >
            Bulk Upload
          </button>
        </div>

        {/* ── Single Mode ── */}
        {mode === "single" && (
          <div className="card bg-base-100 shadow border border-base-200">
            <div className="card-body">
              {/* Step indicator */}
              <ul className="steps steps-horizontal w-full mb-6">
                {["Find Faculty", "Due Details", "Success"].map((label, i) => (
                  <li
                    key={label}
                    className={`step ${step > i ? "step-primary" : ""}`}
                  >
                    {label}
                  </li>
                ))}
              </ul>

              {/* Step 1: Search Faculty */}
              {step === 1 && (
                <div className="space-y-4">
                  <h2 className="font-semibold text-lg">Search Faculty</h2>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Enter Employee Code (e.g. EMP001)"
                      className="input input-bordered flex-1"
                      value={empCodeInput}
                      onChange={(e) =>
                        setEmpCodeInput(e.target.value.toUpperCase())
                      }
                      onKeyDown={(e) => e.key === "Enter" && searchFaculty()}
                    />
                    <button
                      className="btn btn-primary"
                      onClick={searchFaculty}
                      disabled={searching}
                    >
                      {searching ? (
                        <span className="loading loading-spinner loading-sm" />
                      ) : (
                        <Search size={18} />
                      )}
                      Search
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2: Due Details */}
              {step === 2 && faculty && (
                <div className="space-y-5">
                  {/* Faculty info card */}
                  <div className="alert alert-info">
                    <div>
                      <p className="font-semibold">{faculty.name}</p>
                      <p className="text-sm">
                        {faculty.employee_code} &bull; {faculty.designation}{" "}
                        &bull; {faculty.department_name}
                        {faculty.section_name
                          ? ` / ${faculty.section_name}`
                          : ""}
                      </p>
                    </div>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setStep(1)}
                    >
                      <X size={16} /> Change
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Due Type */}
                    <div className="form-control">
                      <label className="label">
                        <span className="label-text font-medium">
                          Due Type *
                        </span>
                      </label>
                      <select
                        className="select select-bordered"
                        value={form.due_type_id}
                        onChange={(e) =>
                          setForm({ ...form, due_type_id: e.target.value })
                        }
                      >
                        <option value="">Select due type...</option>
                        {dueTypes.map((dt) => (
                          <option key={dt.id} value={dt.id}>
                            {dt.type_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Payable toggle */}
                    <div className="form-control">
                      <label className="label">
                        <span className="label-text font-medium">
                          Due Category *
                        </span>
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className={`btn flex-1 ${form.is_payable ? "btn-warning" : "btn-outline btn-warning"}`}
                          onClick={() => setForm({ ...form, is_payable: true })}
                        >
                          Payable
                        </button>
                        <button
                          type="button"
                          className={`btn flex-1 ${!form.is_payable ? "btn-info" : "btn-outline btn-info"}`}
                          onClick={() =>
                            setForm({ ...form, is_payable: false })
                          }
                        >
                          Non-Payable
                        </button>
                      </div>
                    </div>

                    {/* Amount (only when payable) */}
                    {form.is_payable && (
                      <>
                        <div className="form-control">
                          <label className="label">
                            <span className="label-text font-medium">
                              Amount (₹) *
                            </span>
                          </label>
                          <input
                            type="number"
                            min="0"
                            className="input input-bordered"
                            placeholder="Enter amount"
                            value={form.current_amount}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                current_amount: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div className="form-control">
                          <label className="label">
                            <span className="label-text font-medium">
                              Principal Amount (₹)
                            </span>
                          </label>
                          <input
                            type="number"
                            min="0"
                            className="input input-bordered"
                            placeholder="Optional"
                            value={form.principal_amount}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                principal_amount: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div className="form-control">
                          <label className="label">
                            <span className="label-text font-medium">
                              Interest Rate (%)
                            </span>
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="input input-bordered"
                            placeholder="Annual rate (optional)"
                            value={form.interest_rate}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                interest_rate: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div className="form-control">
                          <label className="label cursor-pointer gap-3 justify-start">
                            <input
                              type="checkbox"
                              className="checkbox checkbox-primary"
                              checked={form.is_compounded}
                              onChange={(e) =>
                                setForm({
                                  ...form,
                                  is_compounded: e.target.checked,
                                })
                              }
                            />
                            <span className="label-text">
                              Compound Interest
                            </span>
                          </label>
                        </div>
                      </>
                    )}

                    {/* Clear by date */}
                    <div className="form-control">
                      <label className="label">
                        <span className="label-text font-medium">
                          Clear By Date *
                        </span>
                      </label>
                      <input
                        type="date"
                        className="input input-bordered"
                        value={form.due_clear_by_date}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            due_clear_by_date: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>

                  {/* Description */}
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text font-medium">
                        Description
                      </span>
                    </label>
                    <textarea
                      className="textarea textarea-bordered"
                      rows={2}
                      placeholder="Description of the due..."
                      value={form.due_description}
                      onChange={(e) =>
                        setForm({ ...form, due_description: e.target.value })
                      }
                    />
                  </div>

                  {/* Remarks */}
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text font-medium">Remarks</span>
                    </label>
                    <input
                      type="text"
                      className="input input-bordered"
                      placeholder="Optional remarks"
                      value={form.remarks}
                      onChange={(e) =>
                        setForm({ ...form, remarks: e.target.value })
                      }
                    />
                  </div>

                  {/* Document flags */}
                  <div className="flex gap-6">
                    <label className="label cursor-pointer gap-2">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-sm"
                        checked={form.needs_original}
                        onChange={(e) =>
                          setForm({ ...form, needs_original: e.target.checked })
                        }
                      />
                      <span className="label-text">Needs Original</span>
                    </label>
                    <label className="label cursor-pointer gap-2">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-sm"
                        checked={form.needs_pdf}
                        onChange={(e) =>
                          setForm({ ...form, needs_pdf: e.target.checked })
                        }
                      />
                      <span className="label-text">Needs PDF</span>
                    </label>
                  </div>

                  <div className="flex gap-3 justify-end">
                    <button
                      className="btn btn-ghost"
                      onClick={() => setStep(1)}
                    >
                      <ArrowLeft size={16} /> Back
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={submitSingle}
                      disabled={submitting}
                    >
                      {submitting ? (
                        <span className="loading loading-spinner loading-sm" />
                      ) : (
                        <ArrowRight size={16} />
                      )}
                      Submit Due
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Success */}
              {step === 3 && (
                <div className="text-center space-y-4 py-8">
                  <div className="flex justify-center">
                    <div className="bg-success/10 rounded-full p-5">
                      <Check size={48} className="text-success" />
                    </div>
                  </div>
                  <h2 className="text-xl font-semibold">
                    Due Added Successfully!
                  </h2>
                  <p className="text-base-content/60">
                    The faculty due has been recorded for {faculty?.name}.
                  </p>
                  <div className="flex gap-3 justify-center">
                    <button className="btn btn-primary" onClick={resetForm}>
                      Add Another Due
                    </button>
                    <a href="/hr/active-dues" className="btn btn-outline">
                      View Active Dues
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Bulk Mode ── */}
        {mode === "bulk" && (
          <div className="card bg-base-100 shadow border border-base-200">
            <div className="card-body space-y-4">
              <h2 className="font-semibold text-lg">
                Bulk Upload Faculty Dues
              </h2>
              <p className="text-sm text-base-content/60">
                Download the template, fill in the due data, then upload the
                Excel file.
              </p>

              <div className="flex gap-3 flex-wrap">
                <button
                  className="btn btn-outline btn-sm gap-2"
                  onClick={downloadTemplate}
                >
                  <Upload size={16} />
                  Download Template
                </button>
                <button
                  className="btn btn-outline btn-sm gap-2"
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload size={16} />
                  Upload Excel File
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </div>

              {bulkRows.length > 0 && (
                <>
                  <div className="overflow-x-auto max-h-80 border rounded-lg">
                    <table className="table table-sm">
                      <thead className="sticky top-0 bg-base-200">
                        <tr>
                          <th>#</th>
                          <th>Employee Code</th>
                          <th>Due Type ID</th>
                          <th>Payable</th>
                          <th>Amount</th>
                          <th>Description</th>
                          <th>Clear By</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bulkRows.map((r) => (
                          <tr
                            key={r.index}
                            className={
                              r.status === "success"
                                ? "bg-success/10"
                                : r.status === "error"
                                  ? "bg-error/10"
                                  : ""
                            }
                          >
                            <td>{r.index + 1}</td>
                            <td className="font-mono">{r.employee_code}</td>
                            <td>{r.due_type_id}</td>
                            <td>{r.is_payable ? "Yes" : "No"}</td>
                            <td>{r.current_amount || "—"}</td>
                            <td className="max-w-xs truncate">
                              {r.due_description}
                            </td>
                            <td>{r.due_clear_by_date}</td>
                            <td>
                              {r.status === "success" && (
                                <span className="badge badge-success badge-sm">
                                  OK
                                </span>
                              )}
                              {r.status === "error" && (
                                <span
                                  className="badge badge-error badge-sm"
                                  title={r.errorMsg}
                                >
                                  Error
                                </span>
                              )}
                              {r.status === "pending" && (
                                <span className="badge badge-ghost badge-sm">
                                  Pending
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm text-base-content/60">
                      {bulkRows.length} row(s) loaded
                    </span>
                    <button
                      className="btn btn-primary"
                      onClick={submitBulk}
                      disabled={bulkSubmitting}
                    >
                      {bulkSubmitting ? (
                        <span className="loading loading-spinner loading-sm" />
                      ) : null}
                      Upload All
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AddFacultyDue;
