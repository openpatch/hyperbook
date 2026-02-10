var express = require("express");
var db = require("../lib/db");
var middleware = require("../middleware/auth");

var router = express.Router();

router.get(
  "/:hyperbookId",
  middleware.authenticateToken,
  async function (req, res) {
    try {
      var hyperbookId = req.params.hyperbookId;
      var userId = req.user.id;

      var hyperbook = await db.getAsync(
        "SELECT id FROM hyperbooks WHERE slug = ?",
        [hyperbookId]
      );

      if (!hyperbook) {
        res.status(404).json({ error: "Hyperbook not found" });
        return;
      }

      var store = await db.getAsync(
        "SELECT data, updated_at FROM stores WHERE user_id = ? AND hyperbook_id = ?",
        [userId, hyperbook.id]
      );

      if (!store) {
        res.status(404).json({ error: "No store data found" });
        return;
      }

      res.json({
        data: JSON.parse(store.data),
        updatedAt: store.updated_at,
      });
    } catch (error) {
      console.error("Get store error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

router.post(
  "/:hyperbookId",
  middleware.authenticateToken,
  async function (req, res) {
    try {
      if (req.user.readonly) {
        res.status(403).json({ error: "Read-only access" });
        return;
      }

      var hyperbookId = req.params.hyperbookId;
      var userId = req.user.id;
      var data = req.body.data;

      if (!data) {
        res.status(400).json({ error: "Store data required" });
        return;
      }

      var hyperbook = await db.getAsync(
        "SELECT id FROM hyperbooks WHERE slug = ?",
        [hyperbookId]
      );

      if (!hyperbook) {
        res.status(404).json({ error: "Hyperbook not found" });
        return;
      }

      await db.runAsync(
        "INSERT INTO stores (user_id, hyperbook_id, data, updated_at) " +
          "VALUES (?, ?, ?, CURRENT_TIMESTAMP) " +
          "ON CONFLICT(user_id, hyperbook_id) " +
          "DO UPDATE SET data = ?, updated_at = CURRENT_TIMESTAMP",
        [userId, hyperbook.id, JSON.stringify(data), JSON.stringify(data)]
      );

      res.json({ success: true, updatedAt: new Date().toISOString() });
    } catch (error) {
      console.error("Save store error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

module.exports = router;
