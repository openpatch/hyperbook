var fs = require("fs");
var path = require("path");

/**
 * Schema migrations, tracked with `PRAGMA user_version`.
 *
 * Every step runs at most once, in order, and the version is only bumped after
 * the step succeeds. A database is never opened by a build older than the one
 * that last migrated it — a downgrade is refused rather than left to silently
 * read columns it does not understand.
 *
 * To add a schema change, append a new entry. Never edit or renumber an
 * existing one: deployments have already run it and will not run it again.
 */

/**
 * Step 1 is the whole schema as it stood before versioning existed.
 *
 * It is written to converge rather than to create, because it has to land both
 * a brand new file and a database from any earlier release: adding the teacher
 * role and email, `prim_key_json` and `table_schema` on events, `source` on
 * snapshots, and folding the retired `stores` table into snapshots.
 *
 * Everything after this point can be a plain forward-only step.
 */
function baseline(db) {
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

  // Older releases had no teacher role and no email column. SQLite cannot
  // widen a CHECK constraint in place, so the table is rebuilt.
  var tableInfo = db.pragma("table_info(users)");
  var hasEmail = tableInfo.some(function (col) {
    return col.name === "email";
  });

  if (tableInfo.length > 0 && !hasEmail) {
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
    console.log("  users: added teacher role and email");
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

  db.exec(
    "CREATE TABLE IF NOT EXISTS events (" +
      "id INTEGER PRIMARY KEY AUTOINCREMENT," +
      "user_id INTEGER NOT NULL," +
      "hyperbook_id INTEGER NOT NULL," +
      "table_name TEXT NOT NULL," +
      "operation TEXT NOT NULL CHECK(operation IN ('create', 'update', 'delete'))," +
      "prim_key TEXT NOT NULL," +
      // prim_key stores String(primKey), which loses the type of numeric keys
      // and flattens compound ones. prim_key_json keeps the original value;
      // prim_key is still written so an older build can still read the row.
      "prim_key_json TEXT," +
      // The Dexie primary-key source string ("id", "path", "++id", "[a+b]") of
      // the table an event targets. Without it the server must assume "id" for
      // any table it has not seen in a snapshot, corrupting tables keyed
      // otherwise.
      "table_schema TEXT," +
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

  // Only reached by a database created before these columns existed; a fresh
  // one gets them from the CREATE above.
  var eventColumns = db.prepare("PRAGMA table_info(events)").all();

  if (!hasColumn(eventColumns, "prim_key_json")) {
    db.exec("ALTER TABLE events ADD COLUMN prim_key_json TEXT");
    console.log("  events: added prim_key_json");
  }

  if (!hasColumn(eventColumns, "table_schema")) {
    db.exec("ALTER TABLE events ADD COLUMN table_schema TEXT");
    console.log("  events: added table_schema");
  }

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

  var snapshotColumns = db.prepare("PRAGMA table_info(snapshots)").all();
  if (!hasColumn(snapshotColumns, "source")) {
    db.exec(
      "ALTER TABLE snapshots ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'"
    );
    console.log("  snapshots: added source");
  }

  // `stores` held one JSON blob per user per hyperbook, before event sourcing.
  // Each row becomes the starting snapshot for that user.
  var hasStoresTable = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='stores'")
    .get();

  if (hasStoresTable) {
    var storeRows = db
      .prepare("SELECT user_id, hyperbook_id, data, updated_at FROM stores")
      .all();

    for (var s = 0; s < storeRows.length; s++) {
      var row = storeRows[s];
      var existing = db
        .prepare(
          "SELECT id FROM snapshots WHERE user_id = ? AND hyperbook_id = ? LIMIT 1"
        )
        .get(row.user_id, row.hyperbook_id);

      if (!existing) {
        db.prepare(
          "INSERT INTO snapshots (user_id, hyperbook_id, data, last_event_id, created_at) " +
            "VALUES (?, ?, ?, 0, ?)"
        ).run(row.user_id, row.hyperbook_id, row.data, row.updated_at);
      }
    }

    db.exec("DROP TABLE stores");
    console.log(
      "  stores: moved " + storeRows.length + " rows into snapshots and dropped"
    );
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
}

function hasColumn(columns, name) {
  return columns.some(function (c) {
    return c.name === name;
  });
}

var MIGRATIONS = [
  {
    version: 1,
    name: "baseline",
    // Rebuilding the users table toggles `PRAGMA foreign_keys`, which SQLite
    // ignores inside a transaction. This one step manages its own atomicity.
    transactional: false,
    up: baseline,
  },
];

var LATEST_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;

function getVersion(db) {
  var result = db.pragma("user_version", { simple: true });
  return Number(result) || 0;
}

/** True once the database holds anything worth backing up. */
function hasContent(db) {
  var table = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' LIMIT 1")
    .get();
  return Boolean(table);
}

/**
 * Copy the database aside before a migration touches it.
 *
 * `VACUUM INTO` produces a consistent copy without stopping the server, and
 * costs a few milliseconds on the database sizes this app produces. Restoring
 * is copying the file back, which is the point: an upgrade that goes wrong on
 * a school's only server should be recoverable without a backup strategy
 * anybody had to set up in advance.
 */
function backup(db, fromVersion) {
  var source = db.name;
  var stamp = new Date().toISOString().replace(/[:.]/g, "-");
  var target = path.join(
    path.dirname(source),
    path.basename(source) + ".v" + fromVersion + "-" + stamp + ".backup"
  );

  db.prepare("VACUUM INTO ?").run(target);
  return target;
}

/** Delete all but the newest `keep` backups, so upgrades cannot fill the disk. */
function pruneBackups(db, keep) {
  var source = db.name;
  var dir = path.dirname(source);
  var prefix = path.basename(source) + ".v";

  var backups = fs
    .readdirSync(dir)
    .filter(function (name) {
      return name.indexOf(prefix) === 0 && /\.backup$/.test(name);
    })
    .sort();

  backups.slice(0, Math.max(0, backups.length - keep)).forEach(function (name) {
    try {
      fs.unlinkSync(path.join(dir, name));
    } catch (error) {
      console.warn("Could not remove old backup " + name + ": " + error.message);
    }
  });
}

/**
 * Bring the database up to the current schema.
 *
 * @param {import("better-sqlite3").Database} db
 * @param {{backups?: boolean, keepBackups?: number}} [options]
 * @returns {{from: number, to: number, applied: string[], backup: string|null}}
 */
function migrate(db, options) {
  options = options || {};
  var keepBackups = options.keepBackups === undefined ? 5 : options.keepBackups;

  var current = getVersion(db);

  if (current > LATEST_VERSION) {
    throw new Error(
      "Database schema is version " +
        current +
        ", but this build only understands " +
        LATEST_VERSION +
        ". You are running an older Hyperbook Cloud than the one that last " +
        "wrote this database. Upgrade the server, or restore a backup taken " +
        "before the upgrade."
    );
  }

  var pending = MIGRATIONS.filter(function (m) {
    return m.version > current;
  });

  if (pending.length === 0) return { from: current, to: current, applied: [], backup: null };

  // An in-memory database has nothing to lose, and a database with no tables
  // yet is a first run, not an upgrade.
  var wantsBackup =
    options.backups !== false && !db.memory && db.name && hasContent(db);

  var backupPath = null;
  if (wantsBackup) {
    try {
      backupPath = backup(db, current);
      console.log("✓ Backed up database to " + path.basename(backupPath));
    } catch (error) {
      throw new Error(
        "Refusing to migrate: could not back up the database first (" +
          error.message +
          ")"
      );
    }
  }

  var applied = [];
  for (var i = 0; i < pending.length; i++) {
    var migration = pending[i];
    try {
      if (migration.transactional === false) {
        migration.up(db);
      } else {
        db.transaction(migration.up)(db);
      }
      // Only after the step succeeds, so a crash re-runs it rather than
      // skipping it. PRAGMA does not accept a bound parameter.
      db.pragma("user_version = " + migration.version);
      applied.push(migration.name);
      console.log("✓ Applied migration " + migration.version + " (" + migration.name + ")");
    } catch (error) {
      var hint = backupPath
        ? " A backup was taken first: " + backupPath
        : "";
      throw new Error(
        "Migration " +
          migration.version +
          " (" +
          migration.name +
          ") failed: " +
          error.message +
          "." +
          hint
      );
    }
  }

  if (backupPath) pruneBackups(db, keepBackups);

  return { from: current, to: getVersion(db), applied: applied, backup: backupPath };
}

module.exports = {
  migrate: migrate,
  getVersion: getVersion,
  LATEST_VERSION: LATEST_VERSION,
  MIGRATIONS: MIGRATIONS,
};
