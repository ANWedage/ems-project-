const { getNotificationModel } = require('../models/notification.model');

async function listMyNotifications(req, res) {
  try {
    const Notification = getNotificationModel(req.tenantConnection);
    const notifications = await Notification.find({ recipient: req.user.id })
      .sort({ createdAt: -1 })
      .limit(50);

    const unreadCount = await Notification.countDocuments({ recipient: req.user.id, isRead: false });

    return res.json({ notifications, unreadCount });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch notifications', error: err.message });
  }
}

async function markAsRead(req, res) {
  try {
    const Notification = getNotificationModel(req.tenantConnection);
    const notification = await Notification.findOne({ _id: req.params.notificationId, recipient: req.user.id });
    if (!notification) return res.status(404).json({ message: 'Notification not found' });

    notification.isRead = true;
    await notification.save();

    return res.json({ message: 'Marked as read', notification });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to update notification', error: err.message });
  }
}

async function markAllAsRead(req, res) {
  try {
    const Notification = getNotificationModel(req.tenantConnection);
    await Notification.updateMany({ recipient: req.user.id, isRead: false }, { $set: { isRead: true } });
    return res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to update notifications', error: err.message });
  }
}

module.exports = { listMyNotifications, markAsRead, markAllAsRead };
