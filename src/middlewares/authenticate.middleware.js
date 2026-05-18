const { verifyAccessToken, ACCESS_TYP } = require('../auth/jwt');
const { isAccessTokenBlacklisted } = require('../cache/token.store');
const { UserRepository } = require('../repositories/user.repository');
const { ApiError } = require('../utils/ApiError');

const users = new UserRepository();

function extractBearerToken(req) {
  const header = req.headers.authorization;
  if (!header || typeof header !== 'string') return null;
  const [scheme, token] = header.split(' ');
  if (!token || scheme.toLowerCase() !== 'bearer') return null;
  return token.trim();
}

function authenticate() {
  return async function authenticateMiddleware(req, res, next) {
    try {
      const token = extractBearerToken(req);
      if (!token) {
        throw ApiError.unauthorized('Missing bearer token');
      }
      let decoded;
      try {
        decoded = verifyAccessToken(token);
      } catch {
        throw ApiError.unauthorized('Invalid access token');
      }
      if (decoded.typ !== ACCESS_TYP) {
        throw ApiError.unauthorized('Invalid access token');
      }
      if (await isAccessTokenBlacklisted(decoded.jti)) {
        throw ApiError.unauthorized('Token revoked');
      }

      const user = await users.findById(decoded.sub);
      if (!user || !user.isActive) {
        throw ApiError.unauthorized('User not available');
      }
      if (user.tokenVersion !== decoded.tv) {
        throw ApiError.unauthorized('Token version mismatch');
      }

      req.auth = {
        userId: user.id,
        roles: user.roles,
        jti: decoded.jti,
        tokenVersion: user.tokenVersion,
      };
      return next();
    } catch (e) {
      return next(e);
    }
  };
}

module.exports = { authenticate, extractBearerToken };
