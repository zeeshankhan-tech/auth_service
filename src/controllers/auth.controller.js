const { AuthService } = require('../services/auth.service');
const { asyncHandler } = require('../utils/asyncHandler');
const { extractBearerToken } = require('../middlewares/authenticate.middleware');
const { HTTP_STATUS } = require('../constants/http');
const {
  ApiResponseDto,
  AuthSessionDto,
  TokenRefreshResponseDto,
  LogoutResponseDto,
  MeResponseDto,
  ValidateTokenResponseDto,
} = require('../dtos');

const authService = new AuthService();

const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.validated.body);
  res.status(HTTP_STATUS.CREATED).json(ApiResponseDto.success(AuthSessionDto.fromService(result)));
});

const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.validated.body);
  res.status(HTTP_STATUS.OK).json(ApiResponseDto.success(AuthSessionDto.fromService(result)));
});

const refresh = asyncHandler(async (req, res) => {
  const refreshToken = req.validated.body.refreshToken || req.cookies?.refreshToken;
  const result = await authService.refresh({ refreshToken });
  res.status(HTTP_STATUS.OK).json(ApiResponseDto.success(TokenRefreshResponseDto.fromService(result)));
});

const logout = asyncHandler(async (req, res) => {
  const accessToken = extractBearerToken(req);
  const refreshToken = req.validated.body.refreshToken || req.cookies?.refreshToken;
  const result = await authService.logout({ accessToken, refreshToken });
  res.clearCookie('refreshToken', { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production' });
  res.status(HTTP_STATUS.OK).json(ApiResponseDto.success(LogoutResponseDto.fromService(result)));
});

const me = asyncHandler(async (req, res) => {
  const user = await authService.me(req.auth.userId);
  res.status(HTTP_STATUS.OK).json(ApiResponseDto.success(MeResponseDto.fromService(user)));
});

const validate = asyncHandler(async (req, res) => {
  const result = await authService.validateAccessToken(req.validated.body.token);
  res.status(HTTP_STATUS.OK).json(ApiResponseDto.success(ValidateTokenResponseDto.fromService(result)));
});

module.exports = {
  register,
  login,
  refresh,
  logout,
  me,
  validate,
};
