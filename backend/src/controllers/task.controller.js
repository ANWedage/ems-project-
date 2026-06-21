const { getTaskModel } = require('../models/task.model');
const { getUserModel } = require('../models/user.model');

async function createTask(req, res) {
  try {
    const { title, description, assignedTo, dueDate } = req.body;
    if (!title || !assignedTo) {
      return res.status(400).json({ message: 'title and assignedTo are required' });
    }

    const Task = getTaskModel(req.tenantConnection);
    const User = getUserModel(req.tenantConnection);

    const assignee = await User.findById(assignedTo);
    if (!assignee) return res.status(404).json({ message: 'Assigned user not found' });

    const task = await Task.create({
      title,
      description,
      assignedTo,
      assignedBy: req.user.id,
      department: assignee.department,
      dueDate,
    });

    return res.status(201).json({ message: 'Task assigned', task });
  } catch (err) {
    console.error('createTask error:', err);
    return res.status(500).json({ message: 'Failed to create task', error: err.message });
  }
}

/**
 * Returns tasks scoped to the requester's role:
 *  - employee: only their own tasks
 *  - team_leader: all tasks within their department
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

    return res.json({ message: 'Task updated', task });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to update task', error: err.message });
  }
}

module.exports = { createTask, listTasks, updateTaskStatus };
