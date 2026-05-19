const RefreshSession = require('../models/refreshSession.model');

class RefreshSessionRepository {
  async create({ jti, userId, familyId, tokenHash, deviceInfo, expiresAt }) {
    return RefreshSession.create({
      jti,
      userId,
      familyId,
      tokenHash,
      deviceInfo: deviceInfo || '',
      expiresAt,
      revoked: false,
    });
  }

  async findActiveByJti(jti) {
    return RefreshSession.findOne({
      jti,
      revoked: false,
      expiresAt: { $gt: new Date() },
    }).exec();
  }

  async findByJti(jti) {
    return RefreshSession.findOne({ jti }).exec();
  }

  async revokeByJti(jti) {
    return RefreshSession.findOneAndUpdate(
      { jti, revoked: false },
      { revoked: true, revokedAt: new Date() },
      { new: true },
    ).exec();
  }

  async revokeAllByUserId(userId) {
    const result = await RefreshSession.updateMany(
      { userId, revoked: false },
      { revoked: true, revokedAt: new Date() },
    );
    return result.modifiedCount;
  }

  async listActiveByUserId(userId) {
    return RefreshSession.find({
      userId,
      revoked: false,
      expiresAt: { $gt: new Date() },
    })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
  }

  async listJtisByUserId(userId) {
    const rows = await RefreshSession.find({ userId, revoked: false }).select('jti').lean().exec();
    return rows.map((r) => r.jti);
  }
}

module.exports = { RefreshSessionRepository };
