/**
 * Centralized error handling and logging utilities
 */

/**
 * Standard API error response
 */
export class APIError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.name = 'APIError';
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Log levels
 */
export const LogLevel = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG'
};

/**
 * Logger class
 */
class Logger {
  log(level, message, meta = {}) {
    const logEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...meta
    };

    // In production, send to logging service (e.g., Winston, Sentry)
    if (process.env.NODE_ENV === 'production') {
      // TODO: Integrate with logging service
      if (level === LogLevel.ERROR) {
        console.error(JSON.stringify(logEntry));
      }
    } else {
      // Development logging
      const colorMap = {
        ERROR: '\x1b[31m', // Red
        WARN: '\x1b[33m',  // Yellow
        INFO: '\x1b[36m',  // Cyan
        DEBUG: '\x1b[90m'  // Gray
      };
      const reset = '\x1b[0m';
      console.log(`${colorMap[level]}[${level}]${reset} ${message}`, meta);
    }
  }

  error(message, error = null, meta = {}) {
    this.log(LogLevel.ERROR, message, {
      error: error?.message,
      stack: error?.stack,
      ...meta
    });
  }

  warn(message, meta = {}) {
    this.log(LogLevel.WARN, message, meta);
  }

  info(message, meta = {}) {
    this.log(LogLevel.INFO, message, meta);
  }

  debug(message, meta = {}) {
    if (process.env.NODE_ENV !== 'production') {
      this.log(LogLevel.DEBUG, message, meta);
    }
  }
}

export const logger = new Logger();

/**
 * Global error handler middleware
 */
export const errorHandler = (err, req, res, next) => {
  // Log the error
  logger.error('Request error', err, {
    path: req.path,
    method: req.method,
    query: req.query,
    body: req.body,
    user: req.user?.user_id
  });

  // Determine status code
  const statusCode = err.statusCode || 500;

  // Don't leak error details in production
  const message = process.env.NODE_ENV === 'production' && statusCode === 500
    ? 'Internal server error'
    : err.message;

  // Send error response
  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    ...(err.details && { details: err.details })
  });
};

/**
 * Async route handler wrapper
 * Automatically catches errors and passes to error handler
 */
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Not found handler
 */
export const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.path
  });
};

/**
 * Database error handler
 */
export const handleDatabaseError = (error, operation = 'database operation') => {
  logger.error(`Database error during ${operation}`, error);

  // Check for specific database errors
  if (error.code === '23505') { // Unique violation
    return new APIError('Duplicate entry found', 409, {
      field: error.constraint
    });
  }

  if (error.code === '23503') { // Foreign key violation
    return new APIError('Referenced record not found', 400, {
      constraint: error.constraint
    });
  }

  if (error.code === '23514') { // Check constraint violation
    return new APIError('Invalid data provided', 400, {
      constraint: error.constraint
    });
  }

  // Generic database error
  return new APIError('Database operation failed', 500);
};

/**
 * Validation error formatter
 */
export const validationError = (errors) => {
  return new APIError('Validation failed', 400, { errors });
};
