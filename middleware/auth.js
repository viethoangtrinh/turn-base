// Check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.userId) {
    return next();
  }
  return res.status(401).json({ error: "Unauthorized. Please login." });
};

// Check if user is admin
const isAdmin = (req, res, next) => {
  if (req.session && req.session.userId && req.session.role === "admin") {
    return next();
  }
  return res.status(403).json({ error: "Forbidden. Admin access required." });
};

module.exports = { isAuthenticated, isAdmin };
