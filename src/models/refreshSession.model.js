const mongoose = require('mongoose');

const refreshSessionSchema = new mongoose.Schema(
  {
    jti: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    familyId: {
      type: String,
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
    },
    deviceInfo: {
      type: String,
      trim: true,
      maxlength: 512,
      default: '',
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    revoked: {
      type: Boolean,
      default: false,
      index: true,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

refreshSessionSchema.index({ userId: 1, revoked: 1, expiresAt: 1 });

refreshSessionSchema.methods.isActive = function isActive() {
  return !this.revoked && this.expiresAt > new Date();
};

module.exports =
  mongoose.models.RefreshSession || mongoose.model('RefreshSession', refreshSessionSchema);
