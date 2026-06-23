const bcrypt = require('bcryptjs');
const { getUserModel } = require('../models/user.model');
const { getDepartmentModel } = require('../models/department.model');
const { notify } = require('../utils/notify');
const { sendEmail } = require('../utils/email');

/**
 * Returns the logged-in user's own profile, including every department
 * they belong to (populated with names). Available to any authenticated
 * role (ceo, team_leader, employee) so each dashboard can show "which
 * team(s) am I on" without needing elevated permissions.
 */
async function getMe(req, res) {
  try {
    const User = getUserModel(req.tenantConnection);
    const me = await User.findById(req.user.id)
      .select('-password')
      .populate('department', 'name')
      .populate('departments', 'name');

    if (!me) return res.status(404).json({ message: 'User not found' });
    return res.json({ user: me });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch profile', error: err.message });
  }
}

/**
 * CEO creates a new user (employee or team_leader placeholder).
 * All users start as 'employee' role. Role becomes 'team_leader' only
 * when assigned as department leader.
 */
async function createUser(req, res) {
  try {
    const { fullName, email, username, password, contact } = req.body;
    if (!fullName || !username || !password) {
      return res.status(400).json({ message: 'fullName, username and password are required' });
    }

    const User = getUserModel(req.tenantConnection);
    const existing = await User.findOne({ username });
    if (existing) {
      return res.status(409).json({ message: 'That username is already taken' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      username,
      password: hashedPassword,
      email,
      fullName,
      contact,
      role: 'employee',
      isActive: true,
    });

    await notify(req.tenantConnection, {
      recipient: user._id,
      message: `Welcome ${fullName}! Your account has been created by the CEO.`,
      type: 'account_created',
      relatedId: user._id,
    });

    if (email) {
      sendEmail({
        to: email,
        subject: 'Your EMS account has been created',
        text: `Hi ${fullName},\n\nYour EMS account has been created by the CEO.\n\nUsername: ${username}\n\nUse the password you were given and your company name to log in.`,
      });
    }

    return res.status(201).json({
      message: 'User created',
      user: { id: user._id, username: user.username, fullName: user.fullName, role: user.role },
    });
  } catch (err) {
    console.error('createUser error:', err);
    return res.status(500).json({ message: 'Failed to create user', error: err.message });
  }
}

/**
 * List all users (except CEO) with department and team-leader info.
 */
async function listUsers(req, res) {
  try {
    const User = getUserModel(req.tenantConnection);
    const Department = getDepartmentModel(req.tenantConnection);

    const users = await User.find({ role: { $ne: 'ceo' } })
      .select('-password')
      .populate('department', 'name')
      .populate('departments', 'name')
      .lean();

    // Find all department team leaders to highlight them
    const departments = await Department.find({ teamLeader: { $ne: null } }).select('teamLeader').lean();
    const leaderIds = new Set(departments.map(d => d.teamLeader?.toString()));

    const usersWithFlag = users.map(u => ({
      ...u,
      isTeamLeader: leaderIds.has(u._id.toString()),
    }));

    return res.json({ users: usersWithFlag });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to list users', error: err.message });
  }
}

/**
 * Update user details (name, email, contact). CEO only.
 */
async function updateUser(req, res) {
  try {
    const { id } = req.params;
    const { fullName, email, contact, username, password } = req.body;

    const User = getUserModel(req.tenantConnection);
    const user = await User.findById(id);
    if (!user || user.role === 'ceo') {
      return res.status(404).json({ message: 'User not found' });
    }

    if (fullName !== undefined) user.fullName = fullName;
    if (email !== undefined) user.email = email;
    if (contact !== undefined) user.contact = contact;
    if (username !== undefined) {
      const existing = await User.findOne({ username, _id: { $ne: id } });
      if (existing) return res.status(409).json({ message: 'Username already taken' });
      user.username = username;
    }
    if (password && password.trim()) {
      user.password = await bcrypt.hash(password, 10);
    }

    await user.save();

    await notify(req.tenantConnection, {
      recipient: user._id,
      message: 'Your account details have been updated by the CEO.',
      type: 'account_updated',
      relatedId: user._id,
    });

    return res.json({ message: 'User updated', user: { id: user._id, username: user.username, fullName: user.fullName } });
  } catch (err) {
    console.error('updateUser error:', err);
    return res.status(500).json({ message: 'Failed to update user', error: err.message });
  }
}

/**
 * Toggle user active/inactive.
 */
async function toggleUserActive(req, res) {
  try {
    const { id } = req.params;
    const User = getUserModel(req.tenantConnection);
    const user = await User.findById(id);
    if (!user || user.role === 'ceo') {
      return res.status(404).json({ message: 'User not found' });
    }

    user.isActive = !user.isActive;
    await user.save();

    await notify(req.tenantConnection, {
      recipient: user._id,
      message: `Your account has been ${user.isActive ? 'activated' : 'deactivated'} by the CEO.`,
      type: 'account_status',
      relatedId: user._id,
    });

    return res.json({ message: `User ${user.isActive ? 'activated' : 'deactivated'}`, isActive: user.isActive });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to toggle user status', error: err.message });
  }
}

/**
 * Delete a user. Cannot delete if they are a department leader.
 */
async function deleteUser(req, res) {
  try {
    const { id } = req.params;
    const User = getUserModel(req.tenantConnection);
    const Department = getDepartmentModel(req.tenantConnection);

    const user = await User.findById(id);
    if (!user || user.role === 'ceo') {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent deleting an active team leader
    const leaderOfDept = await Department.findOne({ teamLeader: id });
    if (leaderOfDept) {
      return res.status(400).json({ message: `Cannot delete: this user is the team leader of "${leaderOfDept.name}". Reassign the department leader first.` });
    }

    await User.findByIdAndDelete(id);
    return res.json({ message: 'User deleted' });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to delete user', error: err.message });
  }
}

/**
 * Search users by name/username (for department leader assignment).
 */
async function searchUsers(req, res) {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 1) return res.json({ users: [] });

    const User = getUserModel(req.tenantConnection);
    const users = await User.find({
      role: { $ne: 'ceo' },
      isActive: true,
      $or: [
        { username: { $regex: q, $options: 'i' } },
        { fullName: { $regex: q, $options: 'i' } },
      ],
    }).select('-password').limit(10).lean();

    return res.json({ users });
  } catch (err) {
    return res.status(500).json({ message: 'Search failed', error: err.message });
  }
}

module.exports = { createUser, listUsers, updateUser, deleteUser, toggleUserActive, searchUsers, getMe };
