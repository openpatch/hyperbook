var express = require("express");
var db = require("../lib/db");
var middleware = require("../middleware/auth");

var router = express.Router();

// GET /api/store/:hyperbookId — fetch current state (snapshot + event replay)
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

      var state = await db.reconstructState(userId, hyperbook.id);

      if (!state) {
        res.status(404).json({ error: "No store data found" });
        return;
      }

      res.json({
        snapshot: state.data,
        lastEventId: state.lastEventId,
        updatedAt: state.updatedAt,
      });
    } catch (error) {
      console.error("Get store error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// POST /api/store/:hyperbookId/events — append event batch
router.post(
  "/:hyperbookId/events",
  middleware.authenticateToken,
  async function (req, res) {
    try {
      if (req.user.readonly) {
        res.status(403).json({ error: "Read-only access" });
        return;
      }

      var hyperbookId = req.params.hyperbookId;
      var userId = req.user.id;
      var events = req.body.events;
      var afterEventId = req.body.afterEventId;

      if (!Array.isArray(events) || events.length === 0) {
        res.status(400).json({ error: "Events array required" });
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

      // Validate afterEventId matches server's latest
      var currentLatest = await db.getLatestEventId(userId, hyperbook.id);
      var latestSnapshot = await db.getLatestSnapshot(userId, hyperbook.id);
      var serverLatest = Math.max(
        currentLatest,
        latestSnapshot ? latestSnapshot.last_event_id : 0
      );

      if (afterEventId !== null && afterEventId !== undefined && afterEventId !== serverLatest) {
        res.status(409).json({
          error: "Stale state — re-fetch required",
          serverLastEventId: serverLatest,
        });
        return;
      }

      var lastEventId = await db.appendEvents(userId, hyperbook.id, events);

      res.json({
        success: true,
        lastEventId: lastEventId,
      });
    } catch (error) {
      console.error("Append events error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// POST /api/store/:hyperbookId/snapshot — full-state overwrite
router.post(
  "/:hyperbookId/snapshot",
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
        res.status(400).json({ error: "Snapshot data required" });
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

      var snapshotId = await db.replaceWithSnapshot(
        userId,
        hyperbook.id,
        data
      );

      res.json({
        success: true,
        snapshotId: snapshotId,
        lastEventId: 0,
      });
    } catch (error) {
      console.error("Save snapshot error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

module.exports = router;
