const { HTTP_STATUS } = require('../constants/http');
const { ApiError } = require('../utils/ApiError');
const { logger } = require('./logger');

// eslint-disable-next-line no-unused-vars
function errorMiddleware(err, req, res, next) {
  let status;
  let message;
  let details;

  if (err && err.code === 11000) {
    status = HTTP_STATUS.CONFLICT;
    message = 'Duplicate key';
  } else if (err instanceof ApiError) {
    status = err.statusCode;
    message = err.message;
    details = err.details;
  } else {
    status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
    message = 'Internal server error';
  }

  const isOperational = err instanceof ApiError && err.isOperational;
  if (!isOperational) {
    logger.error({ err, path: req.path, operational: false }, err?.message || message);
  } else if (status >= 500) {
    logger.error({ err, path: req.path, operational: true }, err?.message || message);
  }

  const body = {
    success: false,
    error: {
      message,
      ...(details ? { details } : {}),
    },
  };
  res.status(status).json(body);
}

module.exports = { errorMiddleware };
