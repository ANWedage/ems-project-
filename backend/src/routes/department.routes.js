const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { createDepartment, listDepartments } = require('../controllers/department.controller');

router.use(authenticate);

router.post('/', authorize('ceo'), createDepartment);
router.get('/', authorize('ceo', 'team_leader'), listDepartments);

module.exports = router;
