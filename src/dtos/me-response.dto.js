const { UserDto } = require('./user.dto');

/**
 * Response for GET /auth/me.
 */
class MeResponseDto {
  static fromService(user) {
    return {
      user: UserDto.fromEntity(user),
    };
  }
}

module.exports = { MeResponseDto };
