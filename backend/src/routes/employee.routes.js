const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const {
  addEmployee,
  listEmployees,
  searchAllEmployees,
  addEmployeeToTeam,
  removeEmployeeFromTeam,
} = require('../controllers/employee.controller');

router.use(authenticate);

router.post('/', authorize('team_leader'), addEmployee);
router.get('/', authorize('ceo', 'team_leader'), listEmployees);
router.get('/search', authorize('team_leader'), searchAllEmployees);
router.post('/add-to-team', authorize('team_leader'), addEmployeeToTeam);
router.delete('/:id/remove-from-team', authorize('team_leader'), removeEmployeeFromTeam);

module.exports = router;
