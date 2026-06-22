const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, trim: true },
    password: { type: String, required: true }, // bcrypt hashed
    email: { type: String, trim: true, lowercase: true },
    role: {
      type: String,
      enum: ['ceo', 'team_leader', 'employee'],
      required: true,
    },
    fullName: { type: String, trim: true },

    // Department this user belongs to (null for CEO).
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },

    // For employees: which team leader manages them.
    reportsTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: 'users' }
);

// Username must be unique WITHIN a company's own database (not globally,
// since each company has its own database, this is automatically scoped).
userSchema.index({ username: 1 }, { unique: true });

function getUserModel(tenantConnection) {
  return tenantConnection.models.User || tenantConnection.model('User', userSchema);
}

module.exports = { getUserModel, userSchema };
