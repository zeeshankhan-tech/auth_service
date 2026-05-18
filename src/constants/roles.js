const ROLES = {
  USER: 'user',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super-admin',
};

const DEFAULT_ROLE = ROLES.USER;

/** Role -> permission keys for fine-grained checks */
const ROLE_PERMISSIONS = {
  [ROLES.USER]: ['profile:read', 'profile:write'],
  [ROLES.ADMIN]: ['profile:read', 'profile:write', 'users:read', 'users:write'],
  [ROLES.SUPER_ADMIN]: ['*'],
};

module.exports = { ROLES, DEFAULT_ROLE, ROLE_PERMISSIONS };
