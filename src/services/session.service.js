const { getRedis } = require('../cache/redis.client');
const { refreshTokenKey } = require('../constants/redisKeys');
const {
  setRefreshSession,
  consumeRefreshSession,
  revokeRefreshFamily,
} = require('../cache/token.store');
const { RefreshSessionRepository } = require('../repositories/refreshSession.repository');
const { sha256Hex } = require('../utils/cryptoRandom');

class SessionService {
  constructor({ refreshSessionRepository = new RefreshSessionRepository() } = {}) {
    this.sessions = refreshSessionRepository;
  }

  hashRefreshToken(refreshToken) {
    return sha256Hex(refreshToken);
  }

  /**
   * Mongo source of truth + Redis cache (write-through).
   */
  async persistRefreshSession({
    jti,
    userId,
    familyId,
    refreshToken,
    deviceInfo,
    expiresAt,
    ttlSeconds,
  }) {
    await this.sessions.create({
      jti,
      userId,
      familyId,
      tokenHash: this.hashRefreshToken(refreshToken),
      deviceInfo,
      expiresAt,
    });
    await setRefreshSession(jti, familyId, userId, ttlSeconds, { createdAt: Date.now() });
  }

  /**
   * Redis fast path, Mongo fallback on cache miss.
   */
  async consumeRefreshSession(jti) {
    const fromRedis = await consumeRefreshSession(jti);
    if (fromRedis) {
      await this.sessions.revokeByJti(jti);
      return fromRedis;
    }

    const active = await this.sessions.findActiveByJti(jti);
    if (active) {
      await this.sessions.revokeByJti(jti);
      return {
        userId: String(active.userId),
        familyId: active.familyId,
      };
    }

    const any = await this.sessions.findByJti(jti);
    if (any && any.revoked) {
      await revokeRefreshFamily(any.familyId);
    }

    return null;
  }

  async revokeSessionByJti(jti) {
    await this.sessions.revokeByJti(jti);
    await getRedis().del(refreshTokenKey(jti));
  }

  async revokeAllForUser(userId) {
    const jtis = await this.sessions.listJtisByUserId(userId);
    await this.sessions.revokeAllByUserId(userId);
    if (jtis.length) {
      const redis = getRedis();
      const pipeline = redis.pipeline();
      for (const jti of jtis) {
        pipeline.del(refreshTokenKey(jti));
      }
      await pipeline.exec();
    }
  }

  async listActiveSessions(userId) {
    return this.sessions.listActiveByUserId(userId);
  }

  async findActiveSessionForUser(jti, userId) {
    const row = await this.sessions.findActiveByJti(jti);
    if (!row || String(row.userId) !== String(userId)) return null;
    return row;
  }
}

module.exports = { SessionService };
