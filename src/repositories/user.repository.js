const User = require('../models/user.model');

class UserRepository {
  async create(data) {
    const doc = await User.create(data);
    return doc;
  }

  async findByEmail(email, { withPassword = false } = {}) {
    const q = User.findOne({ email });
    if (withPassword) q.select('+password');
    return q.exec();
  }

  async findById(id, { withPassword = false } = {}) {
    const q = User.findById(id);
    if (withPassword) q.select('+password');
    return q.exec();
  }

  async incrementTokenVersion(userId) {
    return User.findByIdAndUpdate(
      userId,
      { $inc: { tokenVersion: 1 } },
      { new: true, runValidators: true },
    ).exec();
  }

  async updateRoles(userId, roles) {
    return User.findByIdAndUpdate(userId, { roles }, { new: true, runValidators: true }).exec();
  }
}

module.exports = { UserRepository };
