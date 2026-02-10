var nodemailer = require("nodemailer");

var transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  var host = process.env.SMTP_HOST;
  var port = parseInt(process.env.SMTP_PORT || "587", 10);
  var user = process.env.SMTP_USER;
  var pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host: host,
    port: port,
    secure: port === 465,
    auth: { user: user, pass: pass },
  });

  return transporter;
}

function sendPasswordResetEmail(email, resetUrl) {
  var transport = getTransporter();
  if (!transport) {
    console.warn("⚠️  SMTP not configured — cannot send password reset email");
    return Promise.reject(new Error("SMTP not configured"));
  }

  var from = process.env.SMTP_FROM || process.env.SMTP_USER;

  return transport.sendMail({
    from: from,
    to: email,
    subject: "Hyperbook — Password Reset",
    text:
      "You requested a password reset for your Hyperbook account.\n\n" +
      "Click the following link to reset your password (valid for 15 minutes):\n\n" +
      resetUrl +
      "\n\n" +
      "If you did not request this, please ignore this email.",
    html:
      "<p>You requested a password reset for your Hyperbook account.</p>" +
      '<p><a href="' +
      resetUrl +
      '">Click here to reset your password</a> (valid for 15 minutes).</p>' +
      "<p>If you did not request this, please ignore this email.</p>",
  });
}

module.exports = {
  sendPasswordResetEmail: sendPasswordResetEmail,
};
