/*
 * Rebuilding a student's state from a snapshot and the events after it.
 * Ported from the old cloud's lib/eventSourcing.js; side-effect free, so it is
 * tested without a database.
 *
 * Wire format of an event, as packages/markdown/assets/cloud.js sends it:
 *   { table, schema, op: "create" | "update" | "delete", primKey, data }
 *
 * A snapshot is { version, data: { hyperbook: <Dexie export> } }, which the
 * client feeds straight into Dexie's import().
 */

export const OPERATIONS = ["create", "update", "delete"] as const;
export type Operation = (typeof OPERATIONS)[number];

/** An event as stored: primKey and data already parsed from JSON. */
export type StoredEvent = {
  tableName: string;
  tableSchema: string | null;
  operation: Operation;
  primKey: unknown;
  data: Record<string, unknown> | null;
};

/** An event as it arrives from cloud.js. */
export type WireEvent = {
  table: string;
  schema?: string | null;
  op: Operation;
  primKey: unknown;
  data: Record<string, unknown> | null;
};

type Row = Record<string, unknown>;
type TableSchema = { name: string; schema: string; rowCount: number; rows?: Row[] };
type TableData = { tableName: string; inbound: boolean; rows: Row[] };
type DexieData = { tables: TableSchema[]; data?: TableData[] } & Record<string, unknown>;
export type Snapshot = { version: number; data: { hyperbook?: { data: DexieData } } & Record<string, unknown> } & Record<
  string,
  unknown
>;

/** The state of a student who saved nothing yet; the shape of a Dexie export. */
export function emptySnapshot(): Snapshot {
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
      } as never,
    },
  };
}

export type PrimaryKey = { fields: string[]; compound: boolean; outbound: boolean };

/**
 * The primary key field(s) of a Dexie schema string. The markers `++`
 * (auto-increment), `&` (unique) and `*` (multi-entry) are not part of the
 * property name; `[a+b]` is a compound key; an empty first entry an outbound
 * key that is not stored on the object.
 */
export function parsePrimaryKey(schema: string | null | undefined): PrimaryKey {
  const raw = (schema || "").split(",")[0]!.trim();
  if (raw === "") return { fields: [], compound: false, outbound: true };
  if (raw.startsWith("[")) {
    const inner = raw.replace(/^\[/, "").replace(/\]$/, "");
    return { fields: inner.split("+").map((f) => f.trim()), compound: true, outbound: false };
  }
  return { fields: [raw.replace(/^(\+\+|&|\*)/, "")], compound: false, outbound: false };
}

function keyParts(eventKey: unknown): unknown[] {
  return Array.isArray(eventKey) ? eventKey : String(eventKey).split(",");
}

/**
 * Compares as strings: a row keyed by the number 1 and an event keyed by "1"
 * are the same record.
 */
export function keyMatches(row: Row, pk: PrimaryKey, eventKey: unknown): boolean {
  if (pk.outbound || pk.fields.length === 0) return false;
  if (pk.compound) {
    const parts = keyParts(eventKey);
    if (parts.length !== pk.fields.length) return false;
    return pk.fields.every((f, i) => String(row[f]) === String(parts[i]));
  }
  return String(row[pk.fields[0]!]) === String(eventKey);
}

/**
 * Writes the event's key onto the row. Dexie's `creating` hook leaves an
 * auto-incremented key out, and an update of an unseen row arrives as bare
 * modifications; without its key such a row would be invisible to later events.
 */
function applyPrimKey(row: Row, pk: PrimaryKey, eventKey: unknown): Row {
  if (pk.outbound || pk.fields.length === 0) return row;
  if (pk.compound) {
    const parts = keyParts(eventKey);
    pk.fields.forEach((f, i) => {
      if (row[f] === undefined) row[f] = parts[i];
    });
    return row;
  }
  if (row[pk.fields[0]!] === undefined) row[pk.fields[0]!] = eventKey;
  return row;
}

const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/**
 * Applies a Dexie modifications object. Dotted key paths (`"a.b": 1`)
 * address nested properties, as in Dexie's `table.update()`.
 */
export function applyModifications(row: Row, modifications: Row): Row {
  for (const [key, value] of Object.entries(modifications)) {
    const path = key.split(".");
    if (path.some((p) => UNSAFE_KEYS.has(p))) continue;
    let target = row;
    for (const part of path.slice(0, -1)) {
      if (typeof target[part] !== "object" || target[part] === null) target[part] = {};
      target = target[part] as Row;
    }
    target[path[path.length - 1]!] = value;
  }
  return row;
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** An error message for a malformed batch, or null when it is fine. */
export function validateEvents(events: unknown): string | null {
  if (!Array.isArray(events) || events.length === 0) return "Events array required";
  for (let i = 0; i < events.length; i++) {
    const evt = events[i];
    if (!isObject(evt)) return `Event ${i} is not an object`;
    if (typeof evt.table !== "string" || evt.table === "") return `Event ${i} is missing a table name`;
    if (!OPERATIONS.includes(evt.op as Operation)) {
      return `Event ${i} has an invalid operation: ${JSON.stringify(evt.op)}`;
    }
    if (evt.primKey === undefined || evt.primKey === null) return `Event ${i} is missing a primKey`;
    if (evt.op !== "delete" && !isObject(evt.data)) return `Event ${i} (${evt.op}) is missing data`;
    if (evt.schema !== undefined && evt.schema !== null && typeof evt.schema !== "string") {
      return `Event ${i} has an invalid schema`;
    }
  }
  return null;
}

/**
 * Finds the table list and row lists inside a snapshot. Two shapes exist: a
 * real Dexie export (`tables` next to a separate `data` array of rows) and a
 * simplified one with the rows on each table entry.
 */
function indexSnapshot(snapshot: Snapshot) {
  const dexie = (snapshot.data?.hyperbook?.data ?? snapshot.data) as DexieData | undefined;
  if (!dexie || typeof dexie !== "object") throw new Error("Snapshot has no Dexie payload");
  if (!Array.isArray(dexie.tables)) dexie.tables = [];

  const useDataArray = Array.isArray(dexie.data);
  const schemas = new Map(dexie.tables.map((t) => [t.name, t]));
  const rowData = new Map<string, TableData>();
  if (useDataArray) {
    for (const d of dexie.data!) rowData.set(d.tableName, d);
  } else {
    for (const t of dexie.tables) {
      t.rows ??= [];
      rowData.set(t.name, { tableName: t.name, inbound: true, rows: t.rows });
    }
  }

  /**
   * The schema and rows of a table, created when missing. `eventSchema` is
   * the key source the client sent; without it a table never seen in a
   * snapshot would have to be guessed to be keyed by "id".
   */
  return function tableFor(name: string, eventSchema: string | null) {
    let schema = schemas.get(name);
    if (!schema) {
      schema = { name, schema: eventSchema || "id", rowCount: 0 };
      dexie.tables.push(schema);
      schemas.set(name, schema);
    } else if (eventSchema && !schema.schema) {
      schema.schema = eventSchema;
    }
    let data = rowData.get(name);
    if (!data) {
      if (useDataArray) {
        data = { tableName: name, inbound: true, rows: [] };
        dexie.data!.push(data);
      } else {
        schema.rows ??= [];
        data = { tableName: name, inbound: true, rows: schema.rows };
      }
      rowData.set(name, data);
    }
    data.rows ??= [];
    return { schema, data };
  };
}

/**
 * Replays events, oldest first, onto a snapshot. Idempotent: `create`
 * upserts, so a batch sent twice (a retry, the offline queue) cannot
 * duplicate rows. Mutates and returns `snapshot`.
 */
export function applyEvents(snapshot: Snapshot, events: StoredEvent[] | null | undefined): Snapshot {
  if (!events || events.length === 0) return snapshot;
  const tableFor = indexSnapshot(snapshot);

  for (const evt of events) {
    const table = tableFor(evt.tableName, evt.tableSchema);
    const rows = table.data.rows;
    const pk = parsePrimaryKey(table.schema.schema);

    if (evt.operation === "create") {
      const row = applyPrimKey({ ...(evt.data ?? {}) }, pk, evt.primKey);
      const existing = rows.findIndex((r) => keyMatches(r, pk, evt.primKey));
      if (existing === -1) rows.push(row);
      else rows[existing] = row;
    } else if (evt.operation === "update" && evt.data) {
      const existing = rows.find((r) => keyMatches(r, pk, evt.primKey));
      // An update of a row never seen created counts as an insert, so state
      // written before the client connected is not dropped.
      if (existing) applyModifications(existing, evt.data);
      else rows.push(applyPrimKey(applyModifications({}, evt.data), pk, evt.primKey));
    } else if (evt.operation === "delete") {
      for (let i = rows.length - 1; i >= 0; i--) {
        if (keyMatches(rows[i]!, pk, evt.primKey)) rows.splice(i, 1);
      }
    }
    table.schema.rowCount = rows.length;
  }
  return snapshot;
}

export function fromWire(evt: WireEvent): StoredEvent {
  return {
    tableName: evt.table,
    tableSchema: evt.schema ?? null,
    operation: evt.op,
    primKey: evt.primKey,
    data: evt.data ?? null,
  };
}
