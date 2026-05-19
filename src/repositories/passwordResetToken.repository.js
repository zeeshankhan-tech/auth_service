const PasswordResetToken = require('../models/passwordResetToken.model');

class PasswordResetTokenRepository {
  async create({ userId, tokenHash, expiresAt }) {
    await PasswordResetToken.updateMany({ userId, used: false }, { used: true });
    return PasswordResetToken.create({ userId, tokenHash, expiresAt, used: false });
  }

  async findValidByHash(tokenHash) {
    return PasswordResetToken.findOne({
      tokenHash,
      used: false,
      expiresAt: { $gt: new Date() },
    }).exec();
  }

  async markUsed(id) {
    return PasswordResetToken.findByIdAndUpdate(id, { used: true }, { new: true }).exec();
  }
}

module.exports = { PasswordResetTokenRepository };
