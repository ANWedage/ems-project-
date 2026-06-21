const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { createTask, listTasks, updateTaskStatus } = require('../controllers/task.controller');

router.use(authenticate);

router.post('/', authorize('ceo', 'team_leader'), createTask);
router.get('/', listTasks); // every role can view, scoped inside the controller
router.patch('/:taskId/status', updateTaskStatus);

module.exports = router;
