const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { listMyNotifications, markAsRead, markAllAsRead } = require('../controllers/notification.controller');

router.use(authenticate);

router.get('/', listMyNotifications);
router.patch('/:notificationId/read', markAsRead);
router.patch('/read-all', markAllAsRead);

module.exports = router;
