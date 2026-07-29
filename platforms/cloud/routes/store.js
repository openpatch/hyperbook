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

      // Reject malformed batches with a 400 rather than letting a bad
      // operation trip the CHECK constraint and surface as a 500 — the client
      // retries 5xx forever, but treats 4xx as terminal.
      var validationError = db.validateEvents(events);
      if (validationError) {
        res.status(400).json({ error: validationError });
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

      // The staleness check and the append happen in one transaction, so two
      // concurrent batches cannot both observe the same watermark and append.
      var result = await db.appendEventsIfCurrent(
        userId,
        hyperbook.id,
        events,
        afterEventId
      );

      if (result.conflict) {
        res.status(409).json({
          error: "Stale state — re-fetch required",
          serverLastEventId: result.serverLastEventId,
        });
        return;
      }

      res.json({
        success: true,
        lastEventId: result.lastEventId,
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

      var result = await db.replaceWithSnapshot(userId, hyperbook.id, data);

      res.json({
        success: true,
        snapshotId: result.snapshotId,
        lastEventId: result.lastEventId,
      });
    } catch (error) {
      console.error("Save snapshot error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

module.exports = router;
