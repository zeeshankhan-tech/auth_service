const { TokenPairDto } = require('./token-pair.dto');

/**
 * Response for POST /auth/refresh (tokens only, no user object).
 */
class TokenRefreshResponseDto {
  static fromService(payload) {
    return TokenPairDto.fromIssueResult(payload);
  }
}

module.exports = { TokenRefreshResponseDto };
