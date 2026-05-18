/**
 * Response for POST /auth/validate — safe subset of JWT and server checks.
 */
class ValidateTokenResponseDto {
  static fromService(result) {
    if (!result) return null;
    return {
      valid: Boolean(result.valid),
      sub: result.sub,
      roles: Array.isArray(result.roles) ? [...result.roles] : [],
      tokenVersion: result.tokenVersion,
      jti: result.jti,
      expiresAt: result.expiresAt,
    };
  }
}

module.exports = { ValidateTokenResponseDto };
