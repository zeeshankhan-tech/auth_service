/**
 * Response for POST /auth/logout.
 */
class LogoutResponseDto {
  static fromService(result) {
    return {
      success: Boolean(result?.success),
    };
  }
}

module.exports = { LogoutResponseDto };
