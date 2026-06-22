/**
 * Safely inserts a database name into a MongoDB connection string,
 * no matter what the base URI looks like.
 *
 * This matters because MongoDB Atlas's standard connection string looks like:
 *   mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
 * Note: it ends in query parameters, NOT a bare trailing slash.
 *
 * Naively concatenating `${baseUri}/${dbName}` in that case produces a broken
 * URL where the database name lands AFTER the query string and gets ignored,
 * causing every "tenant" connection to silently fall back to the same default
 * database - which is exactly what causes cross-company data leakage.
 *
 * This function parses the URL properly and rebuilds it with the correct
 * database name in the path, keeping all existing query parameters intact.
 */
function buildTenantMongoUri(baseUri, dbName) {
  if (!baseUri) throw new Error('MONGO_BASE_URI is not set');
  if (!dbName) throw new Error('dbName is required to build a tenant Mongo URI');

  // Node's URL parser handles mongodb:// and mongodb+srv:// schemes fine,
  // since both follow the standard scheme://host/path?query shape.
  const parsed = new URL(baseUri);

  // Force the path to be exactly "/<dbName>", discarding whatever
  // (often empty, or another db name) was there before.
  parsed.pathname = `/${dbName}`;

  return parsed.toString();
}

module.exports = { buildTenantMongoUri };
