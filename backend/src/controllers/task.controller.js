const { getTaskModel } = require('../models/task.model');
const { getUserModel } = require('../models/user.model');
const { getDepartmentModel } = require('../models/department.model');
const { notify } = require('../utils/notify');
const { sendEmail } = require('../utils/email');

/**
 * CEO -> hands a company-wide task to a department as a whole (no
 * individual assignee yet). The department's team leader is notified and
 * is expected to break it down into individual tasks for their members.
 */
async function createCompanyTask(req, res) {
  try {
    const { title, description, departmentId, dueDate } = req.body;
    if (!title || !departmentId) {
      return res.status(400).json({ message: 'title and departmentId are required' });
    }

    const Task = getTaskModel(req.tenantConnection);
    const Department = getDepartmentModel(req.tenantConnection);

    const department = await Department.findById(departmentId);
    if (!department) return res.status(404).json({ message: 'Department not found' });

    const task = await Task.create({
      title,
      description,
      assignedBy: req.user.id,
      department: department._id,
      assignedToDepartment: department._id,
      scope: 'company',
      dueDate,
    });

    if (department.teamLeader) {
      await notify(req.tenantConnection, {
        recipient: department.teamLeader,
        message: `The CEO assigned a new company task to your "${department.name}" team: "${title}"`,
        type: 'task_assigned',
        relatedId: task._id,
      });

      const User = getUserModel(req.tenantConnection);
      const leader = await User.findById(department.teamLeader);
      if (leader && leader.email) {
        sendEmail({
          to: leader.email,
          subject: `New company task for ${department.name}: ${title}`,
          text: `Hi ${leader.fullName || leader.username},\n\nThe CEO has assigned a new task to your "${department.name}" team: "${title}".\n${description ? `Description: ${description}\n` : ''}${dueDate ? `Due date: ${new Date(dueDate).toLocaleDateString()}\n` : ''}\nLog in to the EMS app to break this down into tasks for your team members.`,
        });
      }
    }

    return res.status(201).json({ message: 'Company task assigned', task });
  } catch (err) {
    console.error('createCompanyTask error:', err);
    return res.status(500).json({ message: 'Failed to assign company task', error: err.message });
  }
}

/**
 * Team leader -> assigns an individual task to one of their own members.
 * Optionally linked to a company task (parentTaskId) the CEO delegated to
 * the department, so progress on the original request can be traced.
 */
async function createTask(req, res) {
  try {
    const { title, description, assignedTo, dueDate, parentTaskId } = req.body;
    if (!title || !assignedTo) {
      return res.status(400).json({ message: 'title and assignedTo are required' });
    }

    const Task = getTaskModel(req.tenantConnection);
    const User = getUserModel(req.tenantConnection);

    const assignee = await User.findById(assignedTo);
    if (!assignee) return res.status(404).json({ message: 'Assigned user not found' });

    let parentTask = null;
    if (parentTaskId) {
      parentTask = await Task.findById(parentTaskId);
      if (!parentTask) return res.status(404).json({ message: 'Parent company task not found' });
    }

    const task = await Task.create({
      title,
      description,
      assignedTo,
      assignedBy: req.user.id,
      department: assignee.department,
      scope: 'team',
      parentTask: parentTask ? parentTask._id : null,
      dueDate,
    });

    await notify(req.tenantConnection, {
      recipient: assignee._id,
      message: `You have been assigned a new task: "${title}"`,
      type: 'task_assigned',
      relatedId: task._id,
    });

    sendEmail({
      to: assignee.email,
      subject: `New task assigned: ${title}`,
      text: `Hi ${assignee.fullName || assignee.username},\n\nYou have been assigned a new task: "${title}".\n${description ? `Description: ${description}\n` : ''}${dueDate ? `Due date: ${new Date(dueDate).toLocaleDateString()}\n` : ''}\nLog in to the EMS app to view details.`,
    });

    return res.status(201).json({ message: 'Task assigned', task });
  } catch (err) {
    console.error('createTask error:', err);
    return res.status(500).json({ message: 'Failed to create task', error: err.message });
  }
}

/**
 * Returns tasks scoped to the requester's role:
 *  - employee: only their own individually-assigned tasks
 *  - team_leader: every task (company or team) tied to their department
 *  - ceo: every task company-wide
 */
async function listTasks(req, res) {
  try {
    const Task = getTaskModel(req.tenantConnection);
    const User = getUserModel(req.tenantConnection);

    let query = {};
    if (req.user.role === 'employee') {
      query.assignedTo = req.user.id;
    } else if (req.user.role === 'team_leader') {
      const leader = await User.findById(req.user.id);
      query.department = leader.department;
    }

    const tasks = await Task.find(query)
      .populate('assignedTo', 'username fullName')
      .populate('assignedBy', 'username fullName')
      .populate('assignedToDepartment', 'name')
      .sort({ createdAt: -1 });

    return res.json({ tasks });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to list tasks', error: err.message });
  }
}

async function updateTaskStatus(req, res) {
  try {
    const { status } = req.body;
    const Task = getTaskModel(req.tenantConnection);

    const task = await Task.findById(req.params.taskId);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    // Employees may only update their own task's status.
    if (req.user.role === 'employee' && String(task.assignedTo) !== String(req.user.id)) {
      return res.status(403).json({ message: 'You can only update your own tasks' });
    }

    task.status = status;
    await task.save();

    await notify(req.tenantConnection, {
      recipient: task.assignedBy,
      message: `Task "${task.title}" status changed to "${status}"`,
      type: 'task_status_changed',
      relatedId: task._id,
    });

    const User = getUserModel(req.tenantConnection);
    const assigner = await User.findById(task.assignedBy);
    if (assigner) {
      sendEmail({
        to: assigner.email,
        subject: `Task status updated: ${task.title}`,
        text: `The task "${task.title}" you assigned was updated to status "${status}" by ${req.user.username}.`,
      });
    }

    return res.json({ message: 'Task updated', task });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to update task', error: err.message });
  }
}

module.exports = { createTask, createCompanyTask, listTasks, updateTaskStatus };
