const { getRedis } = require('./redis.client');
const { refreshTokenKey, accessBlacklistKey, sessionKey, userSessionsSet } = require('../constants/redisKeys');

async function setRefreshSession(jti, familyId, userId, ttlSeconds, metadata = {}) {
  const redis = getRedis();
  const key = refreshTokenKey(jti);
  const payload = JSON.stringify({ userId, familyId, ...metadata });
  await redis.set(key, payload, 'EX', ttlSeconds);
}

/**
 * Atomically consumes a refresh session slot (replay protection / rotation).
 * Returns parsed payload or null if missing.
 */
async function consumeRefreshSession(jti) {
  const redis = getRedis();
  const key = refreshTokenKey(jti);
  const res = await redis.getdel(key);
  if (!res) return null;
  try {
    return JSON.parse(res);
  } catch {
    return null;
  }
}

async function revokeRefreshFamily(familyId) {
  const redis = getRedis();
  await redis.set(`rfam:revoked:${familyId}`, '1', 'EX', 60 * 60 * 24 * 30);
}

async function isFamilyRevoked(familyId) {
  const redis = getRedis();
  const v = await redis.get(`rfam:revoked:${familyId}`);
  return v === '1';
}

async function blacklistAccessToken(jti, ttlSeconds) {
  const redis = getRedis();
  await redis.set(accessBlacklistKey(jti), '1', 'EX', ttlSeconds);
}

async function isAccessTokenBlacklisted(jti) {
  const redis = getRedis();
  const v = await redis.get(accessBlacklistKey(jti));
  return v === '1';
}

async function registerSession(userId, sessionId, ttlSeconds, payload = {}) {
  const redis = getRedis();
  const key = sessionKey(sessionId);
  await redis.set(key, JSON.stringify({ userId, ...payload }), 'EX', ttlSeconds);
  await redis.sadd(userSessionsSet(userId), sessionId);
  await redis.expire(userSessionsSet(userId), ttlSeconds);
}

async function deleteSession(sessionId, userId) {
  const redis = getRedis();
  await redis.del(sessionKey(sessionId));
  if (userId) {
    await redis.srem(userSessionsSet(userId), sessionId);
  }
}

async function clearUserSessions(userId) {
  const redis = getRedis();
  const setKey = userSessionsSet(userId);
  const ids = await redis.smembers(setKey);
  if (ids.length) {
    const pipeline = redis.pipeline();
    for (const id of ids) {
      pipeline.del(sessionKey(id));
    }
    pipeline.del(setKey);
    await pipeline.exec();
  } else {
    await redis.del(setKey);
  }
}

module.exports = {
  setRefreshSession,
  consumeRefreshSession,
  revokeRefreshFamily,
  isFamilyRevoked,
  blacklistAccessToken,
  isAccessTokenBlacklisted,
  registerSession,
  deleteSession,
  clearUserSessions,
};
