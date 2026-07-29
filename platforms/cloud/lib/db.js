var Database = require("better-sqlite3");
var eventSourcing = require("./eventSourcing");
var migrations = require("./migrations");

var db = null;

/**
 * Open the sqlite handle on first use rather than at import time, so that the
 * process is free to set DATABASE_PATH (dotenv, tests) before the connection
 * is made, and so tests can inject a database and exercise the real module.
 */
function getDb() {
  if (!db) db = new Database(process.env.DATABASE_PATH || "./database.sqlite");
  return db;
}

/** Replace the sqlite handle. Intended for tests. */
function setDatabase(instance) {
  db = instance;
}

function runAsync(sql, params) {
  var stmt = getDb().prepare(sql);
  var result = stmt.run.apply(stmt, params || []);
  return Promise.resolve({
    lastID: result.lastInsertRowid,
    changes: result.changes,
  });
}

function getAsync(sql, params) {
  var stmt = getDb().prepare(sql);
  var row = stmt.get.apply(stmt, params || []);
  return Promise.resolve(row);
}

function allAsync(sql, params) {
  var stmt = getDb().prepare(sql);
  var rows = stmt.all.apply(stmt, params || []);
  return Promise.resolve(rows);
}

function initializeDatabase(options) {
  getDb().pragma("foreign_keys = ON");

  var result = migrations.migrate(getDb(), options);

  if (result.applied.length === 0) {
    console.log("✓ Database schema up to date (v" + result.to + ")");
  } else {
    console.log(
      "✓ Database schema migrated v" + result.from + " → v" + result.to
    );
  }

  return Promise.resolve(result);
}

function ensureAdminUser(username, password) {
  var bcrypt = require("bcryptjs");
  return getAsync(
    "SELECT id, password FROM users WHERE role = 'admin' LIMIT 1"
  ).then(function (admin) {
    if (!admin) {
      var hashed = bcrypt.hashSync(password, 10);
      return runAsync(
        "INSERT INTO users (username, password, role) VALUES (?, ?, 'admin')",
        [username, hashed]
      ).then(function () {
        console.log("✓ Admin user '" + username + "' created");
      });
    }
    // Migrate plain-text admin password to hashed if needed
    if (admin && !admin.password.startsWith("$2a$") && !admin.password.startsWith("$2b$")) {
      var hashed = bcrypt.hashSync(admin.password, 10);
      return runAsync("UPDATE users SET password = ? WHERE id = ?", [
        hashed,
        admin.id,
      ]).then(function () {
        console.log("✓ Admin password migrated to bcrypt");
      });
    }
  });
}

// === Permission helpers ===

function getUserPermissions(userId) {
  return allAsync(
    "SELECT id, permission, created_at FROM permissions WHERE user_id = ? ORDER BY permission",
    [userId]
  );
}

function hasPermission(userId, permission) {
  return getAsync(
    "SELECT id FROM permissions WHERE user_id = ? AND permission = ?",
    [userId, permission]
  ).then(function (row) {
    return !!row;
  });
}

function addPermission(userId, permission) {
  return runAsync(
    "INSERT OR IGNORE INTO permissions (user_id, permission) VALUES (?, ?)",
    [userId, permission]
  );
}

function removePermission(userId, permission) {
  return runAsync(
    "DELETE FROM permissions WHERE user_id = ? AND permission = ?",
    [userId, permission]
  );
}

function removePermissionsByPrefix(userId, prefix) {
  return runAsync(
    "DELETE FROM permissions WHERE user_id = ? AND permission LIKE ?",
    [userId, prefix + "%"]
  );
}

// === Event-sourcing helpers ===

var SNAPSHOT_THRESHOLD = parseInt(process.env.SNAPSHOT_THRESHOLD, 10) || 100;

function getLatestSnapshot(userId, hyperbookId) {
  return getAsync(
    "SELECT id, data, last_event_id, source, created_at FROM snapshots " +
      "WHERE user_id = ? AND hyperbook_id = ? ORDER BY id DESC LIMIT 1",
    [userId, hyperbookId]
  );
}

function getEventsSince(userId, hyperbookId, afterEventId) {
  return allAsync(
    "SELECT id, table_name, operation, prim_key, prim_key_json, table_schema, data, created_at FROM events " +
      "WHERE user_id = ? AND hyperbook_id = ? AND id > ? ORDER BY id ASC",
    [userId, hyperbookId, afterEventId]
  );
}

function getEventCountSince(userId, hyperbookId, afterEventId) {
  return getAsync(
    "SELECT COUNT(*) as count FROM events " +
      "WHERE user_id = ? AND hyperbook_id = ? AND id > ?",
    [userId, hyperbookId, afterEventId]
  );
}

function getLatestEventId(userId, hyperbookId) {
  return getAsync(
    "SELECT MAX(id) as max_id FROM events " +
      "WHERE user_id = ? AND hyperbook_id = ?",
    [userId, hyperbookId]
  ).then(function (row) {
    return row ? row.max_id || 0 : 0;
  });
}

function insertEvents(userId, hyperbookId, events) {
  var stmt = getDb().prepare(
    "INSERT INTO events (user_id, hyperbook_id, table_name, operation, prim_key, prim_key_json, table_schema, data) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  );

  var lastId = 0;
  for (var i = 0; i < events.length; i++) {
    var evt = events[i];
    var result = stmt.run(
      userId,
      hyperbookId,
      evt.table,
      evt.op,
      String(evt.primKey),
      JSON.stringify(evt.primKey),
      typeof evt.schema === "string" ? evt.schema : null,
      evt.data ? JSON.stringify(evt.data) : null
    );
    lastId = Number(result.lastInsertRowid);
  }
  return lastId;
}

function appendEvents(userId, hyperbookId, events) {
  var insertMany = getDb().transaction(function (evts) {
    return insertEvents(userId, hyperbookId, evts);
  });

  return Promise.resolve(insertMany(events));
}

/**
 * The event id a client must send as `afterEventId` to be considered current.
 * Snapshots reset the event log, so the snapshot's watermark counts too.
 */
function getServerLastEventIdSync(userId, hyperbookId) {
  var eventRow = getDb()
    .prepare(
      "SELECT MAX(id) as max_id FROM events WHERE user_id = ? AND hyperbook_id = ?"
    )
    .get(userId, hyperbookId);

  var snapshotRow = getDb()
    .prepare(
      "SELECT last_event_id FROM snapshots " +
        "WHERE user_id = ? AND hyperbook_id = ? ORDER BY id DESC LIMIT 1"
    )
    .get(userId, hyperbookId);

  return Math.max(
    eventRow && eventRow.max_id ? eventRow.max_id : 0,
    snapshotRow ? snapshotRow.last_event_id : 0
  );
}

function getServerLastEventId(userId, hyperbookId) {
  return Promise.resolve(getServerLastEventIdSync(userId, hyperbookId));
}

/**
 * Append a batch only if the client is up to date.
 *
 * The staleness check and the insert run inside one transaction. Doing them as
 * two separate statements let two concurrent requests both read the same
 * `serverLastEventId`, both pass the check, and both append — silently
 * interleaving two clients' events instead of returning a 409 to one of them.
 *
 * @returns {Promise<{conflict: boolean, lastEventId: number, serverLastEventId: number}>}
 */
function appendEventsIfCurrent(userId, hyperbookId, events, afterEventId) {
  var run = getDb().transaction(function () {
    var serverLatest = getServerLastEventIdSync(userId, hyperbookId);

    if (
      afterEventId !== null &&
      afterEventId !== undefined &&
      afterEventId !== serverLatest
    ) {
      return {
        conflict: true,
        lastEventId: serverLatest,
        serverLastEventId: serverLatest,
      };
    }

    var lastId = insertEvents(userId, hyperbookId, events);
    return {
      conflict: false,
      lastEventId: lastId,
      serverLastEventId: lastId,
    };
  });

  return Promise.resolve(run());
}

function createSnapshot(userId, hyperbookId, data, lastEventId) {
  var insertAndClean = getDb().transaction(function () {
    var result = getDb()
      .prepare(
        "INSERT INTO snapshots (user_id, hyperbook_id, data, last_event_id, source) " +
          "VALUES (?, ?, ?, ?, 'auto')"
      )
      .run(userId, hyperbookId, JSON.stringify(data), lastEventId);

    var newSnapshotId = Number(result.lastInsertRowid);

    // Delete older snapshots
    getDb().prepare(
      "DELETE FROM snapshots WHERE user_id = ? AND hyperbook_id = ? AND id < ?"
    ).run(userId, hyperbookId, newSnapshotId);

    // Delete events up to and including lastEventId
    getDb().prepare(
      "DELETE FROM events WHERE user_id = ? AND hyperbook_id = ? AND id <= ?"
    ).run(userId, hyperbookId, lastEventId);

    return newSnapshotId;
  });

  var snapshotId = insertAndClean();
  return Promise.resolve(snapshotId);
}

function replaceWithSnapshot(userId, hyperbookId, data) {
  var replaceAll = getDb().transaction(function () {
    // Delete all events
    getDb().prepare(
      "DELETE FROM events WHERE user_id = ? AND hyperbook_id = ?"
    ).run(userId, hyperbookId);

    // Delete all snapshots
    getDb().prepare(
      "DELETE FROM snapshots WHERE user_id = ? AND hyperbook_id = ?"
    ).run(userId, hyperbookId);

    // Insert new snapshot
    var result = getDb()
      .prepare(
        "INSERT INTO snapshots (user_id, hyperbook_id, data, last_event_id, source) " +
          "VALUES (?, ?, ?, 0, 'manual')"
      )
      .run(userId, hyperbookId, JSON.stringify(data));

    return Number(result.lastInsertRowid);
  });

  var snapshotId = replaceAll();
  // The event log was truncated, so the client's new watermark is 0.
  return Promise.resolve({ snapshotId: snapshotId, lastEventId: 0 });
}

/**
 * Reconstruct the full state for a user+hyperbook.
 * Creates a new snapshot if events exceed the threshold.
 * Returns { data, lastEventId, updatedAt } or null if no data exists.
 */
function reconstructState(userId, hyperbookId) {
  return getLatestSnapshot(userId, hyperbookId).then(function (snapshot) {
    var snapshotEventId = snapshot ? snapshot.last_event_id : 0;

    return getEventsSince(userId, hyperbookId, snapshotEventId).then(
      function (events) {
        if (!snapshot && events.length === 0) {
          return null;
        }

        var snapshotData = snapshot
          ? JSON.parse(snapshot.data)
          : eventSourcing.createEmptySnapshot();

        var lastEventId = events.length > 0
          ? events[events.length - 1].id
          : snapshotEventId;

        var updatedAt = events.length > 0
          ? events[events.length - 1].created_at
          : snapshot
            ? snapshot.created_at
            : null;

        if (events.length === 0) {
          return {
            data: snapshotData,
            lastEventId: lastEventId,
            updatedAt: updatedAt,
          };
        }

        var reconstructed = eventSourcing.applyEventsToSnapshot(
          snapshotData,
          events
        );

        // Create new snapshot if threshold exceeded
        if (events.length >= SNAPSHOT_THRESHOLD) {
          return createSnapshot(
            userId,
            hyperbookId,
            reconstructed,
            lastEventId
          ).then(function () {
            return {
              data: reconstructed,
              lastEventId: lastEventId,
              updatedAt: updatedAt,
            };
          });
        }

        return {
          data: reconstructed,
          lastEventId: lastEventId,
          updatedAt: updatedAt,
        };
      }
    );
  });
}

/**
 * Get the latest updated_at for a user+hyperbook (for admin views).
 */
function getStoreUpdatedAt(userId, hyperbookId) {
  return getAsync(
    "SELECT created_at FROM events WHERE user_id = ? AND hyperbook_id = ? ORDER BY id DESC LIMIT 1",
    [userId, hyperbookId]
  ).then(function (event) {
    if (event) return event.created_at;
    return getAsync(
      "SELECT created_at FROM snapshots WHERE user_id = ? AND hyperbook_id = ? ORDER BY id DESC LIMIT 1",
      [userId, hyperbookId]
    ).then(function (snap) {
      return snap ? snap.created_at : null;
    });
  });
}

module.exports = {
  runAsync: runAsync,
  getAsync: getAsync,
  allAsync: allAsync,
  setDatabase: setDatabase,
  initializeDatabase: initializeDatabase,
  schemaVersion: function () {
    return migrations.getVersion(getDb());
  },
  LATEST_SCHEMA_VERSION: migrations.LATEST_VERSION,
  ensureAdminUser: ensureAdminUser,
  getUserPermissions: getUserPermissions,
  hasPermission: hasPermission,
  addPermission: addPermission,
  removePermission: removePermission,
  removePermissionsByPrefix: removePermissionsByPrefix,
  // Event-sourcing
  getLatestSnapshot: getLatestSnapshot,
  getEventsSince: getEventsSince,
  getEventCountSince: getEventCountSince,
  getLatestEventId: getLatestEventId,
  getServerLastEventId: getServerLastEventId,
  appendEvents: appendEvents,
  appendEventsIfCurrent: appendEventsIfCurrent,
  createSnapshot: createSnapshot,
  replaceWithSnapshot: replaceWithSnapshot,
  applyEventsToSnapshot: eventSourcing.applyEventsToSnapshot,
  validateEvents: eventSourcing.validateEvents,
  createEmptySnapshot: eventSourcing.createEmptySnapshot,
  reconstructState: reconstructState,
  getStoreUpdatedAt: getStoreUpdatedAt,
  SNAPSHOT_THRESHOLD: SNAPSHOT_THRESHOLD,
};
