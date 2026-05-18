/**
 * Public user representation for API responses (no password, no internal-only fields).
 * Maps from User#toSafeJSON or equivalent plain objects.
 */
class UserDto {
  /**
   * @param {object} user - Safe user plain object (id, name, email, roles, isActive, tokenVersion, timestamps).
   * @returns {object}
   */
  static fromEntity(user) {
    if (!user) return null;
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      roles: Array.isArray(user.roles) ? [...user.roles] : [],
      isActive: Boolean(user.isActive),
      tokenVersion: user.tokenVersion,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}

module.exports = { UserDto };
