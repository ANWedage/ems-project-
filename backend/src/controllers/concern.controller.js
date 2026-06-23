const { getConcernModel } = require('../models/concern.model');
const { getCompanyModel } = require('../models/masterCompany.model');
const { getTenantConnection } = require('../config/tenantManager');

/**
 * PUBLIC — no auth required.
 * User provides: companyName, name, username, email (optional), message.
 * We look up the company in the master DB to get its dbName, then
 * store the concern in that company's tenant database.
 */
async function submitConcern(req, res) {
  try {
    const { companyName, name, username, email, message } = req.body;

    if (!companyName || !name || !username || !email || !message) {
      return res.status(400).json({ message: 'All fields are required: companyName, name, username, email, message' });
    }

    // Find the company in the master registry
    const Company = getCompanyModel();
    const company = await Company.findOne({ companyName }).collation({ locale: 'en', strength: 2 });
    if (!company) {
      return res.status(404).json({ message: 'Company not found. Please check the company name.' });
    }

    const tenantConn = getTenantConnection(company.dbName);
    const Concern = getConcernModel(tenantConn);

    const concern = await Concern.create({ name, username, email, message });
    return res.status(201).json({ message: 'Concern submitted successfully', concern });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to submit concern', error: err.message });
  }
}

/** CEO only — list all concerns for their company. */
async function listConcerns(req, res) {
  try {
    const Concern = getConcernModel(req.tenantConnection);
    const concerns = await Concern.find().sort({ createdAt: -1 });
    const newCount = concerns.filter(c => c.status === 'new').length;
    return res.json({ concerns, newCount });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch concerns', error: err.message });
  }
}

/** CEO only — mark a concern as reviewed. */
async function updateConcernStatus(req, res) {
  try {
    const { status } = req.body;
    if (!['new', 'reviewed'].includes(status)) {
      return res.status(400).json({ message: "status must be 'new' or 'reviewed'" });
    }
    const Concern = getConcernModel(req.tenantConnection);
    const concern = await Concern.findByIdAndUpdate(
      req.params.concernId,
      { status },
      { new: true }
    );
    if (!concern) return res.status(404).json({ message: 'Concern not found' });
    return res.json({ message: 'Concern updated', concern });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to update concern', error: err.message });
  }
}

/** CEO only — delete a concern. */
async function deleteConcern(req, res) {
  try {
    const Concern = getConcernModel(req.tenantConnection);
    const concern = await Concern.findByIdAndDelete(req.params.concernId);
    if (!concern) return res.status(404).json({ message: 'Concern not found' });
    return res.json({ message: 'Concern deleted' });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to delete concern', error: err.message });
  }
}

module.exports = { submitConcern, listConcerns, updateConcernStatus, deleteConcern };
