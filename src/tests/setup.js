process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'fatal';
process.env.PORT = '0';

process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/auth_service_test_placeholder';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-access-secret-key-32chars!!';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-key-32chars!';
process.env.JWT_ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
process.env.JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
process.env.BCRYPT_SALT_ROUNDS = process.env.BCRYPT_SALT_ROUNDS || '10';

const Redis = require('ioredis-mock');
const { setRedisClientForTests } = require('../cache/redis.client');

setRedisClientForTests(new Redis());
