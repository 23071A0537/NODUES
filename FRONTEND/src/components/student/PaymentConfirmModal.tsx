import { type Due, formatCurrency } from "../../store/useStudentDuesStore";

interface PaymentConfirmModalProps {
  isOpen: boolean;
  selectedDues: Due[];
  totalAmount: number;
  onConfirm: () => void;
  onCancel: () => void;
  processing?: boolean;
}

export default function PaymentConfirmModal({
  isOpen,
  selectedDues,
  totalAmount,
  onConfirm,
  onCancel,
  processing = false,
}: PaymentConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/45 backdrop-blur-[2px] transition-opacity"
        onClick={onCancel}
      ></div>

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative official-surface-plain max-w-lg w-full max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="bg-primary/10 border-b border-primary/15 px-6 py-4">
            <div className="flex items-center justify-between">
              <h3
                className="text-lg sm:text-xl font-semibold text-primary"
                id="modal-title"
              >
                Confirm Dues Payment
              </h3>
              <button
                onClick={onCancel}
                disabled={processing}
                className="text-primary hover:text-primary/75 disabled:opacity-50"
              >
                <svg
                  className="w-6 h-6"
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
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-4 max-h-96 overflow-y-auto">
            <p className="text-sm text-base-content/60 mb-4">
              You are about to submit payment for {selectedDues.length}{" "}
              {selectedDues.length === 1 ? "due" : "dues"}
            </p>

            {/* Due Items List */}
            <div className="space-y-3 mb-6">
              {selectedDues.map((due) => (
                <div
                  key={due.id}
                  className="bg-base-200/60 border border-base-300 rounded-lg p-3"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-medium text-base-content">
                        {due.type_name}
                      </p>
                      <p className="text-xs text-base-content/60 mt-0.5">
                        {due.added_by_entity}
                      </p>
                    </div>
                    <p className="font-semibold text-success ml-4">
                      {formatCurrency(due.outstanding_amount)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="border-t-2 border-base-300 pt-4">
              <div className="flex justify-between items-center">
                <span className="text-base sm:text-lg font-semibold text-base-content">
                  Total Amount
                </span>
                <span className="text-xl sm:text-2xl font-bold text-success">
                  {formatCurrency(totalAmount)}
                </span>
              </div>
            </div>

            {/* Notice */}
            <div className="mt-4 alert alert-warning">
              <svg
                className="w-5 h-5 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <p className="font-medium">Important</p>
                <p className="text-xs mt-1">
                  You will be redirected to the payment gateway to complete this
                  transaction. Review the selected items and total before
                  proceeding.
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-base-200/70 px-6 py-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <button
              onClick={onCancel}
              disabled={processing}
              className="btn btn-outline w-full sm:w-auto"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={processing}
              className="btn btn-primary w-full sm:w-auto gap-2"
            >
              {processing ? (
                <>
                  <span className="loading loading-spinner loading-sm"></span>
                  Processing...
                </>
              ) : (
                <>
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Proceed to Payment
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
