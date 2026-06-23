const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },

    // Who's actually doing the work. Required for regular team tasks
    // (leader -> member). Left null for a company task that the CEO has
    // handed to a department but the leader hasn't broken down yet.
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // The department this task belongs to either way - used to scope a
    // team leader's task list regardless of who it's assigned to.
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },

    // Set only on a company task: which department/team it was delegated
    // to as a whole (before the leader splits it into individual tasks).
    assignedToDepartment: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },

    // 'company': CEO -> department/team leader, not yet assigned to a person.
    // 'team': a normal task assigned to one member (by a leader, or split
    // out from a company task).
    scope: { type: String, enum: ['company', 'team'], default: 'team' },

    // If this task was created by a team leader breaking down a company
    // task into individual work items, this points back to that company
    // task so progress can be traced.
    parentTask: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', default: null },

    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'blocked'],
      default: 'pending',
    },
    dueDate: { type: Date },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: 'tasks' }
);

function getTaskModel(tenantConnection) {
  return tenantConnection.models.Task || tenantConnection.model('Task', taskSchema);
}

module.exports = { getTaskModel, taskSchema };
