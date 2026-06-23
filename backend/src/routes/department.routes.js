const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { createDepartment, updateDepartment, listDepartments, deleteDepartment } = require('../controllers/department.controller');

router.use(authenticate);

router.post('/', authorize('ceo'), createDepartment);
router.put('/:id', authorize('ceo'), updateDepartment);
router.get('/', authorize('ceo', 'team_leader'), listDepartments);
router.delete('/:id', authorize('ceo'), deleteDepartment);

module.exports = router;
