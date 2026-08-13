import { describe, expect, it } from "vitest";

/**
 * The legacy-id migration renames rows from a directive's old id to its
 * current one. Its correctness turns on one thing: writing the new id to the
 * column each table actually keys on.
 *
 * Three tables do not key on `id` — `onlineide` and `sqlideScripts` use
 * `scriptId`, `sqlideDatabases` uses `databaseId`. Writing `id` on those puts
 * the row straight back where it was, and the delete that follows then
 * destroys the very reader work the migration exists to preserve.
 */

/** The schema string for each table, mirroring assets/store.js. */
const SCHEMA: Record<string, string> = {
  textinput: "id,text",
  pyide: "id,script",
  onlineide: "scriptId,script",
  sqlideScripts: "scriptId,script",
  sqlideDatabases: "databaseId,database",
};

/** The primary key Dexie derives from a schema string. */
const primaryKeyOf = (schema: string) => schema.split(",")[0].trim();

/** A stand-in for Dexie's inline-primary-key behaviour. */
class FakeTable {
  readonly rows = new Map<string, any>();
  constructor(readonly primaryKey: string) {}
  async get(key: string) {
    return this.rows.get(key);
  }
  async put(row: any) {
    // Dexie keys an inline-PK store on row[primaryKey], not on row.id.
    this.rows.set(row[this.primaryKey], row);
  }
  async delete(key: string) {
    this.rows.delete(key);
  }
}

/** The migration body from assets/store.js, with the fix applied. */
async function migrate(table: FakeTable, newId: string, oldId: string) {
  const primaryKey = table.primaryKey;
  const legacyRow = await table.get(oldId);
  if (legacyRow === undefined) return;
  if ((await table.get(newId)) !== undefined) return;
  await table.put({ ...legacyRow, [primaryKey]: newId });
  await table.delete(oldId);
}

describe("legacy id migration", () => {
  for (const [name, schema] of Object.entries(SCHEMA)) {
    const primaryKey = primaryKeyOf(schema);

    it(`moves a row to the new id in ${name} (keyed by ${primaryKey})`, async () => {
      const table = new FakeTable(primaryKey);
      await table.put({ [primaryKey]: "OLD", script: "reader's work" });

      await migrate(table, "NEW", "OLD");

      const moved = await table.get("NEW");
      expect(moved, "the row must exist under the new id").toBeDefined();
      expect(moved.script).toBe("reader's work");
      expect(await table.get("OLD")).toBeUndefined();
      expect(table.rows.size).toBe(1);
    });
  }

  it("writing the id field instead of the primary key destroys the row", async () => {
    // The behaviour this guards against, spelled out.
    const table = new FakeTable("scriptId");
    await table.put({ scriptId: "OLD", script: "reader's work" });

    const legacyRow = await table.get("OLD");
    await table.put({ ...legacyRow, id: "NEW" }); // lands back on scriptId=OLD
    await table.delete("OLD"); // ... and then removes it

    expect(table.rows.size).toBe(0);
  });

  it("keeps data already stored under the current id", async () => {
    const table = new FakeTable("id");
    await table.put({ id: "OLD", text: "before the upgrade" });
    await table.put({ id: "NEW", text: "written since the upgrade" });

    await migrate(table, "NEW", "OLD");

    expect((await table.get("NEW")).text).toBe("written since the upgrade");
  });
});
