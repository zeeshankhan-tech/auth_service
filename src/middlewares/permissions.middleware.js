const { ROLE_PERMISSIONS } = require('../constants/roles');
const { ApiError } = require('../utils/ApiError');

function userHasPermission(roles, permission) {
  for (const role of roles) {
    const perms = ROLE_PERMISSIONS[role] || [];
    if (perms.includes('*')) return true;
    if (perms.includes(permission)) return true;
  }
  return false;
}

/**
 * Fine-grained permission check; compose with authenticate().
 */
function requirePermission(...permissions) {
  return function requirePermissionMiddleware(req, res, next) {
    if (!req.auth || !Array.isArray(req.auth.roles)) {
      return next(ApiError.unauthorized());
    }
    const ok = permissions.every((p) => userHasPermission(req.auth.roles, p));
    if (!ok) {
      return next(ApiError.forbidden('Missing permission'));
    }
    return next();
  };
}

module.exports = { requirePermission, userHasPermission };
