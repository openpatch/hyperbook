import { readFileSync } from "node:fs";
import path from "node:path";
import { and, asc, eq, inArray, isNotNull, isNull, max } from "drizzle-orm";
import { z } from "zod";
import type { Config } from "../config";
import type { Db } from "../db/client";
import { type books, storeHeads, storeRows, studentSessions, students } from "../db/schema";
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
      /** The sections the page is in, outermost first (newer builds). */
      sections: z.array(z.string()).optional(),
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

/**
 * The task each row of work in no element came from, as `table/id`. An
 * embedded IDE keeps its file list under the bare id and each file under id
 * + file name (and the SQL-IDE its database under URL + id); those rows
 * belong to the row under the bare id, so a removed IDE is one task, not
 * one per file. Every other row is a task of its own.
 */
export function orphanTasks(rows: { table: string; key: string }[]): string[] {
  const bare = rows.filter((r) => r.table === "onlineide" || r.table === "sqlideScripts");
  return rows.map((row) => {
    if (row.table === "onlineide" || row.table === "sqlideScripts") {
      const owner = bare
        .filter((b) => b.table === row.table && b.key !== row.key && row.key.startsWith(b.key))
        .sort((a, b) => b.key.length - a.key.length)[0];
      return cellId(row.table, (owner ?? row).key);
    }
    if (row.table === "sqlideDatabases") {
      const owner = bare
        .filter((b) => b.table === "sqlideScripts" && row.key.endsWith(b.key))
        .sort((a, b) => b.key.length - a.key.length)[0];
      if (owner) return cellId(owner.table, owner.key);
    }
    return cellId(row.table, row.key);
  });
}

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
  // A build never changes once finished, so its index is read once. A big
  // book's index (hundreds of pages) would otherwise be parsed on every
  // refresh of every open overview.
  const cacheKey = `${config.dataDir}\0${book.id}\0${book.publishedBuildId}`;
  if (indexCache.has(cacheKey)) return indexCache.get(cacheKey)!;
  let index: ElementIndex | null = null;
  try {
    const file = path.join(buildDir(config, book.id, book.publishedBuildId), "_hyperbook", "elements.json");
    index = parseElementIndex(JSON.parse(readFileSync(file, "utf8")));
  } catch (error) {
    // Only a build without an index (older Hyperbook) is remembered as such;
    // a passing error (too many open files, a restore) is tried again.
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") return null;
    index = null;
  }
  if (indexCache.size >= INDEX_CACHE_SIZE) indexCache.delete(indexCache.keys().next().value!);
  indexCache.set(cacheKey, index);
  return index;
}

/**
 * Reads an index leniently: an element or page this platform does not
 * understand (a newer Hyperbook, a hand-edited file) is left out instead of
 * dropping the whole index, and pages without tasks are skipped.
 */
export function parseElementIndex(raw: unknown): ElementIndex | null {
  const pages = (raw as { pages?: unknown })?.pages;
  if (!Array.isArray(pages)) return null;
  const page = elementIndex.shape.pages.element.omit({ elements: true });
  return {
    version: 1,
    pages: pages.flatMap((p) => {
      const head = page.safeParse(p);
      const raw = (p as { elements?: unknown })?.elements;
      if (!head.success || !Array.isArray(raw)) return [];
      const elements = raw.flatMap((e) => {
        const parsed = element.safeParse(e);
        return parsed.success ? [parsed.data] : [];
      });
      return elements.length > 0 ? [{ ...head.data, elements }] : [];
    }),
  };
}

const INDEX_CACHE_SIZE = 50;
const indexCache = new Map<string, ElementIndex | null>();

/** What the teacher chose to look at: a section, and only pages with work. */
export type OverviewView = { section?: string[]; worked?: boolean };

/**
 * The overview narrowed to a section (pages whose sections start with
 * `section`) and, with `worked`, to pages at least one student worked on.
 */
export function viewOf(overview: ReturnType<typeof groupOverview>, view: OverviewView) {
  const section = view.section ?? [];
  const pages = overview.pages.filter((page) => {
    const sections = page.sections ?? [];
    if (!section.every((name, i) => sections[i] === name)) return false;
    if (!view.worked) return true;
    return page.elements.some((e) => overview.students.some((s) => cellId(e.table, e.id) in s.cells));
  });
  return { ...overview, pages };
}

export type OverviewStudent = {
  id: number;
  username: string;
  lastLoginAt: number | null;
  /**
   * When the student was last in the book: a request of one of their own
   * sessions (kept to the minute) or their last upload, whichever is later.
   */
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
): { indexed: boolean; buildId: number | null; pages: ElementIndex["pages"]; students: OverviewStudent[] } {
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
    const orphans = new Map<number, { table: string; key: string }[]>();
    for (const row of rows) {
      if (UI_TABLES.has(row.table)) continue;
      const student = result.get(row.studentId)!;
      const key = parseKey(row.key);
      const cell = key === null ? null : cellOf(row.table, key);
      // An element with several rows counts once, at its latest change.
      if (cell) student.cells[cell] = Math.max(student.cells[cell] ?? 0, row.editedAt);
      else orphans.set(row.studentId, [...(orphans.get(row.studentId) ?? []), { table: row.table, key: key ?? row.key }]);
    }
    // Other counts tasks, like Worked on, not saved rows.
    for (const [studentId, list] of orphans) result.get(studentId)!.elsewhere = new Set(orphanTasks(list)).size;
    const seen = db
      .select({ studentId: studentSessions.studentId, at: max(studentSessions.lastSeenAt) })
      .from(studentSessions)
      // A teacher viewing the student's work is not the student being online.
      .where(and(inArray(studentSessions.studentId, ids), isNull(studentSessions.impersonatedBy)))
      .groupBy(studentSessions.studentId)
      .all();
    const ms = (at: unknown) => (at instanceof Date ? at.getTime() : typeof at === "number" ? at : null);
    const later = (student: OverviewStudent, at: number | null) => {
      if (at !== null && (student.lastSeenAt === null || at > student.lastSeenAt)) student.lastSeenAt = at;
    };
    for (const s of seen) later(result.get(s.studentId)!, ms(s.at));
    const uploads = db
      .select({ studentId: storeHeads.studentId, at: storeHeads.updatedAt })
      .from(storeHeads)
      .where(inArray(storeHeads.studentId, ids))
      .all();
    for (const u of uploads) later(result.get(u.studentId)!, ms(u.at));
  }
  return {
    indexed: index !== null,
    // The live version the pages come from: a client that has them already
    // can ask without them (?known=<buildId>).
    buildId: index ? book.publishedBuildId : null,
    pages: index?.pages ?? [],
    students: [...result.values()],
  };
}

/**
 * One CSV cell: quoted when needed, and text a spreadsheet would run as a
 * formula (=, +, -, @, tab, CR at the start; a page title, a username) gets a
 * leading ' (OWASP's advice against CSV injection).
 */
const csvCell = (value: string) => {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

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

/**
 * A student's saved work that belongs to no task of the live version: tasks
 * removed since, or changed without an `id=` (their id came from their
 * content). UI state is left out, as in the overview.
 */
export function elsewhereRows(db: Db, config: Config, book: typeof books.$inferSelect, studentId: number) {
  const cellOf = rowMatcher(readElementIndex(config, book)?.pages ?? []);
  const rows = db
    .select({ table: storeRows.tableName, key: storeRows.key, data: storeRows.data, editedAt: storeRows.editedAt })
    .from(storeRows)
    .where(and(eq(storeRows.studentId, studentId), isNotNull(storeRows.data)))
    .all()
    .flatMap((row) => {
      if (UI_TABLES.has(row.table)) return [];
      const key = parseKey(row.key);
      if (key !== null && cellOf(row.table, key)) return [];
      return [{ table: row.table, key: key ?? row.key, data: JSON.parse(row.data!) as unknown, editedAt: row.editedAt }];
    });
  // Each row with the task it came from (`task`: table/id), so the dialog
  // can show one entry, and one id to give back, per task.
  const tasks = orphanTasks(rows);
  return rows
    .map((row, i) => ({ ...row, task: tasks[i]! }))
    .sort((a, b) => a.task.localeCompare(b.task) || a.key.localeCompare(b.key));
}

/** A task of the live version that a newer save no longer has, and who worked in it. */
export type LeftBehind = { href: string; title: string; name: string; table: string; id: string; students: number };

/**
 * The tasks of the live version that `pages` (a newer save, from its check)
 * no longer has, which students saved work in: removed, or changed without
 * an `id` (their id came from their content). Publishing that save would
 * leave the work without its task; giving a changed task its old id keeps it.
 */
export function workLeftBehind(
  db: Db,
  config: Config,
  book: typeof books.$inferSelect,
  pages: { elements: IndexedElement[] }[],
  /** Pages that failed to render: what is on them now is unknown, so their tasks are not counted as gone. */
  unchecked: string[] = [],
): LeftBehind[] {
  const live = readElementIndex(config, book);
  if (!live) return [];
  const next = new Set(pages.flatMap((p) => p.elements.map((e) => cellId(e.table, e.id))));
  const skip = new Set(unchecked);
  const gone = live.pages.filter((page) => !skip.has(page.href)).flatMap((page) =>
    page.elements.filter((e) => !next.has(cellId(e.table, e.id))).map((e) => ({ page, e })),
  );
  if (gone.length === 0) return [];
  const who = new Map(gone.map(({ e }) => [cellId(e.table, e.id), new Set<number>()]));
  const cellOf = rowMatcher(live.pages);
  const rows = db
    .select({ studentId: storeRows.studentId, table: storeRows.tableName, key: storeRows.key })
    .from(storeRows)
    .innerJoin(students, eq(students.id, storeRows.studentId))
    .where(and(eq(students.bookId, book.id), isNotNull(storeRows.data)))
    .all();
  for (const row of rows) {
    const key = parseKey(row.key);
    const cell = key === null ? null : cellOf(row.table, key);
    if (cell) who.get(cell)?.add(row.studentId);
  }
  return gone.flatMap(({ page, e }) => {
    const students = who.get(cellId(e.table, e.id))!.size;
    return students === 0 ? [] : [{ href: page.href, title: page.title, name: e.name, table: e.table, id: e.id, students }];
  });
}

/**
 * The address of a page file of the check ("book/a/index.md" → "/a",
 * "glossary/term.md" → "/glossary/term"), as the index names pages.
 */
export function hrefOfPageFile(file: string): string {
  const glossary = file.startsWith("glossary/");
  const rest = file.replace(/^(book|glossary)\//, "").replace(/\.md(\.(hbs|json|yml))?$/, "");
  const parts = rest.split("/").filter((p, i, all) => !(i === all.length - 1 && p === "index"));
  const href = "/" + [...(glossary ? ["glossary"] : []), ...parts].join("/");
  return href.length > 1 ? href.replace(/\/$/, "") : "/";
}
