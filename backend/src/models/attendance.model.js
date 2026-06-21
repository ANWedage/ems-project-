const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true }, // 'YYYY-MM-DD' - simplifies daily lookups
    checkIn: { type: Date },
    checkOut: { type: Date },
    status: {
      type: String,
      enum: ['present', 'absent', 'half_day', 'on_leave'],
      default: 'present',
    },
  },
  { collection: 'attendance' }
);

// One attendance record per user per day
attendanceSchema.index({ user: 1, date: 1 }, { unique: true });

function getAttendanceModel(tenantConnection) {
  return tenantConnection.models.Attendance || tenantConnection.model('Attendance', attendanceSchema);
}

module.exports = { getAttendanceModel, attendanceSchema };
