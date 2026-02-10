var auth = require("../lib/auth");
var db = require("../lib/db");

function authenticateToken(req, res, next) {
  var authHeader = req.headers["authorization"];
  var token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  var decoded = auth.verifyToken(token);
  if (!decoded) {
    res.status(403).json({ error: "Invalid or expired token" });
    return;
  }

  req.user = decoded;
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}

function requireAdminOrTeacher(req, res, next) {
  if (!req.user || (req.user.role !== "admin" && req.user.role !== "teacher")) {
    res.status(403).json({ error: "Admin or teacher access required" });
    return;
  }
  next();
}

function requirePermission(permission) {
  return function (req, res, next) {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    if (req.user.role === "admin") {
      return next();
    }
    db.hasPermission(req.user.id, permission).then(function (has) {
      if (has) {
        next();
      } else {
        res.status(403).json({ error: "Permission denied" });
      }
    });
  };
}

function checkPermission(userId, role, permission) {
  if (role === "admin") return Promise.resolve(true);
  return db.hasPermission(userId, permission);
}

module.exports = {
  authenticateToken: authenticateToken,
  requireAdmin: requireAdmin,
  requireAdminOrTeacher: requireAdminOrTeacher,
  requirePermission: requirePermission,
  checkPermission: checkPermission,
};
