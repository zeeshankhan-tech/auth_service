const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { env } = require('../config');
const { ROLES, DEFAULT_ROLE } = require('../constants/roles');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false,
    },
    roles: {
      type: [String],
      default: [DEFAULT_ROLE],
      validate: {
        validator(arr) {
          return Array.isArray(arr) && arr.length > 0 && arr.every((r) => Object.values(ROLES).includes(r));
        },
        message: 'Invalid role value',
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    tokenVersion: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

userSchema.pre('save', async function hashPasswordPreSave(next) {
  if (!this.isModified('password')) return next();
  const saltRounds = env.BCRYPT_SALT_ROUNDS;
  this.password = await bcrypt.hash(this.password, saltRounds);
  next();
});

userSchema.methods.comparePassword = async function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: this.id,
    name: this.name,
    email: this.email,
    roles: this.roles,
    isActive: this.isActive,
    tokenVersion: this.tokenVersion,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
