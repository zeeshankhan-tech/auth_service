const { v4: uuidv4 } = require('uuid');
const { UserRepository } = require('../repositories/user.repository');
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
const { getRedis } = require('../cache/redis.client');
const { refreshTokenKey } = require('../constants/redisKeys');
const {
  setRefreshSession,
  consumeRefreshSession,
  isFamilyRevoked,
  blacklistAccessToken,
  isAccessTokenBlacklisted,
} = require('../cache/token.store');
const { ApiError } = require('../utils/ApiError');
const { ROLES, DEFAULT_ROLE } = require('../constants/roles');
const { sanitizeObjectStrings } = require('../utils/sanitize');

class AuthService {
  constructor({ userRepository = new UserRepository() } = {}) {
    this.users = userRepository;
  }

  async register({ name, email, password }) {
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
    const tokens = await this.issueAuthTokens(user);
    return { user: user.toSafeJSON(), ...tokens };
  }

  async login({ email, password }) {
    const clean = sanitizeObjectStrings({ email, password });
    const user = await this.users.findByEmail(clean.email, { withPassword: true });
    if (!user || !user.isActive) {
      throw ApiError.unauthorized('Invalid credentials');
    }
    const ok = await user.comparePassword(clean.password);
    if (!ok) {
      throw ApiError.unauthorized('Invalid credentials');
    }
    const tokens = await this.issueAuthTokens(user);
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

    const consumed = await consumeRefreshSession(payload.jti);
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

    const tokens = await this.issueAuthTokens(user, { familyId: payload.fam });
    return tokens;
  }

  async logout({ accessToken, refreshToken }) {
    if (refreshToken) {
      try {
        const p = verifyRefreshToken(refreshToken);
        if (p.typ === REFRESH_TYP && p.jti) {
          await getRedis().del(refreshTokenKey(p.jti));
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

  async issueAuthTokens(user, { familyId } = {}) {
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
    await setRefreshSession(refreshJti, fam, user.id, refreshTtl, { createdAt: Date.now() });

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: accessTtlSecondsFromToken(accessToken),
    };
  }

  /** Revoke all refresh tokens for user by bumping tokenVersion (access invalidation). */
  async revokeAllSessions(userId) {
    await this.users.incrementTokenVersion(userId);
    return { success: true };
  }
}

module.exports = { AuthService };
