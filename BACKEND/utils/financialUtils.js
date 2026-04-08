/**
 * Financial Utilities
 * Provides helper functions for working with monetary values
 * Ensures precision and consistency in financial calculations
 * 
 * @module financialUtils
 */

/**
 * Round a number to specified decimal places
 * Uses proper rounding (banker's rounding for .5 cases can be implemented if needed)
 * 
 * @param {number|string} value - Value to round
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {string} Rounded value as string
 */
export function roundMoney(value, decimals = 2) {
  const num = parseFloat(value);
  if (isNaN(num)) return '0.00';
  
  const multiplier = Math.pow(10, decimals);
  return (Math.round(num * multiplier) / multiplier).toFixed(decimals);
}

/**
 * Add two monetary values with precision
 * @param {number|string} a - First value
 * @param {number|string} b - Second value
 * @returns {string} Sum with 2 decimal places
 */
export function addMoney(a, b) {
  const numA = parseFloat(a) || 0;
  const numB = parseFloat(b) || 0;
  return roundMoney(numA + numB);
}

/**
 * Subtract two monetary values with precision
 * @param {number|string} a - Value to subtract from
 * @param {number|string} b - Value to subtract
 * @returns {string} Difference with 2 decimal places
 */
export function subtractMoney(a, b) {
  const numA = parseFloat(a) || 0;
  const numB = parseFloat(b) || 0;
  return roundMoney(numA - numB);
}

/**
 * Multiply a monetary value
 * @param {number|string} value - Value to multiply
 * @param {number|string} multiplier - Multiplier
 * @returns {string} Product with 2 decimal places
 */
export function multiplyMoney(value, multiplier) {
  const numValue = parseFloat(value) || 0;
  const numMultiplier = parseFloat(multiplier) || 0;
  return roundMoney(numValue * numMultiplier);
}

/**
 * Divide a monetary value
 * @param {number|string} value - Value to divide
 * @param {number|string} divisor - Divisor
 * @returns {string} Quotient with 2 decimal places
 */
export function divideMoney(value, divisor) {
  const numValue = parseFloat(value) || 0;
  const numDivisor = parseFloat(divisor);
  
  if (!numDivisor || numDivisor === 0) {
    throw new Error('Division by zero');
  }
  
  return roundMoney(numValue / numDivisor);
}

/**
 * Compare two monetary values with tolerance
 * @param {number|string} a - First value
 * @param {number|string} b - Second value
 * @param {number} tolerance - Tolerance for comparison (default: 0.01)
 * @returns {number} -1 if a < b, 0 if equal (within tolerance), 1 if a > b
 */
export function compareMoney(a, b, tolerance = 0.01) {
  const numA = parseFloat(a) || 0;
  const numB = parseFloat(b) || 0;
  const diff = numA - numB;
  
  if (Math.abs(diff) < tolerance) return 0;
  return diff < 0 ? -1 : 1;
}

/**
 * Check if two monetary values are equal (within tolerance)
 * @param {number|string} a - First value
 * @param {number|string} b - Second value
 * @param {number} tolerance - Tolerance (default: 0.01)
 * @returns {boolean} True if equal within tolerance
 */
export function isMoneyEqual(a, b, tolerance = 0.01) {
  return compareMoney(a, b, tolerance) === 0;
}

/**
 * Check if value is greater than another
 * @param {number|string} a - First value
 * @param {number|string} b - Second value
 * @returns {boolean} True if a > b
 */
export function isMoneyGreater(a, b) {
  return compareMoney(a, b) > 0;
}

/**
 * Check if value is less than another
 * @param {number|string} a - First value
 * @param {number|string} b - Second value
 * @returns {boolean} True if a < b
 */
export function isMoneyLess(a, b) {
  return compareMoney(a, b) < 0;
}

/**
 * Format money for display
 * @param {number|string} value - Value to format
 * @param {string} currency - Currency symbol (default: ₹)
 * @param {boolean} showSymbol - Whether to show currency symbol
 * @returns {string} Formatted money string
 */
export function formatMoney(value, currency = '₹', showSymbol = true) {
  const num = parseFloat(value) || 0;
  const formatted = num.toLocaleString('en-IN', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });
  
  return showSymbol ? `${currency}${formatted}` : formatted;
}

/**
 * Distribute an amount proportionally across multiple values
 * Ensures the sum of distributed amounts equals the total (handles rounding)
 * 
 * @param {number|string} totalAmount - Total amount to distribute
 * @param {Array<number|string>} proportions - Array of proportional values
 * @returns {Array<string>} Array of distributed amounts
 */
export function distributeProportionally(totalAmount, proportions) {
  const total = parseFloat(totalAmount);
  const props = proportions.map(p => parseFloat(p) || 0);
  const sum = props.reduce((a, b) => a + b, 0);
  
  if (sum === 0) {
    return props.map(() => '0.00');
  }
  
  // Calculate proportional amounts
  const distributed = props.map(p => (p / sum) * total);
  
  // Round all but last
  const rounded = distributed.slice(0, -1).map(d => parseFloat(roundMoney(d)));
  
  // Last item gets the remainder to ensure exact total
  const sumRounded = rounded.reduce((a, b) => a + b, 0);
  const lastAmount = total - sumRounded;
  rounded.push(lastAmount);
  
  return rounded.map(r => roundMoney(r));
}

/**
 * Validate a monetary amount
 * @param {any} value - Value to validate
 * @param {Object} options - Validation options
 * @param {boolean} options.allowZero - Allow zero values (default: true)
 * @param {boolean} options.allowNegative - Allow negative values (default: false)
 * @param {number} options.min - Minimum value
 * @param {number} options.max - Maximum value
 * @returns {Object} { valid: boolean, error: string|null, value: string|null }
 */
export function validateMoney(value, options = {}) {
  const {
    allowZero = true,
    allowNegative = false,
    min = null,
    max = null
  } = options;
  
  const num = parseFloat(value);
  
  if (isNaN(num)) {
    return { valid: false, error: 'Invalid monetary value', value: null };
  }
  
  if (!allowZero && num === 0) {
    return { valid: false, error: 'Amount cannot be zero', value: null };
  }
  
  if (!allowNegative && num < 0) {
    return { valid: false, error: 'Amount cannot be negative', value: null };
  }
  
  if (min !== null && num < min) {
    return { valid: false, error: `Amount must be at least ${formatMoney(min)}`, value: null };
  }
  
  if (max !== null && num > max) {
    return { valid: false, error: `Amount cannot exceed ${formatMoney(max)}`, value: null };
  }
  
  return { valid: true, error: null, value: roundMoney(num) };
}

/**
 * Calculate percentage of a value
 * @param {number|string} value - Base value
 * @param {number|string} percentage - Percentage (e.g., 5 for 5%)
 * @returns {string} Calculated amount
 */
export function calculatePercentage(value, percentage) {
  const num = parseFloat(value) || 0;
  const pct = parseFloat(percentage) || 0;
  return roundMoney((num * pct) / 100);
}

/**
 * Get the maximum of multiple monetary values
 * @param {...number|string} values - Values to compare
 * @returns {string} Maximum value
 */
export function maxMoney(...values) {
  const nums = values.map(v => parseFloat(v) || 0);
  return roundMoney(Math.max(...nums));
}

/**
 * Get the minimum of multiple monetary values
 * @param {...number|string} values - Values to compare
 * @returns {string} Minimum value
 */
export function minMoney(...values) {
  const nums = values.map(v => parseFloat(v) || 0);
  return roundMoney(Math.min(...nums));
}

/**
 * Sum multiple monetary values
 * @param {Array<number|string>} values - Values to sum
 * @returns {string} Total sum
 */
export function sumMoney(values) {
  const total = values.reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
  return roundMoney(total);
}
