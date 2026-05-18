const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { env } = require('./config');
const { httpLogger } = require('./middlewares/httpLogger.middleware');
const { errorMiddleware } = require('./middlewares/error.middleware');
const authRoutes = require('./routes/auth.routes');
const healthRoutes = require('./routes/health.routes');
const rbacRoutes = require('./routes/rbac.routes');
const { ApiError } = require('./utils/ApiError');
const { HTTP_STATUS } = require('./constants/http');

function createApp() {
  const app = express();

  if (env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN
        ? env.CORS_ORIGIN.split(',').map((s) => s.trim())
        : env.NODE_ENV === 'production'
          ? false
          : true,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '32kb' }));
  app.use(cookieParser());
  app.use(httpLogger);

  app.use('/health', healthRoutes);
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1', rbacRoutes);

  app.use((req, res, next) => {
    next(ApiError.notFound('Route not found'));
  });

  app.use(errorMiddleware);

  return app;
}

module.exports = { createApp };
