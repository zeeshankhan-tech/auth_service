const pino = require('pino');
const { env } = require('../config');

function buildLoggerOptions() {
  const options = { level: env.LOG_LEVEL };

  if (env.NODE_ENV === 'development') {
    try {
      require.resolve('pino-pretty');
      options.transport = {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:standard' },
      };
    } catch {
      // pino-pretty is a devDependency; Docker images omit it (npm ci --omit=dev)
    }
  }

  return options;
}

const logger = pino(buildLoggerOptions());

module.exports = { logger };
