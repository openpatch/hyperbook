/// <reference path="./hyperbook.types.js" />
var hyperbook = window.hyperbook = window.hyperbook || {};

/**
 * Converts rows saved by the single-file IDEs into the shared `ide` table.
 *
 * Kept apart from store.js so it is a plain function of a row: it runs inside
 * a Dexie upgrade transaction, where awaiting anything but IndexedDB commits
 * the transaction early, and the tests can run it without a database.
 *
 * The file names match the main files `hyperbook migrate` gives the
 * directives, so a converted row lands on the file the page now calls main.
 *
 * @memberof hyperbook
 */
hyperbook.storeIdeMigration = (function () {
  /** Legacy table → the file its editor held as the main file. */
  const LEGACY_IDE_TABLES = {
    pyide: "main.py",
    p5: "sketch.js",
    openscad: "main.scad",
    typst: "main.typ",
  };

  /** Split sizes the IDEs remembered next to the code. */
  const UI_FIELDS = [
    "splitHorizontal",
    "splitVertical",
    "splitCanvasOutput",
    "splitCanvasParams",
  ];

  const stripSlash = (path) => path.replace(/^\/+/, "");

  /** Files a reader uploaded, kept as the data URLs they were saved as. */
  const uploads = (binaryFiles) =>
    (Array.isArray(binaryFiles) ? binaryFiles : [])
      .filter(
        (file) =>
          file && typeof file.dest === "string" && typeof file.url === "string",
      )
      .map((file) => ({
        path: stripSlash(file.dest),
        url: file.url,
        created: true,
      }))
      .filter((file) => file.path);

  /**
   * The workspace files a legacy row held, main file first, or null when the
   * row holds no code.
   */
  const filesOf = (table, row, main) => {
    if (table === "pyide" && typeof row.script === "string") {
      return [{ path: main, content: row.script }];
    }
    if (table === "p5" && typeof row.sketch === "string") {
      return [{ path: main, content: row.sketch }];
    }
    if (table === "openscad" && typeof row.code === "string") {
      return [{ path: main, content: row.code }, ...uploads(row.binaryFiles)];
    }
    if (table === "typst") {
      const sources = (Array.isArray(row.sourceFiles) ? row.sourceFiles : [])
        .filter(
          (file) =>
            file &&
            typeof file.filename === "string" &&
            typeof file.content === "string",
        )
        .map((file) => ({
          path: stripSlash(file.filename),
          content: file.content,
        }));
      if (sources.length === 0) {
        if (typeof row.code !== "string") return null;
        sources.push({ path: main, content: row.code });
      }
      // Files the reader added were saved alongside the page's own.
      return [...sources, ...uploads(row.binaryFiles)];
    }
    return null;
  };

  /**
   * @param {string} table The legacy table the row comes from.
   * @param {Record<string, unknown>} row
   * @returns {import("./hyperbook.types.js").HyperbookIdeRow | null}
   *   The `ide` row, or null when the row holds nothing to keep.
   */
  const convertLegacyIdeRow = (table, row) => {
    const main = LEGACY_IDE_TABLES[table];
    if (!main || !row || typeof row.id !== "string") return null;

    const files = filesOf(table, row, main);
    if (!files) return null;

    const ui = {};
    for (const field of UI_FIELDS) {
      const value = row[field];
      if (Number.isFinite(value) && value > 0) ui[field] = Math.round(value);
    }

    const active =
      typeof row.currentFile === "string" &&
      files.some((file) => file.path === stripSlash(row.currentFile))
        ? stripSlash(row.currentFile)
        : files[0].path;

    return {
      id: row.id,
      runtime: table,
      migratedFrom: table,
      files,
      active,
      ui,
      ...(table === "openscad" && typeof row.params === "string"
        ? { extra: { params: row.params } }
        : {}),
    };
  };

  /**
   * Moves every row of the legacy IDE tables into `ide` and empties them.
   *
   * A row already in `ide` wins: the reader has used the new IDE since. Only
   * IndexedDB calls are awaited, so this is safe inside an upgrade.
   *
   * @param {(name: string) => import("dexie").Table} table Looks up a table
   *   of the current transaction or database.
   * @returns {Promise<void>}
   */
  const moveLegacyIdeRows = async (table) => {
    const ide = table("ide");
    for (const name of Object.keys(LEGACY_IDE_TABLES)) {
      const legacy = table(name);
      const rows = await legacy.toArray();
      for (const row of rows) {
        const converted = convertLegacyIdeRow(name, row);
        if (converted && (await ide.get(converted.id)) === undefined) {
          await ide.put(converted);
        }
      }
      await legacy.clear();
    }
  };

  return { LEGACY_IDE_TABLES, convertLegacyIdeRow, moveLegacyIdeRows };
})();
