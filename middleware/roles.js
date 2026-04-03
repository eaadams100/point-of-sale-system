/**
 * Role hierarchy: admin > manager > cashier
 * Usage: router.get('/route', auth, roles('admin', 'manager'), controller)
 */
module.exports = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Required role(s): ${allowedRoles.join(', ')}.`
      });
    }
    next();
  };
};
