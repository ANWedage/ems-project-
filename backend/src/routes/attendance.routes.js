const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { checkIn, checkOut, myAttendance } = require('../controllers/attendance.controller');

router.use(authenticate);

router.post('/check-in', checkIn);
router.post('/check-out', checkOut);
router.get('/', myAttendance);

module.exports = router;
