import {
  BookOpen,
  Briefcase,
  Eye,
  EyeOff,
  GraduationCap,
  Lock,
  type LucideIcon,
  Mail,
  ShieldCheck,
  User,
} from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import Footer from "../components/Footer";
import Header from "../components/Header";

type LoginType = "student" | "teacher" | "faculty";

type LoginOption = {
  key: LoginType;
  title: string;
  caption: string;
  description: string;
  fieldLabel: string;
  placeholder: string;
  icon: LucideIcon;
  buttonClass: string;
  toneClass: string;
  helper: string;
};

const loginOptions: Record<LoginType, LoginOption> = {
  student: {
    key: "student",
    title: "Student",
    caption: "Student Portal",
    description: "Check dues, make payments, and upload required documents.",
    fieldLabel: "Roll Number",
    placeholder: "Enter your roll number",
    icon: GraduationCap,
    buttonClass: "btn-primary",
    toneClass: "border-info/40 bg-info/10 text-info",
    helper: "Academic records, dues, and payment history",
  },
  teacher: {
    key: "teacher",
    title: "Institute User",
    caption: "Admin / HOD / Operator / HR",
    description:
      "Use your institutional email credentials to access role-specific tools.",
    fieldLabel: "Email Address",
    placeholder: "Enter your institutional email",
    icon: BookOpen,
    buttonClass: "btn-secondary",
    toneClass: "border-primary/35 bg-primary/10 text-primary",
    helper: "Department operations and institute administration",
  },
  faculty: {
    key: "faculty",
    title: "Faculty",
    caption: "Faculty Self Service",
    description: "Track your dues and submit payment proof for review.",
    fieldLabel: "Employee ID",
    placeholder: "Enter your employee ID",
    icon: Briefcase,
    buttonClass: "btn-accent",
    toneClass: "border-warning/40 bg-warning/10 text-warning",
    helper: "Personal dues and approvals workspace",
  },
};

function Login() {
  const navigate = useNavigate();

  // Auto-select login type based on portal mode (set by vite.student.config.ts / vite.teacher.config.ts)
  const portalMode = import.meta.env.VITE_PORTAL_MODE as string | undefined;
  const initialLoginType =
    portalMode === "teacher"
      ? "teacher"
      : portalMode === "student"
        ? "student"
        : "student";

  const [loginType, setLoginType] = useState<LoginType>(initialLoginType);
  const [email, setEmail] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [employeeCode, setEmployeeCode] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
  }, [loginType]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: loginType === "teacher" ? email.trim() : undefined,
          rollNumber:
            loginType === "student"
              ? rollNumber.trim().toUpperCase()
              : undefined,
          employeeCode:
            loginType === "faculty"
              ? employeeCode.trim().toUpperCase()
              : undefined,
          password,
          loginType,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.message || "Invalid credentials");
      }

      if (!data.success) {
        throw new Error(data.message || "Login failed");
      }

      const userData = data.data;
      localStorage.setItem("user", JSON.stringify(userData));

      toast.success("Login successful!");

      setTimeout(() => {
        switch (userData.role) {
          case "admin":
            navigate("/admin/dashboard");
            break;
          case "hod":
            navigate("/hod/dashboard");
            break;
          case "operator":
            navigate("/operator/dashboard");
            break;
          case "hr":
            navigate("/hr/dashboard");
            break;
          case "faculty":
            navigate("/faculty/dashboard");
            break;
          case "student":
            navigate("/student/dashboard");
            break;
          default:
            navigate("/admin/dashboard");
        }
      }, 500);
    } catch (err) {
      console.error("Login error:", err);
      const errorMessage =
        err instanceof Error
          ? err.message
          : loginType === "student"
            ? "Invalid roll number or password"
            : loginType === "faculty"
              ? "Invalid employee ID or password"
              : "Invalid email or password";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const activeOption = useMemo(() => loginOptions[loginType], [loginType]);

  return (
    <>
      <Toaster position="top-right" />
      <Header />

      <div className="min-h-[calc(100vh-4rem)] px-4 pb-16 pt-8 sm:px-6 sm:pt-10">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1.12fr_0.88fr]">
          <section className="official-surface official-enter p-6 sm:p-8 lg:p-10">
            <p className="official-kicker">Official Institute Access</p>
            <h1 className="official-title mt-2">NoDues Clearance Platform</h1>
            <p className="official-subtitle mt-3 max-w-2xl">
              One secure portal for students, faculty, and institute offices to
              manage dues, submit payment proof, and complete clearance
              workflows with full audit traceability.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <article className="official-surface-plain p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-base-content/60">
                  Access Model
                </p>
                <p className="mt-2 text-lg font-bold text-primary">
                  Role Based
                </p>
                <p className="mt-1 text-xs text-base-content/65">
                  Student, Faculty, and Institute office workflows
                </p>
              </article>
              <article className="official-surface-plain p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-base-content/60">
                  Security
                </p>
                <p className="mt-2 text-lg font-bold text-primary">
                  Session Protected
                </p>
                <p className="mt-1 text-xs text-base-content/65">
                  Authenticated sessions with activity monitoring
                </p>
              </article>
              <article className="official-surface-plain p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-base-content/60">
                  Compliance
                </p>
                <p className="mt-2 text-lg font-bold text-primary">
                  Audit Ready
                </p>
                <p className="mt-1 text-xs text-base-content/65">
                  Standardized records and verification history
                </p>
              </article>
            </div>

            <div className="mt-6 rounded-xl border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck size={20} className="mt-0.5 text-primary" />
                <div>
                  <p className="text-sm font-semibold text-base-content">
                    Before You Sign In
                  </p>
                  <ol className="mt-2 space-y-1 text-sm text-base-content/75">
                    <li>
                      1. Select the account category that matches your role.
                    </li>
                    <li>2. Use only institute-issued credentials.</li>
                    <li>
                      3. Contact your department office for reset requests.
                    </li>
                  </ol>
                </div>
              </div>
            </div>
          </section>

          <section className="official-surface-plain official-enter p-5 sm:p-6 lg:p-7">
            <p className="official-kicker">Sign In</p>
            <h2 className="mt-1 text-2xl font-bold text-primary">
              Account Verification
            </h2>
            <p className="mt-1 text-sm text-base-content/65">
              Choose your account type and enter your authorized credentials.
            </p>

            <div
              className="mt-5 grid gap-2 sm:grid-cols-3"
              role="radiogroup"
              aria-label="Account type"
            >
              {(Object.values(loginOptions) as LoginOption[]).map((option) => {
                const Icon = option.icon;
                const selected = loginType === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setLoginType(option.key)}
                    className={`rounded-xl border px-3 py-3 text-left transition-all ${
                      selected
                        ? `${option.toneClass} shadow-sm`
                        : "border-base-300 bg-base-100 hover:border-primary/35 hover:bg-base-200/70"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon size={17} />
                      <p className="text-sm font-semibold">{option.title}</p>
                    </div>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.1em] text-base-content/60">
                      {option.caption}
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 rounded-xl border border-base-300 bg-base-200/50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.1em] text-base-content/55 font-semibold">
                Selected Access Scope
              </p>
              <p className="mt-1 text-sm text-base-content/80">
                {activeOption.description}
              </p>
            </div>

            {error && (
              <div className="mt-4 rounded-xl border border-error/40 bg-error/10 px-4 py-3 text-sm text-error">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="mt-5 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-base-content/80">
                  {activeOption.fieldLabel}
                </label>
                <div className="relative">
                  {loginType === "teacher" ? (
                    <Mail
                      size={16}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base-content/45"
                    />
                  ) : (
                    <User
                      size={16}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base-content/45"
                    />
                  )}
                  <input
                    type={loginType === "teacher" ? "email" : "text"}
                    value={
                      loginType === "student"
                        ? rollNumber
                        : loginType === "faculty"
                          ? employeeCode
                          : email
                    }
                    onChange={(e) => {
                      if (loginType === "student") {
                        setRollNumber(e.target.value.toUpperCase());
                      } else if (loginType === "faculty") {
                        setEmployeeCode(e.target.value.toUpperCase());
                      } else {
                        setEmail(e.target.value);
                      }
                    }}
                    className="input input-bordered h-12 w-full pl-10"
                    placeholder={activeOption.placeholder}
                    autoComplete={
                      loginType === "teacher" ? "email" : "username"
                    }
                    required
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-base-content/80">
                  Password
                </label>
                <div className="relative">
                  <Lock
                    size={16}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base-content/45"
                  />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input input-bordered h-12 w-full pl-10 pr-12"
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/55 hover:text-base-content"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-base-300 bg-base-200/60 px-3 py-2 text-xs text-base-content/65">
                Need help with credentials? Contact your institute admin,
                operator, or department office for reset support.
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`btn h-12 w-full ${activeOption.buttonClass} text-white`}
              >
                {loading
                  ? "Signing in..."
                  : `Continue as ${activeOption.title}`}
              </button>
            </form>
          </section>
        </div>
      </div>
      <Footer />
    </>
  );
}

export default Login;
