const bcrypt = require('bcryptjs');
const { getCompanyModel } = require('../models/masterCompany.model');
const { getUserModel } = require('../models/user.model');
const { getTenantConnection, generateDbNameFromCompany } = require('../config/tenantManager');
const { signToken } = require('../utils/jwt');

/**
 * STEP: "Setup as CEO" screen in the installer wizard.
 * Creates:
 *   1. A brand new, unique MongoDB database for this company.
 *   2. A CEO user inside that new database.
 *   3. A registry entry in the master DB mapping companyName -> dbName.
 */
async function registerCompany(req, res) {
  try {
    const { companyName, username, password, email } = req.body;

    if (!companyName || !username || !password || !email) {
      return res.status(400).json({ message: 'companyName, username, password and email are all required' });
    }

    const Company = getCompanyModel();

    const existing = await Company.findOne({ companyName }).collation({ locale: 'en', strength: 2 });
    if (existing) {
      return res.status(409).json({ message: 'A company with this name is already registered. Choose a different name.' });
    }

    const dbName = generateDbNameFromCompany(companyName);
    const tenantConnection = getTenantConnection(dbName);
    const User = getUserModel(tenantConnection);

    const hashedPassword = await bcrypt.hash(password, 10);

    const ceoUser = await User.create({
      username,
      password: hashedPassword,
      email,
      role: 'ceo',
      fullName: username,
    });

    await Company.create({ companyName, dbName, ceoEmail: email });

    const token = signToken({
      id: ceoUser._id,
      username: ceoUser.username,
      role: ceoUser.role,
      dbName,
      companyName,
    });

    return res.status(201).json({
      message: 'Company and CEO account created successfully',
      token,
      user: { id: ceoUser._id, username: ceoUser.username, role: ceoUser.role },
      companyName,
    });
  } catch (err) {
    console.error('registerCompany error:', err);
    return res.status(500).json({ message: 'Failed to register company', error: err.message });
  }
}

/**
 * Universal login for CEO, team leaders, and employees.
 * The user must tell us which company they belong to (by company name),
 * since usernames are only unique WITHIN a company's database, not globally.
 */
async function login(req, res) {
  try {
    const { companyName, username, password } = req.body;

    if (!companyName || !username || !password) {
      return res.status(400).json({ message: 'companyName, username and password are required' });
    }

    const Company = getCompanyModel();
    const company = await Company.findOne({ companyName }).collation({ locale: 'en', strength: 2 });

    if (!company) {
      return res.status(404).json({ message: 'No company found with that name' });
    }

    const tenantConnection = getTenantConnection(company.dbName);
    const User = getUserModel(tenantConnection);

    const user = await User.findOne({ username });
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const token = signToken({
      id: user._id,
      username: user.username,
      role: user.role,
      dbName: company.dbName,
      companyName: company.companyName,
    });

    return res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        fullName: user.fullName,
        department: user.department,
      },
      companyName: company.companyName,
    });
  } catch (err) {
    console.error('login error:', err);
    return res.status(500).json({ message: 'Login failed', error: err.message });
  }
}

/**
 * Lightweight helper used by the Electron "Setup as Employee" screen
 * just to validate that the typed company name actually exists,
 * before showing the plain login form.
 */
async function checkCompanyExists(req, res) {
  try {
    const { companyName } = req.query;
    if (!companyName) return res.status(400).json({ message: 'companyName query param is required' });

    const Company = getCompanyModel();
    const company = await Company.findOne({ companyName }).collation({ locale: 'en', strength: 2 });

    return res.json({ exists: !!company });
  } catch (err) {
    return res.status(500).json({ message: 'Lookup failed', error: err.message });
  }
}

module.exports = { registerCompany, login, checkCompanyExists };
