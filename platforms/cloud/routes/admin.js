var express = require("express");
var db = require("../lib/db");
var auth = require("../lib/auth");
var middleware = require("../middleware/auth");

var router = express.Router();

router.use(middleware.authenticateToken, middleware.requireAdminOrTeacher);

// ===== Hyperbook Management =====

router.get("/hyperbooks", async function (req, res) {
  try {
    var hyperbooks = await db.allAsync(
      "SELECT id, slug, name, url, description, created_at FROM hyperbooks ORDER BY name"
    );
    if (req.user.role === "teacher") {
      var perms = await db.getUserPermissions(req.user.id);
      var permSet = {};
      perms.forEach(function (p) { permSet[p.permission] = true; });
      hyperbooks = hyperbooks.filter(function (hb) {
        return permSet["hyperbook:" + hb.id + ":read"];
      });
    }
    res.json({ hyperbooks: hyperbooks });
  } catch (error) {
    console.error("List hyperbooks error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/hyperbooks", async function (req, res) {
  try {
    var allowed = await middleware.checkPermission(req.user.id, req.user.role, "hyperbooks:create");
    if (!allowed) {
      res.status(403).json({ error: "Permission denied" });
      return;
    }

    var slug = req.body.slug;
    var name = req.body.name;
    var url = req.body.url;
    var description = req.body.description;

    if (!slug || !name) {
      res.status(400).json({ error: "Slug and name required" });
      return;
    }

    var result = await db.runAsync(
      "INSERT INTO hyperbooks (slug, name, url, description) VALUES (?, ?, ?, ?)",
      [slug, name, url || null, description || null]
    );

    // Grant the creator full permissions on the new hyperbook if they are a teacher
    if (req.user.role === "teacher") {
      var hbId = result.lastID;
      var allPerms = [
        "hyperbook:" + hbId + ":read",
        "hyperbook:" + hbId + ":update",
        "hyperbook:" + hbId + ":delete",
        "hyperbook:" + hbId + ":groups:create",
        "hyperbook:" + hbId + ":groups:update",
        "hyperbook:" + hbId + ":groups:delete",
        "hyperbook:" + hbId + ":students:create",
        "hyperbook:" + hbId + ":students:update",
        "hyperbook:" + hbId + ":students:delete",
      ];
      for (var i = 0; i < allPerms.length; i++) {
        await db.addPermission(req.user.id, allPerms[i]);
      }
    }

    res.json({
      id: result.lastID,
      slug: slug,
      name: name,
      url: url,
      description: description,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
      res.status(409).json({ error: "Hyperbook slug already exists" });
      return;
    }
    console.error("Create hyperbook error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/hyperbooks/:id", async function (req, res) {
  try {
    var id = req.params.id;
    var allowed = await middleware.checkPermission(req.user.id, req.user.role, "hyperbook:" + id + ":update");
    if (!allowed) {
      res.status(403).json({ error: "Permission denied" });
      return;
    }

    var slug = req.body.slug;
    var name = req.body.name;
    var url = req.body.url;
    var description = req.body.description;

    if (!slug || !name) {
      res.status(400).json({ error: "Slug and name required" });
      return;
    }

    var result = await db.runAsync(
      "UPDATE hyperbooks SET slug = ?, name = ?, url = ?, description = ? WHERE id = ?",
      [slug, name, url || null, description || null, id]
    );

    if (result.changes === 0) {
      res.status(404).json({ error: "Hyperbook not found" });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
      res.status(409).json({ error: "Slug already exists" });
      return;
    }
    console.error("Update hyperbook error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/hyperbooks/:id", async function (req, res) {
  try {
    var id = req.params.id;
    var allowed = await middleware.checkPermission(req.user.id, req.user.role, "hyperbook:" + id + ":delete");
    if (!allowed) {
      res.status(403).json({ error: "Permission denied" });
      return;
    }
    await db.runAsync("DELETE FROM hyperbooks WHERE id = ?", [id]);
    res.json({ success: true });
  } catch (error) {
    console.error("Delete hyperbook error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ===== Group Management =====

router.get("/hyperbooks/:hyperbookId/groups", async function (req, res) {
  try {
    var hyperbookId = req.params.hyperbookId;
    var allowed = await middleware.checkPermission(req.user.id, req.user.role, "hyperbook:" + hyperbookId + ":read");
    if (!allowed) {
      res.status(403).json({ error: "Permission denied" });
      return;
    }

    var groups = await db.allAsync(
      "SELECT g.id, g.name, g.description, g.created_at," +
        "(SELECT COUNT(*) FROM users u WHERE u.group_id = g.id) as student_count " +
        "FROM groups g WHERE g.hyperbook_id = ? ORDER BY g.name",
      [hyperbookId]
    );
    res.json({ groups: groups });
  } catch (error) {
    console.error("List groups error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/hyperbooks/:hyperbookId/groups", async function (req, res) {
  try {
    var hyperbookId = req.params.hyperbookId;
    var allowed = await middleware.checkPermission(req.user.id, req.user.role, "hyperbook:" + hyperbookId + ":groups:create");
    if (!allowed) {
      res.status(403).json({ error: "Permission denied" });
      return;
    }

    var name = req.body.name;
    var description = req.body.description;

    if (!name) {
      res.status(400).json({ error: "Group name required" });
      return;
    }

    var result = await db.runAsync(
      "INSERT INTO groups (hyperbook_id, name, description) VALUES (?, ?, ?)",
      [hyperbookId, name, description || null]
    );

    res.json({
      id: result.lastID,
      hyperbookId: hyperbookId,
      name: name,
      description: description,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
      res
        .status(409)
        .json({ error: "Group name already exists in this hyperbook" });
      return;
    }
    console.error("Create group error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/groups/:id", async function (req, res) {
  try {
    var id = req.params.id;
    var group = await db.getAsync("SELECT hyperbook_id FROM groups WHERE id = ?", [id]);
    if (!group) {
      res.status(404).json({ error: "Group not found" });
      return;
    }
    var allowed = await middleware.checkPermission(req.user.id, req.user.role, "hyperbook:" + group.hyperbook_id + ":groups:update");
    if (!allowed) {
      res.status(403).json({ error: "Permission denied" });
      return;
    }

    var name = req.body.name;
    var description = req.body.description;

    if (!name) {
      res.status(400).json({ error: "Name required" });
      return;
    }

    var result = await db.runAsync(
      "UPDATE groups SET name = ?, description = ? WHERE id = ?",
      [name, description || null, id]
    );

    if (result.changes === 0) {
      res.status(404).json({ error: "Group not found" });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
      res
        .status(409)
        .json({ error: "Group name already exists in this hyperbook" });
      return;
    }
    console.error("Update group error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/groups/:id", async function (req, res) {
  try {
    var id = req.params.id;
    var group = await db.getAsync("SELECT hyperbook_id FROM groups WHERE id = ?", [id]);
    if (!group) {
      res.status(404).json({ error: "Group not found" });
      return;
    }
    var allowed = await middleware.checkPermission(req.user.id, req.user.role, "hyperbook:" + group.hyperbook_id + ":groups:delete");
    if (!allowed) {
      res.status(403).json({ error: "Permission denied" });
      return;
    }
    await db.runAsync("DELETE FROM groups WHERE id = ?", [id]);
    res.json({ success: true });
  } catch (error) {
    console.error("Delete group error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ===== Student Management =====

// Helper to resolve hyperbook_id from a groupId
async function getHyperbookIdForGroup(groupId) {
  var group = await db.getAsync("SELECT hyperbook_id FROM groups WHERE id = ?", [groupId]);
  return group ? group.hyperbook_id : null;
}

router.get("/students", async function (req, res) {
  try {
    var groupId = req.query.groupId;
    if (groupId) {
      var hbId = await getHyperbookIdForGroup(groupId);
      if (hbId) {
        var allowed = await middleware.checkPermission(req.user.id, req.user.role, "hyperbook:" + hbId + ":read");
        if (!allowed) {
          res.status(403).json({ error: "Permission denied" });
          return;
        }
      }
    }

    var query;
    var params;

    if (groupId) {
      query =
        "SELECT u.id, u.username, u.password, u.created_at, s.updated_at as store_updated_at " +
        "FROM users u " +
        "LEFT JOIN groups g ON u.group_id = g.id " +
        "LEFT JOIN stores s ON s.user_id = u.id AND s.hyperbook_id = g.hyperbook_id " +
        "WHERE u.role = 'student' AND u.group_id = ? ORDER BY u.username";
      params = [groupId];
    } else {
      query =
        "SELECT u.id, u.username, u.password, u.group_id, u.created_at, s.updated_at as store_updated_at " +
        "FROM users u " +
        "LEFT JOIN groups g ON u.group_id = g.id " +
        "LEFT JOIN stores s ON s.user_id = u.id AND s.hyperbook_id = g.hyperbook_id " +
        "WHERE u.role = 'student' ORDER BY u.username";
      params = [];
    }

    var students = await db.allAsync(query, params);
    res.json({ students: students });
  } catch (error) {
    console.error("List students error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/students", async function (req, res) {
  try {
    var username = req.body.username;
    var password = req.body.password;
    var groupId = req.body.groupId;

    if (groupId) {
      var hbId = await getHyperbookIdForGroup(groupId);
      if (hbId) {
        var allowed = await middleware.checkPermission(req.user.id, req.user.role, "hyperbook:" + hbId + ":students:create");
        if (!allowed) {
          res.status(403).json({ error: "Permission denied" });
          return;
        }
      }
    }

    if (!username || !password) {
      res.status(400).json({ error: "Username and password required" });
      return;
    }

    var result = await db.runAsync(
      "INSERT INTO users (username, password, role, group_id) VALUES (?, ?, 'student', ?)",
      [username, password, groupId || null]
    );

    res.json({ id: result.lastID, username: username });
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
      res.status(409).json({ error: "Username already exists" });
      return;
    }
    console.error("Create student error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/students/bulk", async function (req, res) {
  try {
    var students = req.body.students;
    var groupId = req.body.groupId;

    if (groupId) {
      var hbId = await getHyperbookIdForGroup(groupId);
      if (hbId) {
        var allowed = await middleware.checkPermission(req.user.id, req.user.role, "hyperbook:" + hbId + ":students:create");
        if (!allowed) {
          res.status(403).json({ error: "Permission denied" });
          return;
        }
      }
    }

    if (!Array.isArray(students) || students.length === 0) {
      res.status(400).json({ error: "Students array required" });
      return;
    }

    var created = [];
    var failed = [];

    for (var i = 0; i < students.length; i++) {
      var student = students[i];
      try {
        if (!student.username || !student.password) {
          failed.push({
            username: student.username || "unknown",
            error: "Username and password required",
          });
          continue;
        }
        var result = await db.runAsync(
          "INSERT INTO users (username, password, role, group_id) VALUES (?, ?, 'student', ?)",
          [student.username, student.password, groupId || null]
        );
        created.push({ id: result.lastID, username: student.username });
      } catch (error) {
        failed.push({
          username: student.username,
          error:
            error instanceof Error &&
            error.message.includes("UNIQUE constraint failed")
              ? "Username already exists"
              : error instanceof Error
                ? error.message
                : "Unknown error",
        });
      }
    }

    res.json({
      success: true,
      total: students.length,
      created: created.length,
      failed: failed.length,
      results: { created: created, failed: failed },
    });
  } catch (error) {
    console.error("Bulk create students error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/students/bulk-csv", async function (req, res) {
  try {
    var csv = req.body.csv;
    var groupId = req.body.groupId;

    if (groupId) {
      var hbId = await getHyperbookIdForGroup(groupId);
      if (hbId) {
        var allowed = await middleware.checkPermission(req.user.id, req.user.role, "hyperbook:" + hbId + ":students:create");
        if (!allowed) {
          res.status(403).json({ error: "Permission denied" });
          return;
        }
      }
    }

    if (!csv || typeof csv !== "string") {
      res.status(400).json({ error: "CSV data required" });
      return;
    }

    var lines = csv.trim().split("\n");
    var students = [];

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line || line.startsWith("#")) continue;
      var parts = line.split(",").map(function (s) {
        return s.trim();
      });
      var username = parts[0];
      var password = parts[1];
      if (username && password) {
        students.push({ username: username, password: password });
      } else {
        res.status(400).json({
          error:
            "Invalid CSV format at line " +
            (i + 1) +
            ". Expected: username,password",
        });
        return;
      }
    }

    if (students.length === 0) {
      res.status(400).json({ error: "No valid students found in CSV" });
      return;
    }

    var created = [];
    var failed = [];

    for (var j = 0; j < students.length; j++) {
      var student = students[j];
      try {
        var result = await db.runAsync(
          "INSERT INTO users (username, password, role, group_id) VALUES (?, ?, 'student', ?)",
          [student.username, student.password, groupId || null]
        );
        created.push({ id: result.lastID, username: student.username });
      } catch (error) {
        failed.push({
          username: student.username,
          error:
            error instanceof Error &&
            error.message.includes("UNIQUE constraint failed")
              ? "Username already exists"
              : error instanceof Error
                ? error.message
                : "Unknown error",
        });
      }
    }

    res.json({
      success: true,
      total: students.length,
      created: created.length,
      failed: failed.length,
      results: { created: created, failed: failed },
    });
  } catch (error) {
    console.error("Bulk CSV create students error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/students/:id/password", async function (req, res) {
  try {
    var id = req.params.id;
    var password = req.body.password;

    if (!password) {
      res.status(400).json({ error: "Password required" });
      return;
    }

    var student = await db.getAsync(
      "SELECT u.id, u.group_id FROM users u WHERE u.id = ? AND u.role = 'student'",
      [id]
    );
    if (!student) {
      res.status(404).json({ error: "Student not found" });
      return;
    }
    if (student.group_id) {
      var hbId = await getHyperbookIdForGroup(student.group_id);
      if (hbId) {
        var allowed = await middleware.checkPermission(req.user.id, req.user.role, "hyperbook:" + hbId + ":students:update");
        if (!allowed) {
          res.status(403).json({ error: "Permission denied" });
          return;
        }
      }
    }

    var result = await db.runAsync(
      "UPDATE users SET password = ? WHERE id = ? AND role = ?",
      [password, id, "student"]
    );

    if (result.changes === 0) {
      res.status(404).json({ error: "Student not found" });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Update password error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/students/:id", async function (req, res) {
  try {
    var id = req.params.id;
    var student = await db.getAsync(
      "SELECT u.id, u.group_id FROM users u WHERE u.id = ? AND u.role = 'student'",
      [id]
    );
    if (student && student.group_id) {
      var hbId = await getHyperbookIdForGroup(student.group_id);
      if (hbId) {
        var allowed = await middleware.checkPermission(req.user.id, req.user.role, "hyperbook:" + hbId + ":students:delete");
        if (!allowed) {
          res.status(403).json({ error: "Permission denied" });
          return;
        }
      }
    }
    await db.runAsync("DELETE FROM users WHERE id = ? AND role = 'student'", [
      id,
    ]);
    res.json({ success: true });
  } catch (error) {
    console.error("Delete student error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ===== Student Store Download =====

router.get("/students/:studentId/store", async function (req, res) {
  try {
    var studentId = req.params.studentId;

    var student = await db.getAsync(
      "SELECT id, username, group_id FROM users WHERE id = ? AND role = ?",
      [studentId, "student"]
    );

    if (!student) {
      res.status(404).json({ error: "Student not found" });
      return;
    }

    if (!student.group_id) {
      res.status(400).json({ error: "Student is not assigned to any group" });
      return;
    }

    var group = await db.getAsync("SELECT hyperbook_id FROM groups WHERE id = ?", [
      student.group_id,
    ]);

    if (!group) {
      res.status(400).json({ error: "Group not found" });
      return;
    }

    var allowed = await middleware.checkPermission(req.user.id, req.user.role, "hyperbook:" + group.hyperbook_id + ":read");
    if (!allowed) {
      res.status(403).json({ error: "Permission denied" });
      return;
    }

    var store = await db.getAsync(
      "SELECT data, updated_at FROM stores WHERE user_id = ? AND hyperbook_id = ?",
      [student.id, group.hyperbook_id]
    );

    if (!store) {
      res.status(404).json({ error: "No store data found for this student" });
      return;
    }

    var data = JSON.parse(store.data);

    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="store-' + student.username + '.json"'
    );
    res.json(data);
  } catch (error) {
    console.error("Download store error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ===== Impersonation =====

router.post("/impersonate/:studentId", async function (req, res) {
  try {
    var studentId = req.params.studentId;

    var student = await db.getAsync(
      "SELECT id, username, group_id FROM users WHERE id = ? AND role = ?",
      [studentId, "student"]
    );

    if (!student) {
      res.status(404).json({ error: "Student not found" });
      return;
    }

    if (!student.group_id) {
      res.status(400).json({ error: "Student is not assigned to any group" });
      return;
    }

    var groupInfo = await db.getAsync(
      "SELECT g.hyperbook_id, h.slug, h.name, h.url " +
        "FROM groups g " +
        "JOIN hyperbooks h ON g.hyperbook_id = h.id " +
        "WHERE g.id = ?",
      [student.group_id]
    );

    if (!groupInfo) {
      res.status(400).json({ error: "Group not found" });
      return;
    }

    var allowed = await middleware.checkPermission(req.user.id, req.user.role, "hyperbook:" + groupInfo.hyperbook_id + ":read");
    if (!allowed) {
      res.status(403).json({ error: "Permission denied" });
      return;
    }

    var token = auth.generateImpersonationToken(
      req.user.id,
      student.id,
      student.username
    );

    res.json({
      token: token,
      student: { id: student.id, username: student.username },
      hyperbook: {
        id: groupInfo.hyperbook_id,
        slug: groupInfo.slug,
        name: groupInfo.name,
        url: groupInfo.url,
      },
    });
  } catch (error) {
    console.error("Impersonate error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ===== Teacher (User) Management — Admin only =====

router.get("/users", middleware.requireAdmin, async function (_req, res) {
  try {
    var users = await db.allAsync(
      "SELECT id, username, email, role, created_at FROM users WHERE role = 'teacher' ORDER BY username"
    );
    res.json({ users: users });
  } catch (error) {
    console.error("List users error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/users", middleware.requireAdmin, async function (req, res) {
  try {
    var username = req.body.username;
    var password = req.body.password;
    var email = req.body.email;

    if (!username || !password) {
      res.status(400).json({ error: "Username and password required" });
      return;
    }

    var hashed = auth.hashPassword(password);
    var result = await db.runAsync(
      "INSERT INTO users (username, password, email, role) VALUES (?, ?, ?, 'teacher')",
      [username, hashed, email || null]
    );

    res.json({ id: result.lastID, username: username, email: email });
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
      res.status(409).json({ error: "Username already exists" });
      return;
    }
    console.error("Create user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/users/:id", middleware.requireAdmin, async function (req, res) {
  try {
    var id = req.params.id;
    var username = req.body.username;
    var email = req.body.email;

    var user = await db.getAsync("SELECT id FROM users WHERE id = ? AND role = 'teacher'", [id]);
    if (!user) {
      res.status(404).json({ error: "Teacher not found" });
      return;
    }

    await db.runAsync(
      "UPDATE users SET username = ?, email = ? WHERE id = ? AND role = 'teacher'",
      [username, email || null, id]
    );

    res.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
      res.status(409).json({ error: "Username already exists" });
      return;
    }
    console.error("Update user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/users/:id/password", middleware.requireAdmin, async function (req, res) {
  try {
    var id = req.params.id;
    var password = req.body.password;

    if (!password) {
      res.status(400).json({ error: "Password required" });
      return;
    }

    var hashed = auth.hashPassword(password);
    var result = await db.runAsync(
      "UPDATE users SET password = ? WHERE id = ? AND role = 'teacher'",
      [hashed, id]
    );

    if (result.changes === 0) {
      res.status(404).json({ error: "Teacher not found" });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Update user password error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/users/:id", middleware.requireAdmin, async function (req, res) {
  try {
    var id = req.params.id;
    await db.runAsync("DELETE FROM users WHERE id = ? AND role = 'teacher'", [id]);
    res.json({ success: true });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ===== Permission Management — Admin only =====

router.get("/users/:userId/permissions", middleware.requireAdmin, async function (req, res) {
  try {
    var userId = req.params.userId;
    var permissions = await db.getUserPermissions(userId);
    res.json({ permissions: permissions });
  } catch (error) {
    console.error("List permissions error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/users/:userId/permissions", middleware.requireAdmin, async function (req, res) {
  try {
    var userId = req.params.userId;
    var permission = req.body.permission;

    if (!permission) {
      res.status(400).json({ error: "Permission required" });
      return;
    }

    await db.addPermission(userId, permission);
    res.json({ success: true });
  } catch (error) {
    console.error("Add permission error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/users/:userId/permissions", middleware.requireAdmin, async function (req, res) {
  try {
    var userId = req.params.userId;
    var permission = req.body.permission;

    if (!permission) {
      res.status(400).json({ error: "Permission required" });
      return;
    }

    await db.removePermission(userId, permission);
    res.json({ success: true });
  } catch (error) {
    console.error("Remove permission error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
