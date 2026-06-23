const mongoose = require('mongoose');
const { getMasterConnection } = require('../config/masterDb');

const companySchema = new mongoose.Schema(
  {
    companyName: { type: String, required: true, trim: true },
    dbName: { type: String, required: true, unique: true },
    ceoEmail: { type: String, required: true, lowercase: true, trim: true },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: 'companies' }
);

// Prevent the same company name being registered twice (case-insensitive)
companySchema.index({ companyName: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

function getCompanyModel() {
  const conn = getMasterConnection();
  // Reuse the model if already compiled on this connection
  return conn.models.Company || conn.model('Company', companySchema);
}

module.exports = { getCompanyModel };
