/**
 * API helper utilities for frontend
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

interface FetchOptions extends RequestInit {
  headers?: Record<string, string>;
}

interface UserData {
  user_id: string;
  username: string;
  email: string;
  role: string;
  [key: string]: unknown;
}

/**
 * Get user data from localStorage
 */
export const getUser = (): UserData | null => {
  try {
    const userStr = localStorage.getItem("user");
    return userStr ? JSON.parse(userStr) : null;
  } catch {
    return null;
  }
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = (): boolean => {
  return !!getUser();
};

/**
 * Logout user
 */
export const logout = async (): Promise<void> => {
  try {
    // Call backend logout endpoint to clear cookie
    await fetch(`${API_BASE_URL}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
  } catch (error) {
    console.error("Logout error:", error);
  } finally {
    // Always clear local storage
    localStorage.removeItem("user");
    window.location.href = "/login";
  }
};

/**
 * Refresh session to extend timeout
 */
export const refreshSession = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });

    if (response.ok) {
      return true;
    }
    return false;
  } catch (error) {
    console.error("Refresh session error:", error);
    return false;
  }
};

/**
 * Custom fetch wrapper with automatic token injection and error handling
 */
export const apiFetch = async <T = unknown>(
  endpoint: string,
  options: FetchOptions = {},
): Promise<T> => {
  const url = endpoint.startsWith("http")
    ? endpoint
    : `${API_BASE_URL}${endpoint}`;

  const config: FetchOptions = {
    ...options,
    credentials: "include", // Always include cookies
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, config);

    // Handle 401 Unauthorized - session expired
    if (response.status === 401) {
      const data = await response.json().catch(() => ({}));

      // Check if it's a session expiration
      if (data.sessionExpired) {
        localStorage.removeItem("user");
        window.location.href = "/login";
        throw new Error(
          "Session expired due to inactivity. Please login again.",
        );
      }

      logout();
      throw new Error("Session expired. Please login again.");
    }

    // Parse JSON response
    const data = await response.json();

    // Handle non-2xx responses
    if (!response.ok) {
      throw new Error(data.message || data.error || `HTTP ${response.status}`);
    }

    return data;
  } catch (error: unknown) {
    // Network or parsing error
    const err = error as Error;
    if (err.message === "Failed to fetch") {
      throw new Error("Network error. Please check your connection.");
    }
    throw error;
  }
};

/**
 * API methods
 */
export const api = {
  /**
   * GET request
   */
  get: <T = unknown>(
    endpoint: string,
    params: Record<string, unknown> = {},
  ): Promise<T> => {
    const queryString = new URLSearchParams(
      params as Record<string, string>,
    ).toString();
    const url = queryString ? `${endpoint}?${queryString}` : endpoint;
    return apiFetch<T>(url, { method: "GET" });
  },

  /**
   * POST request
   */
  post: <T = unknown>(endpoint: string, data: unknown = {}): Promise<T> => {
    return apiFetch<T>(endpoint, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * PUT request
   */
  put: <T = unknown>(endpoint: string, data: unknown = {}): Promise<T> => {
    return apiFetch<T>(endpoint, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  /**
   * PATCH request
   */
  patch: <T = unknown>(endpoint: string, data: unknown = {}): Promise<T> => {
    return apiFetch<T>(endpoint, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  /**
   * DELETE request
   */
  delete: <T = unknown>(endpoint: string): Promise<T> => {
    return apiFetch<T>(endpoint, { method: "DELETE" });
  },

  /**
   * Upload file
   */
  upload: async <T = unknown>(
    endpoint: string,
    formData: FormData,
  ): Promise<T> => {
    const url = endpoint.startsWith("http")
      ? endpoint
      : `${API_BASE_URL}${endpoint}`;

    const response = await fetch(url, {
      method: "POST",
      credentials: "include",
      body: formData,
    });

    if (response.status === 401) {
      logout();
      throw new Error("Session expired");
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || "Upload failed");
    }

    return data;
  },
};

/**
 * Format currency for display
 */
export const formatCurrency = (amount: number | null | undefined): string => {
  if (amount === null || amount === undefined) return "₹0.00";
  return `₹${amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

/**
 * Format date for display
 */
export const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

/**
 * Format date and time
 */
export const formatDateTime = (
  dateString: string | null | undefined,
): string => {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  return date.toLocaleString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/**
 * Calculate days remaining
 */
export const daysUntil = (
  dateString: string | null | undefined,
): number | null => {
  if (!dateString) return null;
  const date = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  const diffTime = date.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

/**
 * Check if date is overdue
 */
export const isOverdue = (dateString: string | null | undefined): boolean => {
  const days = daysUntil(dateString);
  return days !== null && days < 0;
};

/**
 * Download file from blob
 */
export const downloadBlob = (blob: Blob, filename: string): void => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

/**
 * Download file from API endpoint
 */
export const downloadFile = async (
  endpoint: string,
  filename: string,
): Promise<void> => {
  const url = endpoint.startsWith("http")
    ? endpoint
    : `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Download failed");
  }

  const blob = await response.blob();
  downloadBlob(blob, filename);
};

/**
 * Debounce function
 */
export const debounce = <T extends (...args: never[]) => unknown>(
  func: T,
  wait: number,
): ((...args: Parameters<T>) => void) => {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * Copy text to clipboard
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand("copy");
      return true;
    } catch {
      return false;
    } finally {
      document.body.removeChild(textArea);
    }
  }
};
