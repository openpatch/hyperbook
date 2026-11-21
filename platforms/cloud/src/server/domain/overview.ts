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

const elementIndex = z.object({
  version: z.literal(1),
  pages: z.array(
    z.object({
      href: z.string(),
      title: z.string(),
      elements: z.array(z.object({ id: z.string(), name: z.string(), table: z.string() })),
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
  const known = new Set(index?.pages.flatMap((p) => p.elements.map((e) => cellId(e.table, e.id))) ?? []);
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
      let key: unknown;
      try {
        key = JSON.parse(row.key);
      } catch {
        key = null;
      }
      const id = typeof key === "string" ? cellId(row.table, key) : null;
      if (id && known.has(id)) student.cells[id] = row.editedAt;
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
