import { describe, it, expect } from "vitest";

// We can't import db.js directly since it connects to sqlite on load.
// Extract the pure function for testing.
function applyEventsToSnapshot(snapshotData, events) {
  if (!events || events.length === 0) return snapshotData;

  // Navigate to the Dexie inner data object inside the wrapper format
  var dexieData =
    snapshotData.data && snapshotData.data.hyperbook
      ? snapshotData.data.hyperbook.data
      : snapshotData.data;

  // Dexie export has two formats:
  // 1. Real Dexie: tables=[{name,schema,rowCount}], data=[{tableName,inbound,rows}]
  // 2. Simplified: tables=[{name,schema,rowCount,rows}]
  // Detect which format by checking for dexieData.data array
  var useDataArray = Array.isArray(dexieData.data);
  var schemaList = dexieData.tables || [];
  var dataList = useDataArray ? dexieData.data : null;

  // Build schema lookup: tableName → schema string
  var schemaMap = {};
  for (var s = 0; s < schemaList.length; s++) {
    schemaMap[schemaList[s].name] = schemaList[s].schema || "id";
  }

  // Build row data lookup: tableName → data entry (with rows array)
  var rowDataMap = {};
  if (useDataArray) {
    for (var d = 0; d < dataList.length; d++) {
      rowDataMap[dataList[d].tableName] = dataList[d];
    }
  } else {
    // Simplified format: rows are on the tables entries
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
        // In simplified format, add rows to the schema entry
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
    var schemaIdx = schemaList.find(function (e) { return e.name === tableName; });
    if (schemaIdx) schemaIdx.rowCount = rows.length;
  }

  return snapshotData;
}

// Helper: create an empty snapshot in wrapper format (as sendSnapshot produces)
function makeWrapperSnapshot(tables = []) {
  return {
    version: 1,
    data: {
      hyperbook: {
        formatName: "dexie",
        formatVersion: 1,
        data: {
          databaseName: "Hyperbook",
          databaseVersion: 2,
          tables: tables,
        },
      },
    },
  };
}

// Helper: create an empty snapshot in reconstructState's default format
function makeDefaultEmptySnapshot() {
  return {
    version: 1,
    data: {
      hyperbook: {
        formatName: "dexie",
        formatVersion: 1,
        data: {
          databaseName: "Hyperbook",
          databaseVersion: 2,
          tables: [],
        },
      },
    },
  };
}

// Helper: create a snapshot in REAL Dexie export format (as store.export() produces)
// tables = [{ name, schema, rowCount }] (no rows!)
// data = [{ tableName, inbound, rows }] (rows here!)
function makeRealDexieSnapshot(tableSchemas = [], tableData = []) {
  return {
    version: 1,
    origin: "http://localhost:8080",
    data: {
      hyperbook: {
        formatName: "dexie",
        formatVersion: 1,
        data: {
          databaseName: "Hyperbook",
          databaseVersion: 2,
          tables: tableSchemas,
          data: tableData,
        },
      },
    },
  };
}

// Helper: create a DB event row (as returned by getEventsSince)
function makeEvent(id, tableName, operation, primKey, data) {
  return {
    id,
    table_name: tableName,
    operation,
    prim_key: String(primKey),
    data: data !== null ? JSON.stringify(data) : null,
    created_at: new Date().toISOString(),
  };
}

// Helper: get Dexie tables from wrapper snapshot
function getTablesFromWrapper(snapshot) {
  return snapshot.data.hyperbook.data.tables;
}

// Helper: find a table by name in wrapper snapshot
function findTable(snapshot, name) {
  return getTablesFromWrapper(snapshot).find((t) => t.name === name);
}

describe("applyEventsToSnapshot", () => {
  describe("with wrapper format (from sendSnapshot)", () => {
    it("should apply a create event to an empty snapshot", () => {
      const snapshot = makeWrapperSnapshot();
      const events = [
        makeEvent(1, "collapsibles", "create", "section-1", {
          id: "section-1",
          collapsed: false,
        }),
      ];

      const result = applyEventsToSnapshot(snapshot, events);
      const table = findTable(result, "collapsibles");

      expect(table).toBeDefined();
      expect(table.rows).toHaveLength(1);
      expect(table.rows[0]).toEqual({ id: "section-1", collapsed: false });
    });

    it("should apply create events to multiple tables", () => {
      const snapshot = makeWrapperSnapshot();
      const events = [
        makeEvent(1, "collapsibles", "create", "s1", { id: "s1" }),
        makeEvent(2, "tabs", "create", "t1", { id: "t1", active: "tab-a" }),
        makeEvent(3, "bookmarks", "create", "/page1", {
          path: "/page1",
          label: "Page 1",
        }),
      ];

      const result = applyEventsToSnapshot(snapshot, events);

      expect(findTable(result, "collapsibles").rows).toHaveLength(1);
      expect(findTable(result, "tabs").rows).toHaveLength(1);
      expect(findTable(result, "bookmarks").rows).toHaveLength(1);
      expect(findTable(result, "bookmarks").rows[0]).toEqual({
        path: "/page1",
        label: "Page 1",
      });
    });

    it("should apply an update event to an existing row", () => {
      const snapshot = makeWrapperSnapshot([
        {
          name: "collapsibles",
          schema: "id",
          rowCount: 1,
          rows: [{ id: "s1", collapsed: false }],
        },
      ]);
      const events = [
        makeEvent(1, "collapsibles", "update", "s1", { collapsed: true }),
      ];

      const result = applyEventsToSnapshot(snapshot, events);
      const table = findTable(result, "collapsibles");

      expect(table.rows).toHaveLength(1);
      expect(table.rows[0]).toEqual({ id: "s1", collapsed: true });
    });

    it("should treat update on missing row as create", () => {
      const snapshot = makeWrapperSnapshot();
      const events = [
        makeEvent(1, "tabs", "update", "t1", { active: "tab-b" }),
      ];

      const result = applyEventsToSnapshot(snapshot, events);
      const table = findTable(result, "tabs");

      expect(table.rows).toHaveLength(1);
      expect(table.rows[0]).toEqual({ id: "t1", active: "tab-b" });
    });

    it("should apply a delete event", () => {
      const snapshot = makeWrapperSnapshot([
        {
          name: "bookmarks",
          schema: "path,label",
          rowCount: 2,
          rows: [
            { path: "/p1", label: "P1" },
            { path: "/p2", label: "P2" },
          ],
        },
      ]);
      const events = [makeEvent(1, "bookmarks", "delete", "/p1", null)];

      const result = applyEventsToSnapshot(snapshot, events);
      const table = findTable(result, "bookmarks");

      expect(table.rows).toHaveLength(1);
      expect(table.rows[0].path).toBe("/p2");
    });

    it("should handle a sequence of create, update, delete", () => {
      const snapshot = makeWrapperSnapshot();
      const events = [
        makeEvent(1, "textinput", "create", "q1", {
          id: "q1",
          text: "hello",
        }),
        makeEvent(2, "textinput", "create", "q2", {
          id: "q2",
          text: "world",
        }),
        makeEvent(3, "textinput", "update", "q1", { text: "hello updated" }),
        makeEvent(4, "textinput", "delete", "q2", null),
      ];

      const result = applyEventsToSnapshot(snapshot, events);
      const table = findTable(result, "textinput");

      expect(table.rows).toHaveLength(1);
      expect(table.rows[0]).toEqual({ id: "q1", text: "hello updated" });
    });

    it("should handle tables with non-standard primary keys", () => {
      const snapshot = makeWrapperSnapshot([
        {
          name: "onlineide",
          schema: "scriptId,script",
          rowCount: 0,
          rows: [],
        },
      ]);
      const events = [
        makeEvent(1, "onlineide", "create", "abc", {
          scriptId: "abc",
          script: "print('hi')",
        }),
        makeEvent(2, "onlineide", "update", "abc", {
          script: "print('updated')",
        }),
      ];

      const result = applyEventsToSnapshot(snapshot, events);
      const table = findTable(result, "onlineide");

      expect(table.rows).toHaveLength(1);
      expect(table.rows[0].scriptId).toBe("abc");
      expect(table.rows[0].script).toBe("print('updated')");
    });

    it("should preserve existing tables when adding events for new tables", () => {
      const snapshot = makeWrapperSnapshot([
        {
          name: "collapsibles",
          schema: "id",
          rowCount: 1,
          rows: [{ id: "s1" }],
        },
      ]);
      const events = [
        makeEvent(1, "tabs", "create", "t1", { id: "t1", active: "a" }),
      ];

      const result = applyEventsToSnapshot(snapshot, events);

      expect(findTable(result, "collapsibles").rows).toHaveLength(1);
      expect(findTable(result, "tabs").rows).toHaveLength(1);
    });

    it("should preserve the wrapper structure after applying events", () => {
      const snapshot = makeWrapperSnapshot();
      const events = [
        makeEvent(1, "collapsibles", "create", "s1", { id: "s1" }),
      ];

      const result = applyEventsToSnapshot(snapshot, events);

      // The wrapper structure must be intact for loadFromCloud to work
      expect(result.version).toBe(1);
      expect(result.data).toBeDefined();
      expect(result.data.hyperbook).toBeDefined();
      expect(result.data.hyperbook.formatName).toBe("dexie");
      expect(result.data.hyperbook.data.tables).toBeDefined();
      expect(result.data.hyperbook.data.tables.length).toBeGreaterThan(0);
    });
  });

  describe("with default empty snapshot (from reconstructState)", () => {
    it("should apply events to the default empty snapshot", () => {
      const snapshot = makeDefaultEmptySnapshot();
      const events = [
        makeEvent(1, "collapsibles", "create", "s1", {
          id: "s1",
          collapsed: true,
        }),
      ];

      const result = applyEventsToSnapshot(snapshot, events);

      // Must still have wrapper structure
      expect(result.data.hyperbook.data.tables).toBeDefined();
      const table = result.data.hyperbook.data.tables.find(
        (t) => t.name === "collapsibles",
      );
      expect(table).toBeDefined();
      expect(table.rows).toHaveLength(1);
      expect(table.rows[0]).toEqual({ id: "s1", collapsed: true });
    });
  });

  describe("with tables that have no rows property", () => {
    it("should handle tables without rows array", () => {
      const snapshot = makeWrapperSnapshot([
        { name: "collapsibles", schema: "id", rowCount: 0 },
      ]);
      const events = [
        makeEvent(1, "collapsibles", "create", "s1", { id: "s1" }),
      ];

      const result = applyEventsToSnapshot(snapshot, events);
      const table = findTable(result, "collapsibles");
      expect(table.rows).toHaveLength(1);
    });
  });

  describe("edge cases", () => {
    it("should return snapshot unchanged when events is empty", () => {
      const snapshot = makeWrapperSnapshot();
      const result = applyEventsToSnapshot(snapshot, []);
      expect(result).toBe(snapshot);
    });

    it("should return snapshot unchanged when events is null", () => {
      const snapshot = makeWrapperSnapshot();
      const result = applyEventsToSnapshot(snapshot, null);
      expect(result).toBe(snapshot);
    });

    it("should handle delete on non-existent row without error", () => {
      const snapshot = makeWrapperSnapshot([
        {
          name: "collapsibles",
          schema: "id",
          rowCount: 1,
          rows: [{ id: "s1" }],
        },
      ]);
      const events = [
        makeEvent(1, "collapsibles", "delete", "nonexistent", null),
      ];

      const result = applyEventsToSnapshot(snapshot, events);
      expect(findTable(result, "collapsibles").rows).toHaveLength(1);
    });

    it("should handle large data in events (Excalidraw blobs)", () => {
      const snapshot = makeWrapperSnapshot();
      const largeData = {
        id: "exc1",
        excalidrawElements: new Array(1000).fill({ type: "rectangle", x: 0 }),
        appState: { viewBackgroundColor: "#fff" },
        files: {},
      };
      const events = [
        makeEvent(1, "excalidraw", "create", "exc1", largeData),
      ];

      const result = applyEventsToSnapshot(snapshot, events);
      const table = findTable(result, "excalidraw");
      expect(table.rows).toHaveLength(1);
      expect(table.rows[0].id).toBe("exc1");
    });
  });

  describe("full roundtrip simulation", () => {
    it("should produce state that loadFromCloud can consume", () => {
      // Simulate: empty state → events → reconstructState → GET response → loadFromCloud
      const snapshot = makeDefaultEmptySnapshot();
      const events = [
        makeEvent(1, "collapsibles", "create", "s1", {
          id: "s1",
          collapsed: false,
        }),
        makeEvent(2, "tabs", "create", "t1", { id: "t1", active: "a" }),
        makeEvent(3, "collapsibles", "update", "s1", { collapsed: true }),
      ];

      const reconstructed = applyEventsToSnapshot(snapshot, events);

      // This is what the GET route returns as `snapshot`
      const apiResponse = {
        snapshot: reconstructed,
        lastEventId: 3,
        updatedAt: new Date().toISOString(),
      };

      // loadFromCloud does: data.snapshot.data → storeData, then storeData.hyperbook
      const storeData = apiResponse.snapshot.data || apiResponse.snapshot;
      const hyperbook = storeData.hyperbook;

      expect(hyperbook).toBeDefined();
      expect(hyperbook.formatName).toBe("dexie");
      expect(hyperbook.data.tables).toBeDefined();

      const collapsibles = hyperbook.data.tables.find(
        (t) => t.name === "collapsibles",
      );
      expect(collapsibles).toBeDefined();
      expect(collapsibles.rows).toHaveLength(1);
      expect(collapsibles.rows[0]).toEqual({ id: "s1", collapsed: true });

      const tabs = hyperbook.data.tables.find((t) => t.name === "tabs");
      expect(tabs).toBeDefined();
      expect(tabs.rows).toHaveLength(1);
    });

    it("should produce state that matches a full snapshot from sendSnapshot", () => {
      // Simulate: sendSnapshot wraps as { version: 1, data: { hyperbook: dexieExport } }
      // Then events are applied on top of that existing snapshot
      const existingSnapshot = makeWrapperSnapshot([
        {
          name: "collapsibles",
          schema: "id",
          rowCount: 1,
          rows: [{ id: "s1", collapsed: false }],
        },
        {
          name: "tabs",
          schema: "id,active",
          rowCount: 1,
          rows: [{ id: "t1", active: "a" }],
        },
      ]);

      const events = [
        makeEvent(1, "collapsibles", "update", "s1", { collapsed: true }),
        makeEvent(2, "tabs", "create", "t2", { id: "t2", active: "b" }),
      ];

      const result = applyEventsToSnapshot(existingSnapshot, events);

      // Verify structure
      const hyperbook = result.data.hyperbook;
      expect(hyperbook).toBeDefined();

      const coll = hyperbook.data.tables.find(
        (t) => t.name === "collapsibles",
      );
      expect(coll.rows[0].collapsed).toBe(true);

      const tabs = hyperbook.data.tables.find((t) => t.name === "tabs");
      expect(tabs.rows).toHaveLength(2);
    });
  });

  describe("with REAL Dexie export format (data[] array separate from tables[])", () => {
    // Helper to find row data in the data[] array
    function findDataEntry(snapshot, tableName) {
      return snapshot.data.hyperbook.data.data.find(
        (d) => d.tableName === tableName,
      );
    }

    it("should apply create event using data[] array", () => {
      const snapshot = makeRealDexieSnapshot(
        [{ name: "collapsibles", schema: "id", rowCount: 0 }],
        [{ tableName: "collapsibles", inbound: true, rows: [] }],
      );

      const events = [
        makeEvent(1, "collapsibles", "create", "s1", {
          id: "s1",
          collapsed: false,
        }),
      ];

      const result = applyEventsToSnapshot(snapshot, events);
      const dataEntry = findDataEntry(result, "collapsibles");

      expect(dataEntry).toBeDefined();
      expect(dataEntry.rows).toHaveLength(1);
      expect(dataEntry.rows[0]).toEqual({ id: "s1", collapsed: false });
    });

    it("should apply update event to existing row in data[] array", () => {
      const snapshot = makeRealDexieSnapshot(
        [{ name: "collapsibles", schema: "id", rowCount: 1 }],
        [
          {
            tableName: "collapsibles",
            inbound: true,
            rows: [{ id: "s1", collapsed: false }],
          },
        ],
      );

      const events = [
        makeEvent(1, "collapsibles", "update", "s1", { collapsed: true }),
      ];

      const result = applyEventsToSnapshot(snapshot, events);
      const dataEntry = findDataEntry(result, "collapsibles");

      expect(dataEntry.rows).toHaveLength(1);
      expect(dataEntry.rows[0]).toEqual({ id: "s1", collapsed: true });
    });

    it("should apply delete event to data[] array", () => {
      const snapshot = makeRealDexieSnapshot(
        [{ name: "bookmarks", schema: "path,label", rowCount: 2 }],
        [
          {
            tableName: "bookmarks",
            inbound: true,
            rows: [
              { path: "/p1", label: "P1" },
              { path: "/p2", label: "P2" },
            ],
          },
        ],
      );

      const events = [makeEvent(1, "bookmarks", "delete", "/p1", null)];

      const result = applyEventsToSnapshot(snapshot, events);
      const dataEntry = findDataEntry(result, "bookmarks");

      expect(dataEntry.rows).toHaveLength(1);
      expect(dataEntry.rows[0].path).toBe("/p2");
    });

    it("should add new table to data[] when event references unknown table", () => {
      const snapshot = makeRealDexieSnapshot(
        [{ name: "collapsibles", schema: "id", rowCount: 0 }],
        [{ tableName: "collapsibles", inbound: true, rows: [] }],
      );

      const events = [
        makeEvent(1, "tabs", "create", "t1", { id: "t1", active: "a" }),
      ];

      const result = applyEventsToSnapshot(snapshot, events);
      const dataEntry = findDataEntry(result, "tabs");

      expect(dataEntry).toBeDefined();
      expect(dataEntry.rows).toHaveLength(1);
      expect(dataEntry.rows[0]).toEqual({ id: "t1", active: "a" });
    });

    it("should handle non-standard primary keys in data[] format", () => {
      const snapshot = makeRealDexieSnapshot(
        [{ name: "sqlideScripts", schema: "scriptId,script", rowCount: 1 }],
        [
          {
            tableName: "sqlideScripts",
            inbound: true,
            rows: [{ scriptId: "abc", script: "SELECT 1" }],
          },
        ],
      );

      const events = [
        makeEvent(1, "sqlideScripts", "update", "abc", {
          script: "SELECT * FROM users",
        }),
      ];

      const result = applyEventsToSnapshot(snapshot, events);
      const dataEntry = findDataEntry(result, "sqlideScripts");

      expect(dataEntry.rows).toHaveLength(1);
      expect(dataEntry.rows[0].script).toBe("SELECT * FROM users");
    });

    it("should produce correct structure for loadFromCloud with real Dexie format", () => {
      const snapshot = makeRealDexieSnapshot(
        [
          { name: "collapsibles", schema: "id", rowCount: 1 },
          { name: "sqlideScripts", schema: "scriptId,script", rowCount: 1 },
        ],
        [
          {
            tableName: "collapsibles",
            inbound: true,
            rows: [{ id: "s1", collapsed: false }],
          },
          {
            tableName: "sqlideScripts",
            inbound: true,
            rows: [{ scriptId: "abc", script: "SELECT 1" }],
          },
        ],
      );

      const events = [
        makeEvent(1, "collapsibles", "update", "s1", { collapsed: true }),
        makeEvent(2, "sqlideScripts", "update", "abc", {
          script: "SELECT * FROM users",
        }),
      ];

      const result = applyEventsToSnapshot(snapshot, events);

      // Simulate loadFromCloud path
      const apiResponse = { snapshot: result, lastEventId: 2 };
      const storeData = apiResponse.snapshot.data;
      const hyperbook = storeData.hyperbook;

      expect(hyperbook).toBeDefined();
      expect(hyperbook.data.data).toBeDefined(); // real Dexie format

      const collData = hyperbook.data.data.find(
        (d) => d.tableName === "collapsibles",
      );
      expect(collData.rows[0].collapsed).toBe(true);

      const sqlData = hyperbook.data.data.find(
        (d) => d.tableName === "sqlideScripts",
      );
      expect(sqlData.rows[0].script).toBe("SELECT * FROM users");
    });

    it("should handle snapshot with many empty tables (real-world scenario)", () => {
      // This mimics the real Dexie export with 22 tables, most empty
      const tableNames = [
        "currentState",
        "collapsibles",
        "abcMusic",
        "audio",
        "bookmarks",
        "p5",
        "protect",
        "pyide",
        "slideshow",
        "tabs",
        "excalidraw",
        "webide",
        "h5p",
        "geogebra",
        "learningmap",
        "textinput",
        "custom",
        "onlineide",
        "sqlideScripts",
        "sqlideDatabases",
        "multievent",
        "typst",
      ];
      const schemas = tableNames.map((name) => ({
        name,
        schema: name === "sqlideScripts" ? "scriptId,script" : "id",
        rowCount: 0,
      }));
      const data = tableNames.map((name) => ({
        tableName: name,
        inbound: true,
        rows: [],
      }));

      const snapshot = makeRealDexieSnapshot(schemas, data);

      const events = [
        makeEvent(1, "sqlideScripts", "create", "key1", {
          scriptId: "key1",
          script: "SELECT 1",
        }),
        makeEvent(2, "sqlideScripts", "update", "key1", {
          script: "SELECT * FROM test",
        }),
      ];

      const result = applyEventsToSnapshot(snapshot, events);
      const sqlData = result.data.hyperbook.data.data.find(
        (d) => d.tableName === "sqlideScripts",
      );

      expect(sqlData.rows).toHaveLength(1);
      expect(sqlData.rows[0].script).toBe("SELECT * FROM test");
    });
  });
});
