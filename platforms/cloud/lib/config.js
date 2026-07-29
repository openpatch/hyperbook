var crypto = require("crypto");

/**
 * Startup configuration checks.
 *
 * These only fail in production. A misconfigured production server is worse
 * than one that will not start: with the placeholder JWT secret, anybody who
 * has read the repository can mint a valid admin token for any deployment that
 * forgot to set it, and nothing in the logs would ever say so.
 *
 * Development keeps its convenient defaults.
 */

// The value lib/auth.js falls back to. Kept in one place so the check cannot
// drift away from what is actually used.
var PLACEHOLDER_SECRET = "default-secret-change-in-production";
var MIN_SECRET_LENGTH = 32;

/** A secret in the shape the error messages suggest. */
function suggestSecret() {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * @param {NodeJS.ProcessEnv} env
 * @returns {string[]} One message per problem; empty when the config is usable.
 */
function check(env) {
  var problems = [];

  if (env.NODE_ENV !== "production") return problems;

  var secret = env.JWT_SECRET;

  if (!secret || secret === PLACEHOLDER_SECRET) {
    problems.push(
      "JWT_SECRET is " +
        (secret ? "still the placeholder value" : "not set") +
        ". Every session token would be forgeable by anyone who has seen " +
        "the source. Set it to a private random string, for example:\n" +
        "    JWT_SECRET=" +
        suggestSecret()
    );
  } else if (secret.length < MIN_SECRET_LENGTH) {
    problems.push(
      "JWT_SECRET is only " +
        secret.length +
        " characters. Use at least " +
        MIN_SECRET_LENGTH +
        ", for example:\n    JWT_SECRET=" +
        suggestSecret()
    );
  }

  if (!env.BASE_URL) {
    problems.push(
      "BASE_URL is not set. Password reset links are built from it, and it " +
        "is the origin hyperbooks are allowed to sync from, so both break " +
        "without it. Set it to the address readers use, for example:\n" +
        "    BASE_URL=https://cloud.example.com"
    );
  }

  // Not fatal on its own — a deployment may reset passwords by hand — but
  // half a mail configuration silently sends nothing.
  var smtpKeys = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"];
  var smtpSet = smtpKeys.filter(function (key) {
    return Boolean(env[key]);
  });
  if (smtpSet.length > 0 && smtpSet.length < smtpKeys.length) {
    var missing = smtpKeys.filter(function (key) {
      return !env[key];
    });
    problems.push(
      "SMTP is half configured: " +
        missing.join(", ") +
        " missing. Password reset emails will fail to send. Set the rest, or " +
        "unset all of " +
        smtpKeys.join(", ") +
        " to disable email."
    );
  }

  return problems;
}

/**
 * Check the environment and throw if the server must not start.
 *
 * @param {NodeJS.ProcessEnv} [env]
 */
function assertUsable(env) {
  var problems = check(env || process.env);
  if (problems.length === 0) return;

  throw new Error(
    "Hyperbook Cloud cannot start in production with this configuration:\n\n" +
      problems
        .map(function (problem, i) {
          return "  " + (i + 1) + ". " + problem;
        })
        .join("\n\n") +
      "\n\nSet these in your .env file (or as environment variables) and " +
      "start again."
  );
}

module.exports = {
  check: check,
  assertUsable: assertUsable,
  suggestSecret: suggestSecret,
  PLACEHOLDER_SECRET: PLACEHOLDER_SECRET,
  MIN_SECRET_LENGTH: MIN_SECRET_LENGTH,
};
