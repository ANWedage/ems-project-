const { getNotificationModel } = require('../models/notification.model');

/**
 * Creates a notification for a single recipient inside a specific
 * company's tenant database. Call this from any controller after an
 * event happens that the recipient should know about.
 *
 * Usage:
 *   await notify(req.tenantConnection, {
 *     recipient: someUserId,
 *     message: 'You have been assigned a new task: Fix login bug',
 *     type: 'task_assigned',
 *     relatedId: task._id,
 *   });
 */
async function notify(tenantConnection, { recipient, message, type = 'general', relatedId = null }) {
  if (!recipient || !message) return null;
  const Notification = getNotificationModel(tenantConnection);
  return Notification.create({ recipient, message, type, relatedId });
}

/**
 * Same as notify(), but for multiple recipients at once
 * (e.g. notifying every employee in a department).
 */
async function notifyMany(tenantConnection, recipientIds, { message, type = 'general', relatedId = null }) {
  if (!recipientIds || recipientIds.length === 0 || !message) return [];
  const Notification = getNotificationModel(tenantConnection);
  const docs = recipientIds.map((recipient) => ({ recipient, message, type, relatedId }));
  return Notification.insertMany(docs);
}

module.exports = { notify, notifyMany };
