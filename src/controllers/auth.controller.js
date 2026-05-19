const { AuthService } = require('../services/auth.service');
const { asyncHandler } = require('../utils/asyncHandler');
const { extractBearerToken } = require('../middlewares/authenticate.middleware');
const { getDeviceInfo } = require('../utils/requestDevice');
const { HTTP_STATUS } = require('../constants/http');
const {
  ApiResponseDto,
  AuthSessionDto,
  TokenRefreshResponseDto,
  LogoutResponseDto,
  MeResponseDto,
  ValidateTokenResponseDto,
  SessionsListDto,
} = require('../dtos');

const authService = new AuthService();

const register = asyncHandler(async (req, res) => {
  const result = await authService.register({
    ...req.validated.body,
    deviceInfo: getDeviceInfo(req),
  });
  res.status(HTTP_STATUS.CREATED).json(ApiResponseDto.success(AuthSessionDto.fromService(result)));
});

const login = asyncHandler(async (req, res) => {
  const result = await authService.login({
    ...req.validated.body,
    deviceInfo: getDeviceInfo(req),
  });
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

const logoutAll = asyncHandler(async (req, res) => {
  const accessToken = extractBearerToken(req);
  const result = await authService.logoutAll({ userId: req.auth.userId, accessToken });
  res.status(HTTP_STATUS.OK).json(ApiResponseDto.success(LogoutResponseDto.fromService(result)));
});

const changePassword = asyncHandler(async (req, res) => {
  const result = await authService.changePassword({
    userId: req.auth.userId,
    ...req.validated.body,
  });
  res.status(HTTP_STATUS.OK).json(ApiResponseDto.success(result));
});

const forgotPassword = asyncHandler(async (req, res) => {
  const result = await authService.forgotPassword(req.validated.body);
  res.status(HTTP_STATUS.OK).json(ApiResponseDto.success(result));
});

const resetPassword = asyncHandler(async (req, res) => {
  const result = await authService.resetPassword(req.validated.body);
  res.status(HTTP_STATUS.OK).json(ApiResponseDto.success(result));
});

const listSessions = asyncHandler(async (req, res) => {
  const sessions = await authService.listSessions(req.auth.userId);
  res.status(HTTP_STATUS.OK).json(ApiResponseDto.success(SessionsListDto.fromService(sessions)));
});

const revokeSession = asyncHandler(async (req, res) => {
  const result = await authService.revokeSession({
    userId: req.auth.userId,
    jti: req.validated.params.jti,
  });
  res.status(HTTP_STATUS.OK).json(ApiResponseDto.success(result));
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
  logoutAll,
  changePassword,
  forgotPassword,
  resetPassword,
  listSessions,
  revokeSession,
  me,
  validate,
};
