const { UserDto } = require('./user.dto');
const { TokenPairDto } = require('./token-pair.dto');

/**
 * Combined response for register / login: safe user + token pair.
 */
class AuthSessionDto {
  /**
   * @param {object} payload - Result from AuthService register/login (user + token fields).
   */
  static fromService(payload) {
    if (!payload) return null;
    return {
      user: UserDto.fromEntity(payload.user),
      ...TokenPairDto.fromIssueResult(payload),
    };
  }
}

module.exports = { AuthSessionDto };
