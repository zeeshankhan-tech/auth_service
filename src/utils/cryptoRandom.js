const crypto = require('crypto');

function randomUrlSafeBytes(length = 48) {
  return crypto.randomBytes(length).toString('base64url');
}

function sha256Hex(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

module.exports = { randomUrlSafeBytes, sha256Hex };
