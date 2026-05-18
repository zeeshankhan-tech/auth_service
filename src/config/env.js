const { z } = require('zod');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  LOG_LEVEL: z.string().default('info'),

  MONGODB_URI: z.string().min(1),
  REDIS_URL: z.string().min(1),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  BCRYPT_SALT_ROUNDS: z.coerce.number().min(10).max(15).default(12),

  CORS_ORIGIN: z.string().optional(),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const message = parsed.error.flatten().fieldErrors;
    throw new Error(`Invalid environment configuration: ${JSON.stringify(message)}`);
  }
  return parsed.data;
}

module.exports = { loadEnv };
