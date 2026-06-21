const { getLeaveModel } = require('../models/leave.model');
const { getUserModel } = require('../models/user.model');

async function requestLeave(req, res) {
  try {
    const { fromDate, toDate, reason } = req.body;
    if (!fromDate || !toDate) {
      return res.status(400).json({ message: 'fromDate and toDate are required' });
    }

    const Leave = getLeaveModel(req.tenantConnection);
    const leave = await Leave.create({ user: req.user.id, fromDate, toDate, reason });

    return res.status(201).json({ message: 'Leave request submitted', leave });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to submit leave request', error: err.message });
  }
}

/**
 * team_leader sees leave requests from their own department's employees.
 * ceo sees everything. employee sees only their own requests.
 */
async function listLeaves(req, res) {
  try {
    const Leave = getLeaveModel(req.tenantConnection);
    const User = getUserModel(req.tenantConnection);

    let userFilter = {};
    if (req.user.role === 'employee') {
      userFilter = { user: req.user.id };
    } else if (req.user.role === 'team_leader') {
      const leader = await User.findById(req.user.id);
      const deptEmployees = await User.find({ department: leader.department }).select('_id');
      userFilter = { user: { $in: deptEmployees.map((e) => e._id) } };
    }

    const leaves = await Leave.find(userFilter).populate('user', 'username fullName').sort({ createdAt: -1 });
    return res.json({ leaves });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to list leaves', error: err.message });
  }
}

async function reviewLeave(req, res) {
  try {
    const { status } = req.body; // 'approved' | 'rejected'
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: "status must be 'approved' or 'rejected'" });
    }

    const Leave = getLeaveModel(req.tenantConnection);
    const leave = await Leave.findById(req.params.leaveId);
    if (!leave) return res.status(404).json({ message: 'Leave request not found' });

    leave.status = status;
    leave.reviewedBy = req.user.id;
    await leave.save();

    return res.json({ message: `Leave ${status}`, leave });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to review leave', error: err.message });
  }
}

module.exports = { requestLeave, listLeaves, reviewLeave };
