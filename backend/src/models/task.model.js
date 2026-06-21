const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
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
