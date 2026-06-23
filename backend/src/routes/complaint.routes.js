const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const {
  submitComplaint,
  listComplaints,
  myComplaints,
  updateComplaint,
  deleteComplaint,
} = require('../controllers/complaint.controller');

router.use(authenticate);

// Employee / team leader
router.post('/', authorize('employee', 'team_leader'), submitComplaint);
router.get('/mine', authorize('employee', 'team_leader'), myComplaints);

// CEO
router.get('/', authorize('ceo'), listComplaints);
router.patch('/:complaintId', authorize('ceo'), updateComplaint);
router.delete('/:complaintId', authorize('ceo'), deleteComplaint);

module.exports = router;
