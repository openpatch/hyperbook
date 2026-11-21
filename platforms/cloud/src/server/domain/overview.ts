import { readFileSync } from "node:fs";
import path from "node:path";
import { and, asc, eq, inArray, isNotNull, isNull, max } from "drizzle-orm";
import { z } from "zod";
import type { Config } from "../config";
import type { Db } from "../db/client";
import { type books, storeRows, studentSessions, students } from "../db/schema";
import { buildDir } from "../hosting/storage";

/*
 * The class view (M8 in docs/cloud-platform.md): which student worked on
 * which element, from the times of their saved rows. Values are never read
 * here, only table, key and time.
 */

const keyMatch = z.enum(["id", "prefix", "suffix"]);
const element = z.object({
  id: z.string(),
  name: z.string(),
  table: z.string(),
  /** How row keys relate to the id; equal when left out. */
  match: keyMatch.optional(),
  /** More tables of the same element. */
  also: z.array(z.object({ table: z.string(), match: keyMatch })).optional(),
});
export type IndexedElement = z.infer<typeof element>;

const elementIndex = z.object({
  version: z.literal(1),
  pages: z.array(
    z.object({
      href: z.string(),
      title: z.string(),
      elements: z.array(element),
    }),
  ),
});
export type ElementIndex = z.infer<typeof elementIndex>;

/**
 * Tables that hold how the book looks for the student (open tabs, scroll
 * state, bookmarks), not their work. They never show in the overview.
 */
const UI_TABLES = new Set([
  "collapsibles",
  "tabs",
  "slideshow",
  "currentState",
  "consent",
  "bookmarks",
  "audio",
  "protect",
]);

/** The id of a cell: an element's table and id. */
export const cellId = (table: string, id: string) => `${table}/${id}`;

const keyMatches = (key: string, id: string, match: z.infer<typeof keyMatch> = "id") =>
  match === "prefix" ? key.startsWith(id) : match === "suffix" ? key.endsWith(id) : key === id;

/** Every (table, match) under which an element keeps rows. */
const placesOf = (e: IndexedElement) => [{ table: e.table, match: e.match ?? "id" }, ...(e.also ?? [])];

/**
 * Finds the element a saved row belongs to: an exact key first, then the
 * longest id the key starts or ends with (embedded IDEs key their files
 * id + file name).
 */
function rowMatcher(pages: ElementIndex["pages"]) {
  const exact = new Map<string, string>();
  const loose = new Map<string, { id: string; match: "prefix" | "suffix"; cell: string }[]>();
  for (const page of pages) {
    for (const e of page.elements) {
      const cell = cellId(e.table, e.id);
      for (const place of placesOf(e)) {
        if (place.match === "id") exact.set(`${place.table}\0${e.id}`, cell);
        else {
          const list = loose.get(place.table) ?? [];
          list.push({ id: e.id, match: place.match, cell });
          loose.set(place.table, list);
        }
      }
    }
  }
  for (const list of loose.values()) list.sort((a, b) => b.id.length - a.id.length);
  return (table: string, key: string): string | null =>
    exact.get(`${table}\0${key}`) ??
    loose.get(table)?.find((c) => keyMatches(key, c.id, c.match))?.cell ??
    null;
}

const parseKey = (key: string): string | null => {
  try {
    const parsed: unknown = JSON.parse(key);
    return typeof parsed === "string" ? parsed : null;
  } catch {
    return null;
  }
};

/**
 * The element index of the book's live version, written by the build
 * (`_hyperbook/elements.json`); null when nothing is published or the
 * version was built by a Hyperbook that does not write it.
 */
export function readElementIndex(config: Config, book: typeof books.$inferSelect): ElementIndex | null {
  if (!book.publishedBuildId) return null;
  try {
    const file = path.join(buildDir(config, book.id, book.publishedBuildId), "_hyperbook", "elements.json");
    const parsed = elementIndex.safeParse(JSON.parse(readFileSync(file, "utf8")));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export type OverviewStudent = {
  id: number;
  username: string;
  lastLoginAt: number | null;
  /** The last request of one of the student's own sessions. */
  lastSeenAt: number | null;
  /** cellId → when the student last changed that element (device time, ms). */
  cells: Record<string, number>;
  /** Saved work that belongs to no element of the live version. */
  elsewhere: number;
};

export function groupOverview(
  db: Db,
  config: Config,
  book: typeof books.$inferSelect,
  groupId: number,
): { indexed: boolean; pages: ElementIndex["pages"]; students: OverviewStudent[] } {
  const index = readElementIndex(config, book);
  const cellOf = rowMatcher(index?.pages ?? []);
  const list = db
    .select({ id: students.id, username: students.username, lastLoginAt: students.lastLoginAt })
    .from(students)
    .where(eq(students.groupId, groupId))
    .orderBy(asc(students.username))
    .all();
  const ids = list.map((s) => s.id);
  const result = new Map<number, OverviewStudent>(
    list.map((s) => [
      s.id,
      {
        id: s.id,
        username: s.username,
        lastLoginAt: s.lastLoginAt?.getTime() ?? null,
        lastSeenAt: null,
        cells: {},
        elsewhere: 0,
      },
    ]),
  );
  if (ids.length > 0) {
    const rows = db
      .select({ studentId: storeRows.studentId, table: storeRows.tableName, key: storeRows.key, editedAt: storeRows.editedAt })
      .from(storeRows)
      .where(and(inArray(storeRows.studentId, ids), isNotNull(storeRows.data)))
      .all();
    for (const row of rows) {
      if (UI_TABLES.has(row.table)) continue;
      const student = result.get(row.studentId)!;
      const key = parseKey(row.key);
      const cell = key === null ? null : cellOf(row.table, key);
      // An element with several rows counts once, at its latest change.
      if (cell) student.cells[cell] = Math.max(student.cells[cell] ?? 0, row.editedAt);
      else student.elsewhere++;
    }
    const seen = db
      .select({ studentId: studentSessions.studentId, at: max(studentSessions.lastSeenAt) })
      .from(studentSessions)
      // A teacher viewing the student's work is not the student being online.
      .where(and(inArray(studentSessions.studentId, ids), isNull(studentSessions.impersonatedBy)))
      .groupBy(studentSessions.studentId)
      .all();
    for (const s of seen) {
      const at = s.at as unknown;
      result.get(s.studentId)!.lastSeenAt =
        at instanceof Date ? at.getTime() : typeof at === "number" ? at : null;
    }
  }
  return { indexed: index !== null, pages: index?.pages ?? [], students: [...result.values()] };
}

const csvCell = (value: string) => (/[",\n;]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

/**
 * The overview as CSV: one row per student, one column per element (when
 * the student last changed it, ISO time, empty for never).
 */
export function overviewCsv(
  overview: ReturnType<typeof groupOverview>,
  labels: { username: string; lastLogin: string; lastSeen: string; elsewhere: string },
): string {
  const elements = overview.pages.flatMap((page) =>
    page.elements.map((e, i) => ({ id: cellId(e.table, e.id), label: `${page.title} ${i + 1} (${e.name})` })),
  );
  const iso = (ms: number | null) => (ms === null ? "" : new Date(ms).toISOString());
  const header = [labels.username, labels.lastLogin, labels.lastSeen, ...elements.map((e) => e.label), labels.elsewhere];
  const lines = overview.students.map((s) => [
    s.username,
    iso(s.lastLoginAt),
    iso(s.lastSeenAt),
    ...elements.map((e) => iso(s.cells[e.id] ?? null)),
    String(s.elsewhere),
  ]);
  return [header, ...lines].map((line) => line.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

/**
 * All saved rows of one element of a student (several for an embedded IDE).
 * A row goes to the element the overview gives it, so "java2Main.java" is
 * the second IDE's even though it starts with "java".
 */
export function elementRows(
  db: Db,
  studentId: number,
  e: IndexedElement,
  pages: ElementIndex["pages"] = [],
) {
  const places = placesOf(e);
  const cellOf = rowMatcher([...pages, { href: "", title: "", elements: [e] }]);
  const cell = cellId(e.table, e.id);
  const rows = db
    .select({ table: storeRows.tableName, key: storeRows.key, data: storeRows.data, editedAt: storeRows.editedAt })
    .from(storeRows)
    .where(
      and(
        eq(storeRows.studentId, studentId),
        inArray(
          storeRows.tableName,
          places.map((p) => p.table),
        ),
        isNotNull(storeRows.data),
      ),
    )
    .all();
  return rows
    .flatMap((row) => {
      const key = parseKey(row.key);
      if (key === null || cellOf(row.table, key) !== cell) return [];
      return [{ table: row.table, key, data: JSON.parse(row.data!) as unknown, editedAt: row.editedAt }];
    })
    .sort((a, b) => a.table.localeCompare(b.table) || a.key.localeCompare(b.key));
}
