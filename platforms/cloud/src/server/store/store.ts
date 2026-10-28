import { asc, count, eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { storeEvents, storeHeads } from "../db/schema";
import { type Snapshot, type WireEvent, applyEvents, emptySnapshot, fromWire } from "./replay";

/*
 * A student's saved state: a snapshot plus the events after it. The client's
 * watermark (`lastEventId`) is the head's revision, which grows by one per
 * accepted batch or snapshot. Only the revision matters to the client, never
 * event ids.
 */

export class StoreTooLargeError extends Error {
  constructor(readonly maxBytes: number) {
    super(`The saved state may be at most ${Math.floor(maxBytes / 1024 / 1024)} MB`);
    this.name = "StoreTooLargeError";
  }
}

export type StoreLimits = {
  /** Largest state per student (snapshot plus pending events). */
  maxBytes: number;
  /** Events after which they are folded into the snapshot. */
  compactAfter: number;
};

function head(db: Db, studentId: number) {
  return db.select().from(storeHeads).where(eq(storeHeads.studentId, studentId)).get();
}

function eventsOf(db: Db, studentId: number) {
  return db
    .select()
    .from(storeEvents)
    .where(eq(storeEvents.studentId, studentId))
    .orderBy(asc(storeEvents.id))
    .all()
    .map((e) => ({
      tableName: e.tableName,
      tableSchema: e.tableSchema,
      operation: e.operation,
      primKey: JSON.parse(e.primKey) as unknown,
      data: e.data === null ? null : (JSON.parse(e.data) as Record<string, unknown>),
    }));
}

function rebuild(db: Db, studentId: number, snapshotJson: string | null): Snapshot {
  const snapshot = snapshotJson ? (JSON.parse(snapshotJson) as Snapshot) : emptySnapshot();
  return applyEvents(snapshot, eventsOf(db, studentId));
}

/** The current state, or a null snapshot when the student never saved. */
export function readState(db: Db, studentId: number) {
  const h = head(db, studentId);
  if (!h) return { snapshot: null, lastEventId: 0, updatedAt: null };
  return {
    snapshot: rebuild(db, studentId, h.snapshot),
    lastEventId: h.revision,
    updatedAt: h.updatedAt.getTime(),
  };
}

/** When the student last saved, for teachers; null if never. */
export function lastSavedAt(db: Db, studentId: number): number | null {
  return head(db, studentId)?.updatedAt.getTime() ?? null;
}

/**
 * Appends a batch, unless the client's watermark is behind the server's:
 * another device saved in between, and the client must merge first. The
 * check and the append are one transaction. A missing watermark (a client
 * that never loaded) skips the check, as the old cloud did.
 */
export function appendEvents(
  db: Db,
  studentId: number,
  events: WireEvent[],
  afterEventId: number | null | undefined,
  limits: StoreLimits,
): { conflict: true; serverLastEventId: number } | { conflict: false; lastEventId: number } {
  return db.transaction((tx) => {
    const h = head(tx as unknown as Db, studentId);
    const revision = h?.revision ?? 0;
    if (afterEventId !== null && afterEventId !== undefined && afterEventId !== revision) {
      return { conflict: true as const, serverLastEventId: revision };
    }

    const rows = events.map((e) => {
      const stored = fromWire(e);
      return {
        studentId,
        revision: revision + 1,
        tableName: stored.tableName,
        tableSchema: stored.tableSchema,
        operation: stored.operation,
        primKey: JSON.stringify(stored.primKey),
        data: stored.data === null ? null : JSON.stringify(stored.data),
      };
    });
    const added = rows.reduce((n, r) => n + r.primKey.length + (r.data?.length ?? 0), 0);
    const size = (h?.sizeBytes ?? 0) + added;
    if (size > limits.maxBytes) throw new StoreTooLargeError(limits.maxBytes);

    tx.insert(storeEvents).values(rows).run();
    const now = new Date();
    tx.insert(storeHeads)
      .values({ studentId, revision: revision + 1, sizeBytes: size, updatedAt: now })
      .onConflictDoUpdate({
        target: storeHeads.studentId,
        set: { revision: revision + 1, sizeBytes: size, updatedAt: now },
      })
      .run();

    const pending =
      tx.select({ n: count() }).from(storeEvents).where(eq(storeEvents.studentId, studentId)).get()?.n ?? 0;
    if (pending >= limits.compactAfter) compact(tx as unknown as Db, studentId);

    return { conflict: false as const, lastEventId: revision + 1 };
  });
}

/** Folds the events into the snapshot. Inside a transaction. */
function compact(db: Db, studentId: number) {
  const h = head(db, studentId)!;
  const json = JSON.stringify(rebuild(db, studentId, h.snapshot));
  db.update(storeHeads)
    .set({ snapshot: json, snapshotRevision: h.revision, sizeBytes: json.length })
    .where(eq(storeHeads.studentId, studentId))
    .run();
  db.delete(storeEvents).where(eq(storeEvents.studentId, studentId)).run();
}

/**
 * Replaces the whole state (the client's fallback for large batches, and
 * after its offline queue overflowed). No watermark check: the client sends
 * everything it has.
 */
export function replaceSnapshot(db: Db, studentId: number, data: Snapshot, limits: StoreLimits) {
  const json = JSON.stringify(data);
  if (json.length > limits.maxBytes) throw new StoreTooLargeError(limits.maxBytes);
  return db.transaction((tx) => {
    const revision = (head(tx as unknown as Db, studentId)?.revision ?? 0) + 1;
    const now = new Date();
    const values = { snapshot: json, snapshotRevision: revision, revision, sizeBytes: json.length, updatedAt: now };
    tx.insert(storeHeads)
      .values({ studentId, ...values })
      .onConflictDoUpdate({ target: storeHeads.studentId, set: values })
      .run();
    tx.delete(storeEvents).where(eq(storeEvents.studentId, studentId)).run();
    return { lastEventId: revision };
  });
}
