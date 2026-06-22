const { getAttendanceModel } = require('../models/attendance.model');

function todayString() {
  return new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

async function checkIn(req, res) {
  try {
    const Attendance = getAttendanceModel(req.tenantConnection);
    const date = todayString();

    let record = await Attendance.findOne({ user: req.user.id, date });
    if (record && record.checkIn) {
      return res.status(409).json({ message: 'You have already checked in today' });
    }

    if (!record) {
      record = await Attendance.create({ user: req.user.id, date, checkIn: new Date(), status: 'present' });
    } else {
      record.checkIn = new Date();
      record.status = 'present';
      await record.save();
    }

    return res.json({ message: 'Checked in', record });
  } catch (err) {
    return res.status(500).json({ message: 'Check-in failed', error: err.message });
  }
}

async function checkOut(req, res) {
  try {
    const Attendance = getAttendanceModel(req.tenantConnection);
    const date = todayString();

    const record = await Attendance.findOne({ user: req.user.id, date });
    if (!record || !record.checkIn) {
      return res.status(400).json({ message: 'You must check in before checking out' });
    }
    if (record.checkOut) {
      return res.status(409).json({ message: 'You have already checked out today' });
    }

    record.checkOut = new Date();
    await record.save();

    return res.json({ message: 'Checked out', record });
  } catch (err) {
    return res.status(500).json({ message: 'Check-out failed', error: err.message });
  }
}

/**
 * Employees see their own history. Team leaders/CEO can pass a
 * ?userId= query to inspect a specific person's attendance.
 */
async function myAttendance(req, res) {
  try {
    const Attendance = getAttendanceModel(req.tenantConnection);
    const targetUserId = req.query.userId && req.user.role !== 'employee' ? req.query.userId : req.user.id;

    const records = await Attendance.find({ user: targetUserId }).sort({ date: -1 }).limit(60);
    return res.json({ records });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch attendance', error: err.message });
  }
}

module.exports = { checkIn, checkOut, myAttendance };
