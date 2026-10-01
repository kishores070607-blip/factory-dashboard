/**
 * Middleware to require authentication.
 * @param {object} req 
 * @param {object} res 
 * @param {function} next 
 */
function requireAuth(req, res, next) {
  if (req.session && req.session.user) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

/**
 * Middleware generator to require specific roles.
 * @param {...string} roles 
 * @returns {function} middleware
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (req.session && req.session.user && roles.includes(req.session.user.role)) {
      next();
    } else {
      res.status(403).json({ error: 'Forbidden' });
    }
  };
}

module.exports = {
  requireAuth,
  requireRole
};
