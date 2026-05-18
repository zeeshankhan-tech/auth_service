const { ApiError } = require('../utils/ApiError');

function validateRequest(schema) {
  return function validateRequestMiddleware(req, res, next) {
    const parsed = schema.safeParse({ body: req.body, query: req.query, params: req.params });
    if (!parsed.success) {
      return next(ApiError.badRequest('Validation failed', parsed.error.flatten()));
    }
    req.validated = parsed.data;
    return next();
  };
}

module.exports = { validateRequest };
