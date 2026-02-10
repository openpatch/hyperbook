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

  db.exec(
    "CREATE TABLE IF NOT EXISTS stores (" +
      "user_id INTEGER NOT NULL," +
      "hyperbook_id INTEGER NOT NULL," +
      "data TEXT NOT NULL," +
      "updated_at DATETIME DEFAULT CURRENT_TIMESTAMP," +
      "PRIMARY KEY (user_id, hyperbook_id)," +
      "FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE," +
      "FOREIGN KEY (hyperbook_id) REFERENCES hyperbooks(id) ON DELETE CASCADE" +
      ")"
  );

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
};
