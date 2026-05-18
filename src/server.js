require('dotenv').config();

const { env } = require('./config');
const { logger } = require('./middlewares/logger');
const { connectMongo } = require('./db/mongoose');
const { getRedis } = require('./cache/redis.client');
const { createApp } = require('./app');

async function start() {
  await connectMongo();
  getRedis();
  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, 'Auth service listening');
  });

  const shutdown = async (signal) => {
    logger.info({ signal }, 'Shutting down');
    server.close(async () => {
      const { disconnectMongo } = require('./db/mongoose');
      const { disconnectRedis } = require('./cache/redis.client');
      await disconnectRedis().catch(() => {});
      await disconnectMongo().catch(() => {});
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

if (require.main === module) {
  start().catch((err) => {
    logger.error(err, 'Failed to start server');
    process.exit(1);
  });
}

module.exports = { start };
