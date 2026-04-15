import { create } from "zustand";

export interface Due {
  id: number;
  due_type_id: number;
  type_name: string;
  type_description: string;
  requires_permission: boolean;
  is_payable: boolean;
  current_amount: number;
  amount_paid: number;
  outstanding_amount: number;
  permission_granted: boolean | null;
  supporting_document_link: string | null;
  proof_drive_link: string | null;
  due_clear_by_date: string;
  is_cleared: boolean;
  overall_status: boolean;
  due_description: string;
  remarks: string | null;
  is_compounded: boolean | null;
  needs_original: boolean | null;
  needs_pdf: boolean | null;
  created_at: string;
  updated_at: string;
  added_by_entity: string;
  is_alumni_due?: boolean;
  is_form_submitted?: boolean;
  submitted_at?: string | null;
  status_of_registration_with_alumni_portal?: string | null;
  linkedin_profile_link?: string | null;
  placement_status?: string | null;
  proof_of_placement?: string | null;
  planning_for_higher_education?: string | null;
  proof_of_higher_education?: string | null;
  status_badge:
    | "payable"
    | "scholarship_approved"
    | "partial"
    | "cleared"
    | "info";
}

export interface ClearedDue extends Due {
  cleared_by_username: string | null;
  proof_drive_link: string | null;
  payments: Payment[] | null;
}

export interface Payment {
  id: number;
  paid_amount: number;
  payment_reference: string;
  payment_method: string;
  payment_status: "SUCCESS" | "FAILED" | "PENDING";
  paid_at: string;
}

export interface Totals {
  total_dues: number;
  total_outstanding: number;
  payable_total: number;
}

export interface PaymentSession {
  payment_id: string;
  redirect_url: string;
  total_amount: number;
  due_items: Array<{
    id: number;
    type_name: string;
    amount: number;
  }>;
}

interface StudentDuesStore {
  // State
  selectedDues: number[];
  dues: Due[];
  totals: Totals;
  loading: boolean;
  error: string | null;
  currentStatus: "payable" | "all";

  // Cleared dues history
  history: ClearedDue[];
  historyLoading: boolean;
  historyError: string | null;

  // Actions
  toggleDue: (id: number) => void;
  clearSelection: () => void;
  selectAll: () => void;
  deselectAll: () => void;

  fetchDues: (status?: "payable" | "all") => Promise<void>;
  refreshDues: () => Promise<void>;

  fetchHistory: (filters?: {
    start_date?: string;
    end_date?: string;
    due_type_id?: number;
  }) => Promise<void>;

  createPaymentSession: (returnUrl?: string) => Promise<PaymentSession>;
}

export const useStudentDuesStore = create<StudentDuesStore>((set, get) => ({
  // Initial state
  selectedDues: [],
  dues: [],
  totals: { total_dues: 0, total_outstanding: 0, payable_total: 0 },
  loading: false,
  error: null,
  currentStatus: "payable",

  history: [],
  historyLoading: false,
  historyError: null,

  // Selection actions
  toggleDue: (id) =>
    set((state) => ({
      selectedDues: state.selectedDues.includes(id)
        ? state.selectedDues.filter((d) => d !== id)
        : [...state.selectedDues, id],
    })),

  clearSelection: () => set({ selectedDues: [] }),

  selectAll: () => {
    const { dues } = get();
    const payableIds = dues
      .filter(
        (due) =>
          due.is_payable && !due.is_cleared && due.outstanding_amount > 0,
      )
      .map((due) => due.id);
    set({ selectedDues: payableIds });
  },

  deselectAll: () => set({ selectedDues: [] }),

  // Fetch active dues
  fetchDues: async (status = "payable") => {
    set({ loading: true, error: null, currentStatus: status });

    try {
      const response = await fetch(
        `/api/student/dues?status=${status}&_t=${Date.now()}`,
        {
          credentials: "include",
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
          },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to fetch dues");
      }

      const data = await response.json();

      set({
        dues: data.dues || [],
        totals: data.totals || {
          total_dues: 0,
          total_outstanding: 0,
          payable_total: 0,
        },
        loading: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "An error occurred",
        loading: false,
        dues: [],
        totals: { total_dues: 0, total_outstanding: 0, payable_total: 0 },
      });
    }
  },

  // Refresh current dues list
  refreshDues: async () => {
    const { fetchDues, currentStatus, clearSelection } = get();
    clearSelection();
    await fetchDues(currentStatus);
  },

  // Fetch cleared dues history
  fetchHistory: async (filters = {}) => {
    set({ historyLoading: true, historyError: null });

    try {
      const params = new URLSearchParams();
      if (filters.start_date) params.append("start_date", filters.start_date);
      if (filters.end_date) params.append("end_date", filters.end_date);
      if (filters.due_type_id)
        params.append("due_type_id", filters.due_type_id.toString());

      const response = await fetch(
        `/api/student/dues/history?${params}&_t=${Date.now()}`,
        {
          credentials: "include",
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
          },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to fetch history");
      }

      const data = await response.json();

      set({
        history: data.history || [],
        historyLoading: false,
      });
    } catch (error) {
      set({
        historyError:
          error instanceof Error ? error.message : "An error occurred",
        historyLoading: false,
        history: [],
      });
    }
  },

  // Create payment session
  createPaymentSession: async (returnUrl = "/student/dues") => {
    const { selectedDues } = get();

    if (selectedDues.length === 0) {
      throw new Error("No dues selected");
    }

    const response = await fetch("/api/student/payments", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        due_ids: selectedDues,
        return_url: returnUrl,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to create payment session");
    }

    const data = await response.json();
    return data as PaymentSession;
  },
}));

// Utility functions
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(amount);
};

export const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export const formatDateTime = (dateString: string): string => {
  return new Date(dateString).toLocaleString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const downloadForm = (dueId: number): void => {
  window.open(`/api/student/dues/${dueId}/form`, "_blank");
};

export const downloadReceipt = (dueId: number): void => {
  window.open(`/api/student/dues/${dueId}/receipt`, "_blank");
};
