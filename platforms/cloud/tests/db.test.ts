import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { verifyPassword } from "../src/server/auth/password";
import { migrateDb, openDb } from "../src/server/db/client";
import { users } from "../src/server/db/schema";
import { ensureFirstAdmin } from "../src/server/db/seed";
import { setup } from "./helpers";

const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));

describe("migrateDb", () => {
  it("creates a fresh database without a backup, and does nothing the second time", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "hyperbook-cloud-db-"));
    const file = path.join(dir, "database.sqlite");
    const { db, sqlite } = openDb(file);
    const first = migrateDb(sqlite, db, { migrationsFolder, file });
    expect(first.applied).toBeGreaterThan(0);
    expect(first.backup).toBeNull();
    expect(migrateDb(sqlite, db, { migrationsFolder, file })).toEqual({
      applied: 0,
      backup: null,
    });
    sqlite.close();
  });
});

describe("ensureFirstAdmin", () => {
  it("creates the admin once and ignores later changes", async () => {
    const { db } = setup();
    expect(await ensureFirstAdmin(db, null)).toBe("missing");
    expect(
      await ensureFirstAdmin(db, { email: "root@example.org", password: "first password" }),
    ).toBe("created");
    expect(
      await ensureFirstAdmin(db, { email: "other@example.org", password: "second password" }),
    ).toBe("exists");
    const all = db.select().from(users).all();
    expect(all).toHaveLength(1);
    expect(all[0]!.role).toBe("admin");
    expect(await verifyPassword("first password", all[0]!.passwordHash)).toBe(true);
  });
});
