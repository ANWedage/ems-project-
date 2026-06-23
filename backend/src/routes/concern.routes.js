const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { submitConcern, listConcerns, updateConcernStatus, deleteConcern } = require('../controllers/concern.controller');

// PUBLIC — no auth — anyone can submit a concern (even if they can't log in)
router.post('/', submitConcern);

// CEO-only routes — require authentication
router.get('/', authenticate, authorize('ceo'), listConcerns);
router.patch('/:concernId/status', authenticate, authorize('ceo'), updateConcernStatus);
router.delete('/:concernId', authenticate, authorize('ceo'), deleteConcern);

module.exports = router;
