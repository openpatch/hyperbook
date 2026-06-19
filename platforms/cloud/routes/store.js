var express = require("express");
var crypto = require("crypto");
var db = require("../lib/db");
var middleware = require("../middleware/auth");

var router = express.Router();

function computeChecksum(data) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(data || null))
    .digest("hex");
}

function hasProvided(value) {
  return value !== null && value !== undefined;
}

async function getServerSyncHead(userId, hyperbookId) {
  var currentLatest = await db.getLatestEventId(userId, hyperbookId);
  var latestSnapshot = await db.getLatestSnapshot(userId, hyperbookId);
  return Math.max(
    currentLatest,
    latestSnapshot ? latestSnapshot.last_event_id : 0
  );
}

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
        stateChecksum: computeChecksum(state.data),
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
      var ifMatchChecksum = req.body.ifMatchChecksum;

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
      var serverLatest = await getServerSyncHead(userId, hyperbook.id);

      if (hasProvided(afterEventId) && afterEventId !== serverLatest) {
        res.status(409).json({
          error: "Stale state — re-fetch required",
          serverLastEventId: serverLatest,
        });
        return;
      }

      if (ifMatchChecksum) {
        var currentState = await db.reconstructState(userId, hyperbook.id);
        var serverChecksum = computeChecksum(currentState ? currentState.data : null);
        if (ifMatchChecksum !== serverChecksum) {
          res.status(409).json({
            error: "Stale state checksum mismatch",
            serverLastEventId: serverLatest,
            serverChecksum: serverChecksum,
          });
          return;
        }
      }

      var lastEventId = await db.appendEvents(userId, hyperbook.id, events);
      var updatedState = await db.reconstructState(userId, hyperbook.id);

      res.json({
        success: true,
        lastEventId: lastEventId,
        stateChecksum: computeChecksum(updatedState ? updatedState.data : null),
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
      var ifMatchLastEventId = req.body.ifMatchLastEventId;
      var ifMatchChecksum = req.body.ifMatchChecksum;
      var forceOverwrite = req.body.forceOverwrite === true;

      if (hasProvided(ifMatchLastEventId)) {
        ifMatchLastEventId = Number(ifMatchLastEventId);
      }

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

      var serverLatest = await getServerSyncHead(userId, hyperbook.id);

      if (!forceOverwrite) {
        if (hasProvided(ifMatchLastEventId) && ifMatchLastEventId !== serverLatest) {
          res.status(409).json({
            error: "Stale state — re-fetch required",
            serverLastEventId: serverLatest,
          });
          return;
        }

        if (ifMatchChecksum) {
          var currentState = await db.reconstructState(userId, hyperbook.id);
          var serverChecksum = computeChecksum(currentState ? currentState.data : null);
          if (ifMatchChecksum !== serverChecksum) {
            res.status(409).json({
              error: "Stale state checksum mismatch",
              serverLastEventId: serverLatest,
              serverChecksum: serverChecksum,
            });
            return;
          }
        }
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
        stateChecksum: computeChecksum(data),
      });
    } catch (error) {
      console.error("Save snapshot error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

module.exports = router;
