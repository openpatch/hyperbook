import { describe, expect, it } from "vitest";
import { books, groups, students } from "../src/server/db/schema";
import {
  StoreTooLargeError,
  exportState,
  lastSavedAt,
  readChanges,
  validateRows,
  writeRows,
} from "../src/server/store/store";
import { setup } from "./helpers";

const limits = { maxBytes: 1024 * 1024 };

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

const bookmark = (path: string, label = path.toUpperCase()) => ({
  table: "bookmarks",
  key: path,
  data: { path, label } as Record<string, unknown>,
});
const gone = (path: string) => ({ table: "bookmarks", key: path, data: null });

describe("store", () => {
  it("starts empty", () => {
    const { db, id } = student();
    expect(readChanges(db, id, 0)).toEqual({ revision: 0, rows: [] });
    expect(exportState(db, id)).toBeNull();
    expect(lastSavedAt(db, id)).toBeNull();
  });

  it("stamps each upload with the next revision and hands out what changed since", () => {
    const { db, id } = student();
    expect(writeRows(db, id, { since: 0, rows: [bookmark("/a")] }, limits)).toEqual({ revision: 1, rows: [] });
    expect(writeRows(db, id, { since: 1, rows: [bookmark("/b")] }, limits)).toEqual({ revision: 2, rows: [] });
    expect(readChanges(db, id, 1)).toEqual({ revision: 2, rows: [bookmark("/b")] });
    expect(readChanges(db, id, 2)).toEqual({ revision: 2, rows: [] });
    expect(readChanges(db, id, 0).rows).toEqual([bookmark("/a"), bookmark("/b")]);
  });

  it("is idempotent: the same upload twice leaves the same state", () => {
    const { db, id } = student();
    writeRows(db, id, { since: 0, rows: [bookmark("/a")] }, limits);
    writeRows(db, id, { since: 0, rows: [bookmark("/a")] }, limits);
    expect(readChanges(db, id, 0).rows).toEqual([bookmark("/a")]);
    expect(exportState(db, id)!.tables).toEqual({ bookmarks: [{ path: "/a", label: "/A" }] });
  });

  it("answers an upload with what other devices saved after its revision", () => {
    const { db, id } = student();
    writeRows(db, id, { since: 0, rows: [bookmark("/phone")] }, limits);
    const laptop = writeRows(db, id, { since: 0, rows: [bookmark("/laptop")] }, limits);
    expect(laptop).toEqual({ revision: 2, rows: [bookmark("/phone")] });
  });

  it("keeps deletions for devices that have seen the row, not for new ones", () => {
    const { db, id } = student();
    writeRows(db, id, { since: 0, rows: [bookmark("/a"), bookmark("/b")] }, limits);
    writeRows(db, id, { since: 1, rows: [gone("/a")] }, limits);
    expect(readChanges(db, id, 1).rows).toEqual([gone("/a")]);
    expect(readChanges(db, id, 0).rows).toEqual([bookmark("/b")]);
  });

  it("takes the last value of a row named twice in one upload", () => {
    const { db, id } = student();
    writeRows(db, id, { since: 0, rows: [bookmark("/a", "first"), bookmark("/a", "second")] }, limits);
    expect(readChanges(db, id, 0).rows).toEqual([bookmark("/a", "second")]);
  });

  it("replaces the whole state, deleting rows the upload does not name", () => {
    const { db, id } = student();
    writeRows(db, id, { since: 0, rows: [bookmark("/a"), bookmark("/b")] }, limits);
    writeRows(db, id, { since: 1, rows: [bookmark("/z")], replace: true }, limits);
    expect(readChanges(db, id, 0).rows).toEqual([bookmark("/z")]);
    expect(readChanges(db, id, 1).rows).toEqual(expect.arrayContaining([gone("/a"), gone("/b"), bookmark("/z")]));
  });

  it("keeps compound and numeric keys apart", () => {
    const { db, id } = student();
    writeRows(
      db,
      id,
      {
        since: 0,
        rows: [
          { table: "t", key: 1, data: { v: "number" } },
          { table: "t", key: "1", data: { v: "string" } },
          { table: "t", key: ["a", 1], data: { v: "compound" } },
        ],
      },
      limits,
    );
    expect(readChanges(db, id, 0).rows.map((r) => r.key)).toEqual(expect.arrayContaining([1, "1", ["a", 1]]));
  });

  it("refuses a state over the limit and keeps nothing of it", () => {
    const { db, id } = student();
    const tiny = { maxBytes: 100 };
    writeRows(db, id, { since: 0, rows: [bookmark("/a")] }, tiny);
    const big = { table: "bookmarks", key: "/big", data: { text: "x".repeat(200) } };
    expect(() => writeRows(db, id, { since: 1, rows: [big] }, tiny)).toThrow(StoreTooLargeError);
    expect(readChanges(db, id, 0)).toEqual({ revision: 1, rows: [bookmark("/a")] });
    // Deleting frees the space again.
    writeRows(db, id, { since: 1, rows: [gone("/a")] }, tiny);
    writeRows(db, id, { since: 2, rows: [{ table: "t", key: 1, data: { text: "x".repeat(60) } }] }, tiny);
  });

  it("counts the limit in bytes, not characters", () => {
    const { db, id } = student();
    const tiny = { maxBytes: 100 };
    // 30 characters, 90 bytes in UTF-8: over the limit with key and quotes.
    const wide = { table: "t", key: 1, data: { text: "€".repeat(30) } };
    expect(() => writeRows(db, id, { since: 0, rows: [wide] }, tiny)).toThrow(StoreTooLargeError);
  });

  it("lets a state over the limit shrink or stay as large", () => {
    const { db, id } = student();
    writeRows(db, id, { since: 0, rows: [{ table: "t", key: 1, data: { text: "x".repeat(150) } }, bookmark("/a")] }, limits);
    // The limit is lowered under it (an admin changed STORE_MAX_MB).
    const tiny = { maxBytes: 100 };
    // Deleting a row goes through, though the state is still too large.
    expect(() => writeRows(db, id, { since: 1, rows: [gone("/a")] }, tiny)).not.toThrow();
    // Changing a row to something no larger goes through too; growing does not.
    expect(() =>
      writeRows(db, id, { since: 2, rows: [{ table: "t", key: 1, data: { text: "y".repeat(150) } }] }, tiny),
    ).not.toThrow();
    expect(() =>
      writeRows(db, id, { since: 3, rows: [{ table: "t", key: 1, data: { text: "y".repeat(151) } }] }, tiny),
    ).toThrow(StoreTooLargeError);
  });

  it("does not advance the revision for an empty upload", () => {
    const { db, id } = student();
    writeRows(db, id, { since: 0, rows: [bookmark("/a")] }, limits);
    expect(writeRows(db, id, { since: 0, rows: [] }, limits)).toEqual({ revision: 1, rows: [bookmark("/a")] });
  });
});

describe("two devices changing one row", () => {
  const at = (row: ReturnType<typeof bookmark> | ReturnType<typeof gone>, time: number, base: number) => ({
    ...row,
    at: time,
    base,
  });

  it("keeps a later change over an older one from a device that never saw it", () => {
    const { db, id } = student();
    writeRows(db, id, { since: 0, rows: [at(bookmark("/a", "OLD"), 1000, 0)] }, limits);
    // At home, a week later.
    writeRows(db, id, { since: 1, rows: [at(bookmark("/a", "HOME"), 9000, 1)] }, limits);
    // The school computer uploads the change it kept since revision 1.
    const answer = writeRows(db, id, { since: 1, rows: [at(bookmark("/a", "SCHOOL"), 5000, 1)] }, limits);
    expect(answer).toEqual({ revision: 2, rows: [bookmark("/a", "HOME")] });
    expect(readChanges(db, id, 0).rows).toEqual([bookmark("/a", "HOME")]);
  });

  it("hands back a deletion that won, also to a device syncing from scratch", () => {
    const { db, id } = student();
    writeRows(db, id, { since: 0, rows: [at(bookmark("/a"), 1000, 0)] }, limits);
    writeRows(db, id, { since: 1, rows: [at(gone("/a"), 9000, 1)] }, limits);
    const answer = writeRows(db, id, { since: 0, rows: [at(bookmark("/a", "STALE"), 5000, 0)] }, limits);
    expect(answer.rows).toEqual([gone("/a")]);
  });

  it("takes a later change from a device that never saw the stored row", () => {
    const { db, id } = student();
    writeRows(db, id, { since: 0, rows: [at(bookmark("/a", "FIRST"), 1000, 0)] }, limits);
    writeRows(db, id, { since: 0, rows: [at(bookmark("/a", "LATER"), 2000, 0)] }, limits);
    expect(readChanges(db, id, 0).rows).toEqual([bookmark("/a", "LATER")]);
  });

  it("takes any change from a device that had seen the stored row", () => {
    const { db, id } = student();
    writeRows(db, id, { since: 0, rows: [at(bookmark("/a", "FIRST"), 9000, 0)] }, limits);
    // The clock of this device runs behind, but it knew revision 1.
    writeRows(db, id, { since: 1, rows: [at(bookmark("/a", "NEXT"), 1000, 1)] }, limits);
    expect(readChanges(db, id, 0).rows).toEqual([bookmark("/a", "NEXT")]);
  });

  it("does not let a clock running ahead win later changes", () => {
    const { db, id } = student();
    const future = Date.now() + 365 * 24 * 3600 * 1000;
    writeRows(db, id, { since: 0, rows: [at(bookmark("/a", "AHEAD"), future, 0)] }, limits);
    writeRows(db, id, { since: 0, rows: [at(bookmark("/a", "NOW"), Date.now() + 1000, 0)] }, limits);
    expect(readChanges(db, id, 0).rows).toEqual([bookmark("/a", "NOW")]);
  });

  it("does not advance the revision when every row lost", () => {
    const { db, id } = student();
    writeRows(db, id, { since: 0, rows: [at(bookmark("/a"), 1000, 0)] }, limits);
    writeRows(db, id, { since: 1, rows: [at(bookmark("/a", "HOME"), 9000, 1)] }, limits);
    const answer = writeRows(db, id, { since: 2, rows: [at(bookmark("/a", "OLD"), 5000, 1)] }, limits);
    expect(answer).toEqual({ revision: 2, rows: [bookmark("/a", "HOME")] });
  });

  it("stores a replacement whatever is saved", () => {
    const { db, id } = student();
    writeRows(db, id, { since: 0, rows: [at(bookmark("/a", "HOME"), 9000, 0)] }, limits);
    writeRows(db, id, { since: 0, rows: [at(bookmark("/a", "IMPORTED"), 1000, 0)], replace: true }, limits);
    expect(readChanges(db, id, 0).rows).toEqual([bookmark("/a", "IMPORTED")]);
  });
});

describe("validateRows", () => {
  it("accepts rows and deletions", () => {
    expect(validateRows([bookmark("/a"), gone("/a"), { table: "t", key: ["a", 1], data: {} }])).toBeNull();
  });

  it.each([
    [{ rows: [] }, /list/],
    [[{ table: "", key: 1, data: null }], /table name/],
    [[{ table: "a-b", key: 1, data: null }], /table name/],
    [[{ table: "t", key: null, data: null }], /key/],
    [[{ table: "t", key: [], data: null }], /key/],
    [[{ table: "t", key: { a: 1 }, data: null }], /key/],
    [[{ table: "t", key: "x".repeat(2000), data: null }], /too long/],
    [[{ table: "t", key: 1, data: [1] }], /data/],
    [[{ table: "t", key: 1, data: "text" }], /data/],
    [[{ table: "t", key: 1, data: null, at: -1 }], /change time/],
    [[{ table: "t", key: 1, data: null, at: "now" }], /change time/],
    [[{ table: "t", key: 1, data: null, base: 1.5 }], /base/],
    [Array.from({ length: 1001 }, (_, i) => ({ table: "t", key: i, data: null })), /At most 1000/],
  ])("refuses %j", (rows, message) => {
    expect(validateRows(rows)).toMatch(message);
  });
});
