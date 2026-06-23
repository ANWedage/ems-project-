const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { checkIn, checkOut, myAttendance, getAllAttendance } = require('../controllers/attendance.controller');

router.use(authenticate);

router.post('/check-in', checkIn);
router.post('/check-out', checkOut);
router.get('/all', authorize('ceo'), getAllAttendance);
router.get('/', myAttendance);

module.exports = router;
