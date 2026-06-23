const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, trim: true },
    password: { type: String, required: true }, // bcrypt hashed
    email: { type: String, trim: true, lowercase: true },
    contact: { type: String, trim: true, default: null },
    role: {
      type: String,
      enum: ['ceo', 'team_leader', 'employee'],
      required: true,
    },
    fullName: { type: String, trim: true },

    // Primary department this user belongs to (null for CEO). Kept for
    // backward compatibility with task/leave/attendance filtering, which
    // scope by a single department. It is always kept in sync with the
    // first entry of `departments` below.
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },

    // All departments/teams this employee has been added to. An employee
    // can belong to one or more teams (added by one or more team leaders).
    departments: { type: [mongoose.Schema.Types.ObjectId], ref: 'Department', default: [] },

    // For employees: which team leader manages them (their primary leader,
    // i.e. the leader of `department` above).
    reportsTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: 'users' }
);

userSchema.index({ username: 1 }, { unique: true });

function getUserModel(tenantConnection) {
  return tenantConnection.models.User || tenantConnection.model('User', userSchema);
}

module.exports = { getUserModel, userSchema };
