const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { env } = require('../config');

const ACCESS_TYP = 'access';
const REFRESH_TYP = 'refresh';

function signAccessToken({ userId, roles, tokenVersion, jti }) {
  return jwt.sign(
    {
      typ: ACCESS_TYP,
      sub: userId,
      roles,
      tv: tokenVersion,
      jti: jti || uuidv4(),
    },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRES_IN, algorithm: 'HS256' },
  );
}

function signRefreshToken({ userId, familyId, tokenVersion, jti }) {
  return jwt.sign(
    {
      typ: REFRESH_TYP,
      sub: userId,
      fam: familyId,
      tv: tokenVersion,
      jti,
    },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN, algorithm: 'HS256' },
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] });
}

function verifyRefreshToken(token) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET, { algorithms: ['HS256'] });
}

function decodeTokenUnsafe(token) {
  return jwt.decode(token, { complete: false });
}

function accessTtlSecondsFromToken(token) {
  const decoded = jwt.decode(token);
  if (!decoded || !decoded.exp) return 60;
  return Math.max(1, decoded.exp - Math.floor(Date.now() / 1000));
}

function refreshTtlSecondsFromToken(token) {
  return accessTtlSecondsFromToken(token);
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  decodeTokenUnsafe,
  accessTtlSecondsFromToken,
  refreshTtlSecondsFromToken,
  ACCESS_TYP,
  REFRESH_TYP,
};
