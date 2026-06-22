const bcrypt = require('bcryptjs');
const { getUserModel } = require('../models/user.model');

/**
 * Team leader adds a new employee (developer, designer, etc.) under
 * their own department, and creates that employee's login credentials.
 */
async function addEmployee(req, res) {
  try {
    const { username, password, email, fullName } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'username and password are required' });
    }

    const User = getUserModel(req.tenantConnection);

    const existing = await User.findOne({ username });
    if (existing) {
      return res.status(409).json({ message: 'That username is already taken in this company' });
    }

    // The logged-in team leader's own user doc tells us their department.
    const leader = await User.findById(req.user.id);
    if (!leader || !leader.department) {
      return res.status(400).json({ message: 'Your account is not linked to a department' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const employee = await User.create({
      username,
      password: hashedPassword,
      email,
      fullName: fullName || username,
      role: 'employee',
      department: leader.department,
      reportsTo: leader._id,
    });

    return res.status(201).json({
      message: 'Employee created',
      employee: { id: employee._id, username: employee.username, fullName: employee.fullName },
    });
  } catch (err) {
    console.error('addEmployee error:', err);
    return res.status(500).json({ message: 'Failed to add employee', error: err.message });
  }
}

/**
 * Team leader views all employees in their own department.
 * CEO can view all employees company-wide.
 */
async function listEmployees(req, res) {
  try {
    const User = getUserModel(req.tenantConnection);

    let query = { role: 'employee' };
    if (req.user.role === 'team_leader') {
      const leader = await User.findById(req.user.id);
      query.department = leader.department;
    }

    const employees = await User.find(query).select('-password').populate('department', 'name');
    return res.json({ employees });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to list employees', error: err.message });
  }
}

module.exports = { addEmployee, listEmployees };
