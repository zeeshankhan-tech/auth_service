module.exports = async () => {
  const { disconnectMongo } = require('../db/mongoose');
  const { disconnectRedis } = require('../cache/redis.client');
  await disconnectMongo().catch(() => {});
  await disconnectRedis().catch(() => {});
};
