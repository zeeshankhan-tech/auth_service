const { z } = require('zod');

const passwordField = z
  .string()
  .min(8)
  .max(128)
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[0-9]/, 'Password must contain a number');

const registerSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(120),
    email: z.string().email().max(254),
    password: passwordField,
  }),
});

const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1).max(128),
  }),
});

const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(10).optional(),
  }),
});

const logoutSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(10).optional(),
  }),
});

const validateSchema = z.object({
  body: z.object({
    token: z.string().min(10),
  }),
});

const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1).max(128),
    newPassword: passwordField,
  }),
});

const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email().max(254),
  }),
});

const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(10),
    newPassword: passwordField,
  }),
});

const sessionJtiParamSchema = z.object({
  params: z.object({
    jti: z.string().uuid(),
  }),
});

module.exports = {
  registerSchema,
  loginSchema,
  refreshSchema,
  logoutSchema,
  validateSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  sessionJtiParamSchema,
};
