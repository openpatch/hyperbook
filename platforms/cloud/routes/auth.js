var express = require("express");
var db = require("../lib/db");
var auth = require("../lib/auth");
var middleware = require("../middleware/auth");

var router = express.Router();

router.post("/login", async function (req, res) {
  try {
    var username = req.body.username;
    var password = req.body.password;

    if (!username || !password) {
      res.status(400).json({ error: "Username and password required" });
      return;
    }

    var user = await db.getAsync(
      "SELECT id, username, password, role FROM users WHERE username = ?",
      [username]
    );

    if (!user) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    var validPassword = auth.verifyPassword(password, user.password, user.role);
    if (!validPassword) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    var token = auth.generateToken({
      id: user.id,
      username: user.username,
      role: user.role,
    });

    res.json({
      token: token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/verify", middleware.authenticateToken, function (req, res) {
  res.json({
    valid: true,
    user: {
      id: req.user.id,
      username: req.user.username,
      role: req.user.role,
    },
  });
});

module.exports = router;
