const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { createUser, listUsers, updateUser, deleteUser, toggleUserActive, searchUsers, getMe } = require('../controllers/users.controller');

router.use(authenticate);

router.get('/me', authorize('ceo', 'team_leader', 'employee'), getMe);
router.post('/', authorize('ceo'), createUser);
router.get('/', authorize('ceo'), listUsers);
router.get('/search', authorize('ceo'), searchUsers);
router.put('/:id', authorize('ceo'), updateUser);
router.patch('/:id/toggle-active', authorize('ceo'), toggleUserActive);
router.delete('/:id', authorize('ceo'), deleteUser);

module.exports = router;
