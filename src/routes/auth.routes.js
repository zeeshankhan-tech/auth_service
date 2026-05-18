const { Router } = require('express');
const authController = require('../controllers/auth.controller');
const { validateRequest } = require('../middlewares/validate.middleware');
const {
  registerSchema,
  loginSchema,
  refreshSchema,
  logoutSchema,
  validateSchema,
} = require('../validators/auth.validators');
const { authenticate } = require('../middlewares/authenticate.middleware');
const { createAuthLimiter } = require('../middlewares/rateLimit.middleware');

const router = Router();
const limiter = createAuthLimiter();

router.post('/register', limiter, validateRequest(registerSchema), authController.register);
router.post('/login', limiter, validateRequest(loginSchema), authController.login);
router.post('/refresh', limiter, validateRequest(refreshSchema), authController.refresh);
router.post('/logout', limiter, validateRequest(logoutSchema), authenticate(), authController.logout);
router.get('/me', authenticate(), authController.me);
router.post('/validate', limiter, validateRequest(validateSchema), authController.validate);

module.exports = router;
