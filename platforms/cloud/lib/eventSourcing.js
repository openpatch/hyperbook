/**
 * Pure event-sourcing logic for the hyperbook store sync.
 *
 * Everything in here is side-effect free so it can be unit tested without a
 * database. `lib/db.js` is the only place that turns these helpers into SQL.
 *
 * Wire format of an event (as produced by packages/markdown/assets/cloud.js):
 *   { table: "bookmarks", op: "create" | "update" | "delete", primKey: any, data: object | null }
 *
 * Row format of an event (as stored in the `events` table):
 *   { id, table_name, operation, prim_key, prim_key_json, data, created_at }
 */

var VALID_OPERATIONS = ["create", "update", "delete"];

/**
 * Build the empty state used when a user has no snapshot yet.
 * Must stay structurally identical to what Dexie's `export()` produces,
 * because the client feeds it straight into `db.import()`.
 */
function createEmptySnapshot() {
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
          data: [],
        },
      },
    },
  };
}

/**
 * Extract the primary key field(s) from a Dexie schema string.
 *
 * Dexie schemas mark the primary key with prefixes that are *not* part of the
 * property name: `++id` (auto-increment), `&email` (unique), `[a+b]` (compound).
 * Splitting on "," and using the raw token — as the previous implementation did —
 * yields "++id", which never matches a real row property.
 *
 * @param {string} schema e.g. "++id,name" or "[postId+userId],date"
 * @returns {{ fields: string[], compound: boolean, outbound: boolean }}
 */
function parsePrimaryKey(schema) {
  var raw = (schema || "").split(",")[0].trim();

  // Outbound primary key: the key is not stored on the object itself.
  if (raw === "") {
    return { fields: [], compound: false, outbound: true };
  }

  // Compound key: "[postId+userId]"
  if (raw.charAt(0) === "[") {
    var inner = raw.replace(/^\[/, "").replace(/\]$/, "");
    return {
      fields: inner.split("+").map(function (f) {
        return f.trim();
      }),
      compound: true,
      outbound: false,
    };
  }

  // Strip the auto-increment / unique / multi-entry markers.
  return {
    fields: [raw.replace(/^(\+\+|&|\*)/, "")],
    compound: false,
    outbound: false,
  };
}

/**
 * The key an event refers to. Prefers the JSON-encoded column so that numeric
 * and compound keys survive the round-trip; falls back to the legacy TEXT
 * column for rows written before the `prim_key_json` migration.
 */
function readEventPrimKey(event) {
  if (event.prim_key_json !== undefined && event.prim_key_json !== null) {
    try {
      return JSON.parse(event.prim_key_json);
    } catch (e) {
      /* fall through to the text column */
    }
  }
  return event.prim_key;
}

/**
 * Compare a row's key against an event's key.
 *
 * Comparison is stringified because the legacy `prim_key` column has already
 * lost the original type: a row keyed by the number 1 and an event keyed by
 * "1" must still be recognised as the same record.
 */
function keyMatches(row, pk, eventKey) {
  if (pk.outbound || pk.fields.length === 0) return false;

  if (pk.compound) {
    var parts = Array.isArray(eventKey) ? eventKey : String(eventKey).split(",");
    if (parts.length !== pk.fields.length) return false;
    for (var i = 0; i < pk.fields.length; i++) {
      if (String(row[pk.fields[i]]) !== String(parts[i])) return false;
    }
    return true;
  }

  return String(row[pk.fields[0]]) === String(eventKey);
}

/**
 * Write the event's key onto a row object.
 *
 * Dexie's `creating` hook does not include an auto-incremented key in the
 * object it hands out, and an `update` on a row we have never seen arrives as a
 * bare modifications object. In both cases the reconstructed row would end up
 * without a primary key and become invisible to every later event.
 */
function applyPrimKeyToRow(row, pk, eventKey) {
  if (pk.outbound || pk.fields.length === 0) return row;

  if (pk.compound) {
    var parts = Array.isArray(eventKey) ? eventKey : String(eventKey).split(",");
    for (var i = 0; i < pk.fields.length; i++) {
      if (row[pk.fields[i]] === undefined) row[pk.fields[i]] = parts[i];
    }
    return row;
  }

  if (row[pk.fields[0]] === undefined) row[pk.fields[0]] = eventKey;
  return row;
}

/**
 * Apply one Dexie modifications object to a row.
 *
 * Dexie allows dotted key paths (`table.update(id, { "a.b": 1 })`) to address
 * nested properties. Assigning the literal key "a.b" would create a bogus
 * top-level property and lose the actual update.
 */
function applyModifications(row, modifications) {
  var keys = Object.keys(modifications);

  for (var k = 0; k < keys.length; k++) {
    var key = keys[k];
    var value = modifications[key];

    if (key.indexOf(".") === -1) {
      row[key] = value;
      continue;
    }

    var path = key.split(".");
    var target = row;
    for (var p = 0; p < path.length - 1; p++) {
      if (typeof target[path[p]] !== "object" || target[path[p]] === null) {
        target[path[p]] = {};
      }
      target = target[path[p]];
    }
    target[path[path.length - 1]] = value;
  }

  return row;
}

/**
 * Validate a batch of events coming off the wire.
 * @returns {string|null} an error message, or null when the batch is valid.
 */
function validateEvents(events) {
  if (!Array.isArray(events) || events.length === 0) {
    return "Events array required";
  }

  for (var i = 0; i < events.length; i++) {
    var evt = events[i];

    if (!evt || typeof evt !== "object") {
      return "Event " + i + " is not an object";
    }
    if (typeof evt.table !== "string" || evt.table === "") {
      return "Event " + i + " is missing a table name";
    }
    if (VALID_OPERATIONS.indexOf(evt.op) === -1) {
      return (
        "Event " + i + " has an invalid operation: " + JSON.stringify(evt.op)
      );
    }
    if (evt.primKey === undefined || evt.primKey === null) {
      return "Event " + i + " is missing a primKey";
    }
    if (evt.op !== "delete" && (evt.data === undefined || evt.data === null)) {
      return "Event " + i + " (" + evt.op + ") is missing data";
    }
  }

  return null;
}

/**
 * Locate the Dexie table list and row lists inside a snapshot.
 *
 * Two shapes are supported:
 *   1. Real Dexie export: `tables: [{name, schema, rowCount}]` next to a
 *      separate `data: [{tableName, inbound, rows}]` array.
 *   2. Simplified: `tables: [{name, schema, rowCount, rows}]`.
 */
function indexSnapshot(snapshotData) {
  var dexieData =
    snapshotData.data && snapshotData.data.hyperbook
      ? snapshotData.data.hyperbook.data
      : snapshotData.data;

  if (!dexieData) {
    throw new Error("Snapshot has no Dexie payload");
  }
  if (!Array.isArray(dexieData.tables)) {
    dexieData.tables = [];
  }

  var useDataArray = Array.isArray(dexieData.data);
  var schemaList = dexieData.tables;
  var dataList = useDataArray ? dexieData.data : null;

  var schemaMap = {};
  for (var s = 0; s < schemaList.length; s++) {
    schemaMap[schemaList[s].name] = schemaList[s];
  }

  var rowDataMap = {};
  if (useDataArray) {
    for (var d = 0; d < dataList.length; d++) {
      rowDataMap[dataList[d].tableName] = dataList[d];
    }
  } else {
    for (var t = 0; t < schemaList.length; t++) {
      if (!schemaList[t].rows) schemaList[t].rows = [];
      rowDataMap[schemaList[t].name] = {
        tableName: schemaList[t].name,
        inbound: true,
        rows: schemaList[t].rows,
      };
    }
  }

  /**
   * Get (creating if needed) the schema + row container for a table.
   *
   * `eventSchema` is the primary-key source string the client reported for
   * this event. Without it the server has to guess "id" for any table it has
   * never seen in a snapshot, which silently stamps a bogus `id` property onto
   * every row of a table keyed by something else (`bookmarks` is keyed by
   * `path`, `onlineide` by `scriptId`).
   */
  function tableFor(tableName, eventSchema) {
    if (!schemaMap[tableName]) {
      var entry = { name: tableName, schema: eventSchema || "id", rowCount: 0 };
      schemaList.push(entry);
      schemaMap[tableName] = entry;
    } else if (eventSchema && !schemaMap[tableName].schema) {
      schemaMap[tableName].schema = eventSchema;
    }

    if (!rowDataMap[tableName]) {
      if (useDataArray) {
        var dataEntry = { tableName: tableName, inbound: true, rows: [] };
        dataList.push(dataEntry);
        rowDataMap[tableName] = dataEntry;
      } else {
        schemaMap[tableName].rows = schemaMap[tableName].rows || [];
        rowDataMap[tableName] = {
          tableName: tableName,
          inbound: true,
          rows: schemaMap[tableName].rows,
        };
      }
    }

    if (!rowDataMap[tableName].rows) rowDataMap[tableName].rows = [];

    return { schema: schemaMap[tableName], data: rowDataMap[tableName] };
  }

  return { tableFor: tableFor };
}

/**
 * Replay events on top of a snapshot to produce the current state.
 *
 * Replay is idempotent: `create` upserts rather than appends, so a batch that
 * is retried after a network failure or replayed out of the offline queue
 * cannot duplicate rows.
 *
 * Mutates and returns `snapshotData`.
 *
 * @param {object} snapshotData wrapper format `{ version, data: { hyperbook } }`
 * @param {Array<object>} events event rows, ordered by id ascending
 */
function applyEventsToSnapshot(snapshotData, events) {
  if (!events || events.length === 0) return snapshotData;

  var index = indexSnapshot(snapshotData);

  for (var i = 0; i < events.length; i++) {
    var evt = events[i];
    var table = index.tableFor(evt.table_name, evt.table_schema);
    var rows = table.data.rows;
    var pk = parsePrimaryKey(table.schema.schema);
    var eventKey = readEventPrimKey(evt);
    var data = evt.data ? JSON.parse(evt.data) : null;

    if (evt.operation === "create") {
      var row = applyPrimKeyToRow(data || {}, pk, eventKey);
      var existing = -1;
      for (var c = 0; c < rows.length; c++) {
        if (keyMatches(rows[c], pk, eventKey)) {
          existing = c;
          break;
        }
      }
      // Upsert, so replaying the same create twice is a no-op.
      if (existing === -1) {
        rows.push(row);
      } else {
        rows[existing] = row;
      }
    } else if (evt.operation === "update" && data) {
      var found = false;
      for (var u = 0; u < rows.length; u++) {
        if (keyMatches(rows[u], pk, eventKey)) {
          applyModifications(rows[u], data);
          found = true;
          break;
        }
      }
      // An update for a row we never saw created is treated as an insert so
      // that state written before the client connected is not dropped.
      if (!found) {
        rows.push(applyPrimKeyToRow(applyModifications({}, data), pk, eventKey));
      }
    } else if (evt.operation === "delete") {
      for (var d = rows.length - 1; d >= 0; d--) {
        if (keyMatches(rows[d], pk, eventKey)) {
          rows.splice(d, 1);
        }
      }
    }

    table.schema.rowCount = rows.length;
  }

  return snapshotData;
}

module.exports = {
  VALID_OPERATIONS: VALID_OPERATIONS,
  createEmptySnapshot: createEmptySnapshot,
  parsePrimaryKey: parsePrimaryKey,
  readEventPrimKey: readEventPrimKey,
  keyMatches: keyMatches,
  applyModifications: applyModifications,
  validateEvents: validateEvents,
  applyEventsToSnapshot: applyEventsToSnapshot,
};
