module.exports = {
  refreshTokenKey: (hash) => `rt:${hash}`,
  accessBlacklistKey: (jti) => `abl:${jti}`,
  sessionKey: (sessionId) => `sess:${sessionId}`,
  userSessionsSet: (userId) => `usess:${userId}`,
  rateLimitPrefix: 'rl:',
};
