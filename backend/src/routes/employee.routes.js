const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { addEmployee, listEmployees } = require('../controllers/employee.controller');

router.use(authenticate);

router.post('/', authorize('team_leader'), addEmployee);
router.get('/', authorize('ceo', 'team_leader'), listEmployees);

module.exports = router;
