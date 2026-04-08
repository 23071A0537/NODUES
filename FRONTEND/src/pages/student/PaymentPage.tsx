import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import DashboardLayout from "../../components/DashboardLayout";
import {
  formatCurrency,
  type PaymentSession,
} from "../../store/useStudentDuesStore";

type PaymentStatus = "waiting" | "processing" | "success" | "error";

const COUNTDOWN_SECONDS = 5;

const PAYMENT_STEPS = [
  {
    id: 1,
    label: "QR Code Scanned",
    sublabel: "Payment request received",
    icon: (
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
        />
      </svg>
    ),
    triggerAt: 4, // shows when timeLeft reaches 4 (after 1s)
  },
  {
    id: 2,
    label: "Bank Server Connected",
    sublabel: "Establishing secure channel",
    icon: (
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"
        />
      </svg>
    ),
    triggerAt: 3,
  },
  {
    id: 3,
    label: "UPI PIN Authenticated",
    sublabel: "Identity verified successfully",
    icon: (
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
        />
      </svg>
    ),
    triggerAt: 2,
  },
  {
    id: 4,
    label: "Debiting Amount",
    sublabel: "Processing fund transfer",
    icon: (
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
    triggerAt: 1,
  },
  {
    id: 5,
    label: "Confirming Transaction",
    sublabel: "Updating payment records",
    icon: (
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
        />
      </svg>
    ),
    triggerAt: 0,
  },
];

export default function PaymentPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [timeLeft, setTimeLeft] = useState(COUNTDOWN_SECONDS);
  const [status, setStatus] = useState<PaymentStatus>("waiting");
  const [paymentRef, setPaymentRef] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const hasProcessed = useRef(false);

  const session = (location.state as { session?: PaymentSession } | null)
    ?.session;

  // Get user data from localStorage
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

  // Redirect if no session data
  useEffect(() => {
    if (!session) {
      navigate("/student/dues", { replace: true });
    }
  }, [session, navigate]);

  // Process payment function
  const processPayment = useCallback(async () => {
    if (!session || hasProcessed.current) return;
    hasProcessed.current = true;
    setStatus("processing");

    try {
      const response = await fetch(
        `/api/payments/gateway/${session.payment_id}/process`,
        {
          method: "POST",
          credentials: "include" as RequestCredentials,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "SUCCESS" }),
        },
      );

      const result = await response.json();

      if (response.ok && result.success) {
        setPaymentRef(result.payment_reference);
        setStatus("success");
        // Redirect after showing success for 3 seconds
        setTimeout(() => {
          navigate(
            `/student/dues?payment=success&ref=${result.payment_reference}`,
            { replace: true },
          );
        }, 3000);
      } else {
        throw new Error(result.error || "Payment failed");
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Payment processing failed",
      );
      setStatus("error");
    }
  }, [session, navigate]);

  // Countdown timer + step activation
  useEffect(() => {
    if (!session || status !== "waiting") return;

    // Activate step matching current timeLeft
    const stepForThisTick = PAYMENT_STEPS.find((s) => s.triggerAt === timeLeft);
    if (stepForThisTick && !completedSteps.includes(stepForThisTick.id)) {
      setCompletedSteps((prev) => [...prev, stepForThisTick.id]);
    }

    if (timeLeft <= 0) {
      processPayment();
      return;
    }

    const timer = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft, session, status, processPayment, completedSteps]);

  if (!session) return null;

  // UPI QR code data
  const upiString = `upi://pay?pa=nodues@vnrvjiet&pn=VNRVJIET%20NoDues&am=${session.total_amount.toFixed(2)}&cu=INR&tn=DuePayment-${session.payment_id.substring(0, 8)}`;

  return (
    <DashboardLayout
      role={user.role}
      username={user.username}
      email={user.email}
    >
      <div className="min-h-[80vh] bg-base-200 flex items-center justify-center p-4">
        <div className="max-w-lg w-full">
          {/* ===== WAITING STATE — UPI Payment Screen ===== */}
          {status === "waiting" && (
            <div className="card bg-base-100 shadow-2xl overflow-hidden official-enter">
              {/* Header */}
              <div
                className="px-6 py-4"
                style={{
                  background:
                    "linear-gradient(128deg, var(--edu-primary) 0%, var(--edu-secondary) 100%)",
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-white/60 uppercase tracking-widest">
                      VNRVJIET · NoDues Portal
                    </p>
                    <h2 className="text-lg font-bold text-white mt-0.5">
                      UPI Payment
                    </h2>
                  </div>
                  <div className="bg-white/20 rounded-xl px-3 py-1.5 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span className="text-xs font-semibold text-white">
                      DEMO
                    </span>
                  </div>
                </div>
              </div>

              <div className="card-body p-5">
                {/* QR + Amount row */}
                <div className="flex flex-col sm:flex-row gap-4 items-start">
                  {/* QR Code with scan animation */}
                  <div className="relative flex-shrink-0">
                    <div className="bg-white p-3 rounded-xl shadow border border-base-300 relative overflow-hidden">
                      <QRCodeSVG
                        value={upiString}
                        size={150}
                        bgColor="#ffffff"
                        fgColor="#1e1b4b"
                        level="M"
                        includeMargin={false}
                      />
                      {/* Scan line animation */}
                      <div
                        className="absolute left-0 right-0 h-0.5 opacity-80"
                        style={{
                          animation: "scanLine 2s linear infinite",
                          background:
                            "linear-gradient(90deg, transparent 0%, var(--edu-primary) 50%, transparent 100%)",
                          top: "0%",
                        }}
                      />
                    </div>
                    {/* UPI apps hint */}
                    <p className="text-center text-xs text-base-content/40 mt-1.5">
                      GPay · PhonePe · Paytm
                    </p>
                  </div>

                  {/* Amount + VPA */}
                  <div className="flex-1 min-w-0">
                    <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3 mb-3">
                      <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">
                        Amount
                      </p>
                      <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5 leading-none">
                        {formatCurrency(session.total_amount)}
                      </p>
                    </div>

                    <div className="bg-base-200 rounded-xl p-3">
                      <p className="text-xs text-base-content/50 mb-0.5">
                        Pay to VPA
                      </p>
                      <p className="text-sm font-mono font-semibold text-base-content truncate">
                        nodues@vnrvjiet
                      </p>
                      <p className="text-xs text-base-content/40 mt-0.5 truncate">
                        VNRVJIET NoDues Portal
                      </p>
                    </div>
                  </div>
                </div>

                {/* Due items */}
                <div className="mt-3">
                  <p className="text-xs font-semibold text-base-content/50 uppercase tracking-wide mb-2">
                    {session.due_items.length === 1
                      ? "1 Item"
                      : `${session.due_items.length} Items`}
                  </p>
                  <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                    {session.due_items.map((item) => (
                      <div
                        key={item.id}
                        className="flex justify-between items-center text-sm bg-base-200 rounded-lg px-3 py-2"
                      >
                        <span className="text-base-content/70 truncate mr-2 text-xs">
                          {item.type_name}
                        </span>
                        <span className="font-semibold text-base-content text-xs whitespace-nowrap">
                          {formatCurrency(item.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Payment Steps */}
                <div className="mt-4 border border-base-300 rounded-xl p-3 bg-base-50 dark:bg-base-200/50">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-base-content/60 uppercase tracking-wide">
                      Payment Progress
                    </p>
                    {/* Circular countdown */}
                    <div className="relative w-9 h-9">
                      <svg className="w-9 h-9 -rotate-90" viewBox="0 0 36 36">
                        <circle
                          cx="18"
                          cy="18"
                          r="15"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          className="text-base-300"
                        />
                        <circle
                          cx="18"
                          cy="18"
                          r="15"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          className="text-primary"
                          strokeDasharray={2 * Math.PI * 15}
                          strokeDashoffset={
                            2 * Math.PI * 15 * (timeLeft / COUNTDOWN_SECONDS)
                          }
                          strokeLinecap="round"
                          style={{ transition: "stroke-dashoffset 1s linear" }}
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-primary">
                        {timeLeft}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {PAYMENT_STEPS.map((step) => {
                      const isDone = completedSteps.includes(step.id);
                      const isActive =
                        isDone && step.id === Math.max(...completedSteps);

                      return (
                        <div
                          key={step.id}
                          className={`flex items-center gap-2.5 transition-all duration-500 ${
                            isDone ? "opacity-100" : "opacity-30"
                          }`}
                        >
                          {/* Step icon circle */}
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-500 ${
                              isDone
                                ? isActive
                                  ? "bg-base-200 text-primary ring-2 ring-primary ring-offset-1 ring-offset-base-100"
                                  : "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400"
                                : "bg-base-300 text-base-content/30"
                            }`}
                          >
                            {isDone && !isActive ? (
                              <svg
                                className="w-3.5 h-3.5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={3}
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            ) : (
                              step.icon
                            )}
                          </div>

                          {/* Label */}
                          <div className="min-w-0">
                            <p
                              className={`text-xs font-semibold leading-tight ${
                                isActive
                                  ? "text-primary"
                                  : isDone
                                    ? "text-emerald-700 dark:text-emerald-400"
                                    : "text-base-content/30"
                              }`}
                            >
                              {step.label}
                            </p>
                            {isActive && (
                              <p className="text-xs text-base-content/40 leading-tight mt-0.5">
                                {step.sublabel}
                              </p>
                            )}
                          </div>

                          {/* Active spinner */}
                          {isActive && (
                            <div className="ml-auto flex-shrink-0">
                              <div className="loading loading-spinner loading-xs text-primary" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Demo notice */}
                <p className="text-center text-xs text-base-content/30 mt-3">
                  Demo mode — payment auto-confirms
                </p>
              </div>
            </div>
          )}

          {/* ===== PROCESSING STATE ===== */}
          {status === "processing" && (
            <div className="card bg-base-100 shadow-2xl">
              <div className="card-body items-center text-center py-16">
                <div className="w-20 h-20 rounded-full bg-base-200 flex items-center justify-center mb-4">
                  <div className="loading loading-spinner loading-lg text-primary" />
                </div>
                <h2 className="text-xl font-bold mb-1">Processing Payment</h2>
                <p className="text-base-content/50 text-sm">
                  Updating your dues — please wait
                </p>
                <div className="flex gap-1.5 mt-5">
                  {[0, 150, 300].map((delay) => (
                    <div
                      key={delay}
                      className="w-2 h-2 rounded-full bg-primary animate-bounce"
                      style={{ animationDelay: `${delay}ms` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ===== SUCCESS STATE ===== */}
          {status === "success" && (
            <div className="card bg-base-100 shadow-2xl overflow-hidden">
              <div className="bg-gradient-to-br from-emerald-500 to-teal-500 px-6 py-8 text-center">
                <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-10 h-10 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-white">
                  Payment Successful
                </h2>
                <p className="text-white/80 mt-1 text-sm">
                  {formatCurrency(session.total_amount)} paid to VNRVJIET
                </p>
              </div>

              <div className="card-body p-5">
                {/* Transaction Reference */}
                <div className="bg-base-200 rounded-xl p-4 mb-3">
                  <p className="text-xs text-base-content/50 uppercase tracking-wide mb-1">
                    Transaction Reference
                  </p>
                  <p className="font-mono text-sm font-semibold text-base-content break-all">
                    {paymentRef}
                  </p>
                </div>

                {/* Items Paid */}
                <div className="bg-base-200 rounded-xl p-4 mb-4">
                  <p className="text-xs text-base-content/50 uppercase tracking-wide mb-2">
                    Dues Cleared
                  </p>
                  <div className="space-y-1.5">
                    {session.due_items.map((item) => (
                      <div
                        key={item.id}
                        className="flex justify-between text-sm"
                      >
                        <span className="text-base-content/70 text-xs">
                          {item.type_name}
                        </span>
                        <span className="font-semibold text-emerald-600 text-xs">
                          ✓ {formatCurrency(item.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-center gap-2 text-sm text-base-content/40">
                  <div className="loading loading-spinner loading-xs" />
                  <span>Redirecting to dues page...</span>
                </div>
              </div>
            </div>
          )}

          {/* ===== ERROR STATE ===== */}
          {status === "error" && (
            <div className="card bg-base-100 shadow-2xl overflow-hidden">
              <div className="bg-gradient-to-r from-error to-rose-500 px-6 py-8 text-center">
                <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-10 h-10 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-white">
                  Payment Failed
                </h2>
                <p className="text-white/80 mt-1 text-sm">
                  We couldn't process your payment
                </p>
              </div>

              <div className="card-body p-5 items-center text-center">
                <div className="bg-error/10 border border-error/30 rounded-xl p-4 w-full mb-5">
                  <p className="text-sm text-error">{errorMsg}</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full">
                  <button
                    onClick={() => {
                      hasProcessed.current = false;
                      setTimeLeft(COUNTDOWN_SECONDS);
                      setCompletedSteps([]);
                      setStatus("waiting");
                      setErrorMsg("");
                    }}
                    className="btn btn-outline btn-primary btn-sm sm:btn-md flex-1"
                  >
                    Try Again
                  </button>
                  <button
                    onClick={() => navigate("/student/dues", { replace: true })}
                    className="btn btn-primary btn-sm sm:btn-md flex-1"
                  >
                    Back to Dues
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Scan line keyframe */}
      <style>{`
        @keyframes scanLine {
          0%   { top: 0%; opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>
    </DashboardLayout>
  );
}
