var Database = require("better-sqlite3");

var dbPath = process.env.DATABASE_PATH || "./database.sqlite";

var db = new Database(dbPath);

function runAsync(sql, params) {
  var stmt = db.prepare(sql);
  var result = stmt.run.apply(stmt, params || []);
  return Promise.resolve({
    lastID: result.lastInsertRowid,
    changes: result.changes,
  });
}

function getAsync(sql, params) {
  var stmt = db.prepare(sql);
  var row = stmt.get.apply(stmt, params || []);
  return Promise.resolve(row);
}

function allAsync(sql, params) {
  var stmt = db.prepare(sql);
  var rows = stmt.all.apply(stmt, params || []);
  return Promise.resolve(rows);
}

function initializeDatabase() {
  db.pragma("foreign_keys = ON");

  db.exec(
    "CREATE TABLE IF NOT EXISTS hyperbooks (" +
      "id INTEGER PRIMARY KEY AUTOINCREMENT," +
      "slug TEXT UNIQUE NOT NULL," +
      "name TEXT NOT NULL," +
      "url TEXT," +
      "description TEXT," +
      "created_at DATETIME DEFAULT CURRENT_TIMESTAMP" +
      ")"
  );

  db.exec(
    "CREATE TABLE IF NOT EXISTS groups (" +
      "id INTEGER PRIMARY KEY AUTOINCREMENT," +
      "hyperbook_id INTEGER NOT NULL," +
      "name TEXT NOT NULL," +
      "description TEXT," +
      "created_at DATETIME DEFAULT CURRENT_TIMESTAMP," +
      "FOREIGN KEY (hyperbook_id) REFERENCES hyperbooks(id) ON DELETE CASCADE," +
      "UNIQUE(hyperbook_id, name)" +
      ")"
  );

  // Check if the users table needs migration (add teacher role + email column)
  var tableInfo = db.pragma("table_info(users)");
  var hasEmail = tableInfo.some(function (col) {
    return col.name === "email";
  });

  if (tableInfo.length > 0 && !hasEmail) {
    // Migrate: recreate users table with teacher role and email column
    db.exec("PRAGMA foreign_keys = OFF");
    db.exec(
      "CREATE TABLE users_new (" +
        "id INTEGER PRIMARY KEY AUTOINCREMENT," +
        "username TEXT UNIQUE NOT NULL," +
        "password TEXT NOT NULL," +
        "email TEXT," +
        "role TEXT NOT NULL CHECK(role IN ('admin', 'student', 'teacher'))," +
        "group_id INTEGER," +
        "created_at DATETIME DEFAULT CURRENT_TIMESTAMP," +
        "FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE" +
        ")"
    );
    db.exec(
      "INSERT INTO users_new (id, username, password, role, group_id, created_at) " +
        "SELECT id, username, password, role, group_id, created_at FROM users"
    );
    db.exec("DROP TABLE users");
    db.exec("ALTER TABLE users_new RENAME TO users");
    db.exec("PRAGMA foreign_keys = ON");
    console.log("✓ Migrated users table (added teacher role + email)");
  } else if (tableInfo.length === 0) {
    db.exec(
      "CREATE TABLE IF NOT EXISTS users (" +
        "id INTEGER PRIMARY KEY AUTOINCREMENT," +
        "username TEXT UNIQUE NOT NULL," +
        "password TEXT NOT NULL," +
        "email TEXT," +
        "role TEXT NOT NULL CHECK(role IN ('admin', 'student', 'teacher'))," +
        "group_id INTEGER," +
        "created_at DATETIME DEFAULT CURRENT_TIMESTAMP," +
        "FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE" +
        ")"
    );
  }

  // === Event-sourcing tables ===

  db.exec(
    "CREATE TABLE IF NOT EXISTS events (" +
      "id INTEGER PRIMARY KEY AUTOINCREMENT," +
      "user_id INTEGER NOT NULL," +
      "hyperbook_id INTEGER NOT NULL," +
      "table_name TEXT NOT NULL," +
      "operation TEXT NOT NULL CHECK(operation IN ('create', 'update', 'delete'))," +
      "prim_key TEXT NOT NULL," +
      "data TEXT," +
      "created_at DATETIME DEFAULT CURRENT_TIMESTAMP," +
      "FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE," +
      "FOREIGN KEY (hyperbook_id) REFERENCES hyperbooks(id) ON DELETE CASCADE" +
      ")"
  );

  db.exec(
    "CREATE INDEX IF NOT EXISTS idx_events_user_hyperbook " +
      "ON events (user_id, hyperbook_id, id)"
  );

  db.exec(
    "CREATE TABLE IF NOT EXISTS snapshots (" +
      "id INTEGER PRIMARY KEY AUTOINCREMENT," +
      "user_id INTEGER NOT NULL," +
      "hyperbook_id INTEGER NOT NULL," +
      "data TEXT NOT NULL," +
      "last_event_id INTEGER NOT NULL DEFAULT 0," +
      "source TEXT NOT NULL DEFAULT 'manual'," +
      "created_at DATETIME DEFAULT CURRENT_TIMESTAMP," +
      "FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE," +
      "FOREIGN KEY (hyperbook_id) REFERENCES hyperbooks(id) ON DELETE CASCADE" +
      ")"
  );

  db.exec(
    "CREATE INDEX IF NOT EXISTS idx_snapshots_user_hyperbook " +
      "ON snapshots (user_id, hyperbook_id, id)"
  );

  // Add source column to snapshots if missing (migration)
  var snapshotColumns = db.prepare("PRAGMA table_info(snapshots)").all();
  var hasSourceCol = snapshotColumns.some(function (c) { return c.name === "source"; });
  if (!hasSourceCol) {
    db.exec("ALTER TABLE snapshots ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'");
  }

  // Migrate existing stores data into snapshots
  var hasStoresTable = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='stores'"
    )
    .get();

  if (hasStoresTable) {
    var storeRows = db
      .prepare("SELECT user_id, hyperbook_id, data, updated_at FROM stores")
      .all();

    for (var s = 0; s < storeRows.length; s++) {
      var row = storeRows[s];
      var existingSnapshot = db
        .prepare(
          "SELECT id FROM snapshots WHERE user_id = ? AND hyperbook_id = ? LIMIT 1"
        )
        .get(row.user_id, row.hyperbook_id);

      if (!existingSnapshot) {
        db.prepare(
          "INSERT INTO snapshots (user_id, hyperbook_id, data, last_event_id, created_at) " +
            "VALUES (?, ?, ?, 0, ?)"
        ).run(row.user_id, row.hyperbook_id, row.data, row.updated_at);
      }
    }

    if (storeRows.length > 0) {
      console.log(
        "✓ Migrated " + storeRows.length + " store rows to snapshots"
      );
    }

    db.exec("DROP TABLE stores");
    console.log("✓ Dropped legacy stores table");
  }

  db.exec(
    "CREATE TABLE IF NOT EXISTS permissions (" +
      "id INTEGER PRIMARY KEY AUTOINCREMENT," +
      "user_id INTEGER NOT NULL," +
      "permission TEXT NOT NULL," +
      "created_at DATETIME DEFAULT CURRENT_TIMESTAMP," +
      "FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE," +
      "UNIQUE(user_id, permission)" +
      ")"
  );

  console.log("✓ Database schema initialized");
  return Promise.resolve();
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
    "SELECT id, table_name, operation, prim_key, data, created_at FROM events " +
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

function appendEvents(userId, hyperbookId, events) {
  var stmt = db.prepare(
    "INSERT INTO events (user_id, hyperbook_id, table_name, operation, prim_key, data) " +
      "VALUES (?, ?, ?, ?, ?, ?)"
  );

  var insertMany = db.transaction(function (evts) {
    var lastId = 0;
    for (var i = 0; i < evts.length; i++) {
      var evt = evts[i];
      var result = stmt.run(
        userId,
        hyperbookId,
        evt.table,
        evt.op,
        String(evt.primKey),
        evt.data ? JSON.stringify(evt.data) : null
      );
      lastId = Number(result.lastInsertRowid);
    }
    return lastId;
  });

  var lastEventId = insertMany(events);
  return Promise.resolve(lastEventId);
}

function createSnapshot(userId, hyperbookId, data, lastEventId) {
  var insertAndClean = db.transaction(function () {
    var result = db
      .prepare(
        "INSERT INTO snapshots (user_id, hyperbook_id, data, last_event_id, source) " +
          "VALUES (?, ?, ?, ?, 'auto')"
      )
      .run(userId, hyperbookId, JSON.stringify(data), lastEventId);

    var newSnapshotId = Number(result.lastInsertRowid);

    // Delete older snapshots
    db.prepare(
      "DELETE FROM snapshots WHERE user_id = ? AND hyperbook_id = ? AND id < ?"
    ).run(userId, hyperbookId, newSnapshotId);

    // Delete events up to and including lastEventId
    db.prepare(
      "DELETE FROM events WHERE user_id = ? AND hyperbook_id = ? AND id <= ?"
    ).run(userId, hyperbookId, lastEventId);

    return newSnapshotId;
  });

  var snapshotId = insertAndClean();
  return Promise.resolve(snapshotId);
}

function replaceWithSnapshot(userId, hyperbookId, data) {
  var replaceAll = db.transaction(function () {
    // Delete all events
    db.prepare(
      "DELETE FROM events WHERE user_id = ? AND hyperbook_id = ?"
    ).run(userId, hyperbookId);

    // Delete all snapshots
    db.prepare(
      "DELETE FROM snapshots WHERE user_id = ? AND hyperbook_id = ?"
    ).run(userId, hyperbookId);

    // Insert new snapshot
    var result = db
      .prepare(
        "INSERT INTO snapshots (user_id, hyperbook_id, data, last_event_id, source) " +
          "VALUES (?, ?, ?, 0, 'manual')"
      )
      .run(userId, hyperbookId, JSON.stringify(data));

    return Number(result.lastInsertRowid);
  });

  var snapshotId = replaceAll();
  return Promise.resolve(snapshotId);
}

/**
 * Apply events to a snapshot to reconstruct the current state.
 * Snapshot data uses wrapper format: { version, data: { hyperbook: dexieExport } }
 * Dexie export has two formats:
 *   1. Real Dexie: tables=[{name,schema,rowCount}], data=[{tableName,inbound,rows}]
 *   2. Simplified: tables=[{name,schema,rowCount,rows}]
 */
function applyEventsToSnapshot(snapshotData, events) {
  if (!events || events.length === 0) return snapshotData;

  // Navigate to the Dexie inner data object inside the wrapper format
  var dexieData = snapshotData.data && snapshotData.data.hyperbook
    ? snapshotData.data.hyperbook.data
    : snapshotData.data;

  // Detect format: real Dexie has a data[] array alongside tables[]
  var useDataArray = Array.isArray(dexieData.data);
  var schemaList = dexieData.tables || [];
  var dataList = useDataArray ? dexieData.data : null;

  // Build schema lookup: tableName → schema string
  var schemaMap = {};
  for (var s = 0; s < schemaList.length; s++) {
    schemaMap[schemaList[s].name] = schemaList[s].schema || "id";
  }

  // Build row data lookup: tableName → entry with rows array
  var rowDataMap = {};
  if (useDataArray) {
    for (var d = 0; d < dataList.length; d++) {
      rowDataMap[dataList[d].tableName] = dataList[d];
    }
  } else {
    for (var t = 0; t < schemaList.length; t++) {
      if (!schemaList[t].rows) schemaList[t].rows = [];
      rowDataMap[schemaList[t].name] = { tableName: schemaList[t].name, inbound: true, rows: schemaList[t].rows };
    }
  }

  for (var i = 0; i < events.length; i++) {
    var evt = events[i];
    var tableName = evt.table_name;
    var data = evt.data ? JSON.parse(evt.data) : null;

    // Ensure schema entry exists
    if (!schemaMap[tableName]) {
      schemaMap[tableName] = "id";
      schemaList.push({ name: tableName, schema: "id", rowCount: 0 });
    }

    // Ensure data entry exists
    if (!rowDataMap[tableName]) {
      var newDataEntry = { tableName: tableName, inbound: true, rows: [] };
      if (useDataArray) {
        dataList.push(newDataEntry);
      } else {
        var schemaEntry = schemaList.find(function (e) { return e.name === tableName; });
        if (schemaEntry) schemaEntry.rows = [];
        newDataEntry.rows = schemaEntry ? schemaEntry.rows : [];
      }
      rowDataMap[tableName] = newDataEntry;
    }

    var rows = rowDataMap[tableName].rows;
    if (!rows) {
      rows = [];
      rowDataMap[tableName].rows = rows;
    }
    var pkField = schemaMap[tableName].split(",")[0].trim();

    if (evt.operation === "create") {
      rows.push(data);
    } else if (evt.operation === "update") {
      var found = false;
      for (var r = 0; r < rows.length; r++) {
        if (String(rows[r][pkField]) === evt.prim_key) {
          var keys = Object.keys(data);
          for (var k = 0; k < keys.length; k++) {
            rows[r][keys[k]] = data[keys[k]];
          }
          found = true;
          break;
        }
      }
      if (!found && data) {
        data[pkField] = evt.prim_key;
        rows.push(data);
      }
    } else if (evt.operation === "delete") {
      for (var del = 0; del < rows.length; del++) {
        if (String(rows[del][pkField]) === evt.prim_key) {
          rows.splice(del, 1);
          break;
        }
      }
    }

    // Update rowCount in schema entry
    var schema = schemaList.find(function (e) { return e.name === tableName; });
    if (schema) schema.rowCount = rows.length;
  }

  return snapshotData;
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

        var snapshotData = snapshot ? JSON.parse(snapshot.data) : {
          version: 1,
          data: {
            hyperbook: {
              formatName: "dexie",
              formatVersion: 1,
              data: { databaseName: "Hyperbook", databaseVersion: 2, tables: [] },
            },
          },
        };

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

        var reconstructed = applyEventsToSnapshot(snapshotData, events);

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
  initializeDatabase: initializeDatabase,
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
  appendEvents: appendEvents,
  createSnapshot: createSnapshot,
  replaceWithSnapshot: replaceWithSnapshot,
  applyEventsToSnapshot: applyEventsToSnapshot,
  reconstructState: reconstructState,
  getStoreUpdatedAt: getStoreUpdatedAt,
  SNAPSHOT_THRESHOLD: SNAPSHOT_THRESHOLD,
};
