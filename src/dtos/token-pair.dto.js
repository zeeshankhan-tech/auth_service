/**
 * Access + refresh token bundle returned after issuance (login, register, refresh).
 */
class TokenPairDto {
  /**
   * @param {object} raw - Service token payload.
   * @param {string} raw.accessToken
   * @param {string} raw.refreshToken
   * @param {string} [raw.tokenType]
   * @param {number} raw.expiresIn - Access token TTL in seconds.
   */
  static fromIssueResult(raw) {
    if (!raw) return null;
    return {
      accessToken: raw.accessToken,
      refreshToken: raw.refreshToken,
      tokenType: raw.tokenType || 'Bearer',
      expiresIn: raw.expiresIn,
    };
  }
}

module.exports = { TokenPairDto };
