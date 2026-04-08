/**
 * Validation utilities for input sanitization and validation
 */

/**
 * Validate email format
 */
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate roll number format
 * Example: 21R11A0501
 */
export const isValidRollNumber = (rollNumber) => {
  if (!rollNumber || typeof rollNumber !== 'string') return false;
  // Adjust regex based on your institution's format
  const rollRegex = /^[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{4}$/;
  return rollRegex.test(rollNumber.trim().toUpperCase());
};

/**
 * Validate employee code format
 */
export const isValidEmployeeCode = (code) => {
  if (!code || typeof code !== 'string') return false;
  return code.trim().length >= 3 && code.trim().length <= 20;
};

/**
 * Validate date string (YYYY-MM-DD)
 */
export const isValidDate = (dateString) => {
  if (!dateString) return false;
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
};

/**
 * Validate future date
 */
export const isFutureDate = (dateString) => {
  if (!isValidDate(dateString)) return false;
  const date = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date >= today;
};

/**
 * Validate positive number
 */
export const isPositiveNumber = (value) => {
  const num = parseFloat(value);
  return !isNaN(num) && num > 0;
};

/**
 * Validate integer
 */
export const isValidInteger = (value) => {
  const num = parseInt(value, 10);
  return !isNaN(num) && Number.isInteger(num) && num.toString() === value.toString();
};

/**
 * Sanitize string input (prevent XSS)
 */
export const sanitizeString = (str) => {
  if (!str || typeof str !== 'string') return '';
  return str
    .trim()
    .replace(/[<>]/g, '') // Remove < and >
    .substring(0, 500); // Limit length
};

/**
 * Validate URL format
 */
export const isValidUrl = (urlString) => {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

/**
 * Validate password strength
 * Minimum 6 characters
 */
export const isValidPassword = (password) => {
  return password && typeof password === 'string' && password.length >= 6;
};

/**
 * Validate array of IDs
 */
export const isValidIdArray = (arr) => {
  if (!Array.isArray(arr) || arr.length === 0) return false;
  return arr.every(id => Number.isInteger(parseInt(id)) && parseInt(id) > 0);
};

/**
 * Validate phone number (Indian format)
 */
export const isValidPhone = (phone) => {
  if (!phone || typeof phone !== 'string') return false;
  const phoneRegex = /^[6-9]\d{9}$/;
  return phoneRegex.test(phone.replace(/[\s-]/g, ''));
};

/**
 * Validate boolean value
 */
export const isValidBoolean = (value) => {
  return value === true || value === false || value === 'true' || value === 'false';
};

/**
 * Convert to boolean safely
 */
export const toBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1' || value === 1) return true;
  if (value === 'false' || value === '0' || value === 0) return false;
  return null;
};

/**
 * Validate and parse pagination parameters
 */
export const validatePagination = (limit, offset) => {
  const parsedLimit = parseInt(limit) || 50;
  const parsedOffset = parseInt(offset) || 0;
  
  return {
    limit: Math.min(Math.max(parsedLimit, 1), 100), // Between 1 and 100
    offset: Math.max(parsedOffset, 0) // Non-negative
  };
};

/**
 * Validate due type fields
 */
export const validateDueFields = (data) => {
  const errors = [];
  
  if (!data.due_type_id || !isValidInteger(data.due_type_id)) {
    errors.push('Valid due type ID is required');
  }
  
  if (data.is_payable === undefined || !isValidBoolean(data.is_payable)) {
    errors.push('is_payable must be true or false');
  }
  
  const payable = toBoolean(data.is_payable);
  
  if (payable && !isPositiveNumber(data.current_amount)) {
    errors.push('Payable dues require a positive amount');
  }
  
  if (!payable && data.current_amount) {
    errors.push('Non-payable dues should not have an amount');
  }
  
  if (!isValidDate(data.due_clear_by_date)) {
    errors.push('Valid due clear by date is required');
  }
  
  if (data.proof_drive_link && !isValidUrl(data.proof_drive_link)) {
    errors.push('Proof link must be a valid URL');
  }
  
  return { isValid: errors.length === 0, errors };
};

/**
 * Safe JSON parse
 */
export const safeJSONParse = (str, fallback = null) => {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
};

/**
 * Validate request body has required fields
 */
export const validateRequired = (data, requiredFields) => {
  const missing = [];
  
  for (const field of requiredFields) {
    if (data[field] === undefined || data[field] === null || data[field] === '') {
      missing.push(field);
    }
  }
  
  return {
    isValid: missing.length === 0,
    missing
  };
};
