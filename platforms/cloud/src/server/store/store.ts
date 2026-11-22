import { and, eq, gt, isNotNull, ne } from "drizzle-orm";
import type { Db } from "../db/client";
import { storeHeads, storeRows } from "../db/schema";

/*
 * A student's saved state: the rows of their local store (Dexie tables), as
 * last uploaded from any of their devices.
 *
 * Sync is row-based and idempotent. A device uploads the current value of
 * every row it changed (or null for a deleted row); each upload that changes
 * something advances the student's revision by one and stamps its rows with
 * it. A device remembers the revision it has seen and asks for the rows
 * stamped after it. Sending the same rows twice is harmless.
 *
 * Two devices can change the same row: a school computer that kept a change
 * for a week, while the student went on at home. Each uploaded row says when
 * it was changed (`at`) and which revision the device had seen when it was
 * (`base`). If the stored row is from a later revision, the device never saw
 * it, and the change made later wins; a losing upload gets the stored row
 * back so the device takes it over.
 */

export class StoreTooLargeError extends Error {
  constructor(readonly maxBytes: number) {
    super(`The saved state may be at most ${Math.floor(maxBytes / 1024 / 1024)} MB`);
    this.name = "StoreTooLargeError";
  }
}

export type StoreLimits = {
  /** Largest state per student: the size of all live rows. */
  maxBytes: number;
};

/** A row as it travels between the browser and the server. */
export type SyncRow = {
  table: string;
  key: unknown;
  data: Record<string, unknown> | null;
  /** Uploads: when the student changed the row on the device (ms). */
  at?: number;
  /** Uploads: the revision the device had seen when the row changed. */
  base?: number;
};

const TABLE_NAME = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
const MAX_KEY_LENGTH = 1024;
// Kept small so one request never holds the database for long: the device
// uploads in batches.
export const MAX_ROWS_PER_REQUEST = 1000;

function isKeyPart(value: unknown): boolean {
  return (typeof value === "string" || (typeof value === "number" && Number.isFinite(value)));
}

const isCount = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

/** Why `rows` cannot be stored, or null when they can. */
export function validateRows(rows: unknown): string | null {
  if (!Array.isArray(rows)) return "rows must be a list";
  if (rows.length > MAX_ROWS_PER_REQUEST) return `At most ${MAX_ROWS_PER_REQUEST} rows per request`;
  for (const row of rows) {
    if (!row || typeof row !== "object" || Array.isArray(row)) return "Each row must be an object";
    const { table, key, data, at, base } = row as Record<string, unknown>;
    if (typeof table !== "string" || !TABLE_NAME.test(table)) return "Invalid table name";
    const keyOk = isKeyPart(key) || (Array.isArray(key) && key.length > 0 && key.every(isKeyPart));
    if (!keyOk) return "Invalid row key";
    if (JSON.stringify(key).length > MAX_KEY_LENGTH) return "Row key too long";
    if (data !== null && (typeof data !== "object" || Array.isArray(data))) {
      return "Row data must be an object or null";
    }
    if (at !== undefined && !isCount(at)) return "Invalid change time";
    if (base !== undefined && !isCount(base)) return "Invalid base revision";
  }
  return null;
}

function head(db: Db, studentId: number) {
  return db.select().from(storeHeads).where(eq(storeHeads.studentId, studentId)).get();
}

function toWire(row: { tableName: string; key: string; data: string | null }): SyncRow {
  return {
    table: row.tableName,
    key: JSON.parse(row.key) as unknown,
    data: row.data === null ? null : (JSON.parse(row.data) as Record<string, unknown>),
  };
}

/**
 * The rows stamped after `since`, and the current revision. From scratch
 * (`since` 0) only the live rows; after that deletions too, so the device
 * removes them.
 */
export function readChanges(db: Db, studentId: number, since: number) {
  const revision = head(db, studentId)?.revision ?? 0;
  if (since >= revision) return { revision, rows: [] as SyncRow[] };
  const rows = db
    .select()
    .from(storeRows)
    .where(
      since <= 0
        ? and(eq(storeRows.studentId, studentId), isNotNull(storeRows.data))
        : and(eq(storeRows.studentId, studentId), gt(storeRows.revision, since)),
    )
    .all()
    .map(toWire);
  return { revision, rows };
}

/** A row's share of the student's limit, in bytes (as stored, UTF-8). */
const rowSize = (key: string, data: string | null) =>
  data === null ? 0 : Buffer.byteLength(key) + Buffer.byteLength(data);
const rowId = (tableName: string, key: string) => `${tableName}\u0000${key}`;

/**
 * Stores uploaded rows and answers with what other devices uploaded after
 * `since`, so one round trip both saves and catches up. The answer also
 * carries the stored value of every uploaded row that lost to a later change
 * from another device.
 *
 * With `replace`, every stored row the upload does not name is deleted and
 * the named rows are stored whatever is there: the device sends its whole
 * state (after importing a file or resetting).
 */
export function writeRows(
  db: Db,
  studentId: number,
  input: { since: number; rows: SyncRow[]; replace?: boolean },
  limits: StoreLimits,
): { revision: number; rows: SyncRow[] } {
  return db.transaction((tx) => {
    const t = tx as unknown as Db;
    const h = head(t, studentId);
    const current = h?.revision ?? 0;
    if (input.rows.length === 0 && !input.replace) {
      return readChanges(t, studentId, input.since);
    }

    const revision = current + 1;
    const now = new Date();
    // A device clock running ahead must not win every later conflict.
    const editedAt = (at: number | undefined) => Math.min(at ?? now.getTime(), now.getTime());
    let size = h?.sizeBytes ?? 0;

    // The last value of a row in the request wins, as it would locally.
    type Incoming = { tableName: string; key: string; data: string | null; at: number; base?: number };
    const incoming = new Map<string, Incoming>();
    for (const row of input.rows) {
      const key = JSON.stringify(row.key);
      incoming.set(rowId(row.table, key), {
        tableName: row.table,
        key,
        data: row.data === null ? null : JSON.stringify(row.data),
        at: editedAt(row.at),
        base: row.base,
      });
    }

    if (input.replace) {
      const live = t
        .select({ tableName: storeRows.tableName, key: storeRows.key })
        .from(storeRows)
        .where(and(eq(storeRows.studentId, studentId), isNotNull(storeRows.data)))
        .all();
      for (const row of live) {
        const id = rowId(row.tableName, row.key);
        if (!incoming.has(id)) {
          incoming.set(id, { tableName: row.tableName, key: row.key, data: null, at: now.getTime() });
        }
      }
    }

    const lost = new Map<string, SyncRow>();
    let written = 0;
    for (const [id, row] of incoming) {
      const old = t
        .select({ data: storeRows.data, revision: storeRows.revision, editedAt: storeRows.editedAt })
        .from(storeRows)
        .where(
          and(eq(storeRows.studentId, studentId), eq(storeRows.tableName, row.tableName), eq(storeRows.key, row.key)),
        )
        .get();
      // Saved from elsewhere after the device last looked, and changed later
      // than the device's change: the stored row stays.
      const unseen = old && row.base !== undefined && old.revision > row.base;
      if (old && unseen && !input.replace && row.at < old.editedAt) {
        lost.set(id, toWire({ tableName: row.tableName, key: row.key, data: old.data }));
        continue;
      }
      size += rowSize(row.key, row.data) - (old ? rowSize(row.key, old.data) : 0);
      t.insert(storeRows)
        .values({
          studentId,
          tableName: row.tableName,
          key: row.key,
          data: row.data,
          revision,
          editedAt: row.at,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [storeRows.studentId, storeRows.tableName, storeRows.key],
          set: { data: row.data, revision, editedAt: row.at, updatedAt: now },
        })
        .run();
      written += 1;
    }

    // Every row lost: nothing changed, so the revision stays.
    if (written === 0 && !input.replace) {
      const changes = readChanges(t, studentId, input.since);
      return { revision: changes.revision, rows: merge(changes.rows, lost) };
    }

    // Rolls the whole transaction back: nothing of an oversized upload stays.
    // An upload that does not make the state larger always goes through, so
    // a student over the limit can still change and delete their work.
    if (size > limits.maxBytes && size > (h?.sizeBytes ?? 0)) throw new StoreTooLargeError(limits.maxBytes);

    t.insert(storeHeads)
      .values({ studentId, revision, sizeBytes: size, updatedAt: now })
      .onConflictDoUpdate({
        target: storeHeads.studentId,
        set: { revision, sizeBytes: size, updatedAt: now },
      })
      .run();

    const others =
      input.since >= current
        ? []
        : t
            .select()
            .from(storeRows)
            .where(
              and(
                eq(storeRows.studentId, studentId),
                gt(storeRows.revision, input.since),
                ne(storeRows.revision, revision),
              ),
            )
            .all()
            .filter((r) => input.since > 0 || r.data !== null)
            .map(toWire);
    return { revision, rows: merge(others, lost) };
  });
}

/** `rows` with the rows of `lost` added, each row once. */
function merge(rows: SyncRow[], lost: Map<string, SyncRow>): SyncRow[] {
  if (lost.size === 0) return rows;
  const out = rows.filter((r) => !lost.has(rowId(r.table, JSON.stringify(r.key))));
  return out.concat([...lost.values()]);
}

/** Everything a student saved, by table, for teachers; null if never. */
export function exportState(db: Db, studentId: number) {
  const h = head(db, studentId);
  if (!h) return null;
  const tables: Record<string, Record<string, unknown>[]> = {};
  for (const row of readChanges(db, studentId, 0).rows) {
    (tables[row.table] ||= []).push(row.data!);
  }
  return { revision: h.revision, updatedAt: h.updatedAt.getTime(), tables };
}

/** When the student last saved, for teachers; null if never. */
export function lastSavedAt(db: Db, studentId: number): number | null {
  return head(db, studentId)?.updatedAt.getTime() ?? null;
}
