import { formatCurrency } from "../../store/useStudentDuesStore";

interface StickyCartBarProps {
  selectedCount: number;
  totalAmount: number;
  onPay: () => void;
  disabled?: boolean;
}

export default function StickyCartBar({
  selectedCount,
  totalAmount,
  onPay,
  disabled = false,
}: StickyCartBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-base-300 bg-base-100/95 shadow-[0_-10px_24px_-16px_rgba(0,0,0,0.5)] backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-4">
        <div className="flex items-center justify-between gap-3 sm:gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] sm:text-xs text-base-content/65 font-semibold uppercase tracking-[0.1em]">
              {selectedCount} {selectedCount === 1 ? "item" : "items"} selected
            </p>
            <p className="text-lg sm:text-2xl lg:text-3xl font-bold text-primary truncate">
              {formatCurrency(totalAmount)}
            </p>
          </div>

          <button
            onClick={onPay}
            disabled={disabled || totalAmount === 0}
            className={`
              btn btn-md sm:btn-lg gap-2 min-w-[8.5rem]
              ${disabled || totalAmount === 0 ? "btn-disabled" : "btn-primary"}
            `}
            aria-label={`Pay ${formatCurrency(totalAmount)} for ${selectedCount} selected dues`}
          >
            <svg
              className="w-4 h-4 sm:w-5 sm:h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <span>Pay Now</span>
          </button>
        </div>
      </div>
    </div>
  );
}
