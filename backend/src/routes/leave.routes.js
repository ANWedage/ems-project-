const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { requestLeave, listLeaves, reviewLeave } = require('../controllers/leave.controller');

router.use(authenticate);

router.post('/', authorize('employee'), requestLeave);
router.get('/', listLeaves); // scoped per role inside controller
router.patch('/:leaveId/review', authorize('ceo', 'team_leader'), reviewLeave);

module.exports = router;
