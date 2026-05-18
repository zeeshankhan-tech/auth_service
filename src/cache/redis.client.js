const Redis = require('ioredis');
const { env } = require('../config');

let client;

function createRedisClient(url) {
  const target = url || env.REDIS_URL;
  return new Redis(target, {
    maxRetriesPerRequest: 20,
    enableReadyCheck: true,
  });
}

function getRedis() {
  if (!client) {
    const url = process.env.REDIS_URL || env.REDIS_URL;
    client = createRedisClient(url);
  }
  return client;
}

function setRedisClientForTests(c) {
  client = c;
}

async function disconnectRedis() {
  if (!client) return;
  await client.quit().catch(() => {});
  client = undefined;
}

module.exports = { getRedis, createRedisClient, setRedisClientForTests, disconnectRedis };
