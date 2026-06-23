const { getLeaveModel } = require('../models/leave.model');
const { getUserModel } = require('../models/user.model');
const { notify, notifyMany } = require('../utils/notify');
const { sendEmail } = require('../utils/email');

async function requestLeave(req, res) {
  try {
    const { fromDate, toDate, reason } = req.body;
    if (!fromDate || !toDate) {
      return res.status(400).json({ message: 'fromDate and toDate are required' });
    }

    const Leave = getLeaveModel(req.tenantConnection);
    const leave = await Leave.create({ user: req.user.id, fromDate, toDate, reason });

    const User = getUserModel(req.tenantConnection);
    const employee = await User.findById(req.user.id);

    // Notify whoever should review this: the employee's team leader if they
    // have one, otherwise fall back to notifying every CEO in the company.
    const reviewers = employee.reportsTo
      ? [await User.findById(employee.reportsTo)]
      : await User.find({ role: 'ceo' });

    const reviewerIds = reviewers.filter(Boolean).map((r) => r._id);
    await notifyMany(req.tenantConnection, reviewerIds, {
      message: `${employee.fullName || employee.username} requested leave from ${new Date(fromDate).toLocaleDateString()} to ${new Date(toDate).toLocaleDateString()}`,
      type: 'leave_requested',
      relatedId: leave._id,
    });

    reviewers.filter(Boolean).forEach((reviewer) => {
      sendEmail({
        to: reviewer.email,
        subject: `Leave request from ${employee.fullName || employee.username}`,
        text: `${employee.fullName || employee.username} has requested leave from ${new Date(fromDate).toLocaleDateString()} to ${new Date(toDate).toLocaleDateString()}.\nReason: ${reason || 'Not specified'}\n\nLog in to the EMS app to approve or reject this request.`,
      });
    });

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
    // ?mine=true lets a team_leader (or any role) view only their own leaves
    if (req.query.mine === 'true') {
      userFilter = { user: req.user.id };
    } else if (req.user.role === 'employee') {
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

    const User = getUserModel(req.tenantConnection);
    const employee = await User.findById(leave.user);

    if (employee) {
      await notify(req.tenantConnection, {
        recipient: employee._id,
        message: `Your leave request (${new Date(leave.fromDate).toLocaleDateString()} - ${new Date(leave.toDate).toLocaleDateString()}) was ${status}`,
        type: 'leave_reviewed',
        relatedId: leave._id,
      });

      sendEmail({
        to: employee.email,
        subject: `Your leave request was ${status}`,
        text: `Hi ${employee.fullName || employee.username},\n\nYour leave request from ${new Date(leave.fromDate).toLocaleDateString()} to ${new Date(leave.toDate).toLocaleDateString()} has been ${status} by ${req.user.username}.`,
      });
    }

    return res.json({ message: `Leave ${status}`, leave });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to review leave', error: err.message });
  }
}

module.exports = { requestLeave, listLeaves, reviewLeave };
