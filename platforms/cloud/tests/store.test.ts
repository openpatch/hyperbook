import { describe, expect, it } from "vitest";
import { books, groups, students } from "../src/server/db/schema";
import type { Snapshot } from "../src/server/store/replay";
import { StoreTooLargeError, appendEvents, readState, replaceSnapshot } from "../src/server/store/store";
import { setup } from "./helpers";

const limits = { maxBytes: 1024 * 1024, compactAfter: 100 };

function student() {
  const instance = setup();
  const { db } = instance;
  const book = db.insert(books).values({ slug: "b", title: "B" }).returning().get();
  const group = db.insert(groups).values({ bookId: book.id, name: "7a" }).returning().get();
  const s = db
    .insert(students)
    .values({
      bookId: book.id,
      groupId: group.id,
      username: "student01",
      passwordHash: "x",
      passwordSealed: "x",
      loginKeyHash: "k",
      loginKeySealed: "k",
    })
    .returning()
    .get();
  return { db, id: s.id };
}

const bookmark = (path: string) => ({
  table: "bookmarks",
  schema: "path,label",
  op: "create" as const,
  primKey: path,
  data: { path, label: path.toUpperCase() },
});

function rows(snapshot: Snapshot | null, table: string) {
  const dexie = snapshot!.data.hyperbook!.data;
  return dexie.data!.find((d) => d.tableName === table)?.rows;
}

describe("store", () => {
  it("starts empty", () => {
    const { db, id } = student();
    expect(readState(db, id)).toEqual({ snapshot: null, lastEventId: 0, updatedAt: null });
  });

  it("appends batches and replays them", () => {
    const { db, id } = student();
    expect(appendEvents(db, id, [bookmark("/a")], 0, limits)).toEqual({ conflict: false, lastEventId: 1 });
    expect(appendEvents(db, id, [bookmark("/b")], 1, limits)).toEqual({ conflict: false, lastEventId: 2 });
    appendEvents(db, id, [{ table: "bookmarks", op: "delete", primKey: "/a", data: null }], 2, limits);
    const state = readState(db, id);
    expect(state.lastEventId).toBe(3);
    expect(rows(state.snapshot, "bookmarks")).toEqual([{ path: "/b", label: "/B" }]);
  });

  it("refuses a batch based on an old watermark", () => {
    const { db, id } = student();
    appendEvents(db, id, [bookmark("/a")], 0, limits);
    appendEvents(db, id, [bookmark("/b")], 1, limits);
    expect(appendEvents(db, id, [bookmark("/c")], 1, limits)).toEqual({ conflict: true, serverLastEventId: 2 });
    // A client that never loaded sends no watermark and is not checked.
    expect(appendEvents(db, id, [bookmark("/c")], null, limits)).toEqual({ conflict: false, lastEventId: 3 });
  });

  it("folds events into the snapshot without changing the state", () => {
    const { db, id } = student();
    const small = { ...limits, compactAfter: 3 };
    for (let i = 0; i < 7; i++) appendEvents(db, id, [bookmark(`/${i}`)], i, small);
    const state = readState(db, id);
    expect(state.lastEventId).toBe(7);
    expect(rows(state.snapshot, "bookmarks")).toHaveLength(7);
    const pending = db.$client.prepare("select count(*) as n from store_events").get() as { n: number };
    expect(pending.n).toBeLessThan(3);
  });

  it("replaces the state with a snapshot", () => {
    const { db, id } = student();
    appendEvents(db, id, [bookmark("/a")], 0, limits);
    const snapshot = {
      version: 1,
      data: {
        hyperbook: {
          formatName: "dexie",
          data: { tables: [{ name: "bookmarks", schema: "path", rowCount: 1 }], data: [{ tableName: "bookmarks", inbound: true, rows: [{ path: "/z" }] }] },
        },
      },
    } as unknown as Snapshot;
    expect(replaceSnapshot(db, id, snapshot, limits)).toEqual({ lastEventId: 2 });
    expect(rows(readState(db, id).snapshot, "bookmarks")).toEqual([{ path: "/z" }]);
  });

  it("enforces the size limit", () => {
    const { db, id } = student();
    const tiny = { maxBytes: 100, compactAfter: 100 };
    const big = { ...bookmark("/a"), data: { path: "/a", label: "x".repeat(200) } };
    expect(() => appendEvents(db, id, [big], 0, tiny)).toThrow(StoreTooLargeError);
    expect(readState(db, id).lastEventId).toBe(0);
  });
});
