var jwt = require("jsonwebtoken");
var bcrypt = require("bcryptjs");

var JWT_SECRET =
  process.env.JWT_SECRET || "default-secret-change-in-production";
var JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "24h";

function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

function verifyPassword(password, stored, role) {
  if (role === "student") {
    return password === stored;
  }
  // admin and teacher use bcrypt
  return bcrypt.compareSync(password, stored);
}

function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function generateImpersonationToken(adminId, studentId, studentUsername) {
  return jwt.sign(
    {
      adminId: adminId,
      impersonating: studentId,
      id: studentId,
      username: studentUsername,
      role: "student",
      readonly: true,
    },
    JWT_SECRET,
    { expiresIn: "1h" }
  );
}

function generateResetToken(userId, email) {
  return jwt.sign(
    { id: userId, email: email, purpose: "password-reset" },
    JWT_SECRET,
    { expiresIn: "15m" }
  );
}

function verifyResetToken(token) {
  try {
    var decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.purpose !== "password-reset") return null;
    return decoded;
  } catch (e) {
    return null;
  }
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return null;
  }
}

module.exports = {
  hashPassword: hashPassword,
  verifyPassword: verifyPassword,
  generateToken: generateToken,
  generateImpersonationToken: generateImpersonationToken,
  generateResetToken: generateResetToken,
  verifyResetToken: verifyResetToken,
  verifyToken: verifyToken,
};
