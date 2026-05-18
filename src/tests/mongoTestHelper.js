const fs = require('fs');
const { MongoMemoryServer } = require('mongodb-memory-server');

/**
 * Prefer TEST_MONGODB_URI (e.g. Docker: mongodb://127.0.0.1:27017/auth_jest) so tests
 * run in sandboxes that cannot spawn mongodb-memory-server's binary.
 *
 * Optional: MONGOMS_SYSTEM_BINARY=/path/to/mongod to avoid downloading/extracting.
 */
async function startTestMongo() {
  const externalUri = process.env.TEST_MONGODB_URI;
  if (externalUri) {
    return {
      uri: externalUri,
      stop: async () => {},
      mode: 'external',
    };
  }

  const instanceOpts = {
    launchTimeout: 120000,
  };

  const binaryOpts = {};
  const systemBinary = process.env.MONGOMS_SYSTEM_BINARY;
  if (systemBinary && fs.existsSync(systemBinary)) {
    binaryOpts.systemBinary = systemBinary;
  }

  try {
    const mongoServer = await MongoMemoryServer.create({
      instance: instanceOpts,
      ...(Object.keys(binaryOpts).length ? { binary: binaryOpts } : {}),
    });
    return {
      uri: mongoServer.getUri(),
      stop: async () => {
        await mongoServer.stop();
      },
      mode: 'memory',
    };
  } catch (err) {
    const hint = [
      'MongoDB for tests could not start.',
      'Fix options:',
      '  • Set TEST_MONGODB_URI to a reachable MongoDB (e.g. docker run -p 27017:27017 mongo:7, then TEST_MONGODB_URI=mongodb://127.0.0.1:27017/auth_jest).',
      '  • Or set MONGOMS_SYSTEM_BINARY to a real mongod executable.',
      '  • Or run Jest outside a restricted sandbox so mongodb-memory-server can download and execute mongod.',
    ].join('\n');
    const wrapped = new Error(`${hint}\n\nOriginal error: ${err.message}`);
    wrapped.cause = err;
    throw wrapped;
  }
}

module.exports = { startTestMongo };
