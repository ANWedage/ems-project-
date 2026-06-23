const mongoose = require('mongoose');
const { buildTenantMongoUri } = require('./mongoUriBuilder');

let masterConnection = null;

/**
 * Connects to the MASTER database. This database only stores the
 * registry of companies (company name -> generated db name mapping).
 * It does NOT store any employee data - that lives in each company's
 * own isolated database (see tenantManager.js).
 */
async function connectMaster() {
  if (masterConnection) return masterConnection;

  const baseUri = process.env.MONGO_BASE_URI;
  const masterDbName = process.env.MASTER_DB_NAME || 'ems_master';

  const uri = buildTenantMongoUri(baseUri, masterDbName);

  masterConnection = await mongoose.createConnection(uri, {}).asPromise();
  console.log(`[master-db] connected -> ${masterDbName}`);
  return masterConnection;
}

function getMasterConnection() {
  if (!masterConnection) {
    throw new Error('Master DB not connected yet. Call connectMaster() first.');
  }
  return masterConnection;
}

module.exports = { connectMaster, getMasterConnection };
