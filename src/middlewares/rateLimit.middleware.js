const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const { getRedis } = require('../cache/redis.client');
const { env } = require('../config');

function createAuthLimiter() {
  const windowMs = 15 * 60 * 1000;
  const max = env.NODE_ENV === 'test' ? 10000 : 300;

  if (env.NODE_ENV === 'test') {
    return rateLimit({ windowMs, max, standardHeaders: true, legacyHeaders: false });
  }

  const client = getRedis();
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
      sendCommand: (...command) => client.call(...command),
      prefix: 'rl:auth:',
    }),
  });
}

module.exports = { createAuthLimiter };
