const { v4: uuidv4 } = require('uuid');
const { UserRepository } = require('../repositories/user.repository');
const { PasswordResetTokenRepository } = require('../repositories/passwordResetToken.repository');
const { SessionService } = require('./session.service');
const {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  accessTtlSecondsFromToken,
  refreshTtlSecondsFromToken,
  ACCESS_TYP,
  REFRESH_TYP,
} = require('../auth/jwt');
const {
  isFamilyRevoked,
  blacklistAccessToken,
  isAccessTokenBlacklisted,
} = require('../cache/token.store');
const { ApiError } = require('../utils/ApiError');
const { DEFAULT_ROLE } = require('../constants/roles');
const { sanitizeObjectStrings } = require('../utils/sanitize');
const { randomUrlSafeBytes, sha256Hex } = require('../utils/cryptoRandom');
const { env } = require('../config');

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

class AuthService {
  constructor({
    userRepository = new UserRepository(),
    sessionService = new SessionService(),
    passwordResetRepository = new PasswordResetTokenRepository(),
  } = {}) {
    this.users = userRepository;
    this.sessions = sessionService;
    this.passwordResets = passwordResetRepository;
  }

  async register({ name, email, password, deviceInfo }) {
    const clean = sanitizeObjectStrings({ name, email, password });
    const exists = await this.users.findByEmail(clean.email);
    if (exists) {
      throw ApiError.conflict('Email already registered');
    }
    const user = await this.users.create({
      name: clean.name,
      email: clean.email,
      password: clean.password,
      roles: [DEFAULT_ROLE],
    });
    const tokens = await this.issueAuthTokens(user, { deviceInfo });
    return { user: user.toSafeJSON(), ...tokens };
  }

  async login({ email, password, deviceInfo }) {
    const clean = sanitizeObjectStrings({ email, password });
    const user = await this.users.findByEmail(clean.email, { withPassword: true });
    if (!user || !user.isActive) {
      throw ApiError.unauthorized('Invalid credentials');
    }
    const ok = await user.comparePassword(clean.password);
    if (!ok) {
      throw ApiError.unauthorized('Invalid credentials');
    }
    const tokens = await this.issueAuthTokens(user, { deviceInfo });
    return { user: user.toSafeJSON(), ...tokens };
  }

  async refresh({ refreshToken }) {
    if (!refreshToken) {
      throw ApiError.badRequest('refreshToken is required');
    }
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw ApiError.unauthorized('Invalid refresh token');
    }
    if (payload.typ !== REFRESH_TYP) {
      throw ApiError.unauthorized('Invalid refresh token');
    }
    if (await isFamilyRevoked(payload.fam)) {
      throw ApiError.unauthorized('Refresh token family revoked');
    }

    const consumed = await this.sessions.consumeRefreshSession(payload.jti);
    if (!consumed) {
      throw ApiError.unauthorized('Refresh token reuse detected');
    }
    if (consumed.userId !== payload.sub) {
      throw ApiError.unauthorized('Invalid refresh token');
    }

    const user = await this.users.findById(payload.sub);
    if (!user || !user.isActive) {
      throw ApiError.unauthorized('User not available');
    }
    if (user.tokenVersion !== payload.tv) {
      throw ApiError.unauthorized('Token version mismatch');
    }

    return this.issueAuthTokens(user, { familyId: payload.fam });
  }

  async logout({ accessToken, refreshToken }) {
    if (refreshToken) {
      try {
        const p = verifyRefreshToken(refreshToken);
        if (p.typ === REFRESH_TYP && p.jti) {
          await this.sessions.revokeSessionByJti(p.jti);
        }
      } catch {
        // ignore malformed refresh on logout
      }
    }
    if (accessToken) {
      try {
        const decoded = verifyAccessToken(accessToken);
        if (decoded.typ === ACCESS_TYP && decoded.jti) {
          const ttl = accessTtlSecondsFromToken(accessToken);
          await blacklistAccessToken(decoded.jti, ttl);
        }
      } catch {
        // ignore invalid access token on logout
      }
    }
    return { success: true };
  }

  async logoutAll({ userId, accessToken }) {
    if (accessToken) {
      try {
        const decoded = verifyAccessToken(accessToken);
        if (decoded.typ === ACCESS_TYP && decoded.jti) {
          const ttl = accessTtlSecondsFromToken(accessToken);
          await blacklistAccessToken(decoded.jti, ttl);
        }
      } catch {
        // ignore
      }
    }
    await this.sessions.revokeAllForUser(userId);
    await this.users.incrementTokenVersion(userId);
    return { success: true };
  }

  async changePassword({ userId, currentPassword, newPassword }) {
    const user = await this.users.findById(userId, { withPassword: true });
    if (!user || !user.isActive) {
      throw ApiError.unauthorized('User not available');
    }
    const ok = await user.comparePassword(currentPassword);
    if (!ok) {
      throw ApiError.unauthorized('Current password is incorrect');
    }
    user.password = newPassword;
    await user.save();
    await this.sessions.revokeAllForUser(userId);
    await this.users.incrementTokenVersion(userId);
    return { success: true };
  }

  async forgotPassword({ email }) {
    const clean = sanitizeObjectStrings({ email });
    const user = await this.users.findByEmail(clean.email);
    if (!user) {
      return { success: true, message: 'If the email exists, a reset link will be sent' };
    }

    const rawToken = randomUrlSafeBytes(32);
    const tokenHash = sha256Hex(rawToken);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
    await this.passwordResets.create({ userId: user.id, tokenHash, expiresAt });

    const response = {
      success: true,
      message: 'If the email exists, a reset link will be sent',
    };
    if (env.NODE_ENV === 'development') {
      response.resetToken = rawToken;
    }
    return response;
  }

  async resetPassword({ token, newPassword }) {
    if (!token) {
      throw ApiError.badRequest('token is required');
    }
    const tokenHash = sha256Hex(token);
    const row = await this.passwordResets.findValidByHash(tokenHash);
    if (!row) {
      throw ApiError.badRequest('Invalid or expired reset token');
    }
    const user = await this.users.findById(row.userId, { withPassword: true });
    if (!user || !user.isActive) {
      throw ApiError.badRequest('Invalid or expired reset token');
    }
    user.password = newPassword;
    await user.save();
    await this.passwordResets.markUsed(row.id);
    await this.sessions.revokeAllForUser(user.id);
    await this.users.incrementTokenVersion(user.id);
    return { success: true };
  }

  async listSessions(userId) {
    const rows = await this.sessions.listActiveSessions(userId);
    return rows.map((s) => ({
      jti: s.jti,
      familyId: s.familyId,
      deviceInfo: s.deviceInfo,
      expiresAt: s.expiresAt,
      createdAt: s.createdAt,
    }));
  }

  async revokeSession({ userId, jti }) {
    const session = await this.sessions.findActiveSessionForUser(jti, userId);
    if (!session) {
      throw ApiError.notFound('Session not found');
    }
    await this.sessions.revokeSessionByJti(jti);
    return { success: true };
  }

  async me(userId) {
    const user = await this.users.findById(userId);
    if (!user || !user.isActive) {
      throw ApiError.unauthorized('User not available');
    }
    return user.toSafeJSON();
  }

  async validateAccessToken(accessToken) {
    if (!accessToken) {
      throw ApiError.badRequest('token is required');
    }
    let decoded;
    try {
      decoded = verifyAccessToken(accessToken);
    } catch {
      throw ApiError.unauthorized('Invalid token');
    }
    if (decoded.typ !== ACCESS_TYP) {
      throw ApiError.unauthorized('Invalid token');
    }
    if (await isAccessTokenBlacklisted(decoded.jti)) {
      throw ApiError.unauthorized('Token revoked');
    }
    const user = await this.users.findById(decoded.sub);
    if (!user || !user.isActive) {
      throw ApiError.unauthorized('User not available');
    }
    if (user.tokenVersion !== decoded.tv) {
      throw ApiError.unauthorized('Token version mismatch');
    }
    return {
      valid: true,
      sub: user.id,
      roles: user.roles,
      tokenVersion: user.tokenVersion,
      jti: decoded.jti,
      expiresAt: decoded.exp,
    };
  }

  async issueAuthTokens(user, { familyId, deviceInfo } = {}) {
    const fam = familyId || uuidv4();
    const refreshJti = uuidv4();
    const accessJti = uuidv4();

    const accessToken = signAccessToken({
      userId: user.id,
      roles: user.roles,
      tokenVersion: user.tokenVersion,
      jti: accessJti,
    });
    const refreshToken = signRefreshToken({
      userId: user.id,
      familyId: fam,
      tokenVersion: user.tokenVersion,
      jti: refreshJti,
    });

    const refreshTtl = refreshTtlSecondsFromToken(refreshToken);
    const expiresAt = new Date(Date.now() + refreshTtl * 1000);

    await this.sessions.persistRefreshSession({
      jti: refreshJti,
      userId: user.id,
      familyId: fam,
      refreshToken,
      deviceInfo: deviceInfo || '',
      expiresAt,
      ttlSeconds: refreshTtl,
    });

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: accessTtlSecondsFromToken(accessToken),
      sessionId: refreshJti,
    };
  }
}

module.exports = { AuthService };
