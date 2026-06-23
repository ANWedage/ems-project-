const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { createNotice, listNotices, deleteNotice } = require('../controllers/notice.controller');

router.use(authenticate);

router.post('/', authorize('ceo'), createNotice);
router.get('/', listNotices);
router.delete('/:noticeId', authorize('ceo'), deleteNotice);

module.exports = router;
