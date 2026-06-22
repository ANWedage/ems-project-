const bcrypt = require('bcryptjs');
const { getDepartmentModel } = require('../models/department.model');
const { getUserModel } = require('../models/user.model');

/**
 * CEO creates a new department (e.g. "QA", "Frontend", "UI/UX")
 * and simultaneously creates the team leader account for it.
 */
async function createDepartment(req, res) {
  try {
    const { departmentName, leaderUsername, leaderPassword, leaderEmail, leaderFullName } = req.body;

    if (!departmentName || !leaderUsername || !leaderPassword) {
      return res.status(400).json({ message: 'departmentName, leaderUsername and leaderPassword are required' });
    }

    const Department = getDepartmentModel(req.tenantConnection);
    const User = getUserModel(req.tenantConnection);

    const existingUsername = await User.findOne({ username: leaderUsername });
    if (existingUsername) {
      return res.status(409).json({ message: 'That username is already taken in this company' });
    }

    const hashedPassword = await bcrypt.hash(leaderPassword, 10);

    const leader = await User.create({
      username: leaderUsername,
      password: hashedPassword,
      email: leaderEmail,
      fullName: leaderFullName || leaderUsername,
      role: 'team_leader',
    });

    const department = await Department.create({
      name: departmentName,
      teamLeader: leader._id,
      createdBy: req.user.id,
    });

    leader.department = department._id;
    await leader.save();

    return res.status(201).json({ message: 'Department and team leader created', department, leader: { id: leader._id, username: leader.username } });
  } catch (err) {
    console.error('createDepartment error:', err);
    return res.status(500).json({ message: 'Failed to create department', error: err.message });
  }
}

async function listDepartments(req, res) {
  try {
    const Department = getDepartmentModel(req.tenantConnection);
    const departments = await Department.find().populate('teamLeader', 'username fullName email');
    return res.json({ departments });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to list departments', error: err.message });
  }
}

module.exports = { createDepartment, listDepartments };
