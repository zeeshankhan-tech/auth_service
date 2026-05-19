const { Router } = require('express');
const authController = require('../controllers/auth.controller');
const { validateRequest } = require('../middlewares/validate.middleware');
const {
  registerSchema,
  loginSchema,
  refreshSchema,
  logoutSchema,
  validateSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  sessionJtiParamSchema,
} = require('../validators/auth.validators');
const { authenticate } = require('../middlewares/authenticate.middleware');
const { createAuthLimiter } = require('../middlewares/rateLimit.middleware');

const router = Router();
const limiter = createAuthLimiter();

router.post('/register', limiter, validateRequest(registerSchema), authController.register);
router.post('/login', limiter, validateRequest(loginSchema), authController.login);
router.post('/refresh', limiter, validateRequest(refreshSchema), authController.refresh);
router.post('/logout', limiter, validateRequest(logoutSchema), authenticate(), authController.logout);
router.post('/logout-all', limiter, authenticate(), authController.logoutAll);
router.post(
  '/change-password',
  limiter,
  authenticate(),
  validateRequest(changePasswordSchema),
  authController.changePassword,
);
router.post('/forgot-password', limiter, validateRequest(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', limiter, validateRequest(resetPasswordSchema), authController.resetPassword);
router.get('/sessions', authenticate(), authController.listSessions);
router.delete(
  '/sessions/:jti',
  authenticate(),
  validateRequest(sessionJtiParamSchema),
  authController.revokeSession,
);
router.get('/me', authenticate(), authController.me);
router.post('/validate', limiter, validateRequest(validateSchema), authController.validate);

module.exports = router;
