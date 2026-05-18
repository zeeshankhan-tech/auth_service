const { ApiError } = require('../utils/ApiError');

/**
 * Require one of the given roles on the authenticated user.
 * Must run after authenticate().
 */
function authorize(...allowedRoles) {
  return function authorizeMiddleware(req, res, next) {
    if (!req.auth || !Array.isArray(req.auth.roles)) {
      return next(ApiError.unauthorized());
    }
    const has = req.auth.roles.some((r) => allowedRoles.includes(r));
    if (!has) {
      return next(ApiError.forbidden('Insufficient role'));
    }
    return next();
  };
}

module.exports = { authorize };
