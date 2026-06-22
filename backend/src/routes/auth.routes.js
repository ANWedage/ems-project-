const express = require('express');
const router = express.Router();
const { registerCompany, login, checkCompanyExists } = require('../controllers/auth.controller');

router.post('/register-company', registerCompany); // "Setup as CEO" wizard step
router.post('/login', login); // used by CEO, team leaders, and employees alike
router.get('/company-exists', checkCompanyExists); // "Setup as Employee" wizard step

module.exports = router;
