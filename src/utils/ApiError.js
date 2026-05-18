const { HTTP_STATUS } = require('../constants/http');

class ApiError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message, details) {
    return new ApiError(HTTP_STATUS.BAD_REQUEST, message, details);
  }

  static unauthorized(message = 'Unauthorized', details) {
    return new ApiError(HTTP_STATUS.UNAUTHORIZED, message, details);
  }

  static forbidden(message = 'Forbidden', details) {
    return new ApiError(HTTP_STATUS.FORBIDDEN, message, details);
  }

  static notFound(message = 'Not found', details) {
    return new ApiError(HTTP_STATUS.NOT_FOUND, message, details);
  }

  static conflict(message, details) {
    return new ApiError(HTTP_STATUS.CONFLICT, message, details);
  }

  static tooMany(message = 'Too many requests', details) {
    return new ApiError(HTTP_STATUS.TOO_MANY_REQUESTS, message, details);
  }

  static internal(message = 'Internal server error', details) {
    return new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, message, details);
  }
}

module.exports = { ApiError };
