const bcrypt = require('bcryptjs');
const { getUserModel } = require('../models/user.model');
const { getDepartmentModel } = require('../models/department.model');
const { notify } = require('../utils/notify');
const { sendEmail } = require('../utils/email');

/**
 * (Legacy flow, still supported) Team leader creates a brand-new employee
 * account and adds it straight into their own department.
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
      departments: [leader.department],
      reportsTo: leader._id,
    });

    const Department = getDepartmentModel(req.tenantConnection);
    const department = await Department.findById(leader.department);

    await notify(req.tenantConnection, {
      recipient: employee._id,
      message: `Welcome! Your employee account has been created in the "${department ? department.name : ''}" department`,
      type: 'employee_added',
      relatedId: employee._id,
    });

    sendEmail({
      to: employee.email,
      subject: `Welcome to the team - your EMS account is ready`,
      text: `Hi ${employee.fullName || employee.username},\n\nYour employee account has been created in the "${department ? department.name : ''}" department.\n\nYour login username is: ${employee.username}\n(Use the password you were given separately, and your company name, to log in.)\n\nLog in to the EMS desktop app to view your tasks and mark attendance.`,
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
 * Team leader views everyone who belongs to their own department -
 * including the leader themself, since a team leader is also a member
 * of the department they lead (not just its manager). CEO sees every
 * non-CEO user company-wide, also via this same membership rule.
 *
 * Membership = role is 'employee' OR 'team_leader', AND the department
 * is in their `departments[]` (or their legacy single `department`
 * field, for any record that predates multi-department support).
 */
async function listEmployees(req, res) {
  try {
    const User = getUserModel(req.tenantConnection);

    let query = { role: { $in: ['employee', 'team_leader'] } };
    if (req.user.role === 'team_leader') {
      const leader = await User.findById(req.user.id);

      // Match on EITHER the new `departments[]` array OR the legacy
      // single `department` field, so anyone whose primary department
      // points here but who (for any reason - e.g. older data from
      // before multi-department support) never got added to
      // `departments[]` still shows up as a team member.
      query.$or = [
        { departments: leader.department },
        { department: leader.department },
      ];

      // Self-heal: anyone matching the legacy `department` field but
      // missing it from `departments[]` gets fixed silently, so this
      // never has to be re-checked again on the next read. This also
      // covers the leader's own record (e.g. a leader promoted before
      // multi-department support existed).
      await User.updateMany(
        { department: leader.department, departments: { $ne: leader.department } },
        { $addToSet: { departments: leader.department } }
      );
    }

    const employees = await User.find(query)
      .select('-password')
      .populate('department', 'name')
      .populate('departments', 'name')
      .sort({ fullName: 1, username: 1 });

    return res.json({ employees });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to list employees', error: err.message });
  }
}

/**
 * Team leader searches across ALL employees in the company (not just
 * their own team) so they can find someone to add to their team.
 * Excludes people already on the leader's team, and excludes
 * ceo/team_leader accounts.
 */
async function searchAllEmployees(req, res) {
  try {
    const { q } = req.query;
    const User = getUserModel(req.tenantConnection);

    const leader = await User.findById(req.user.id);
    if (!leader || !leader.department) {
      return res.status(400).json({ message: 'Your account is not linked to a department' });
    }

    const filter = {
      role: 'employee',
      isActive: true,
      departments: { $ne: leader.department }, // not already in this leader's team
      department: { $ne: leader.department }, // also guard against legacy data not yet self-healed
    };

    const term = (q || '').trim();
    if (term.length > 0) {
      filter.$or = [
        { username: { $regex: term, $options: 'i' } },
        { fullName: { $regex: term, $options: 'i' } },
      ];
    }

    const employees = await User.find(filter)
      .select('-password')
      .populate('departments', 'name')
      .limit(20)
      .lean();

    return res.json({ employees });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to search employees', error: err.message });
  }
}

/**
 * Team leader adds an EXISTING employee to their own department/team.
 * The employee keeps any other department(s) they already belong to -
 * one employee can belong to one or more teams at the same time.
 */
async function addEmployeeToTeam(req, res) {
  try {
    const { employeeId } = req.body;
    if (!employeeId) {
      return res.status(400).json({ message: 'employeeId is required' });
    }

    const User = getUserModel(req.tenantConnection);
    const Department = getDepartmentModel(req.tenantConnection);

    const leader = await User.findById(req.user.id);
    if (!leader || !leader.department) {
      return res.status(400).json({ message: 'Your account is not linked to a department' });
    }

    const department = await Department.findById(leader.department);
    if (!department) {
      return res.status(404).json({ message: 'Your department could not be found' });
    }

    const employee = await User.findById(employeeId);
    if (!employee || employee.role !== 'employee') {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const alreadyInTeam = (employee.departments || []).some(
      (d) => String(d) === String(leader.department)
    );
    if (alreadyInTeam) {
      return res.status(409).json({ message: `${employee.fullName || employee.username} is already in this team` });
    }

    employee.departments = [...(employee.departments || []), leader.department];

    // If this is the employee's first team, also set it as their primary
    // department / reporting line, so existing task & leave scoping keeps
    // working for whoever is their "main" team leader.
    if (!employee.department) {
      employee.department = leader.department;
      employee.reportsTo = leader._id;
    }

    await employee.save();

    await notify(req.tenantConnection, {
      recipient: employee._id,
      message: `You have been added to the "${department.name}" team by ${leader.fullName || leader.username}`,
      type: 'employee_added',
      relatedId: department._id,
    });

    if (employee.email) {
      sendEmail({
        to: employee.email,
        subject: `You've been added to the ${department.name} team`,
        text: `Hi ${employee.fullName || employee.username},\n\nYou have been added to the "${department.name}" team by ${leader.fullName || leader.username}.\n\nLog in to the EMS desktop app to view your tasks.`,
      });
    }

    const populated = await User.findById(employee._id)
      .select('-password')
      .populate('departments', 'name')
      .populate('department', 'name');

    return res.status(200).json({ message: 'Employee added to team', employee: populated });
  } catch (err) {
    console.error('addEmployeeToTeam error:', err);
    return res.status(500).json({ message: 'Failed to add employee to team', error: err.message });
  }
}

/**
 * Team leader removes an employee from their own team. The employee stays
 * in any other team(s) they belong to. If this was their only/primary
 * department, the primary department/reportsTo is cleared (or moved to
 * another remaining team, if any).
 */
async function removeEmployeeFromTeam(req, res) {
  try {
    const { id } = req.params;
    const User = getUserModel(req.tenantConnection);
    const Department = getDepartmentModel(req.tenantConnection);

    const leader = await User.findById(req.user.id);
    if (!leader || !leader.department) {
      return res.status(400).json({ message: 'Your account is not linked to a department' });
    }

    const employee = await User.findById(id);
    if (!employee || employee.role !== 'employee') {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const wasInTeam = (employee.departments || []).some(
      (d) => String(d) === String(leader.department)
    );
    if (!wasInTeam) {
      return res.status(400).json({ message: 'This employee is not in your team' });
    }

    employee.departments = (employee.departments || []).filter(
      (d) => String(d) !== String(leader.department)
    );

    // If we just removed their primary department, promote the next
    // remaining team (if any) to primary, otherwise clear it.
    if (employee.department && String(employee.department) === String(leader.department)) {
      const nextDept = employee.departments[0] || null;
      employee.department = nextDept;
      if (nextDept) {
        const nextLeaderDept = await Department.findById(nextDept);
        employee.reportsTo = nextLeaderDept ? nextLeaderDept.teamLeader : null;
      } else {
        employee.reportsTo = null;
      }
    }

    await employee.save();

    await notify(req.tenantConnection, {
      recipient: employee._id,
      message: `You have been removed from a team by ${leader.fullName || leader.username}`,
      type: 'employee_removed',
      relatedId: leader.department,
    });

    return res.json({ message: 'Employee removed from team' });
  } catch (err) {
    console.error('removeEmployeeFromTeam error:', err);
    return res.status(500).json({ message: 'Failed to remove employee from team', error: err.message });
  }
}

module.exports = {
  addEmployee,
  listEmployees,
  searchAllEmployees,
  addEmployeeToTeam,
  removeEmployeeFromTeam,
};
