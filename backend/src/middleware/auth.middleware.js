const { verifyToken } = require('../utils/jwt');
const { getTenantConnection } = require('../config/tenantManager');

/**
 * Every login token encodes which company database the user belongs to
 * (dbName), plus their userId/role/username inside that database.
 * This middleware:
 *   1. Verifies the JWT.
 *   2. Resolves the correct tenant (company) DB connection.
 *   3. Attaches both to req, so every controller downstream automatically
 *      operates on the correct company's isolated data - there is no way
 *      for a request to accidentally touch another company's database.
 */
function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing or invalid Authorization header' });
  }

  const token = header.split(' ')[1];

  try {
    const decoded = verifyToken(token);
    req.user = {
      id: decoded.id,
      username: decoded.username,
      role: decoded.role,
      dbName: decoded.dbName,
      companyName: decoded.companyName,
    };
    req.tenantConnection = getTenantConnection(decoded.dbName);
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

/**
 * Restrict a route to specific roles, e.g. authorize('ceo')
 * or authorize('ceo', 'team_leader').
 */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission to perform this action' });
    }
    next();
  };
}

module.exports = { authenticate, authorize };
