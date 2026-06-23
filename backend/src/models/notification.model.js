const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: ['task_assigned', 'task_status_changed', 'leave_requested', 'leave_reviewed', 'employee_added', 'employee_removed', 'department_created', 'department_assigned', 'account_created', 'account_updated', 'account_status', 'role_changed', 'general'],
      default: 'general',
    },
    relatedId: { type: mongoose.Schema.Types.ObjectId, default: null }, // e.g. the task/leave id this notification is about
    isRead: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: 'notifications' }
);

notificationSchema.index({ recipient: 1, createdAt: -1 });

function getNotificationModel(tenantConnection) {
  return tenantConnection.models.Notification || tenantConnection.model('Notification', notificationSchema);
}

module.exports = { getNotificationModel, notificationSchema };
