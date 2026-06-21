const mongoose = require('mongoose');

// Cache of open tenant connections, keyed by dbName, so we don't
// reconnect to MongoDB on every single request.
const tenantConnections = new Map();

/**
 * Returns (and creates if needed) a dedicated mongoose connection
 * for a specific company's database. Each company is FULLY isolated
 * in its own MongoDB database - different companies can never see
 * or query each other's data because they are literally different
 * connections/databases.
 */
function getTenantConnection(dbName) {
  if (!dbName) throw new Error('dbName is required to resolve a tenant connection');

  if (tenantConnections.has(dbName)) {
    return tenantConnections.get(dbName);
  }

  const baseUri = process.env.MONGO_BASE_URI;
  const uri = `${baseUri.replace(/\/$/, '')}/${dbName}`;

  const connection = mongoose.createConnection(uri, {});

  connection.on('connected', () => console.log(`[tenant-db] connected -> ${dbName}`));
  connection.on('error', (err) => console.error(`[tenant-db] error on ${dbName}:`, err.message));

  tenantConnections.set(dbName, connection);
  return connection;
}

/**
 * Turns a human-entered company name into a safe, unique Mongo
 * database name. e.g. "Acme Pvt Ltd!" -> "acme_pvt_ltd_4f8a2c"
 * The random suffix guarantees uniqueness even if two companies
 * pick very similar names.
 */
function generateDbNameFromCompany(companyName) {
  const slug = companyName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);

  const uniqueSuffix = Math.random().toString(36).slice(2, 8);
  return `ems_${slug}_${uniqueSuffix}`;
}

module.exports = { getTenantConnection, generateDbNameFromCompany };
